import { Context, Markup } from 'telegraf';
import { DataStore, DeliveredAccount, listOrdersByUser } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
import { TOTPService } from '../../../security/totp';
import { resolveStoreUrl } from '../../../config/app-url';
import {
  buildAccountDetailKeyboard,
  buildEmptyVaultKeyboard,
  buildTwoFactorKeyboard,
  buildVaultListKeyboard,
  buildOrdersMenuKeyboard,
  buildOrderHistoryKeyboard,
  cb,
  createWebAppOrUrlButton,
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

export interface UserOrderSummary {
  id: string;
  orderCode: string;
  status: string;
  totalAmount: number;
  createdAt: string;
  productTitle: string;
  deliveryMode: string;
  quantity: number;
  deliveryCredentials?: any[] | null;
}

/**
 * Fetch last 10 orders for a user via DataStore (or fallback to Postgres/Supabase)
 */
export async function fetchUserOrders(telegramId: string | number): Promise<UserOrderSummary[]> {
  const tid = String(telegramId);
  const numId = Number(telegramId) || 0;

  // Primary source of truth: DataStore orders
  const memOrders = DataStore.getOrdersByCustomer(numId);
  if (memOrders && memOrders.length > 0) {
    return memOrders.slice(0, 10).map((o: any) => ({
      id: o.id,
      orderCode: o.order_number || o.id,
      status: o.status,
      totalAmount: Number(o.total_amount ?? o.total_price ?? 0),
      createdAt: o.created_at,
      productTitle: o.product_title || o.items?.[0]?.product_title || 'Gaming Product',
      deliveryMode: o.delivery_mode || 'auto_account',
      quantity: Math.max(1, o.quantity || o.items?.[0]?.quantity || 1),
      deliveryCredentials: o.delivery_credentials || null,
    }));
  }

  // Fallback to postgres
  try {
    const pgOrders = await listOrdersByUser(tid);
    if (pgOrders && pgOrders.length > 0) {
      return pgOrders.slice(0, 10).map((o) => ({
        id: o.id,
        orderCode: o.orderCode || o.id,
        status: o.status,
        totalAmount: Number(o.totalAmount || 0),
        createdAt: o.createdAt,
        productTitle: (o as any).productTitle || 'Gaming Product',
        deliveryMode: (o as any).deliveryMode || 'auto_account',
        quantity: Math.max(1, (o as any).quantity || 1),
        deliveryCredentials: (o as any).deliveryCredentials || null,
      }));
    }
  } catch (err: any) {
    console.warn('[Orders] listOrdersByUser warning:', err?.message);
  }

  return [];
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
  const found = accounts.find(
    (a) =>
      a.account_id === accountId ||
      a.account_id === `acc_${accountId}` ||
      `acc_${a.account_id}` === accountId ||
      a.order_code === accountId ||
      a.account_id.startsWith(accountId) ||
      accountId.startsWith(a.account_id)
  );
  if (found) return found;

  // Direct fallback to customer's delivered orders if accountId is an order ID or order_acc_idx
  const numId = Number(telegramId);
  if (numId) {
    const userOrders = DataStore.getOrdersByCustomer(numId).filter(
      (o) => o.status === 'delivered' || (o.status as string) === 'completed'
    );
    for (const order of userOrders) {
      if (order.id === accountId || order.order_number === accountId || accountId.startsWith(order.id)) {
        const creds = Array.isArray(order.delivery_credentials) ? order.delivery_credentials : [];
        if (creds.length > 0) {
          const c = creds[0];
          return {
            account_id: c.account_id || `${order.id}_acc_0`,
            order_code: order.order_number || order.id,
            game_title: order.product_title || order.items?.[0]?.product_title || 'Gaming Account',
            username: c.username || 'N/A',
            password: c.password || '',
            two_factor_secret: c.two_factor || c.authenticator_secret || c.two_factor_secret || null,
            backup_codes: Array.isArray(c.backup_codes) ? c.backup_codes : undefined,
            notes: c.notes || order.fulfillment_notes || undefined,
            delivered_at: order.delivered_at || order.created_at,
          };
        }
      }
    }
  }

  return null;
}

/**
 * Step 1: Render and send/edit Vault Accounts List View
 */
export async function handleVaultMenu(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const accounts = await getCustomerDeliveredAccounts(telegramId);
  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  if (accounts.length === 0) {
    const text =
      lang === 'km'
        ? `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីហ្គេម</b>\n` +
          `━━━━━━━━━━━━━━━━━━━━━━\n` +
          `អ្នកមិនទាន់មានគណនីហ្គេមដែលបានបញ្ជូននៅឡើយទេ។\n\n` +
          `👉 ចុចខាងក្រោមដើម្បីចូលមើលទំនិញក្នុងហាង:`
        : `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
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
    lang === 'km'
      ? `🎒 <b>កាតាបឥវ៉ាន់ &amp; គណនីហ្គេម</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `អ្នកមានគណនីហ្គេមចំនួន <b>${accounts.length}</b> នៅក្នុងកាតាបរបស់អ្នក:\n\n` +
        `👇 <i>ចុចលើគណនីខាងក្រោមដើម្បីមើលព័ត៌មានគណនី & កូដ 2FA Live:</i>`
      : `🎒 <b>MY VAULT &amp; GAME ACCOUNTS</b>\n` +
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

  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';
  const twoFactorSecret = account.two_factor_secret
    ? `<code>${escapeHtml(account.two_factor_secret)}</code>`
    : '—';

  const backupCodesList =
    account.backup_codes && account.backup_codes.length > 0
      ? account.backup_codes.map((c) => `<code>${escapeHtml(c)}</code>`).join('\n')
      : '—';

  const text =
    lang === 'km'
      ? `🔐 <b>ព័ត៌មានគណនី &amp; កាតាបសុវត្ថិភាព</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎮 <b>ផលិតផល:</b> ${escapeHtml(account.game_title)}\n` +
        `📦 <b>លេខបញ្ជាទិញ:</b> <code>${escapeHtml(account.order_code)}</code>\n` +
        `📅 <b>កាលបរិច្ឆេទបញ្ជូន:</b> ${escapeHtml(formatDate(account.delivered_at))}\n\n` +
        `👤 <b>ឈ្មោះគណនី / ID:</b>\n` +
        `<code>${escapeHtml(account.username)}</code> <i>(ចុចដើម្បីចម្លង)</i>\n\n` +
        `🔑 <b>ពាក្យសម្ងាត់:</b>\n` +
        `<tg-spoiler><b>${escapeHtml(account.password)}</b></tg-spoiler> <i>(ចុច spoiler ដើម្បីបង្ហាញ)</i>\n\n` +
        `🛡️ <b>កូដសម្ងាត់ 2FA Authenticator:</b>\n` +
        `${twoFactorSecret}\n\n` +
        `📑 <b>កូដបម្រុង / Recovery Codes:</b>\n` +
        `${backupCodesList}\n\n` +
        `⚠️ <b>ការណែនាំសុវត្ថិភាព:</b> សូមភ្ជាប់ជាមួយ Email ផ្ទាល់ខ្លួនរបស់អ្នក និងប្តូរពាក្យសម្ងាត់ភ្លាមៗដើម្បីសុវត្ថិភាព 100%។\n` +
        `━━━━━━━━━━━━━━━━━━━━━━`
      : `🔐 <b>ACCOUNT CREDENTIALS &amp; VAULT</b>\n` +
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
  let totpCode = '';
  let remainingSeconds = 30;
  try {
    const totp = TOTPService.generateCode(cleanSecret, Date.now());
    remainingSeconds = totp.secondsRemaining;
    totpCode = totp.code;
  } catch {
    try {
      await ctx.answerCbQuery('Invalid 2FA secret format for this account. Please contact support.', { show_alert: true });
    } catch {}
    return;
  }

  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  // 1. Show interactive Telegram alert popup for instant view
  try {
    await ctx.answerCbQuery(
      lang === 'km'
        ? `🔢 កូដ 2FA Live: [ ${totpCode} ] (នៅសល់ ${remainingSeconds} វិនាទី)`
        : `🔢 Live 2FA Code: [ ${totpCode} ] (${remainingSeconds}s remaining)`,
      { show_alert: true }
    );
  } catch {}

  // 2. Also update panel text for convenient 1-tap copy
  const text =
    lang === 'km'
      ? `🔢 <b>កូដ 2FA LIVE របស់អ្នក:</b>\n\n` +
        `[ <b>${totpCode.slice(0, 3)} ${totpCode.slice(3)}</b> ] <i>(នៅសល់ ${remainingSeconds} វិនាទី)</i>\n` +
        `<code>${totpCode}</code> <i>(ចុចដើម្បីចម្លងកូដ)</i>\n\n` +
        `🎮 ${escapeHtml(account.game_title)} (@${escapeHtml(account.username)})`
      : `🔢 <b>YOUR LIVE 2FA CODE:</b>\n\n` +
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
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const orders = await fetchUserOrders(telegramId);
  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  let ordersContent = '';
  const actionKeyboardRows: any[] = [];

  if (orders.length === 0) {
    ordersContent =
      lang === 'km'
        ? `<i>មិនទាន់មានប្រវត្តិបញ្ជាទិញទេ។ នៅពេលអ្នកបញ្ជាទិញ វានឹងបង្ហាញនៅទីនេះ។</i>\n`
        : `<i>No orders found. Once you place an order, it will appear here.</i>\n`;
  } else {
    ordersContent = orders
      .map((o) => {
        const badge = getStatusBadge(o.status);
        const code = escapeHtml(o.orderCode);
        const dateStr = formatDate(o.createdAt);
        const amount = `$${o.totalAmount.toFixed(2)}`;
        const title = escapeHtml(o.productTitle);
        const qtyStr = o.quantity > 1 ? ` (x${o.quantity})` : '';
        return lang === 'km'
          ? `📦 <b>បញ្ជាទិញ #${code}</b> — ${badge}\n` +
            `  🎮 <b>ផលិតផល:</b> ${title}${qtyStr}\n` +
            `  💰 <b>សរុប:</b> ${amount} | 🗓️ <i>${dateStr}</i>`
          : `📦 <b>Order #${code}</b> — ${badge}\n` +
            `  🎮 <b>Product:</b> ${title}${qtyStr}\n` +
            `  💰 <b>Total:</b> ${amount} | 🗓️ <i>${dateStr}</i>`;
      })
      .join('\n\n');

    // Build specific, authorized action buttons for the displayed orders
    for (const o of orders) {
      const isDelivered = o.status === 'delivered' || o.status === 'completed';
      const isAccount = o.deliveryMode === 'auto_account';
      const creds = Array.isArray(o.deliveryCredentials) ? o.deliveryCredentials : [];

      if (isDelivered && isAccount && creds.length > 0) {
        if (creds.length === 1) {
          const accId = creds[0].account_id || `${o.id}_acc_0`;
          actionKeyboardRows.push([
            cb(`View Account`, `cb_view_acc_${accId}`, 'KEY'),
            cb(`Live 2FA`, `cb_gen_2fa_${accId}`, 'SHIELD'),
            cb(`View Order #${o.orderCode}`, `view_order:${o.id}`, 'PACKAGE'),
          ]);
        } else {
          // Multi-account order: provide discrete button for each account delivered
          const multiAccButtons: any[] = [];
          creds.forEach((c, idx) => {
            const accId = c.account_id || `${o.id}_acc_${idx}`;
            multiAccButtons.push(cb(`Account #${idx + 1}`, `cb_view_acc_${accId}`, 'KEY'));
            multiAccButtons.push(cb(`2FA #${idx + 1}`, `cb_gen_2fa_${accId}`, 'SHIELD'));
          });
          for (let i = 0; i < multiAccButtons.length; i += 2) {
            actionKeyboardRows.push(multiAccButtons.slice(i, i + 2));
          }
          actionKeyboardRows.push([cb(`View Order #${o.orderCode}`, `view_order:${o.id}`, 'PACKAGE')]);
        }
      } else {
        actionKeyboardRows.push([
          cb(`View Order #${o.orderCode}`, `view_order:${o.id}`, 'PACKAGE'),
        ]);
      }
    }
  }

  const openOrdersUrl = storeUrl.includes('?') ? `${storeUrl}&tab=orders` : `${storeUrl}?tab=orders`;
  actionKeyboardRows.push([
    createWebAppOrUrlButton('📱 Open Orders in Mini App', openOrdersUrl, 'PACKAGE'),
    cb('Back Home', 'cb_main_menu', 'HOME'),
  ]);

  const text =
    lang === 'km'
      ? `📜 <b>ប្រវត្តិបញ្ជាទិញថ្មីៗ (១០ ចុងក្រោយ)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        ordersContent + `\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>ចុចប៊ូតុងខាងក្រោមដើម្បីមើលព័ត៌មានគណនី, កូដ 2FA Live ឬព័ត៌មានលម្អិត។</i>`
      : `📜 <b>RECENT ORDER HISTORY (LAST 10)</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        ordersContent + `\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `<i>Tap buttons below to view account credentials, live 2FA codes, or complete order details.</i>`;

  const keyboard = Markup.inlineKeyboard(actionKeyboardRows);
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
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  await handleOrdersRecent(ctx, storeUrl);
}

/**
 * Handle Track Order ID (cb_orders_track)
 */
export async function handleOrdersTrack(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
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
