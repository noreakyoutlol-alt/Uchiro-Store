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
import { BatchAnnouncementService } from '../../services/batch-announcement.service';

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
      row(makeAdminButton({ text: 'Seasonal Themes', callbackData: 'admin:theme:menu', iconKey: 'SPARKLES' })),
      row(makeAdminButton({ text: 'Today Stats', callbackData: 'admin:stats:today', iconKey: 'BAR_CHART' })),
      row(makeAdminButton({ text: 'Robux Stock & Pool', callbackData: 'admin:robux:pool', iconKey: 'ROBUX' })),
      row(makeAdminButton({ text: 'Stock Announcements', callbackData: 'admin:stock_batch', iconKey: 'ROCKET' })),
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

  // ================= BATCH STOCK ANNOUNCEMENTS (PROMPT 5) =================
  if (data === 'admin:stock_batch') {
    const preview = await BatchAnnouncementService.previewBatch();
    const grpSummary = preview.grouped_preview.length > 0
      ? preview.grouped_preview.map((g) => `• <b>${g.group_label}</b>: ${g.products.length} product(s)`).join('\n')
      : '<i>No pending products</i>';

    const text =
      `📢 <b>Stock Announcement Batch</b>\n\n` +
      `• Eligible Products: <b>${preview.eligible_count}</b>\n` +
      `• Excluded (0 stock / draft): <b>${preview.excluded_count}</b>\n` +
      `• Authorized Groups: <b>${preview.groups_count}</b>\n\n` +
      `<b>Pending Categories:</b>\n${grpSummary}\n\n` +
      `<i>Click <b>Preview Message</b> to review or <b>Publish All New Stock</b> to dispatch 1 consolidated message per group.</i>`;

    const buttons = [];
    if (preview.eligible_count > 0 && preview.groups_count > 0) {
      buttons.push(row(makeAdminButton({ text: 'Preview Message', callbackData: 'admin:stock_batch:preview', iconKey: 'EYE' })));
      buttons.push(row(makeAdminButton({ text: 'Publish All New Stock', callbackData: 'admin:stock_batch:publish', iconKey: 'ROCKET' })));
    }
    buttons.push(row(makeAdminButton({ text: 'Refresh', callbackData: 'admin:stock_batch', iconKey: 'REFRESH' })));
    buttons.push(back);

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  if (data === 'admin:stock_batch:preview') {
    const preview = await BatchAnnouncementService.previewBatch();
    const previewText = preview.preview_text.length > 3200
      ? preview.preview_text.slice(0, 3200) + '\n\n<i>[Truncated for Telegram inline preview — full message will send cleanly in parts]</i>'
      : preview.preview_text;

    const text =
      `👁️ <b>Consolidated Announcement Preview</b>\n` +
      `━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${previewText}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `Ready to publish to <b>${preview.groups_count}</b> authorized group(s)?`;

    const buttons = [
      row(makeAdminButton({ text: 'Publish All New Stock', callbackData: 'admin:stock_batch:publish', iconKey: 'ROCKET' })),
      row(makeAdminButton({ text: 'Back to Batch', callbackData: 'admin:stock_batch', iconKey: 'BACK' })),
    ];

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  if (data === 'admin:stock_batch:publish') {
    const result = await BatchAnnouncementService.publishBatch(from.id);
    const statusEmoji = result.status === 'succeeded' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';

    const text =
      `${statusEmoji} <b>Stock Announcement Result</b>\n\n` +
      `• Status: <b>${(result.status || 'FAILED').toUpperCase()}</b>\n` +
      `• Groups Succeeded: <b>${result.succeeded_groups || 0}/${result.total_groups || 0}</b>\n` +
      `• Products Announced: <b>${result.published_products_count || 0}</b>\n` +
      `• Skipped Products: <b>${result.skipped_products_count || 0}</b>\n` +
      (result.message ? `\n<i>${result.message}</i>` : '');

    const buttons = [];
    if (result.batch_id && (result.failed_groups || 0) > 0) {
      buttons.push(row(makeAdminButton({ text: 'Retry Failed Groups', callbackData: `admin:stock_batch:retry:${result.batch_id}`, iconKey: 'REFRESH' })));
    }
    buttons.push(row(makeAdminButton({ text: 'Back to Batch', callbackData: 'admin:stock_batch', iconKey: 'BACK' })));
    buttons.push(back);

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  if (data.startsWith('admin:stock_batch:retry:')) {
    const batchId = data.replace('admin:stock_batch:retry:', '');
    const result = await BatchAnnouncementService.retryFailedGroups(from.id, batchId);
    const statusEmoji = result.status === 'succeeded' ? '✅' : result.status === 'partial' ? '⚠️' : '❌';

    const text =
      `${statusEmoji} <b>Retry Delivery Result</b>\n\n` +
      `• Status: <b>${(result.status || 'FAILED').toUpperCase()}</b>\n` +
      `• Groups Succeeded: <b>${result.succeeded_groups || 0}/${result.total_groups || 0}</b>\n` +
      (result.message ? `\n<i>${result.message}</i>` : '');

    const buttons = [];
    if (result.batch_id && (result.failed_groups || 0) > 0) {
      buttons.push(row(makeAdminButton({ text: 'Retry Failed Groups', callbackData: `admin:stock_batch:retry:${result.batch_id}`, iconKey: 'REFRESH' })));
    }
    buttons.push(row(makeAdminButton({ text: 'Back to Batch', callbackData: 'admin:stock_batch', iconKey: 'BACK' })));
    buttons.push(back);

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  // ================= SEASONAL THEMES (PROMPT 6) =================
  const THEME_INFO: Record<string, { label: string; emoji: string; desc: string }> = {
    gaming: {
      label: 'Default Gaming',
      emoji: '🎮',
      desc: 'Existing Uchiro space-gaming pattern & celestial glow (Default fallback).',
    },
    halloween: {
      label: 'Halloween',
      emoji: '🎃',
      desc: 'Spooky web decorations, animated spiders, and atmospheric audio.',
    },
    christmas: {
      label: 'Christmas',
      emoji: '🎄',
      desc: 'Lightweight falling snow, festive lights, and holiday chimes.',
    },
    'angkor-khmer': {
      label: 'Angkor / Khmer',
      emoji: '🏛️',
      desc: 'Angkor Wat silhouette, Khmer motifs, and royal gold accents.',
    },
  };

  if (data === 'admin:theme:menu') {
    const currentTheme = DataStore.getSeasonalTheme();
    const activeInfo = THEME_INFO[currentTheme.active_theme] || THEME_INFO.gaming;

    const text =
      `🎨 <b>Seasonal Store Themes</b>\n\n` +
      `• Active Theme: <b>${activeInfo.emoji} ${activeInfo.label}</b>\n` +
      `• Last Updated: <b>${new Date(currentTheme.updated_at).toUTCString()}</b>\n\n` +
      `<b>Available Themes:</b>\n` +
      `1. 🎮 <b>Default Gaming</b> — Original space-doodle aesthetic\n` +
      `2. 🎃 <b>Halloween</b> — Spooky web accents & spiders\n` +
      `3. 🎄 <b>Christmas</b> — Falling snow & festive lights\n` +
      `4. 🏛️ <b>Angkor / Khmer</b> — Angkor Wat silhouette & gold accents\n\n` +
      `<i>Tap a theme below to preview or activate globally:</i>`;

    const themeButtons = [
      [
        makeAdminButton({ text: `${currentTheme.active_theme === 'gaming' ? '✅ ' : ''}🎮 Gaming`, callbackData: 'admin:theme:select:gaming' }),
        makeAdminButton({ text: `${currentTheme.active_theme === 'halloween' ? '✅ ' : ''}🎃 Halloween`, callbackData: 'admin:theme:select:halloween' }),
      ],
      [
        makeAdminButton({ text: `${currentTheme.active_theme === 'christmas' ? '✅ ' : ''}🎄 Christmas`, callbackData: 'admin:theme:select:christmas' }),
        makeAdminButton({ text: `${currentTheme.active_theme === 'angkor-khmer' ? '✅ ' : ''}🏛️ Angkor Khmer`, callbackData: 'admin:theme:select:angkor-khmer' }),
      ],
      back,
    ];

    return {
      text,
      replyMarkup: { inline_keyboard: themeButtons },
    };
  }

  if (data.startsWith('admin:theme:select:')) {
    const themeId = data.replace('admin:theme:select:', '');
    const info = THEME_INFO[themeId] || { label: themeId, emoji: '🎨', desc: 'Custom Theme' };
    const currentTheme = DataStore.getSeasonalTheme();
    const isActive = currentTheme.active_theme === themeId;

    const previewUrl = `${storeUrl}${storeUrl.includes('?') ? '&' : '?'}theme=${encodeURIComponent(themeId)}`;

    const text =
      `${info.emoji} <b>Theme: ${info.label}</b>\n\n` +
      `• Status: <b>${isActive ? '🟢 CURRENTLY ACTIVE' : '⚪ Inactive'}</b>\n` +
      `• Details: ${info.desc}\n\n` +
      (isActive
        ? `✅ <i>This theme is currently active for all customers.</i>`
        : `⚡ <i>Tap <b>Activate Globally</b> below to switch the store theme.</i>`);

    const buttons = [];
    buttons.push(row(makeAdminButton({ text: 'Preview in Store', url: previewUrl, iconKey: 'EYE' })));
    if (!isActive) {
      buttons.push(row(makeAdminButton({ text: '⚡ Activate Globally', callbackData: `admin:theme:confirm:${themeId}`, iconKey: 'CHECK' })));
    }
    buttons.push(row(makeAdminButton({ text: 'Back to Themes', callbackData: 'admin:theme:menu', iconKey: 'BACK' })));
    buttons.push(back);

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  if (data.startsWith('admin:theme:confirm:')) {
    const themeId = data.replace('admin:theme:confirm:', '');
    const info = THEME_INFO[themeId] || { label: themeId, emoji: '🎨', desc: '' };

    const text =
      `⚠️ <b>CONFIRM GLOBAL THEME ACTIVATION</b>\n\n` +
      `You are about to activate <b>${info.emoji} ${info.label}</b> globally for ALL customers across the store.\n\n` +
      `• Theme: <b>${info.label}</b>\n` +
      `• Target: Customer Mini App / Web Store\n` +
      `• Effect: Immediate across all customer sessions\n\n` +
      `Are you sure you want to proceed?`;

    const buttons = [
      row(makeAdminButton({ text: '✅ Yes, Activate Globally', callbackData: `admin:theme:do_activate:${themeId}`, iconKey: 'CHECK' })),
      row(makeAdminButton({ text: '❌ Cancel', callbackData: `admin:theme:select:${themeId}`, iconKey: 'BACK' })),
    ];

    return {
      text,
      replyMarkup: { inline_keyboard: buttons },
    };
  }

  if (data.startsWith('admin:theme:do_activate:')) {
    const themeId = data.replace('admin:theme:do_activate:', '');
    try {
      const updated = DataStore.setSeasonalTheme(from.id, themeId);
      const info = THEME_INFO[updated.active_theme] || { label: updated.active_theme, emoji: '🎨' };

      const text =
        `🎉 <b>Theme Activated Successfully!</b>\n\n` +
        `• Active Theme: <b>${info.emoji} ${info.label}</b>\n` +
        `• Activated By: Admin <code>${from.id}</code>\n` +
        `• Timestamp: <b>${new Date(updated.updated_at).toUTCString()}</b>\n\n` +
        `<i>Customers opening or refreshing the store will now see this theme.</i>`;

      const buttons = [
        row(makeAdminButton({ text: 'Open Customer Store', url: storeUrl, iconKey: 'SHOPPING_CART' })),
        row(makeAdminButton({ text: 'Back to Themes', callbackData: 'admin:theme:menu', iconKey: 'BACK' })),
      ];

      return {
        text,
        replyMarkup: { inline_keyboard: buttons },
      };
    } catch (err: any) {
      const text = `❌ <b>Activation Failed:</b> ${err?.message || 'Unknown error'}`;
      return {
        text,
        replyMarkup: {
          inline_keyboard: [
            row(makeAdminButton({ text: 'Back to Themes', callbackData: 'admin:theme:menu', iconKey: 'BACK' })),
          ],
        },
      };
    }
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
