import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { handleAdminStart, handleAdminCallback, isMessageNotModifiedError } from './admin-actions';
import { isAuthorizedAdmin } from './admin-guards';
import { TELEGRAM_EMOJIS } from '../../config/telegram-emojis';

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

export const STORE_URL =
  (process.env.STORE_MINIAPP_URL && process.env.STORE_MINIAPP_URL.startsWith('https://'))
    ? process.env.STORE_MINIAPP_URL
    : (env.STORE_WEBAPP_URL && env.STORE_WEBAPP_URL.startsWith('https://'))
      ? env.STORE_WEBAPP_URL
      : (env.CLIENT_STORE_URL && env.CLIENT_STORE_URL.startsWith('https://'))
        ? env.CLIENT_STORE_URL
        : ((process.env.PUBLIC_URL || env.PUBLIC_URL || '').replace(/\/$/, '') || 'https://uchiro.store');

// Handle /start and /menu
adminBot.command(['start', 'menu'], async (ctx) => {
  const from = ctx.from;
  if (!from || ctx.chat?.type !== 'private') return;
  const view = handleAdminStart(from, STORE_URL);
  await ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
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
    await ctx.reply('⛔ Access denied. You are not an authorized admin.');
    return;
  }
  await ctx.reply('Use /menu to view available actions.');
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
