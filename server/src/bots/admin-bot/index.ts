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
import { BatchAnnouncementService } from '../../services/batch-announcement.service';
import { DataStore } from '../../database/data-store';
import { NotificationService } from '../../services/notification.service';
import { OrderService } from '../../services/order.service';

export function isAuthorizedAdmin(telegramId: string | number): boolean {
  const id = String(telegramId).trim();
  const envAdmins = (process.env.ADMIN_TELEGRAM_IDS || process.env.ADMIN_TELEGRAM_USER_IDS || '').split(',').map(s => s.trim());
  if (envAdmins.includes(id)) return true;

  try {
    const dbAdmins = DataStore.getAdminUsers();
    if (dbAdmins.some((a) => String(a.telegram_id) === id && a.is_active)) return true;
  } catch {
    // DataStore fallback
  }

  return false;
}

const token = (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();

export type AdminBotInstance = Omit<Telegraf, 'startPolling'> & {
  startPolling: () => Promise<void>;
  getBot: () => Telegraf;
  handleWebhookUpdate: (update: any) => Promise<boolean>;
  getWebhookInfo: () => Promise<any>;
  setWebhook: (url: string, secret?: string) => Promise<{ success: boolean; message?: string }>;
  deleteWebhook: () => Promise<{ success: boolean; message?: string }>;
};

import { ADMIN_BASE_PATH } from '../../config/admin-slug';
import { resolveStoreUrl, isValidUrl } from '../../config/app-url';

export const adminBot: AdminBotInstance = new Telegraf(token) as unknown as AdminBotInstance;
applyTelegramOutboundGuard(adminBot as any);

export const STORE_URL = resolveStoreUrl();

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

// In-chat admin ticket reply sessions: adminId -> ticketId
const adminTicketReplySessions = new Map<number, string>();
// In-chat admin direct customer reply sessions: adminId -> customerTelegramId
const adminDirectUserReplySessions = new Map<number, number>();

// /cancel command for aborting active in-chat wizards & reply sessions
adminBot.command('cancel', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) return;

  let cleared = false;
  if (adminTicketReplySessions.has(senderId)) {
    adminTicketReplySessions.delete(senderId);
    cleared = true;
  }
  if (adminDirectUserReplySessions.has(senderId)) {
    adminDirectUserReplySessions.delete(senderId);
    cleared = true;
  }

  if (cleared) {
    return ctx.reply('Ticket/Customer reply cancelled.');
  }

  if (hasActiveBroadcastWizard(senderId)) {
    const handled = await handleBroadcastWizardMessage(ctx);
    if (handled) return;
  }
  return ctx.reply('No active operation to cancel.');
});

// /reply command for direct support replies: /reply <ticket_or_customer_id> [message]
adminBot.command(['reply', 'respond', 'send'], async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const rawText = (ctx.message as any)?.text || '';
  const parts = rawText.trim().split(/\s+/);
  const targetIdOrNumber = parts[1]?.trim();
  const inlineMessage = parts.slice(2).join(' ').trim();

  if (!targetIdOrNumber) {
    return ctx.reply(
      `ℹ️ <b>How to reply to customer support:</b>\n\n` +
      `• <code>/reply &lt;customer_id&gt; &lt;message&gt;</code>\n` +
      `• <code>/reply &lt;ticket_number&gt; &lt;message&gt;</code>\n\n` +
      `<i>Or simply swipe to <b>Reply</b> directly to any support notification in this chat!</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Check if target is a ticket number or numeric customer Telegram ID
  let ticket = DataStore.getSupportTicketById(targetIdOrNumber);
  let targetTgId: number | null = Number(targetIdOrNumber) || null;

  if (ticket) {
    targetTgId = ticket.telegram_id;
  } else if (targetTgId) {
    const userTickets = DataStore.getSupportTickets().filter((t) => t.telegram_id === targetTgId);
    ticket = userTickets.find((t) => t.status === 'open' || t.status === 'in_progress') || userTickets[0] || null;
  }

  if (!targetTgId) {
    return ctx.reply(`❌ Customer ID or Ticket <code>${targetIdOrNumber}</code> not found.`, { parse_mode: 'HTML' });
  }

  if (inlineMessage) {
    if (ticket) {
      DataStore.replySupportTicket(ticket.id, inlineMessage, 'resolved');
      await NotificationService.notifyCustomerTicketReply(
        ticket.telegram_id,
        ticket.ticket_number,
        ticket.subject,
        inlineMessage
      );
    } else {
      const lang = DataStore.getUserLanguagePreference(targetTgId) || 'km';
      const msgText =
        lang === 'km'
          ? `💬 <b>សារពីក្រុមការងារជំនួយ — UCHIRO SUPPORT</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${inlineMessage}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>ប្រសិនបើអ្នកមានចម្ងល់បន្ថែម សូមផ្ញើសំបុត្រជំនួយក្នុង Store Mini App។</i>`
          : `💬 <b>SUPPORT TEAM MESSAGE — UCHIRO STORE</b>\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${inlineMessage}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `<i>If you have any further questions, please reply in the Store Mini App under Support.</i>`;
      await NotificationService.sendStoreBotMessage(targetTgId, msgText);
    }

    return ctx.reply(
      `✅ <b>REPLY SENT TO CUSTOMER</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Customer:</b> <code>${targetTgId}</code>\n` +
      (ticket ? `<b>Ticket:</b> #${ticket.ticket_number}\n` : '') +
      `\n<b>Your Message:</b>\n${inlineMessage}`,
      { parse_mode: 'HTML' }
    );
  }

  // Interactive reply session
  if (ticket) {
    adminTicketReplySessions.set(senderId, ticket.id);
  } else {
    adminDirectUserReplySessions.set(senderId, targetTgId);
  }

  return ctx.reply(
    `✍️ <b>REPLY TO CUSTOMER <code>${targetTgId}</code></b>\n` +
    (ticket ? `📌 <b>Ticket #${ticket.ticket_number}:</b> ${ticket.subject}\n` : '') +
    `\n<i>Please type your reply text below and send it. Type /cancel to abort.</i>`,
    { parse_mode: 'HTML' }
  );
});

// /stockbatch command for authorized admins
adminBot.command('stockbatch', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const view = await handleAdminCallback('admin:stock_batch', ctx.from, STORE_URL, adminPortalUrl);
  if (view) {
    return ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  }
});

// /theme command for authorized admins (Prompt 6: Seasonal Theme Management)
adminBot.command('theme', async (ctx) => {
  if (ctx.chat?.type !== 'private') return;
  const senderId = ctx.from?.id;
  if (!senderId || !isAuthorizedAdmin(senderId)) {
    return ctx.reply('⛔ Access denied. You are not an authorized admin.');
  }

  const view = await handleAdminCallback('admin:theme:menu', ctx.from, STORE_URL, adminPortalUrl);
  if (view) {
    return ctx.reply(view.text, { parse_mode: 'HTML', reply_markup: view.replyMarkup });
  }
});

// /register_group command (in a group/channel from an authorized admin)
adminBot.command('register_group', async (ctx) => {
  const from = ctx.from;
  if (!from || !isAuthorizedAdmin(from.id)) {
    return ctx.reply('⛔ Access denied. Only authorized store administrators can register announcement groups.');
  }
  const chat = ctx.chat;
  if (chat.type === 'private') {
    return ctx.reply('❌ This command must be sent inside a Telegram group, supergroup, or channel.');
  }

  const title = (chat as any).title || 'Registered Telegram Group';
  const group = BatchAnnouncementService.registerGroup({
    chat_id: String(chat.id),
    title,
    chat_type: chat.type as any,
  });

  return ctx.reply(
    `✅ <b>Telegram Group Registered for Stock Announcements!</b>\n\n` +
    `• Title: <b>${group.title}</b>\n` +
    `• Chat ID: <code>${group.chat_id}</code>\n` +
    `• Type: <i>${group.chat_type}</i>\n` +
    `• Status: <b>Active & Authorized</b>`,
    { parse_mode: 'HTML' }
  );
});

// Handle callback queries
adminBot.on('callback_query', async (ctx) => {
  const data = 'data' in ctx.callbackQuery ? ctx.callbackQuery.data : undefined;
  if (!data || ctx.chat?.type !== 'private') return;
  const from = ctx.callbackQuery.from;
  if (!from || !isAuthorizedAdmin(from.id)) {
    try { await ctx.answerCbQuery('⛔ Access denied.'); } catch {}
    return;
  }

  // Handle Support Ticket Reply Trigger from Admin Bot
  if (data.startsWith('ticket_reply:')) {
    const ticketId = data.slice('ticket_reply:'.length);
    const ticket = DataStore.getSupportTicketById(ticketId);
    if (!ticket) {
      try { await ctx.answerCbQuery('Ticket not found or deleted.', { show_alert: true }); } catch {}
      return;
    }

    adminTicketReplySessions.set(from.id, ticketId);
    try { await ctx.answerCbQuery(); } catch {}
    return ctx.reply(
      `✍️ <b>REPLY TO TICKET #${ticket.ticket_number}</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `👤 <b>Customer ID:</b> <code>${ticket.telegram_id}</code>\n` +
      `📌 <b>Subject:</b> ${ticket.subject}\n` +
      `💬 <b>Customer Message:</b>\n<i>${ticket.message}</i>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<i>Please type your reply text below and send it. Type /cancel to abort.</i>`,
      { parse_mode: 'HTML' }
    );
  }

  // Handle Support Ticket Close from Admin Bot
  if (data.startsWith('ticket_close:')) {
    const ticketId = data.slice('ticket_close:'.length);
    const ticket = DataStore.getSupportTicketById(ticketId);
    if (!ticket) {
      try { await ctx.answerCbQuery('Ticket not found.', { show_alert: true }); } catch {}
      return;
    }

    if (ticket.status === 'closed') {
      try { await ctx.answerCbQuery('Ticket is already closed.'); } catch {}
      return;
    }

    ticket.status = 'closed';
    ticket.resolved_at = new Date().toISOString();
    ticket.updated_at = new Date().toISOString();

    NotificationService.notifyCustomerTicketClosed(
      ticket.telegram_id,
      ticket.ticket_number,
      ticket.subject
    ).catch(console.error);

    try {
      await ctx.editMessageText(
        `🔒 <b>TICKET #${ticket.ticket_number} CLOSED</b>\n\n` +
        `Customer <code>${ticket.telegram_id}</code> was notified that this ticket has been closed.`,
        { parse_mode: 'HTML' }
      );
    } catch {}
    try { await ctx.answerCbQuery('Ticket marked closed.'); } catch {}
    return;
  }

  // Handle Admin Manual Delivery / Confirmation Trigger for Gift, Gamepass & Trade Orders
  if (data.startsWith('admin_fulfill_order:') || data.startsWith('admin_deliver_order:')) {
    const rawId = data.startsWith('admin_fulfill_order:')
      ? data.slice('admin_fulfill_order:'.length).trim()
      : data.slice('admin_deliver_order:'.length).trim();

    const order = DataStore.getOrderById(rawId) || DataStore.getOrderByNumber(rawId);
    if (!order) {
      try { await ctx.answerCbQuery('Order not found.', { show_alert: true }); } catch {}
      return;
    }

    if (order.status === 'delivered' || order.status === 'completed') {
      try { await ctx.answerCbQuery('Order is already marked as delivered.', { show_alert: true }); } catch {}
      return;
    }

    try {
      await OrderService.fulfillManualOrder(order.id, {
        fulfillment_notes: `Confirmed and delivered by Admin @${from.username || from.id} via Telegram Admin Bot`,
        admin_telegram_id: from.id,
      });

      try { await ctx.answerCbQuery('✅ Order marked delivered & customer notified!'); } catch {}

      const productTitle = order.product_title || order.items?.[0]?.product_title || 'Gift Product';
      return ctx.reply(
        `✅ <b>GIFT / ORDER MARKED AS DELIVERED</b>\n\n` +
        `📦 <b>Product:</b> ${productTitle}\n` +
        `🆔 <b>Order:</b> <code>#${order.order_number || order.id}</code>\n` +
        (order.roblox_username ? `👤 <b>Recipient:</b> <code>${order.roblox_username}</code>\n` : '') +
        `👤 <b>Confirmed by Admin:</b> <code>${from.username ? `@${from.username}` : from.id}</code>\n\n` +
        `Status successfully updated to <b>DELIVERED</b> in store database.\n` +
        `The customer has been notified via Store Bot!`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      try { await ctx.answerCbQuery(`Error: ${err?.message || 'Failed to fulfill'}`, { show_alert: true }); } catch {}
      return;
    }
  }

  // Handle Expired QR Fulfill Trigger from Admin Bot
  if (data.startsWith('admin_fulfill_expired:')) {
    const orderId = data.slice('admin_fulfill_expired:'.length);
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      try { await ctx.answerCbQuery('Order not found.', { show_alert: true }); } catch {}
      return;
    }

    try {
      await OrderService.fulfillManualOrder(orderId, {
        fulfillment_notes: 'Confirmed and fulfilled by admin via Admin Bot (Expired QR payment)',
        admin_telegram_id: from.id,
      });
      try { await ctx.answerCbQuery('✅ Order fulfilled and customer notified!'); } catch {}
      return ctx.reply(
        `✅ <b>ORDER FULFILLED</b>\n\n` +
        `Order <b>#${order.order_number || order.id}</b> has been fulfilled and the customer notified.`,
        { parse_mode: 'HTML' }
      );
    } catch (err: any) {
      try { await ctx.answerCbQuery(`Error: ${err?.message || 'Failed to fulfill'}`, { show_alert: true }); } catch {}
      return;
    }
  }

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

  // Check if admin is currently in a ticket reply session
  if (adminTicketReplySessions.has(from.id)) {
    const ticketId = adminTicketReplySessions.get(from.id)!;
    adminTicketReplySessions.delete(from.id);

    const text = (ctx.message as any)?.text?.trim();
    if (!text || text === '/cancel') {
      return ctx.reply('Ticket reply cancelled.');
    }

    const ticket = DataStore.getSupportTicketById(ticketId);
    if (!ticket) {
      return ctx.reply('❌ Ticket not found or already closed.');
    }

    const updated = DataStore.replySupportTicket(ticketId, text, 'resolved');
    if (!updated) {
      return ctx.reply('❌ Failed to update ticket reply.');
    }

    // Dispatch reply directly to customer via Store Bot
    await NotificationService.notifyCustomerTicketReply(
      ticket.telegram_id,
      ticket.ticket_number,
      ticket.subject,
      text
    );

    return ctx.reply(
      `✅ <b>REPLY SENT TO CUSTOMER</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Ticket:</b> #${ticket.ticket_number}\n` +
      `<b>Customer:</b> <code>${ticket.telegram_id}</code>\n` +
      `<b>Status:</b> RESOLVED\n\n` +
      `<b>Your Reply:</b>\n${text}`,
      { parse_mode: 'HTML' }
    );
  }

  // Check if admin is currently in a direct customer reply session
  if (adminDirectUserReplySessions.has(from.id)) {
    const targetTgId = adminDirectUserReplySessions.get(from.id)!;
    adminDirectUserReplySessions.delete(from.id);

    const text = (ctx.message as any)?.text?.trim();
    if (!text || text === '/cancel') {
      return ctx.reply('Direct reply cancelled.');
    }

    const lang = DataStore.getUserLanguagePreference(targetTgId) || 'km';
    const msgText =
      lang === 'km'
        ? `💬 <b>សារពីក្រុមការងារជំនួយ — UCHIRO SUPPORT</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${text}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>ប្រសិនបើអ្នកមានចម្ងល់បន្ថែម សូមផ្ញើសំបុត្រជំនួយក្នុង Store Mini App។</i>`
        : `💬 <b>SUPPORT TEAM MESSAGE — UCHIRO STORE</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `${text}\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<i>If you have any further questions, please reply in the Store Mini App under Support.</i>`;
    await NotificationService.sendStoreBotMessage(targetTgId, msgText);

    return ctx.reply(
      `✅ <b>REPLY SENT TO CUSTOMER</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `<b>Customer:</b> <code>${targetTgId}</code>\n` +
      `\n<b>Your Message:</b>\n${text}`,
      { parse_mode: 'HTML' }
    );
  }

  // Check if admin is replying directly to a Telegram notification via Telegram's native Reply feature
  const replyTo = (ctx.message as any)?.reply_to_message;
  if (replyTo) {
    const repliedText = String(replyTo.text || replyTo.caption || '');
    const idMatch = repliedText.match(/(?:Customer ID|Customer TG ID|Customer Telegram ID|Customer|User ID|telegram_id)[:\s]+(?:<code>)?(\d{6,14})(?:<\/code>)?/i);
    const ticketMatch = repliedText.match(/TICKET\s*#?([A-Za-z0-9_-]+)/i);

    if (idMatch || ticketMatch) {
      let targetTgId = idMatch ? Number(idMatch[1]) : null;
      let ticket = ticketMatch ? DataStore.getSupportTicketById(ticketMatch[1]) : null;
      if (ticket && !targetTgId) {
        targetTgId = ticket.telegram_id;
      }
      if (!ticket && targetTgId) {
        const userTickets = DataStore.getSupportTickets().filter((t) => t.telegram_id === targetTgId);
        ticket = userTickets.find((t) => t.status === 'open' || t.status === 'in_progress') || userTickets[0] || null;
      }

      const text = (ctx.message as any)?.text?.trim();
      if (targetTgId && text && text !== '/cancel') {
        if (ticket) {
          DataStore.replySupportTicket(ticket.id, text, 'resolved');
          await NotificationService.notifyCustomerTicketReply(
            targetTgId,
            ticket.ticket_number,
            ticket.subject,
            text
          );
        } else {
          const lang = DataStore.getUserLanguagePreference(targetTgId) || 'km';
          const msgText =
            lang === 'km'
              ? `💬 <b>សារពីក្រុមការងារជំនួយ — UCHIRO SUPPORT</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `${text}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `<i>ប្រសិនបើអ្នកមានចម្ងល់បន្ថែម សូមផ្ញើសំបុត្រជំនួយក្នុង Store Mini App។</i>`
              : `💬 <b>SUPPORT TEAM MESSAGE — UCHIRO STORE</b>\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `${text}\n` +
                `━━━━━━━━━━━━━━━━━━━━━━\n` +
                `<i>If you have any further questions, please reply in the Store Mini App under Support.</i>`;
          await NotificationService.sendStoreBotMessage(targetTgId, msgText);
        }

        return ctx.reply(
          `✅ <b>REPLY SENT TO CUSTOMER</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `<b>Customer:</b> <code>${targetTgId}</code>\n` +
          (ticket ? `<b>Ticket:</b> #${ticket.ticket_number}\n` : '') +
          `\n<b>Your Reply:</b>\n${text}`,
          { parse_mode: 'HTML' }
        );
      }
    }
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

(adminBot as any).handleWebhookUpdate = async (update: any): Promise<boolean> => {
  try {
    const activeToken = (adminBot.telegram.token || process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();
    if (activeToken && !adminBot.telegram.token) {
      (adminBot.telegram as any).token = activeToken;
    }
    if (!adminBot.telegram.token) {
      console.error('[ADMIN BOT] Cannot process webhook update: no bot token configured');
      return false;
    }
    console.log('[ADMIN BOT] Webhook processing update ID:', update?.update_id);
    await adminBot.handleUpdate(update);
    return true;
  } catch (err: any) {
    console.error('[ADMIN BOT] Error processing webhook update:', err?.message || err);
    return false;
  }
};

(adminBot as any).getWebhookInfo = async (): Promise<any> => {
  const activeToken = (adminBot.telegram.token || process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();
  if (!activeToken) return { configured: false, error: 'No token' };
  try {
    if (!adminBot.telegram.token) (adminBot.telegram as any).token = activeToken;
    return await adminBot.telegram.getWebhookInfo();
  } catch (err: any) {
    return { configured: true, error: err.message };
  }
};

(adminBot as any).setWebhook = async (url: string, secret?: string): Promise<{ success: boolean; message?: string }> => {
  const activeToken = (adminBot.telegram.token || process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();
  if (!activeToken) return { success: false, message: 'No bot token' };
  try {
    if (!adminBot.telegram.token) (adminBot.telegram as any).token = activeToken;
    await adminBot.telegram.setWebhook(url, secret ? { secret_token: secret } : undefined);
    return { success: true };
  } catch (err: any) {
    return { success: false, message: err.message };
  }
};

(adminBot as any).deleteWebhook = async (): Promise<{ success: boolean; message?: string }> => {
  const activeToken = (adminBot.telegram.token || process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();
  if (!activeToken) return { success: false, message: 'No bot token' };
  try {
    if (!adminBot.telegram.token) (adminBot.telegram as any).token = activeToken;
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
  const appUrl = resolveStoreUrl();

  if (targetUrl && targetUrl.startsWith('https://')) {
    if (targetUrl.startsWith('https://t.me/')) {
      return Markup.button.url(text, targetUrl);
    }
    if ((targetUrl.includes('your-production-app') || targetUrl.includes('web-production-2d8bd')) && isValidUrl(appUrl)) {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        const finalUrl = appUrl ? `${appUrl}${pathAndQuery}` : targetUrl;
        return finalUrl.startsWith('https://')
          ? Markup.button.webApp(text, finalUrl)
          : Markup.button.url(text, finalUrl);
      } catch {
        return appUrl.startsWith('https://')
          ? Markup.button.webApp(text, appUrl)
          : Markup.button.url(text, appUrl);
      }
    }
    return targetUrl.startsWith('https://')
      ? Markup.button.webApp(text, targetUrl)
      : Markup.button.url(text, targetUrl);
  }

  let resolvedUrl = appUrl;
  if (targetUrl) {
    if (targetUrl.startsWith('/')) {
      resolvedUrl = appUrl ? `${appUrl}${targetUrl}` : targetUrl;
    } else {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        if (pathAndQuery) {
          resolvedUrl = appUrl ? `${appUrl}${pathAndQuery}` : targetUrl;
        }
      } catch {
        resolvedUrl = appUrl || targetUrl;
      }
    }
  }

  if (resolvedUrl.startsWith('https://')) {
    return Markup.button.webApp(text, resolvedUrl);
  }
  return Markup.button.url(text, resolvedUrl);
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
