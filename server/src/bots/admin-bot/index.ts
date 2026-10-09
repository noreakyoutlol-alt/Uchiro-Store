import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { DataStore } from '../../database/data-store';
import { AdminService } from '../../services/admin.service';
import { BroadcastService } from '../../services/broadcast.service';
import { formatTelegramHtml, createWebAppOrUrlButton, createEmojiInlineButton } from '../store-bot';
import { renderTgEmoji } from '../../config/telegram-emojis';
import { formatShortOrderId } from '../../utils/order.util';

export { createWebAppOrUrlButton };

export const ADMIN_BOT_DEFAULT_USERNAME = 'uchiro_v2_admin_bot';
export const ADMIN_BOT_DISPLAY_NAME = 'uchiro_v2_admin_bot';
export const ADMIN_BOT_USERNAME = ADMIN_BOT_DEFAULT_USERNAME;

/**
 * Returns the resolved Admin Bot username (without leading '@').
 * Dynamic lookup: env.ADMIN_BOT_USERNAME || process.env.ADMIN_BOT_USERNAME || 'uchiro_v2_admin_bot'.
 */
export function getAdminBotUsername(): string {
  const raw = process.env.ADMIN_BOT_USERNAME || env.ADMIN_BOT_USERNAME || ADMIN_BOT_DEFAULT_USERNAME;
  return raw.replace(/^@/, '').trim();
}

/**
 * Generates dynamic deep links to the Admin Telegram Bot.
 * e.g. https://t.me/uchiro_v2_admin_bot or https://t.me/uchiro_v2_admin_bot?start=panel
 */
export function getAdminBotLink(startParam?: string): string {
  const username = getAdminBotUsername();
  if (startParam) {
    return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}`;
}

export const getAdminBotUrl = getAdminBotLink;

export function getAdminKeyboard(adminWebAppUrl: string) {
  return Markup.inlineKeyboard([
    [
      createEmojiInlineButton({
        text: 'OPEN ADMIN PORTAL',
        emojiKey: 'SHIELD',
        targetUrl: adminWebAppUrl,
      }),
    ],
    [
      createEmojiInlineButton({
        text: 'Real-Time Metrics',
        emojiKey: 'BAR_CHART',
        callbackData: 'admin_metrics',
      }),
      createEmojiInlineButton({
        text: 'Live Inventory',
        emojiKey: 'PACKAGE',
        callbackData: 'admin_inventory',
      }),
    ],
    [
      createEmojiInlineButton({
        text: 'Create Broadcast',
        emojiKey: 'MEGAPHONE',
        callbackData: 'admin_broadcast',
      }),
      createEmojiInlineButton({
        text: 'Store Settings',
        emojiKey: 'WRENCH',
        callbackData: 'admin_settings',
      }),
    ],
  ]);
}

export class AdminBotService {
  private bot: Telegraf | null = null;
  private token: string = '';

  constructor() {
    this.initBot();
  }

  private initBot(): void {
    const rawToken = (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();
    this.token = rawToken;
    if (this.token && !this.token.startsWith('mock_')) {
      if (!this.bot) {
        this.bot = new Telegraf(this.token);
        this.setupHandlers();
      }
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    const adminWebAppUrl = env.ADMIN_WEBAPP_URL || env.CLIENT_ADMIN_URL || 'http://localhost:3001';

    // Security middleware: Ensure caller is authorized admin
    this.bot.use(async (ctx, next) => {
      const fromId = ctx.from?.id;
      if (!fromId) return;

      const adminIds = env.ADMIN_TELEGRAM_USER_IDS;
      if (adminIds.length > 0 && !adminIds.includes(fromId)) {
        console.warn(`[SECURITY] Unauthorized access attempt to Admin Bot by Telegram ID: ${fromId}`);
        await ctx.reply('⛔ <b>ACCESS DENIED:</b> You are not an authorized Uchiro Store administrator.', {
          parse_mode: 'HTML',
        });
        return;
      }

      return next();
    });

    // /start and /admin command: Interactive zero-fakes dashboard
    this.bot.command(['start', 'admin'], async (ctx) => {
      const stats = AdminService.getDashboardStats();
      const inventory = DataStore.getInventoryList();
      const availableInventory = inventory.filter((i) => i.status === 'available').length;
      const shield = renderTgEmoji('SHIELD');
      const pkg = renderTgEmoji('PACKAGE');

      const message =
        `${shield} <b>UCHIRO STORE ADMIN CONTROL</b> ${shield}\n\n` +
        `• <b>Verified Revenue:</b> <b>$${stats.revenue.toFixed(2)} USD</b>\n` +
        `• <b>Paid Transactions:</b> <b>${stats.paid_orders}</b> (${stats.total_orders} total)\n` +
        `• <b>Catalog Products:</b> <b>${stats.active_products}</b>\n` +
        `• <b>Available Vault Units:</b> <b>${availableInventory}</b>\n` +
        `• <b>Pending Claims:</b> <b>${stats.pending_claims_count}</b>\n\n` +
        `Select an action below or open the admin portal:`;

      await ctx.reply(formatTelegramHtml(message), {
        parse_mode: 'HTML',
        ...getAdminKeyboard(adminWebAppUrl),
      });
    });

    // /metrics command
    this.bot.command(['metrics', 'stats'], async (ctx) => {
      const stats = AdminService.getDashboardStats();
      const text =
        `📊 <b>REAL-TIME STORE METRICS</b>\n\n` +
        `• <b>Verified Revenue:</b> $${stats.revenue.toFixed(2)} USD\n` +
        `• <b>Paid Orders:</b> ${stats.paid_orders}\n` +
        `• <b>Total Orders:</b> ${stats.total_orders}\n` +
        `• <b>Active Products:</b> ${stats.active_products}\n` +
        `• <b>Pending Claims:</b> ${stats.pending_claims_count}\n` +
        `• <b>Low Stock Alerts:</b> ${stats.low_stock_count}`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🛡️ OPEN ADMIN PORTAL', adminWebAppUrl)],
        ]),
      });
    });

    // /orders command
    this.bot.command('orders', async (ctx) => {
      const orders = DataStore.getAllOrdersAdmin().slice(0, 5);
      if (orders.length === 0) {
        await ctx.reply('No orders found in database.');
        return;
      }

      const pkg = renderTgEmoji('PACKAGE');
      let text = `${pkg} <b>LATEST REAL ORDERS:</b>\n\n`;
      orders.forEach((o) => {
        text += `• <b>${formatShortOrderId(o.order_number || o.id)}</b> | $${o.total_amount.toFixed(2)} | Status: <code>${o.status}</code>\n`;
      });

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🔎 MANAGE ALL ORDERS', `${adminWebAppUrl}/orders`)],
        ]),
      });
    });

    // /inventory command
    this.bot.command('inventory', async (ctx) => {
      const items = DataStore.getInventoryList();
      const available = items.filter((i) => i.status === 'available').length;
      const reserved = items.filter((i) => i.status === 'reserved').length;
      const consumed = items.filter((i) => i.status === 'consumed').length;

      const pkg = renderTgEmoji('PACKAGE');
      const text =
        `${pkg} <b>LIVE INVENTORY SUMMARY:</b>\n\n` +
        `• Available Items: <b>${available}</b>\n` +
        `• Reserved Items: <b>${reserved}</b>\n` +
        `• Consumed Items: <b>${consumed}</b>\n` +
        `• Total Tracked: <b>${items.length}</b>`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📦 MANAGE INVENTORY', `${adminWebAppUrl}/inventory`)],
        ]),
      });
    });

    // /claims command
    this.bot.command('claims', async (ctx) => {
      const claims = DataStore.getPendingClaimsAdmin();
      if (claims.length === 0) {
        const success = renderTgEmoji('SUCCESS');
        await ctx.reply(`${success} No pending claims awaiting review.`);
        return;
      }

      let text = `🎁 <b>PENDING CLAIMS (${claims.length}):</b>\n\n`;
      claims.slice(0, 5).forEach((c) => {
        text += `• Claim <code>#${c.id.slice(0, 8)}</code> | Customer TG: <code>${c.telegram_id}</code>\n`;
      });

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🎁 REVIEW CLAIMS', `${adminWebAppUrl}/claims`)],
        ]),
      });
    });

    // /broadcast command
    this.bot.command('broadcast', async (ctx) => {
      const text = ctx.message.text.replace('/broadcast', '').trim();
      if (!text) {
        await ctx.reply(
          `Usage: <code>/broadcast Your announcement message here</code>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const result = await AdminService.broadcastMessage(ctx.from.id, text);
      await ctx.reply(
        formatTelegramHtml(
          `📢 <b>BROADCAST COMPLETED</b>\n\nDelivered to ${result.sent} of ${result.total} customers.`
        ),
        { parse_mode: 'HTML' }
      );
    });

    // Interactive Button Callbacks
    this.bot.action('admin_metrics', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const stats = AdminService.getDashboardStats();
      const text =
        `📊 <b>REAL-TIME STORE METRICS</b>\n\n` +
        `• <b>Verified Revenue:</b> $${stats.revenue.toFixed(2)} USD\n` +
        `• <b>Paid Transactions:</b> ${stats.paid_orders}\n` +
        `• <b>Total Orders:</b> ${stats.total_orders}\n` +
        `• <b>Active Catalog Items:</b> ${stats.active_products}\n` +
        `• <b>Pending Claims:</b> ${stats.pending_claims_count}\n` +
        `• <b>Low Stock Alerts:</b> ${stats.low_stock_count}`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🛡️ OPEN ADMIN PORTAL', adminWebAppUrl)],
        ]),
      });
    });

    this.bot.action('admin_inventory', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const items = DataStore.getInventoryList();
      const available = items.filter((i) => i.status === 'available').length;
      const reserved = items.filter((i) => i.status === 'reserved').length;
      const consumed = items.filter((i) => i.status === 'consumed').length;

      const text =
        `📦 <b>LIVE INVENTORY STATUS</b>\n\n` +
        `• <b>Available Vault Units:</b> ${available}\n` +
        `• <b>Currently Reserved:</b> ${reserved}\n` +
        `• <b>Consumed / Fulfilled:</b> ${consumed}\n` +
        `• <b>Total Vault Items:</b> ${items.length}`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📦 MANAGE LIVE INVENTORY', `${adminWebAppUrl}/inventory`)],
        ]),
      });
    });

    this.bot.action('admin_broadcast', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const text =
        `📢 <b>CREATE BROADCAST ANNOUNCEMENT</b>\n\n` +
        `To broadcast a stock arrival with the <b>⚡ Buy Now</b> button:\n\n` +
        `• Use Command: <code>/broadcast Your announcement text</code>\n` +
        `• Or trigger via Admin API: <code>POST /api/admin/broadcast/send</code>\n` +
        `• Outbound speed is automatically rate-limited to 25 msgs/sec to avoid Telegram 429 limits.`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📢 OPEN BROADCAST PORTAL', `${adminWebAppUrl}/broadcast`)],
        ]),
      });
    });

    this.bot.action('admin_settings', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const settings = DataStore.getStoreSettings();
      const text =
        `⚙️ <b>STORE & BOT SETTINGS</b>\n\n` +
        `• <b>Environment:</b> <code>${env.NODE_ENV.toUpperCase()}</code>\n` +
        `• <b>KHPay / KHQR Gateway:</b> Operational\n` +
        `• <b>Points Per Dollar:</b> ${settings.points_per_dollar || 10} pts\n` +
        `• <b>Gacha Ticket Cost:</b> ${settings.gacha_ticket_points_cost || 100} pts\n` +
        `• <b>Default Warranty:</b> 14 Days Guaranteed\n` +
        `• <b>Broadcast Throttle:</b> Max 25 msg/s enforced`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('⚙️ OPEN STORE SETTINGS', `${adminWebAppUrl}/settings`)],
        ]),
      });
    });

    this.bot.catch((err: any, ctx) => {
      console.error(`[ADMIN BOT ERROR] for ${ctx.updateType}:`, err);
    });
  }

  public getBot(): Telegraf | null {
    return this.bot;
  }

  public getDisplayName(): string {
    return ADMIN_BOT_DISPLAY_NAME;
  }

  public getUsername(): string {
    return getAdminBotUsername();
  }

  public getBotLink(startParam?: string): string {
    return getAdminBotLink(startParam);
  }

  public async startPolling(): Promise<void> {
    if (!this.bot) {
      this.initBot();
    }
    if (!this.bot) {
      console.log('🛡️ [ADMIN BOT] Polling disabled (no token provided). Simulated mode active.');
      return;
    }
    try {
      await this.bot.launch();
      console.log(`✅ [ADMIN BOT] Running and listening for authorized admins (@${getAdminBotUsername()})...`);
    } catch (err: any) {
      console.warn('⚠️ [ADMIN BOT] Polling launch warning:', err.message);
    }
  }

  public async handleWebhookUpdate(update: any): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.handleUpdate(update);
      } catch (err: any) {
        console.error('[ADMIN BOT] Error processing update:', err);
      }
    }
  }

  public async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      return { configured: false, error: 'No bot token configured' };
    }
    try {
      return await this.bot.telegram.getWebhookInfo();
    } catch (err: any) {
      return { configured: true, error: err.message };
    }
  }

  public async setWebhook(url: string, secret?: string): Promise<{ success: boolean; message?: string }> {
    if (!this.bot) {
      return { success: false, message: 'No bot token configured' };
    }
    try {
      await this.bot.telegram.setWebhook(url, secret ? { secret_token: secret } : undefined);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteWebhook(): Promise<{ success: boolean; message?: string }> {
    if (!this.bot) {
      return { success: false, message: 'No bot token configured' };
    }
    try {
      await this.bot.telegram.deleteWebhook();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }
}

export const adminBot = new AdminBotService();
