import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { handleAdminStart, handleAdminCallback, isMessageNotModifiedError, makeAdminButton } from './admin-actions';
import {
  hasActiveBroadcastWizard,
  startBroadcastWizard,
  handleBroadcastWizardMessage,
} from './broadcast-wizard';
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

import { ADMIN_BASE_PATH } from '../../config/admin-slug';

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

import { resolveDefaultAdminUrl } from './admin-actions';

export function resolveAdminPortalUrl(): string {
  return resolveDefaultAdminUrl();
}

export const adminPortalUrl = resolveAdminPortalUrl();

// Handle /start and /menu
adminBot.command(['start', 'menu'], async (ctx) => {
  const senderId = String(ctx.from?.id);
  if (!isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  // Ensure Telegram bottom-left Menu Button opens the Admin Portal instead of the customer store
  ctx.setChatMenuButton?.({
    type: 'web_app',
    text: 'Admin Portal',
    web_app: { url: adminPortalUrl },
  } as any).catch(() => {});

  return ctx.reply('👑 <b>UCHIRO STORE ADMINISTRATION</b>\nWelcome Master! Server status: 🟢 Online', {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: [
        [makeAdminButton({ text: 'OPEN ADMIN PORTAL', webAppUrl: adminPortalUrl, iconKey: 'SHIELD' })],
        [
          makeAdminButton({ text: 'Real-Time Metrics', callbackData: 'cb_admin_metrics', iconKey: 'CHART_UP' }),
          makeAdminButton({ text: 'Robux Stock Pool', callbackData: 'admin:robux:pool', iconKey: 'ROBUX' })
        ],
        [
          makeAdminButton({ text: 'Live Inventory', callbackData: 'cb_admin_inventory', iconKey: 'PACKAGE' }),
          makeAdminButton({ text: 'Create Broadcast', callbackData: 'cb_admin_broadcast', iconKey: 'MEGAPHONE' })
        ],
        [
          makeAdminButton({ text: 'Store Settings', callbackData: 'cb_admin_settings', iconKey: 'GEAR' })
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
    return ctx.reply(
      'Usage: <code>/setrobux &lt;total_robux_amount&gt;</code>\n' +
      'Example: <code>/setrobux 1000</code>\n' +
      'Allowed range: 10 to 1,000,000 integer.',
      { parse_mode: 'HTML' }
    );
  }

  const validation = RobuxService.validateStockAmount(parts[1]);
  if (!validation.valid || validation.value === undefined) {
    return ctx.reply(`❌ <b>Validation Error:</b> ${validation.error}`, { parse_mode: 'HTML' });
  }

  try {
    const updated = await RobuxService.setStock(senderId, validation.value, 'Manual Telegram Admin adjustment');
    const tiers = RobuxService.calculateTiers(updated);
    const summary = tiers.map(t => `${t.denomination} R$: ${t.available_packs} packs`).join(', ');

    return ctx.reply(
      `✅ <b>Shared Robux Stock Updated!</b>\n\n` +
      `• Total Pool: <b>${updated.total_balance.toLocaleString()} R$</b>\n` +
      `• Active Reservations: <b>${updated.reserved_balance.toLocaleString()} R$</b>\n` +
      `• Available: <b>${(updated.total_balance - updated.reserved_balance).toLocaleString()} R$</b>\n\n` +
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
    return ctx.reply('❌ <b>Error:</b> Amount to add must be a positive integer.\nExample: <code>/addrobux 500</code>', { parse_mode: 'HTML' });
  }

  try {
    const updated = await RobuxService.addStock(senderId, delta, 'Manual Telegram Admin /addrobux');
    const available = Math.max(0, updated.total_balance - updated.reserved_balance);
    return ctx.reply(
      `✅ <b>Added ${delta.toLocaleString()} R$ to Robux Stock!</b>\n\n` +
      `• Total Balance: <b>${updated.total_balance.toLocaleString()} R$</b>\n` +
      `• Reserved Balance: <b>${updated.reserved_balance.toLocaleString()} R$</b>\n` +
      `• Available Balance: <b>${available.toLocaleString()} R$</b>\n` +
      `• Rate: <b>$${updated.rate_per_1000.toFixed(2)} per 1,000 R$</b>`,
      { parse_mode: 'HTML' }
    );
  } catch (err: any) {
    return ctx.reply(`❌ <b>Failed to add Robux stock:</b> ${err?.message}`, { parse_mode: 'HTML' });
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

  const view = await handleAdminCallback('admin:robux:pool', ctx.from, STORE_URL, adminPortalUrl);
  if (view) {
    return ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  }
});

// /broadcast command for authorized admins (launches in-chat wizard)
adminBot.command('broadcast', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const view = startBroadcastWizard(senderId);
  return ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
});

// /cancel command for aborting active in-chat wizards
adminBot.command('cancel', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) return;

  if (hasActiveBroadcastWizard(senderId)) {
    const handled = await handleBroadcastWizardMessage(ctx);
    if (handled) return;
  }
  return ctx.reply('No active operation to cancel.');
});

// Handle callback queries
adminBot.on('callback_query', async (ctx) => {
  const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!data || ctx.chat?.type !== 'private') return;
  const view = await handleAdminCallback(data, ctx.callbackQuery.from, STORE_URL, adminPortalUrl);
  if (!view) return;
  try {
    await ctx.editMessageText(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) throw err;
  }
  await ctx.answerCbQuery();
});

// Message handler for in-chat wizard & fallbacks
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

  // Check if admin is currently in a broadcast wizard session
  if (hasActiveBroadcastWizard(from.id)) {
    const handled = await handleBroadcastWizardMessage(ctx);
    if (handled) return;
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
  const shieldBtn = makeAdminButton({ text: 'OPEN ADMIN PORTAL', webAppUrl: adminUrl, iconKey: 'SHIELD' });
  const metricsBtn = makeAdminButton({ text: 'Real-Time Metrics', callbackData: 'admin_metrics', iconKey: 'BAR_CHART' });
  const invBtn = makeAdminButton({ text: 'Live Inventory', callbackData: 'admin_inventory', iconKey: 'PACKAGE' });
  const broadcastBtn = makeAdminButton({ text: 'Create Broadcast', callbackData: 'admin_broadcast', iconKey: 'MEGAPHONE' });
  const settingsBtn = makeAdminButton({ text: 'Store Settings', callbackData: 'admin_settings', iconKey: 'WRENCH' });

  return Markup.inlineKeyboard([
    [shieldBtn],
    [metricsBtn, invBtn],
    [broadcastBtn, settingsBtn],
  ]);
}
