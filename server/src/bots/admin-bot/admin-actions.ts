import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';
import { isAuthorizedAdmin } from './admin-guards';
import { getLowStockItems, getRecentOrders, getTodayStats } from './admin-data';
import { RobuxService } from '../../services/robux.service';
import { ADMIN_BASE_PATH } from '../../config/admin-slug';

export interface AdminView {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
}

const UNAUTHORIZED_TEXT = '⛔ Access denied. You are not an authorized admin.';

export function unauthorizedView(): AdminView {
  return { text: UNAUTHORIZED_TEXT, replyMarkup: { inline_keyboard: [] } };
}

function resolveDefaultAdminUrl(): string {
  const explicit = (process.env.ADMIN_WEBAPP_URL || process.env.ADMIN_URL || process.env.ADMIN_MINIAPP_URL || '').trim();
  if (explicit && (explicit.startsWith('https://') || explicit.startsWith('http://'))) {
    try {
      const parsed = new URL(explicit);
      if (parsed.pathname && parsed.pathname !== '/') return explicit.replace(/\/$/, '');
      return `${parsed.origin}${ADMIN_BASE_PATH}`;
    } catch {
      return explicit.replace(/\/$/, '');
    }
  }
  const base = (
    process.env.SERVER_URL ||
    process.env.PUBLIC_URL ||
    process.env.APP_URL ||
    'https://web-production-2d8bd.up.railway.app'
  ).trim().replace(/\/$/, '');
  return `${base}${ADMIN_BASE_PATH}`;
}

function row(...buttons: InlineKeyboardButton[]): InlineKeyboardButton[] {
  return buttons;
}

export function buildMainMenu(storeUrl: string, adminUrl: string = resolveDefaultAdminUrl()): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row({ text: '🛡️ OPEN ADMIN PORTAL', web_app: { url: adminUrl } }),
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
  adminUrl: string = resolveDefaultAdminUrl(),
): AdminView {
  if (!from || !isAuthorizedAdmin(from.id)) return unauthorizedView();
  const name = from.first_name ? ` ${from.first_name}` : '';
  const text =
    `🛡️ <b>Admin Control</b>\n\n` +
    `Welcome${name}. Select an action below to manage the store and stock:\n\n` +
    `<i>Tap <b>OPEN ADMIN PORTAL</b> to open your dedicated management dashboard.</i>`;
  return { text, replyMarkup: buildMainMenu(storeUrl, adminUrl) };
}

export async function handleAdminCallback(
  data: string,
  from: { id: number } | undefined,
  storeUrl: string,
  adminUrl: string = resolveDefaultAdminUrl(),
): Promise<AdminView | null> {
  if (!from || !isAuthorizedAdmin(from.id)) return unauthorizedView();
  const back = row({ text: '« Back to menu', callback_data: 'admin:menu' });

  if (data === 'admin:menu' || data === 'cb_admin_menu') {
    return handleAdminStart(from, storeUrl, adminUrl);
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

  if (data === 'admin:robux:pool' || data === 'admin:robux:view_stock') {
    const stock = await RobuxService.getStockConfig();
    const tiers = RobuxService.calculateTiers(stock);
    const available = stock.total_balance - stock.reserved_balance;

    const tierLines = tiers
      .map(t => `• <b>${t.denomination} R$:</b> ${t.is_sold_out ? '❌ SOLD OUT' : `${t.available_packs} packs ($${t.price_usd.toFixed(2)})`}`)
      .join('\n');

    const text =
      `💎 <b>Robux Management &amp; Stock Pool</b>\n\n` +
      `• Total Balance: <b>${stock.total_balance} R$</b>\n` +
      `• Reserved in Checkout: <b>${stock.reserved_balance} R$</b>\n` +
      `• Available for Purchase: <b>${available} R$</b>\n` +
      `• Current Rate: <b>$${stock.rate_per_1000.toFixed(2)} per 1,000 R$</b>\n` +
      `• Service Status: <b>${stock.is_active ? '🟢 ACTIVE' : '🔴 DISABLED (Compliance Gate)'}</b>\n\n` +
      `<b>Derived Pack Availability:</b>\n${tierLines}\n\n` +
      `<i>Commands: <code>/setrate &lt;usd&gt;</code> | <code>/addrobux &lt;amount&gt;</code> | <code>/setrobux &lt;total&gt;</code></i>`;

    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '💲 Set Robux Rate', callback_data: 'admin:robux:set_rate' },
            { text: '➕ Add Robux Stock', callback_data: 'admin:robux:add_stock' },
          ],
          [
            { text: '📦 View Available Stock', callback_data: 'admin:robux:view_stock' },
            { text: '📋 View Robux Orders', callback_data: 'admin:robux:orders' },
          ],
          [
            { text: '⚙️ Manage Robux Settings', callback_data: 'admin:robux:settings' },
            { text: stock.is_active ? '🔴 Disable Service' : '🟢 Enable Service', callback_data: 'admin:robux:toggle_active' },
          ],
          [
            { text: '🔄 Refresh Pool', callback_data: 'admin:robux:pool' },
            back[0],
          ],
        ],
      },
    };
  }

  if (data === 'admin:robux:set_rate') {
    const stock = await RobuxService.getStockConfig();
    const text =
      `💲 <b>Set Robux Pricing Rate</b>\n\n` +
      `Current Rate: <b>$${stock.rate_per_1000.toFixed(2)} per 1,000 R$</b>\n\n` +
      `Select a quick preset below or send command:\n` +
      `<code>/setrate &lt;price_per_1000&gt;</code> (e.g. <code>/setrate 3.50</code>)`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '$3.00 / 1k', callback_data: 'admin:robux:set_rate_preset:3.00' },
            { text: '$3.50 / 1k', callback_data: 'admin:robux:set_rate_preset:3.50' },
          ],
          [
            { text: '$4.00 / 1k', callback_data: 'admin:robux:set_rate_preset:4.00' },
            { text: '$4.50 / 1k', callback_data: 'admin:robux:set_rate_preset:4.50' },
          ],
          [
            { text: '« Back to Robux Pool', callback_data: 'admin:robux:pool' },
          ],
        ],
      },
    };
  }

  if (data.startsWith('admin:robux:set_rate_preset:')) {
    const newRate = parseFloat(data.replace('admin:robux:set_rate_preset:', ''));
    if (!isNaN(newRate) && newRate > 0) {
      await RobuxService.setRate(String(from.id), newRate, 'ADMIN_BOT_PRESET');
    }
    return handleAdminCallback('admin:robux:pool', from, storeUrl);
  }

  if (data === 'admin:robux:add_stock') {
    const stock = await RobuxService.getStockConfig();
    const text =
      `➕ <b>Add Robux Stock</b>\n\n` +
      `Current Total: <b>${stock.total_balance} R$</b>\n` +
      `Available: <b>${stock.total_balance - stock.reserved_balance} R$</b>\n\n` +
      `Select a quick amount to add to the pool or send command:\n` +
      `<code>/addrobux &lt;amount&gt;</code> (e.g. <code>/addrobux 5000</code>)`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '+1,000 R$', callback_data: 'admin:robux:add_stock_preset:1000' },
            { text: '+5,000 R$', callback_data: 'admin:robux:add_stock_preset:5000' },
          ],
          [
            { text: '+10,000 R$', callback_data: 'admin:robux:add_stock_preset:10000' },
            { text: '+25,000 R$', callback_data: 'admin:robux:add_stock_preset:25000' },
          ],
          [
            { text: '« Back to Robux Pool', callback_data: 'admin:robux:pool' },
          ],
        ],
      },
    };
  }

  if (data.startsWith('admin:robux:add_stock_preset:')) {
    const addAmt = parseInt(data.replace('admin:robux:add_stock_preset:', ''), 10);
    if (!isNaN(addAmt) && addAmt > 0) {
      await RobuxService.addStock(String(from.id), addAmt, 'ADMIN_BOT_PRESET');
    }
    return handleAdminCallback('admin:robux:pool', from, storeUrl);
  }

  if (data === 'admin:robux:orders') {
    const orders = await RobuxService.getRecentOrders(8);
    const lines = orders.length === 0
      ? ['<i>No Robux orders recorded yet</i>']
      : orders.map(o =>
          `• <code>${o.order_code}</code> | ${o.robux_amount} R$ ($${o.price_usd.toFixed(2)})\n` +
          `   Roblox: <code>${o.roblox_username}</code> | Status: <b>${o.status.toUpperCase()}</b>`
        );
    const text = `📋 <b>Recent Robux Orders</b>\n\n${lines.join('\n\n')}`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: '🔄 Refresh Orders', callback_data: 'admin:robux:orders' },
            { text: '« Back to Robux Pool', callback_data: 'admin:robux:pool' },
          ],
        ],
      },
    };
  }

  if (data === 'admin:robux:settings') {
    const stock = await RobuxService.getStockConfig();
    const text =
      `⚙️ <b>Robux Service Settings &amp; Compliance</b>\n\n` +
      `• Active Status: <b>${stock.is_active ? '🟢 ACTIVE' : '🔴 DISABLED (Compliance Gate)'}</b>\n` +
      `• Min Order: <b>${stock.min_order_robux} R$</b>\n` +
      `• Max Order: <b>${stock.max_order_robux} R$</b>\n` +
      `• Current Rate: <b>$${stock.rate_per_1000.toFixed(2)} / 1,000 R$</b>\n\n` +
      `🛡️ <b>Compliance Policy Note:</b>\n` +
      `Direct payment-for-Robux transfers require official partner / group distribution licensing per Roblox terms. When disabled, buyers are shown compliance notices.`;
    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          [
            { text: stock.is_active ? '🔴 Disable Service' : '🟢 Enable Service', callback_data: 'admin:robux:toggle_active' },
          ],
          [
            { text: '« Back to Robux Pool', callback_data: 'admin:robux:pool' },
          ],
        ],
      },
    };
  }

  if (data === 'admin:robux:toggle_active') {
    const stock = await RobuxService.getStockConfig();
    await RobuxService.updateSettings(
      String(from.id),
      { is_active: !stock.is_active },
      `TOGGLE_ACTIVE_TO_${!stock.is_active}`
    );
    return handleAdminCallback('admin:robux:settings', from, storeUrl);
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
