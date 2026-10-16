import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';
import { isAuthorizedAdmin } from './admin-guards';
import { getLowStockItems, getRecentOrders, getTodayStats } from './admin-data';
import { RobuxService } from '../../services/robux.service';

export interface AdminView {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
}

const UNAUTHORIZED_TEXT = '⛔ Access denied. You are not an authorized admin.';

export function unauthorizedView(): AdminView {
  return { text: UNAUTHORIZED_TEXT, replyMarkup: { inline_keyboard: [] } };
}

function row(...buttons: InlineKeyboardButton[]): InlineKeyboardButton[] {
  return buttons;
}

export function buildMainMenu(storeUrl: string): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row({ text: '🛒 Open Store (customer view)', url: storeUrl }),
      row({ text: '📊 Today Stats', callback_data: 'admin:stats:today' }),
      row({ text: '💎 Robux Stock & Pool', callback_data: 'admin:robux:pool' }),
      row({ text: '📦 Recent Orders', callback_data: 'admin:orders:recent' }),
      row({ text: '⚠️ Low Stock', callback_data: 'admin:stock:low' }),
    ],
  };
}

export function handleAdminStart(
  from: { id: number; first_name?: string } | undefined,
  storeUrl: string,
): AdminView {
  if (!from || !isAuthorizedAdmin(from.id)) return unauthorizedView();
  const name = from.first_name ? ` ${from.first_name}` : '';
  const text =
    `🛡️ <b>Admin Control</b>\n\n` +
    `Welcome${name}. Select an action below.\n` +
    `<i>The admin web app is kept private and not linked here.</i>`;
  return { text, replyMarkup: buildMainMenu(storeUrl) };
}

export async function handleAdminCallback(
  data: string,
  from: { id: number } | undefined,
  storeUrl: string,
): Promise<AdminView | null> {
  if (!from || !isAuthorizedAdmin(from.id)) return unauthorizedView();
  const back = row({ text: '« Back to menu', callback_data: 'admin:menu' });

  if (data === 'admin:menu' || data === 'cb_admin_menu') {
    return handleAdminStart(from, storeUrl);
  }

  if (data === 'admin:stats:today' || data === 'cb_admin_metrics' || data === 'admin_metrics') {
    const stats = await getTodayStats();
    const text =
      `📈 <b>Real-Time Metrics</b> (UTC)\n\n` +
      `• Orders: <b>${stats.todayOrders}</b>\n` +
      `• Revenue: <b>$${stats.todayRevenueUsd.toFixed(2)}</b>\n` +
      `• Pending fulfillment: <b>${stats.pendingFulfillment}</b>`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          row({ text: '🔄 Refresh', callback_data: data }),
          back,
        ],
      },
    };
  }

  if (data === 'admin:robux:pool') {
    const stock = await RobuxService.getStockConfig();
    const tiers = RobuxService.calculateTiers(stock);
    const available = stock.total_balance - stock.reserved_balance;

    const tierLines = tiers
      .map(t => `• <b>${t.denomination} R$:</b> ${t.is_sold_out ? '❌ SOLD OUT' : `${t.available_packs} packs ($${t.price_usd.toFixed(2)})`}`)
      .join('\n');

    const text =
      `💎 <b>Shared Robux Stock Pool</b>\n\n` +
      `• Total Balance: <b>${stock.total_balance} R$</b>\n` +
      `• Reserved in Checkout: <b>${stock.reserved_balance} R$</b>\n` +
      `• Available for Purchase: <b>${available} R$</b>\n` +
      `• Current Rate: <b>$${stock.rate_per_1000.toFixed(2)} / 1,000 R$</b>\n\n` +
      `<b>Derived Pack Availability:</b>\n${tierLines}\n\n` +
      `<i>To adjust total stock, use command: <code>/setrobux &lt;amount&gt;</code></i>`;

    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          row({ text: '🔄 Refresh Pool', callback_data: 'admin:robux:pool' }),
          back,
        ],
      },
    };
  }

  if (data === 'admin:orders:recent') {
    const orders = await getRecentOrders(5);
    const lines = orders.length === 0
      ? ['<i>No recent orders</i>']
      : orders.map((o) => `• <code>#${o.shortId}</code> — $${o.totalUsd.toFixed(2)} [${o.status}] (${o.customer})`);
    const text = `📦 <b>Recent Orders</b> (last 5)\n\n${lines.join('\n')}`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          row({ text: '🔄 Refresh', callback_data: 'admin:orders:recent' }),
          back,
        ],
      },
    };
  }

  if (data === 'admin:stock:low' || data === 'cb_admin_inventory' || data === 'admin_inventory') {
    const items = await getLowStockItems(5);
    const lines = items.length === 0
      ? ['<i>All items well stocked</i>']
      : items.map((i) => `• ${i.name}: <b>${i.remaining}</b> left`);
    const text = `📦 <b>Live Inventory Status</b>\n\n${lines.join('\n')}`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          row({ text: '🔄 Refresh', callback_data: data }),
          back,
        ],
      },
    };
  }

  if (data === 'cb_admin_broadcast' || data === 'admin_broadcast') {
    const text = `📢 <b>Store Broadcast</b>\n\nTo broadcast announcements or stock arrivals to customers, use the Admin Portal or REST API <code>/api/admin/broadcast</code>.`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [back],
      },
    };
  }

  if (data === 'cb_admin_settings' || data === 'admin_settings') {
    const text = `⚙️ <b>Store Settings</b>\n\nStore configuration and maintenance controls are managed securely inside the Admin Portal.`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [back],
      },
    };
  }

  return null;
}

export function isMessageNotModifiedError(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const msg = 'message' in err && typeof (err as { message: unknown }).message === 'string'
    ? (err as { message: string }).message
    : '';
  const desc = 'description' in err && typeof (err as { description: unknown }).description === 'string'
    ? (err as { description: string }).description
    : '';
  return /message is not modified/i.test(msg) || /message is not modified/i.test(desc);
}
