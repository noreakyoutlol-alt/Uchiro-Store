import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { DataStore } from '../../database/data-store';
import { AdminService } from '../../services/admin.service';
import { OrderService } from '../../services/order.service';
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

export function getAdminKeyboard(adminWebAppUrl?: string, lang: string = 'en') {
  const isKm = lang === 'km';
  const adminUrl =
    adminWebAppUrl ||
    `${(process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '')}/admin/`;
  return Markup.inlineKeyboard([
    [
      createEmojiInlineButton({
        text: isKm ? '🛡️ បើកផ្ទាំងគ្រប់គ្រង ADMIN (Portal)' : 'OPEN ADMIN PORTAL',
        emojiKey: 'SHIELD',
        targetUrl: adminUrl,
      }),
    ],
    [
      createEmojiInlineButton({
        text: isKm ? '📊 ស្ថិតិចំណូលផ្ទាល់ (Metrics)' : 'Real-Time Metrics',
        emojiKey: 'BAR_CHART',
        callbackData: 'admin_metrics',
      }),
      createEmojiInlineButton({
        text: isKm ? '📦 ស្តុកទំនិញក្នុងឃ្លាំង (Inventory)' : 'Live Inventory',
        emojiKey: 'PACKAGE',
        callbackData: 'admin_inventory',
      }),
    ],
    [
      createEmojiInlineButton({
        text: isKm ? '📢 ផ្ញើសារផ្សព្វផ្សាយ (Broadcast)' : 'Create Broadcast',
        emojiKey: 'MEGAPHONE',
        callbackData: 'admin_broadcast',
      }),
      createEmojiInlineButton({
        text: isKm ? '⚙️ ការកំណត់ហាង (Settings)' : 'Store Settings',
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

    const adminUrl = `${(process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '')}/admin/`;
    const adminWebAppUrl = adminUrl;

    // Set Telegram chat menu button for the admin bot to strictly open the Admin Portal Mini App
    try {
      this.bot.telegram.setChatMenuButton({
        menuButton: {
          type: 'web_app',
          text: 'ផ្ទាំងគ្រប់គ្រង Admin',
          web_app: { url: adminUrl },
        },
      }).catch(() => {});
    } catch {
      // Safe fallback if offline or mock token
    }

    // Security middleware: Ensure caller is authorized admin
    this.bot.use(async (ctx, next) => {
      const fromId = ctx.from?.id;
      if (!fromId) return;

      const adminIds = env.ADMIN_TELEGRAM_USER_IDS;
      if (adminIds.length > 0 && !adminIds.includes(fromId)) {
        console.warn(`[SECURITY] Unauthorized access attempt to Admin Bot by Telegram ID: ${fromId}`);
        await ctx.reply('⛔ <b>ការចូលត្រូវបានបដិសេធ:</b> អ្នកមិនមែនជាអ្នកគ្រប់គ្រងផ្លូវការរបស់ Uchiro Store ទេ។', {
          parse_mode: 'HTML',
        });
        return;
      }

      return next();
    });

    // /start and /admin command: Interactive zero-fakes dashboard (Specification 2: 100% Khmer)
    this.bot.command(['start', 'admin'], async (ctx) => {
      const stats = AdminService.getDashboardStats();
      const inventory = DataStore.getInventoryList();
      const availableInventory = inventory.filter((i) => i.status === 'available').length;
      const shield = renderTgEmoji('SHIELD');

      const message =
        `${shield} <b>ផ្ទាំងគ្រប់គ្រងរដ្ឋបាល UCHIRO STORE</b> ${shield}\n\n` +
        `• <b>ប្រាក់ចំណូលផ្ទៀងផ្ទាត់:</b> <b>$${stats.revenue.toFixed(2)} USD</b>\n` +
        `• <b>ប្រតិបត្តិការបានទូទាត់:</b> <b>${stats.paid_orders}</b> (${stats.total_orders} សរុប)\n` +
        `• <b>ទំនិញក្នុងស្តុក:</b> <b>${stats.active_products}</b>\n` +
        `• <b>គណនីក្នុងឃ្លាំងសុវត្ថិភាព:</b> <b>${availableInventory} គណនី</b>\n` +
        `• <b>ការស្នើសុំកំពុងរង់ចាំ:</b> <b>${stats.pending_claims_count}</b>\n` +
        `• <b>ទំនិញជិតអស់ពីស្តុក:</b> <b>${stats.low_stock_count}</b>\n\n` +
        `សូមជ្រើសរើសមុខងារខាងក្រោម ឬបើកផ្ទាំងគ្រប់គ្រង Admin:`;

      await ctx.reply(formatTelegramHtml(message), {
        parse_mode: 'HTML',
        ...getAdminKeyboard(adminWebAppUrl),
      });
    });

    // /metrics command
    this.bot.command(['metrics', 'stats'], async (ctx) => {
      const stats = AdminService.getDashboardStats();
      const text =
        `📊 <b>ស្ថិតិទិន្នន័យផ្សារ UCHIRO STORE</b>\n\n` +
        `• <b>ប្រាក់ចំណូលសរុប:</b> <b>$${stats.revenue.toFixed(2)} USD</b>\n` +
        `• <b>ការទូទាត់ជោគជ័យ:</b> <b>${stats.paid_orders}</b>\n` +
        `• <b>ការបញ្ជាទិញសរុប:</b> <b>${stats.total_orders}</b>\n` +
        `• <b>ទំនិញសកម្ម:</b> <b>${stats.active_products}</b>\n` +
        `• <b>ការស្នើសុំរង្វាន់:</b> <b>${stats.pending_claims_count}</b>\n` +
        `• <b>ទំនិញខ្វះស្តុក:</b> <b>${stats.low_stock_count}</b>`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🛡️ បើក ADMIN PORTAL', adminWebAppUrl)],
        ]),
      });
    });

    // /orders command
    this.bot.command('orders', async (ctx) => {
      const orders = DataStore.getAllOrdersAdmin().slice(0, 5);
      if (orders.length === 0) {
        await ctx.reply('មិនមានការបញ្ជាទិញក្នុងប្រព័ន្ធនៅឡើយទេ។');
        return;
      }

      const pkg = renderTgEmoji('PACKAGE');
      let text = `${pkg} <b>ការបញ្ជាទិញថ្មីៗ (${orders.length}):</b>\n\n`;
      orders.forEach((o) => {
        text += `• #${o.order_number || o.id.slice(0, 8)} | $${o.total_amount.toFixed(2)} | <b>${o.status}</b>\n`;
      });

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📜 គ្រប់គ្រងការបញ្ជាទិញ', `${adminWebAppUrl}orders`)],
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
        `${pkg} <b>របាយការណ៍ស្តុកទំនិញជាក់ស្តែង:</b>\n\n` +
        `• គណនីទំនេរក្នុងស្តុក: <b>${available}</b>\n` +
        `• គណនីកំពុងកក់ទុក: <b>${reserved}</b>\n` +
        `• គណនីបានប្រគល់ជូន: <b>${consumed}</b>\n` +
        `• ទំនិញសរុបក្នុងឃ្លាំង: <b>${items.length}</b>`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📦 គ្រប់គ្រងស្តុកទំនិញ', `${adminWebAppUrl}inventory`)],
        ]),
      });
    });

    // /claims command
    this.bot.command('claims', async (ctx) => {
      const claims = DataStore.getPendingClaimsAdmin();
      if (claims.length === 0) {
        const success = renderTgEmoji('SUCCESS');
        await ctx.reply(`${success} មិនមានការស្នើសុំរង្វាន់ដែលកំពុងរង់ចាំពិនិត្យទេ។`);
        return;
      }

      let text = `🎁 <b>ការស្នើសុំរង្វាន់កំពុងរង់ចាំ (${claims.length}):</b>\n\n`;
      claims.slice(0, 5).forEach((c) => {
        text += `• សំណើ <code>#${c.id.slice(0, 8)}</code> | Customer TG: <code>${c.telegram_id}</code>\n`;
      });

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🎁 ពិនិត្យការស្នើសុំរង្វាន់', `${adminWebAppUrl}claims`)],
        ]),
      });
    });

    // /broadcast command
    this.bot.command('broadcast', async (ctx) => {
      const text = ctx.message.text.replace('/broadcast', '').trim();
      if (!text) {
        await ctx.reply(
          `របៀបប្រើប្រាស់: <code>/broadcast ខ្លឹមសារសារផ្សព្វផ្សាយនៅទីនេះ</code>`,
          { parse_mode: 'HTML' }
        );
        return;
      }

      const result = await AdminService.broadcastMessage(ctx.from.id, text);
      await ctx.reply(
        formatTelegramHtml(
          `📢 <b>ការផ្សព្វផ្សាយបានបញ្ចប់</b>\n\nបានផ្ញើជូន ${result.sent} នាក់ នៃអតិថិជនសរុប ${result.total} នាក់។`
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
        `📊 <b>ស្ថិតិទិន្នន័យចំណូលជាក់ស្តែង</b>\n\n` +
        `• <b>ប្រាក់ចំណូលសរុប:</b> <b>$${stats.revenue.toFixed(2)} USD</b>\n` +
        `• <b>ការទូទាត់បានសម្រេច:</b> <b>${stats.paid_orders}</b>\n` +
        `• <b>ការបញ្ជាទិញសរុប:</b> <b>${stats.total_orders}</b>\n` +
        `• <b>ទំនិញសកម្មក្នុងហាង:</b> <b>${stats.active_products}</b>\n` +
        `• <b>ការស្នើសុំរង្វាន់:</b> <b>${stats.pending_claims_count}</b>\n` +
        `• <b>ទំនិញខ្វះស្តុក:</b> <b>${stats.low_stock_count}</b>`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('🛡️ បើក ADMIN PORTAL', adminWebAppUrl)],
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
        `📦 <b>របាយការណ៍ស្តុកទំនិញក្នុងឃ្លាំង</b>\n\n` +
        `• <b>គណនីទំនេរអាចលក់បាន:</b> <b>${available}</b>\n` +
        `• <b>គណនីកំពុងកក់ទុក:</b> <b>${reserved}</b>\n` +
        `• <b>គណនីបានប្រគល់ជូន:</b> <b>${consumed}</b>\n` +
        `• <b>គណនីសរុបក្នុងឃ្លាំង:</b> <b>${items.length}</b>`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📦 គ្រប់គ្រងស្តុកទំនិញ', `${adminWebAppUrl}inventory`)],
        ]),
      });
    });

    this.bot.action('admin_broadcast', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const text =
        `📢 <b>បង្កើតសារផ្សព្វផ្សាយថ្មី (Broadcast)</b>\n\n` +
        `ដើម្បីផ្សព្វផ្សាយទំនិញចូលថ្មីដែលមានប៊ូតុង <b>⚡ Buy Now</b>:\n\n` +
        `• ប្រើពាក្យបញ្ជា: <code>/broadcast ខ្លឹមសារសាររបស់អ្នក</code>\n` +
        `• ឬប្រើប្រាស់ផ្ទាំងគ្រប់គ្រង Admin Portal\n` +
        `• ប្រព័ន្ធកំណត់ល្បឿនស្វ័យប្រវត្តិ 25 សារ/វិនាទី ដើម្បីការពារការជាប់ Telegram Rate Limit។`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('📢 បើកផ្ទាំងផ្សព្វផ្សាយ', `${adminWebAppUrl}broadcast`)],
        ]),
      });
    });

    this.bot.action('admin_settings', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const settings = DataStore.getStoreSettings();
      const text =
        `⚙️ <b>ការកំណត់ហាង និង BOT</b>\n\n` +
        `• <b>បរិស្ថានដំណើរការ:</b> <code>${env.NODE_ENV.toUpperCase()}</code>\n` +
        `• <b>ច្រកទូទាត់ KHPay / KHQR:</b> ដំណើរការធម្មតា\n` +
        `• <b>ពិន្ទុរង្វាន់ក្នុង $1:</b> ${settings.points_per_dollar || 10} ពិន្ទុ\n` +
        `• <b>តម្លៃសំបុត្រ Gacha:</b> ${settings.gacha_ticket_points_cost || 100} ពិន្ទុ\n` +
        `• <b>ការធានាដើម:</b> ១៤ ថ្ងៃពេញ\n` +
        `• <b>ល្បឿនផ្សព្វផ្សាយ:</b> អតិបរមា 25 សារ/វិនាទី`;

      await ctx.reply(formatTelegramHtml(text), {
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [createWebAppOrUrlButton('⚙️ ការកំណត់ប្រព័ន្ធបន្ថែម', `${adminWebAppUrl}settings`)],
        ]),
      });
    });

    // Specification 6: Admin instant manual fulfillment for late/expired QR payments
    this.bot.action(/^admin_fulfill_expired:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery('កំពុងប្រគល់ទំនិញជូនអតិថិជន...');
      } catch {}

      const orderId = ctx.match[1];
      try {
        await OrderService.processPaymentSuccess(orderId, 'ADMIN_EXPIRED_QR_OVERRIDE');
        await ctx.reply(
          `✅ <b>បានបញ្ជាក់ និងប្រគល់ទំនិញជោគជ័យ!</b>\n` +
          `Order ID: <code>${orderId}</code> ត្រូវបានប្រគល់ជូនអតិថិជនរួចរាល់ហើយ។`,
          { parse_mode: 'HTML' }
        );
      } catch (err: any) {
        await ctx.reply(
          `❌ <b>បរាជ័យក្នុងការប្រគល់ទំនិញ:</b> ${err.message || 'Error occurred'}`,
          { parse_mode: 'HTML' }
        );
      }
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
