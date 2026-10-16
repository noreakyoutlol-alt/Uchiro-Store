import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { handleAdminStart, handleAdminCallback, isMessageNotModifiedError } from './admin-actions';
import { TELEGRAM_EMOJIS } from '../../config/telegram-emojis';
import { applyTelegramOutboundGuard } from '../telegram-guard';
import { RobuxService } from '../../services/robux.service';

export function isAuthorizedAdmin(telegramId: string | number): boolean {
  const id = String(telegramId).trim();
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_USER_IDS || '').split(',').map(s => s.trim());
  return envAdmins.includes(id);
}

const token = (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();

export type AdminBotInstance = Omit<Telegraf, 'startPolling'> & {
  startPolling: () => Promise<void>;
  getBot: () => Telegraf;
  handleWebhookUpdate: (update: any) => Promise<void>;
  getWebhookInfo: () => Promise<any>;
  setWebhook: (url: string, secret?: string) => Promise<{ success: boolean; message?: string }>;
  deleteWebhook: () => Promise<{ success: boolean; message?: string }>;
};

export const adminBot: AdminBotInstance = new Telegraf(token) as unknown as AdminBotInstance;
applyTelegramOutboundGuard(adminBot as any);

export const STORE_URL =
  (process.env.STORE_MINIAPP_URL && process.env.STORE_MINIAPP_URL.startsWith('https://'))
    ? process.env.STORE_MINIAPP_URL
    : (env.STORE_WEBAPP_URL && env.STORE_WEBAPP_URL.startsWith('https://'))
      ? env.STORE_WEBAPP_URL
      : (env.CLIENT_STORE_URL && env.CLIENT_STORE_URL.startsWith('https://'))
        ? env.CLIENT_STORE_URL
        : ((process.env.PUBLIC_URL || env.PUBLIC_URL || '').replace(/\/$/, '') || 'https://uchiro.store');

const liveDomain = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app';
const adminPortalUrl = `${liveDomain.replace(/\/$/, '')}/noreakyoutadmindashboard`;

// Handle /start and /menu
adminBot.command(['start', 'menu'], async (ctx) => {
  const senderId = String(ctx.from?.id);
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  return ctx.reply('👑 <b>UCHIRO STORE ADMINISTRATION</b>\nWelcome Master! Server status: 🟢 Online', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛡️ OPEN ADMIN PORTAL', web_app: { url: adminPortalUrl } }],
        [
          { text: '📈 Real-Time Metrics', callback_data: 'cb_admin_metrics' },
          { text: '💎 Robux Stock Pool', callback_data: 'admin:robux:pool' }
        ],
        [
          { text: '📦 Live Inventory', callback_data: 'cb_admin_inventory' },
          { text: '📢 Create Broadcast', callback_data: 'cb_admin_broadcast' }
        ],
        [
          { text: '⚙️ Store Settings', callback_data: 'cb_admin_settings' }
        ]
      ]
    }
  });
});

// Admin command: /setrobux <amount>
adminBot.command('setrobux', async (ctx) => {
  const senderId = String(ctx.from?.id);
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('Usage: <code>/setrobux &lt;total_robux_amount&gt;</code>\nExample: <code>/setrobux 1000</code>', {
      parse_mode: 'HTML',
    });
  }

  const amount = Number(parts[1]);
  if (isNaN(amount) || amount < 0 || !Number.isInteger(amount)) {
    return ctx.reply('❌ Error: Amount must be a positive integer.');
  }

  try {
    const updated = await RobuxService.setStock(senderId, amount, 'Manual Telegram Admin adjustment');
    const tiers = RobuxService.calculateTiers(updated);
    const summary = tiers.map(t => `${t.denomination} R$: ${t.available_packs} packs`).join(', ');

    return ctx.reply(
      `✅ <b>Shared Robux Stock Updated!</b>\n\n` +
      `• Total Pool: <b>${updated.total_balance} R$</b>\n` +
      `• Active Reservations: <b>${updated.reserved_balance} R$</b>\n` +
      `• Available: <b>${updated.total_balance - updated.reserved_balance} R$</b>\n\n` +
      `<b>Availability by tier:</b>\n${summary}`,
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    return ctx.reply(`❌ Failed to update Robux stock: ${err?.message}`);
  }
});

// /addrobux <amount> command for authorized admins
adminBot.hears(/^\/addrobux(?:\s+(.+))?$/i, async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = String(ctx.from?.id || '');
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('Usage: <code>/addrobux &lt;amount&gt;</code>\nExample: <code>/addrobux 5000</code>', { parse_mode: 'HTML' });
  }

  const delta = Number(parts[1]);
  if (isNaN(delta) || delta <= 0 || !Number.isInteger(delta)) {
    return ctx.reply('❌ Error: Amount to add must be a positive integer.');
  }

  try {
    const updated = await RobuxService.addStock(senderId, delta, 'Manual Telegram Admin /addrobux');
    const available = updated.total_balance - updated.reserved_balance;
    return ctx.reply(
      `✅ <b>Added ${delta.toLocaleString()} R$ to Robux Stock!</b>\n\n` +
      `• Total Balance: <b>${updated.total_balance.toLocaleString()} R$</b>\n` +
      `• Available Balance: <b>${available.toLocaleString()} R$</b>\n` +
      `• Rate: <b>$${updated.rate_per_1000.toFixed(2)} per 1,000 R$</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    return ctx.reply(`❌ Failed to add Robux stock: ${err?.message}`);
  }
});

// /setrate <rate> command for authorized admins
adminBot.hears(/^\/setrate(?:\s+(.+))?$/i, async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = String(ctx.from?.id || '');
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const parts = ctx.message.text.trim().split(/\s+/);
  if (parts.length < 2) {
    return ctx.reply('Usage: <code>/setrate &lt;price_per_1000&gt;</code>\nExample: <code>/setrate 3.50</code>', { parse_mode: 'HTML' });
  }

  const rate = parseFloat(parts[1]);
  if (isNaN(rate) || rate <= 0) {
    return ctx.reply('❌ Error: Rate must be a positive number (USD per 1,000 Robux).');
  }

  try {
    const updated = await RobuxService.setRate(senderId, rate, 'Manual Telegram Admin /setrate');
    return ctx.reply(
      `✅ <b>Robux Rate Updated to $${updated.rate_per_1000.toFixed(2)} per 1,000 R$!</b>\n\n` +
      `• 100 R$: <b>$${((100 * updated.rate_per_1000) / 1000).toFixed(2)}</b>\n` +
      `• 200 R$: <b>$${((200 * updated.rate_per_1000) / 1000).toFixed(2)}</b>\n` +
      `• 500 R$: <b>$${((500 * updated.rate_per_1000) / 1000).toFixed(2)}</b>\n` +
      `• 1,000 R$: <b>$${((1000 * updated.rate_per_1000) / 1000).toFixed(2)}</b>\n` +
      `• 10,000 R$: <b>$${((10000 * updated.rate_per_1000) / 1000).toFixed(2)}</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    return ctx.reply(`❌ Failed to update Robux rate: ${err?.message}`);
  }
});

// /robux command for authorized admins
adminBot.command('robux', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = String(ctx.from?.id || '');
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const view = await handleAdminCallback('admin:robux:pool', ctx.from, STORE_URL);
  if (view) {
    return ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  }
});

// Handle callback queries
adminBot.on('callback_query', async (ctx) => {
  const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!data || ctx.chat?.type !== 'private') return;
  const view = await handleAdminCallback(data, ctx.callbackQuery.from, STORE_URL);
  if (!view) return;
  try {
    await ctx.editMessageText(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) throw err;
  }
  await ctx.answerCbQuery();
});

// Fallback for any other private message
adminBot.on('message', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const from = ctx.from;
  if (!from || !isAuthorizedAdmin(from.id)) {
    try {
      await ctx.reply('⛔ Access denied. You are not an authorized admin.');
    } catch (err: any) {
      console.warn(`⚠️ [ADMIN BOT] Reply notice:`, err.message);
    }
    return;
  }
  try {
    await ctx.reply('Use /menu to view available actions.');
  } catch (err: any) {
    console.warn(`⚠️ [ADMIN BOT] Reply notice:`, err.message);
  }
});

adminBot.catch((err: any, ctx) => {
  console.error(`[ADMIN BOT ERROR] for ${ctx.updateType}:`, err?.message || err);
});

// Helper / compatibility attachments
(adminBot as any).startPolling = async (): Promise<void> => {
  if (!token || token.startsWith('mock_')) return;
  try {
    await adminBot.launch();
    console.log(`✅ [ADMIN BOT] Polling started`);
  } catch (err: any) {
    console.warn(`⚠️ [ADMIN BOT] Polling launch notice:`, err.message);
  }
};

(adminBot as any).getBot = () => adminBot;

(adminBot as any).handleWebhookUpdate = async (update: any): Promise<void> => {
  try {
    await adminBot.handleUpdate(update);
  } catch (err: any) {
    console.error('[ADMIN BOT] Error processing webhook update:', err);
  }
};

(adminBot as any).getWebhookInfo = async (): Promise<any> => {
  if (!token) return { configured: false, error: 'No token' };
  try {
    return await adminBot.telegram.getWebhookInfo();
  } catch (err: any) {
    return { configured: true, error: err.message };
  }
};

(adminBot as any).setWebhook = async (url: string, secret?: string): Promise<{ success: boolean; message?: string }> => {
  if (!token) return { success: false, message: 'No bot token' };
  try {
    await adminBot.telegram.setWebhook(url, secret ? { secret_token: secret } : undefined);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

(adminBot as any).deleteWebhook = async (): Promise<{ success: boolean; message?: string }> => {
  if (!token) return { success: false, message: 'No bot token' };
  try {
    await adminBot.telegram.deleteWebhook();
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

export function getAdminBotUsername(): string {
  const raw = process.env.ADMIN_BOT_USERNAME || env.ADMIN_BOT_USERNAME || 'uchiro_v2_admin_bot';
  return raw.replace(/^@/, '').trim();
}

export function createWebAppOrUrlButton(text: string, targetUrl: string) {
  const rawPublicUrl = (process.env.PUBLIC_URL || '').trim();
  const appUrl = (rawPublicUrl.startsWith('https://') ? rawPublicUrl : 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');

  if (targetUrl && targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('https://t.me/')) {
      return Markup.button.url(text, targetUrl);
    }
    return Markup.button.webApp(text, targetUrl);
  }

  let resolvedUrl = appUrl;
  if (targetUrl) {
    if (targetUrl.startsWith('/')) {
      resolvedUrl = `${appUrl}${targetUrl}`;
    } else {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        if (pathAndQuery) {
          resolvedUrl = `${appUrl}${pathAndQuery}`;
        }
      } catch {
        resolvedUrl = appUrl;
      }
    }
  }

  if (!resolvedUrl.startsWith('https://')) {
    resolvedUrl = 'https://web-production-2d8bd.up.railway.app';
  }

  return Markup.button.webApp(text, resolvedUrl);
}

export function getAdminKeyboard(adminUrl: string) {
  const shieldBtn = createWebAppOrUrlButton('🛡️ OPEN ADMIN PORTAL', adminUrl);
  (shieldBtn as any).icon_custom_emoji_id = TELEGRAM_EMOJIS.SHIELD.customEmojiId;

  const metricsBtn = Markup.button.callback('Real-Time Metrics', 'admin_metrics');
  (metricsBtn as any).icon_custom_emoji_id = TELEGRAM_EMOJIS.BAR_CHART.customEmojiId;

  const invBtn = Markup.button.callback('Live Inventory', 'admin_inventory');
  (invBtn as any).icon_custom_emoji_id = TELEGRAM_EMOJIS.PACKAGE.customEmojiId;

  const broadcastBtn = Markup.button.callback('Create Broadcast', 'admin_broadcast');
  (broadcastBtn as any).icon_custom_emoji_id = TELEGRAM_EMOJIS.MEGAPHONE.customEmojiId;

  const settingsBtn = Markup.button.callback('Store Settings', 'admin_settings');
  (settingsBtn as any).icon_custom_emoji_id = TELEGRAM_EMOJIS.WRENCH.customEmojiId;

  return Markup.inlineKeyboard([
    [shieldBtn],
    [metricsBtn, invBtn],
    [broadcastBtn, settingsBtn],
  ]);
}
