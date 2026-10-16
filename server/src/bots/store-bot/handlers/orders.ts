import { Context } from 'telegraf';
import { DataStore, DeliveredAccount, listOrdersByUser } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
import { TOTPService } from '../../../security/totp';
import {
  buildAccountDetailKeyboard,
  buildEmptyVaultKeyboard,
  buildTwoFactorKeyboard,
  buildVaultListKeyboard,
  buildOrdersMenuKeyboard,
  buildOrderHistoryKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';

export function escapeHtml(str: string): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function formatDate(iso: string): string {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return iso;
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Phnom_Penh',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(ms));
}

export function isMessageNotModifiedError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return message.toLowerCase().includes('message is not modified');
}

function getStatusBadge(status: string): string {
  switch (status.toLowerCase()) {
    case 'paid':
      return '🟢 Paid';
    case 'delivered':
    case 'completed':
      return '✅ Delivered';
    case 'pending':
      return '⏳ Pending Payment';
    case 'cancelled':
      return '❌ Cancelled';
    case 'refunded':
      return '↩️ Refunded';
    case 'fulfillment':
      return '⚙️ In Fulfillment';
    default:
      return `📦 ${status.toUpperCase()}`;
  }
}

/**
 * Fetch last 10 orders for a user via listOrdersByUser or fallback to DataStore
 */
export async function fetchUserOrders(telegramId: string | number): Promise<Array<{
  orderCode: string;
  status: string;
  totalAmount: number;
  createdAt: string;
}>> {
  const tid = String(telegramId);
  const numId = Number(telegramId) || 0;
  try {
    const pgOrders = await listOrdersByUser(tid);
    if (pgOrders && pgOrders.length > 0) {
      return pgOrders.slice(0, 10).map((o) => ({
        orderCode: o.orderCode || o.id,
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
      }));
    }
  } catch (err: any) {
    console.warn('[Orders] listOrdersByUser warning:', err?.message);
  }

  // Fallback to DataStore
  const memOrders = DataStore.getOrdersByCustomer(numId);
  return memOrders.slice(0, 10).map((o: any) => ({
    orderCode: o.order_number || o.id,
    status: o.status,
    totalAmount: Number(o.total_amount ?? o.total_price ?? 0),
    createdAt: o.created_at,
  }));
}

/**
 * Fetch delivered accounts for a customer from Supabase (if available) or DataStore.
 */
export async function getCustomerDeliveredAccounts(
  telegramId: number | string
): Promise<DeliveredAccount[]> {
  const tid = String(telegramId);

  // Check Supabase vault_accounts if configured
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase
        .from('vault_accounts')
        .select('*')
        .eq('telegram_id', tid)
        .order('delivered_at', { ascending: false });

      if (!error && data && data.length > 0) {
        return (data as any[]).map((row) => ({
          account_id: row.id || row.account_id,
          order_code: row.order_code,
          game_title: row.game_title,
          username: row.username,
          password: row.password || '',
          two_factor_secret: row.two_factor_secret || row.twoFactorSecret,
          backup_codes: Array.isArray(row.backup_codes) ? row.backup_codes : undefined,
          notes: row.notes,
          delivered_at: row.delivered_at,
        }));
      }
    } catch {
      // Graceful fallback to DataStore on any query or schema error
    }
  }

  // Fallback to DataStore
  return DataStore.getDeliveredAccountsByTelegramId(telegramId);
}

/**
 * Fetch a single delivered account by its ID.
 */
export async function getCustomerDeliveredAccountById(
  telegramId: number | string,
  accountId: string
): Promise<DeliveredAccount | null> {
  const accounts = await getCustomerDeliveredAccounts(telegramId);
  return (
    accounts.find(
      (a) =>
        a.account_id === accountId ||
        a.account_id === `acc_${accountId}` ||
        `acc_${a.account_id}` === accountId
    ) || null
  );
}

/**
 * Step 1: Render and send/edit Vault Accounts List View
 */
export async function handleVaultMenu(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const accounts = await getCustomerDeliveredAccounts(telegramId);

  if (accounts.length === 0) {
    const text =
      `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `You don't have any delivered game accounts yet.\n\n` +
      `👉 Tap below to explore the store catalog:`;

    const keyboard = buildEmptyVaultKeyboard(storeUrl);
    try {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } catch (err) {
      if (!isMessageNotModifiedError(err)) {
        await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
      }
    }
    return;
  }

  const text =
    `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `You have <b>${accounts.length}</b> game accounts in your vault:\n\n` +
    `👇 <i>Tap an account below to view credentials & live 2FA code:</i>`;

  const keyboard = buildVaultListKeyboard(accounts, storeUrl);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
    }
  }
}

/**
 * Step 2: Render and send/edit Credentials Detail View
 */
export async function handleViewAccount(
  ctx: Context,
  accountId: string,
  storeUrl: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const account = await getCustomerDeliveredAccountById(telegramId, accountId);
  if (!account) {
    try {
      await ctx.answerCbQuery('Account not found', { show_alert: true });
    } catch {}
    return;
  }

  const twoFactorSecret = account.two_factor_secret
    ? `<code>${escapeHtml(account.two_factor_secret)}</code>`
    : '—';

  const backupCodesList =
    account.backup_codes && account.backup_codes.length > 0
      ? account.backup_codes.map((c) => `<code>${escapeHtml(c)}</code>`).join('\n')
      : '—';

  const text =
    `🔐 <b>ACCOUNT CREDENTIALS &amp; VAULT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎮 <b>Item:</b> ${escapeHtml(account.game_title)}\n` +
    `📦 <b>Order Code:</b> <code>${escapeHtml(account.order_code)}</code>\n` +
    `📅 <b>Delivered At:</b> ${escapeHtml(formatDate(account.delivered_at))}\n\n` +
    `👤 <b>Username / ID:</b>\n` +
    `<code>${escapeHtml(account.username)}</code> <i>(Tap to copy)</i>\n\n` +
    `🔑 <b>Password:</b>\n` +
    `<tg-spoiler><b>${escapeHtml(account.password)}</b></tg-spoiler> <i>(Tap spoiler to reveal)</i>\n\n` +
    `🛡️ <b>2FA Authenticator Key:</b>\n` +
    `${twoFactorSecret}\n\n` +
    `📑 <b>Backup / Recovery Codes:</b>\n` +
    `${backupCodesList}\n\n` +
    `⚠️ <b>Security Notice:</b> Please link your personal email and change the password immediately for 100% protection.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildAccountDetailKeyboard(account, storeUrl);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      await ctx.reply(enrichWithTgEmojis(text), { parse_mode: 'HTML', ...keyboard });
    }
  }
}

/**
 * Step 3: Live 2FA Code Generator
 */
export async function handleGen2fa(
  ctx: Context,
  accountId: string,
  _storeUrl: string
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const account = await getCustomerDeliveredAccountById(telegramId, accountId);
  if (!account || !account.two_factor_secret) {
    try {
      await ctx.answerCbQuery('No 2FA key configured for this account', { show_alert: true });
    } catch {}
    return;
  }

  const cleanSecret = account.two_factor_secret.replace(/\s+/g, '').toUpperCase();
  const totp = TOTPService.generateCode(cleanSecret, Date.now());
  const remainingSeconds = totp.secondsRemaining;
  const totpCode = totp.code;

  // 1. Show interactive Telegram alert popup for instant view
  try {
    await ctx.answerCbQuery(
      `🔢 Live 2FA Code: [ ${totpCode} ] (${remainingSeconds}s remaining)`,
      { show_alert: true }
    );
  } catch {}

  // 2. Also update panel text for convenient 1-tap copy
  const text =
    `🔢 <b>YOUR LIVE 2FA CODE:</b>\n\n` +
    `[ <b>${totpCode.slice(0, 3)} ${totpCode.slice(3)}</b> ] <i>(${remainingSeconds}s remaining)</i>\n` +
    `<code>${totpCode}</code> <i>(Tap to copy code)</i>\n\n` +
    `🎮 ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})`;

  const keyboard = buildTwoFactorKeyboard(account.account_id);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      // Ignored if unmodified
    }
  }
}

/**
 * Order History (cb_orders_recent):
 * Shows a REAL list of the customer's last 10 orders via listOrdersByUser
 */
export async function handleOrdersRecent(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const orders = await fetchUserOrders(telegramId);

  let ordersContent = '';
  if (orders.length === 0) {
    ordersContent = `<i>No orders found. Once you place an order, it will appear here.</i>\n`;
  } else {
    ordersContent = orders
      .map((o) => {
        const badge = getStatusBadge(o.status);
        const code = escapeHtml(o.orderCode);
        const dateStr = formatDate(o.createdAt);
        const amount = `$${o.totalAmount.toFixed(2)}`;
        return `📦 <b>#${code}</b> — ${badge}\n` +
               `  💰 <b>Amount:</b> ${amount} | 🗓️ <i>${dateStr}</i>`;
      })
      .join('\n\n');
  }

  const text =
    `📜 <b>RECENT ORDER HISTORY (LAST 10)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    ordersContent + `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Tap "Open Orders" to view full account details, 2FA keys, and warranty status in Mini App.</i>`;

  const keyboard = buildOrderHistoryKeyboard(storeUrl);
  const formattedHtml = enrichWithTgEmojis(text);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Orders Recent] Render warning:', err);
    }
  }
}

/**
 * Orders Menu: cb_orders_menu / /orders
 */
export async function handleOrdersMenu(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  await handleOrdersRecent(ctx, storeUrl);
}

/**
 * Handle Track Order ID (cb_orders_track)
 */
export async function handleOrdersTrack(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🔍 <b>TRACK YOUR ORDER</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `To track an order or check fulfillment status:\n\n` +
    `• View your 10 most recent orders in <b>Order History</b> below.\n` +
    `• Or contact our 24/7 Support with your Order ID (e.g. <code>ORD-123456</code>).\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildOrderHistoryKeyboard(storeUrl);
  const formattedHtml = enrichWithTgEmojis(text);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(formattedHtml, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Orders Track] Render warning:', err);
    }
  }
}
