import type { InlineKeyboardButton, InlineKeyboardMarkup } from 'telegraf/types';
import { isAuthorizedAdmin } from './admin-guards';
import { getLowStockItems, getRecentOrders, getTodayStats } from './admin-data';
import { RobuxService } from '../../services/robux.service';
import { DataStore } from '../../database/data-store';
import { ADMIN_BASE_PATH } from '../../config/admin-slug';
import { resolveAdminPortalUrl } from '../../config/app-url';
import { TELEGRAM_EMOJIS, TelegramEmojiKey } from '../../config/telegram-emojis';
import { stripLeadingEmoji } from '../store-bot/keyboards';
import {
  startBroadcastWizard,
  handleBroadcastWizardCallback,
} from './broadcast-wizard';

export interface AdminView {
  text: string;
  replyMarkup: InlineKeyboardMarkup;
}

const UNAUTHORIZED_TEXT = '⛔ Access denied. You are not an authorized admin.';

export function unauthorizedView(): AdminView {
  return { text: UNAUTHORIZED_TEXT, replyMarkup: { inline_keyboard: [] } };
}

export function resolveDefaultAdminUrl(): string {
  return resolveAdminPortalUrl();
}

function row(...buttons: InlineKeyboardButton[]): InlineKeyboardButton[] {
  return buttons;
}

export function makeAdminButton(opts: {
  text: string;
  iconKey?: TelegramEmojiKey;
  callbackData?: string;
  url?: string;
  webAppUrl?: string;
}): InlineKeyboardButton {
  const customEmojiDisabled = process.env.BUTTON_CUSTOM_EMOJI === 'off';
  const emojiDef = opts.iconKey ? TELEGRAM_EMOJIS[opts.iconKey] : undefined;
  const customId = !customEmojiDisabled ? emojiDef?.customEmojiId : undefined;
  const fallback = emojiDef?.fallback || '';

  const cleanText = stripLeadingEmoji(opts.text);
  const hasCustomId = Boolean(customId && customId.trim() !== '');

  let finalText = cleanText;
  if (!hasCustomId) {
    if (opts.text !== cleanText) {
      finalText = opts.text;
    } else if (fallback) {
      finalText = `${fallback} ${cleanText}`.trim();
    }
  }

  const btn: any = { text: finalText };
  if (opts.webAppUrl) {
    btn.web_app = { url: opts.webAppUrl };
  } else if (opts.url) {
    btn.url = opts.url;
  } else if (opts.callbackData) {
    btn.callback_data = opts.callbackData;
  }

  if (hasCustomId) {
    btn.icon_custom_emoji_id = customId!.trim();
  }

  Object.defineProperty(btn, '__fallback', {
    value: fallback,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return btn;
}

export function buildMainMenu(storeUrl: string, adminUrl: string = resolveDefaultAdminUrl()): InlineKeyboardMarkup {
  return {
    inline_keyboard: [
      row(makeAdminButton({ text: 'OPEN ADMIN PORTAL', webAppUrl: adminUrl, iconKey: 'SHIELD' })),
      row(makeAdminButton({ text: 'Open Store (customer view)', url: storeUrl, iconKey: 'SHOPPING_CART' })),
      row(makeAdminButton({ text: 'Today Stats', callbackData: 'admin:stats:today', iconKey: 'BAR_CHART' })),
      row(makeAdminButton({ text: 'Robux Stock & Pool', callbackData: 'admin:robux:pool', iconKey: 'ROBUX' })),
      row(makeAdminButton({ text: 'Redeem Codes', callbackData: 'admin:redeem_codes', iconKey: 'TICKET' })),
      row(makeAdminButton({ text: 'Recent Orders', callbackData: 'admin:orders:recent', iconKey: 'PACKAGE' })),
      row(makeAdminButton({ text: 'Low Stock', callbackData: 'admin:stock:low', iconKey: 'ALERT' })),
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
  const back = row(makeAdminButton({ text: 'Back to menu', callbackData: 'admin:menu', iconKey: 'BACK' }));

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
          row(makeAdminButton({ text: 'Refresh', callbackData: data, iconKey: 'REFRESH' })),
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
            makeAdminButton({ text: 'Set Robux Rate', callbackData: 'admin:robux:set_rate', iconKey: 'MONEY' }),
            makeAdminButton({ text: 'Add Robux Stock', callbackData: 'admin:robux:add_stock', iconKey: 'PACKAGE' }),
          ],
          [
            makeAdminButton({ text: 'View Available Stock', callbackData: 'admin:robux:view_stock', iconKey: 'ROBUX' }),
            makeAdminButton({ text: 'View Robux Orders', callbackData: 'admin:robux:orders', iconKey: 'RECEIPT' }),
          ],
          [
            makeAdminButton({ text: 'Manage Robux Settings', callbackData: 'admin:robux:settings', iconKey: 'GEAR' }),
            makeAdminButton({ text: stock.is_active ? 'Disable Service' : 'Enable Service', callbackData: 'admin:robux:toggle_active', iconKey: stock.is_active ? 'RED_CIRCLE' : 'GREEN_CIRCLE' }),
          ],
          [
            makeAdminButton({ text: 'Refresh Pool', callbackData: 'admin:robux:pool', iconKey: 'REFRESH' }),
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
            makeAdminButton({ text: 'Back to Robux Pool', callbackData: 'admin:robux:pool', iconKey: 'BACK' }),
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
            makeAdminButton({ text: 'Refresh Orders', callbackData: 'admin:robux:orders', iconKey: 'REFRESH' }),
            makeAdminButton({ text: 'Back to Robux Pool', callbackData: 'admin:robux:pool', iconKey: 'BACK' }),
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
            makeAdminButton({ text: stock.is_active ? 'Disable Service' : 'Enable Service', callbackData: 'admin:robux:toggle_active', iconKey: stock.is_active ? 'RED_CIRCLE' : 'GREEN_CIRCLE' }),
          ],
          [
            makeAdminButton({ text: 'Back to Robux Pool', callbackData: 'admin:robux:pool', iconKey: 'BACK' }),
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
          row(makeAdminButton({ text: 'Refresh', callbackData: 'admin:orders:recent', iconKey: 'REFRESH' })),
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
          row(makeAdminButton({ text: 'Refresh', callbackData: data, iconKey: 'REFRESH' })),
          back,
        ],
      },
    };
  }

  if (data === 'admin:redeem_codes') {
    const codes = DataStore.getRedeemCodes();
    const active = codes.filter((c) => c.is_active).length;
    const usages = DataStore.getRedeemCodeUsages().length;

    const listSummary =
      codes.slice(0, 5).map((c) => {
        const val = c.reward_type === 'discount_coupon' ? (c.reward_data as any)?.discount_value : c.reward_amount;
        return `• <code>${c.code}</code> (${c.reward_type}: ${val}) - ${c.times_used}/${c.max_uses ?? '∞'} uses ${c.is_active ? '🟢' : '🔴'}`;
      }).join('\n') || '<i>No redeem codes created yet.</i>';

    const text =
      `🎟️ <b>Redeem Codes Management</b>\n\n` +
      `• Total Codes: <b>${codes.length}</b>\n` +
      `• Active Codes: <b>${active}</b>\n` +
      `• Total Redemptions: <b>${usages}</b>\n\n` +
      `<b>Recent Codes:</b>\n${listSummary}\n\n` +
      `<i>Create, generate, and manage redeem codes in the <b>Admin Portal</b>.</i>`;

    return {
      text,
      replyMarkup: {
        inline_keyboard: [
          row(makeAdminButton({ text: 'Open Admin Portal', webAppUrl: `${adminUrl}?tab=redeem_codes`, iconKey: 'SHIELD' })),
          row(makeAdminButton({ text: 'Refresh', callbackData: 'admin:redeem_codes', iconKey: 'REFRESH' })),
          back,
        ],
      },
    };
  }

  if (data.startsWith('wiz_bc_')) {
    return handleBroadcastWizardCallback(data, from);
  }

  if (data === 'cb_admin_broadcast' || data === 'admin_broadcast') {
    return startBroadcastWizard(from.id);
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
