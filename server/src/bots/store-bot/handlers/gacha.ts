import { Context } from 'telegraf';
import { DataStore, getUserSnapshot } from '../../../database/data-store';
import { pgPool, isPostgresConfigured } from '../../../database/postgres';
import { resolveStoreUrl } from '../../../config/app-url';
import {
  buildGachaKeyboard,
  buildSubGachaKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { escapeHtml, isMessageNotModifiedError } from './orders';
import { buyGachaTicket } from '../../../database/data-store';

export interface GachaLiveInfo {
  tickets: number;
  points: number;
  ticket_price_pts: number;
  top_mythical_item: string;
  top_legendary_item: string;
  mythical_drop_rate: number;
}

export async function fetchGachaLiveInfo(telegramId: number | string): Promise<GachaLiveInfo> {
  const tid = String(telegramId);
  const numId = Number(telegramId);

  let tickets = 0;
  let points = 0;
  let ticket_price_pts = 100;
  let top_mythical_item = '🍎 Kitsune Fruit Permanent (Jackpot)';
  let top_legendary_item = '⚔️ Dark Blade (Yoru) Account';
  let mythical_drop_rate = 1.5;

  // 1. Fetch user data from getUserSnapshot (single source of truth)
  try {
    const snap = await getUserSnapshot(tid);
    points = snap.points;
    tickets = snap.gachaTickets || 0;
  } catch (err: any) {
    console.warn('[fetchGachaLiveInfo] getUserSnapshot warning:', err?.message);
  }

  return {
    tickets,
    points,
    ticket_price_pts,
    top_mythical_item,
    top_legendary_item,
    mythical_drop_rate,
  };
}

/**
 * Handle Gacha Menu (cb_gacha_menu)
 */
export async function handleGachaMenu(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const liveInfo = await fetchGachaLiveInfo(telegramId);

  const text =
    `🎰 <b>UCHIRO MYTHICAL GACHA — LIVE OVERVIEW</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>Your Tickets:</b> ` +
    `${liveInfo.tickets}\n` +
    `💎 <b>Your Points:</b> ${liveInfo.points} Pts\n` +
    `💰 <b>Ticket Price:</b> ${liveInfo.ticket_price_pts} Pts\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 <b>Top Prizes:</b>\n` +
    `  ${liveInfo.top_mythical_item}\n` +
    `  ${liveInfo.top_legendary_item}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ <b>Mythical Drop Rate:</b> ${liveInfo.mythical_drop_rate}%\n`;

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...buildSubGachaKeyboard(),
      });
    } else {
      await ctx.reply(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...buildSubGachaKeyboard(),
      });
    }
  } catch (err: any) {
    if (isMessageNotModifiedError(err)) {
      await ctx.answerCbQuery('Already up to date');
    } else {
      throw err;
    }
  }
}

/**
 * Handle Gacha Prizes (cb_gacha_prizes)
 */
export async function handleGachaPrizes(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const liveInfo = await fetchGachaLiveInfo(telegramId);

  const text =
    `🏆 <b>UCHIRO GACHA PRIZE POOL</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🍭 <b>Common Items:</b>\n` +
    `  • Apple Seeds x50\n` +
    `  • Iron Ore x30\n` +
    `  • Healing Herb x20\n` +
    `  • Lucky Coin x10\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚔️ <b>Legendary Items:</b>\n` +
    `  ${liveInfo.top_legendary_item}\n` +
    `  • Phoenix Feather Account\n` +
    `  • Dragon Scale Sword\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌟 <b>Mythical Items:</b>\n` +
    `  ${liveInfo.top_mythical_item}\n` +
    `  • Celestial Kimono Set\n` +
    `  • Void Walker Companion\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Odds:</b> Common 70% | Legendary 25% | Mythical 5%\n`;

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cb_gacha_menu' }]] },
      });
    } else {
      await ctx.reply(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cb_gacha_menu' }]] },
      });
    }
  } catch (err: any) {
    if (isMessageNotModifiedError(err)) {
      await ctx.answerCbQuery('Already up to date');
    } else {
      throw err;
    }
  }
}

/**
 * Handle Gacha Odds/Rates (cb_gacha_odds / cb_gacha_rates)
 */
export async function handleGachaOdds(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const liveInfo = await fetchGachaLiveInfo(telegramId);

  const text =
    `📊 <b>UCHIRO GACHA DROP RATES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 <b>Item Rarity Distribution:</b>\n` +
    `  • Common: 70.0% (Everyday items & resources)\n` +
    `  • Rare: 20.0% (Enhanced gear & materials)\n` +
    `  • Epic: 7.0% (Powerful artifacts)\n` +
    `  • Legendary: 2.5% (Hero equipment)\n` +
    `  • Mythical: 0.5% (Divine relics)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>Current Focus:</b>\n` +
    `  • Mythical Drop Rate: ${liveInfo.mythical_drop_rate}%\n` +
    `  • Guaranteed Legendary: Every 40th pull\n` +
    `  • Jackpot Reset: None (Progressive)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 <b>Tip:</b> Save tickets for rate-up events!\n`;

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cb_gacha_menu' }]] },
      });
    } else {
      await ctx.reply(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: [[{ text: '🔙 Back', callback_data: 'cb_gacha_menu' }]] },
      });
    }
  } catch (err: any) {
    if (isMessageNotModifiedError(err)) {
      await ctx.answerCbQuery('Already up to date');
    } else {
      throw err;
    }
  }
}

/**
 * Handle In-Bot Ticket Buy (cb_buy_ticket_pts / cb_gacha_buy_ticket)
 */
export async function handleBuyGachaTicket(
  ctx: Context,
  storeUrl: string = resolveStoreUrl()
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const tid = String(telegramId);
  const numId = Number(telegramId);

  const ticketCost = DataStore.getStoreSettings().gacha_ticket_points_cost || 100;

  const liveInfo = await fetchGachaLiveInfo(telegramId);
  const currentPoints = liveInfo.points;

  // Insufficient Points Check
  if (currentPoints < ticketCost) {
    try {
      await ctx.answerCbQuery(
        `⚠️ You need at least ${ticketCost} Points to buy 1 Ticket! (You have: ${currentPoints} Pts)`,
        { show_alert: true }
      );
    } catch {}
    return;
  }

  // Use buyGachaTicket which handles both points and tickets atomically in Postgres
  const result = await buyGachaTicket(telegramId, ticketCost);
  if (!result.success) {
    try {
      await ctx.answerCbQuery(
        `⚠️ Failed to exchange ticket: ${result.error || 'INSUFFICIENT_POINTS'}`,
        { show_alert: true }
      );
    } catch {}
    return;
  }

  const newBalance = result.points;
  const newTickets = result.gachaTickets;

  // Success Alert Popup
  try {
    await ctx.answerCbQuery(
      `🎉 Successfully exchanged ${ticketCost} Points for 1 Gacha Ticket! (Remaining: ${newBalance} Pts, Tickets: ${newTickets})`,
      { show_alert: true }
    );
  } catch {}

  // Re-render Gacha Dashboard with updated numbers
  const gacha = await fetchGachaLiveInfo(telegramId);
  gacha.points = newBalance;
  gacha.tickets = newTickets;

  const text =
    `🎰 <b>UCHIRO MYTHICAL GACHA — LIVE OVERVIEW</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>Your Tickets:</b> ` +
    `${gacha.tickets}\n` +
    `💎 <b>Your Points:</b> ${gacha.points} Pts\n` +
    `💰 <b>Ticket Price:</b> ${gacha.ticket_price_pts} Pts\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 <b>Top Prizes:</b>\n` +
    `  ${gacha.top_mythical_item}\n` +
    `  ${gacha.top_legendary_item}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ <b>Mythical Drop Rate:</b> ${gacha.mythical_drop_rate}%\n`;

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...buildSubGachaKeyboard(),
    });
  } catch (err: any) {
    if (isMessageNotModifiedError(err)) {
      await ctx.answerCbQuery('Already up to date');
    } else {
      throw err;
    }
  }
}