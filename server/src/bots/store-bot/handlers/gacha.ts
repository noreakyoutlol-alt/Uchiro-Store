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
  pool_name: string;
  tickets: number;
  points: number;
  ticket_price_pts: number;
  top_mythical_item: string;
  top_legendary_item: string;
  mythical_drop_rate: number;
  cooldown_seconds: number;
}

export async function fetchGachaLiveInfo(telegramId: number | string): Promise<GachaLiveInfo> {
  const tid = String(telegramId);
  const numId = Number(telegramId);

  // 1. Authoritative pool & prize configuration from DataStore
  const pools = DataStore.getGachaPools();
  const activePool = pools.find((p) => p.is_active) || pools[0];
  const pool_name = (activePool as any)?.name || activePool?.title || 'Uchiro Mythical Gacha';
  const prizes = (activePool?.prizes || []).filter((p) => p.is_active);

  const mythicalPrize = prizes.find((p) => p.rarity === 'MYTHICAL');
  const legendaryPrize = prizes.find((p) => p.rarity === 'LEGENDARY');

  const top_mythical_item = mythicalPrize?.title
    ? `🍎 ${mythicalPrize.title} (Jackpot)`
    : '🍎 Mythic Uchiro Champion Account (Jackpot)';
  const top_legendary_item = legendaryPrize?.title
    ? `⚔️ ${legendaryPrize.title}`
    : '⚔️ Shadow Katana V2 Game Voucher';
  const mythical_drop_rate = mythicalPrize ? Number(mythicalPrize.probability_percent) : 0.5;

  const storeSettings = DataStore.getStoreSettings();
  const ticket_price_pts = storeSettings.gacha_ticket_points_cost || 100;

  let tickets = 0;
  let points = 0;
  let cooldown_seconds = 0;

  // 2. Fetch user data from DataStore getGachaStatus
  try {
    const status = DataStore.getGachaStatus(numId);
    tickets = status.tickets || 0;
    points = status.points || 0;
    cooldown_seconds = status.cooldownSecondsRemaining || 0;
  } catch (err: any) {
    console.warn('[fetchGachaLiveInfo] getGachaStatus warning:', err?.message);
  }

  try {
    const snap = await getUserSnapshot(tid);
    if (!tickets && !points) {
      points = snap.points;
      tickets = snap.gachaTickets || 0;
    }
  } catch (err: any) {
    console.warn('[fetchGachaLiveInfo] getUserSnapshot warning:', err?.message);
  }

  return {
    pool_name,
    tickets,
    points,
    ticket_price_pts,
    top_mythical_item,
    top_legendary_item,
    mythical_drop_rate,
    cooldown_seconds,
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
  const lang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const cooldownText =
    liveInfo.cooldown_seconds > 0
      ? `⏳ ${Math.floor(liveInfo.cooldown_seconds / 60)}m ${liveInfo.cooldown_seconds % 60}s (${lang === 'km' ? 'រង់ចាំ Cooldown' : 'Wait for cooldown'})`
      : (lang === 'km' ? `✅ រួចរាល់ក្នុងការបង្វិល` : `✅ Ready to spin`);

  const text =
    lang === 'km'
      ? `🎰 <b>${escapeHtml(liveInfo.pool_name.toUpperCase())} — ព័ត៌មានបន្តផ្ទាល់</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 <b>សំបុត្ររបស់អ្នក៖</b> ${liveInfo.tickets}\n` +
        `💎 <b>ពិន្ទុរបស់អ្នក៖</b> ${liveInfo.points} Pts\n` +
        `💰 <b>តម្លៃសំបុត្រ៖</b> ${liveInfo.ticket_price_pts} Pts\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>រង្វាន់កំពូល៖</b>\n` +
        `  ${liveInfo.top_mythical_item}\n` +
        `  ${liveInfo.top_legendary_item}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>ឱកាសឈ្នះ Mythical៖</b> ${liveInfo.mythical_drop_rate}%\n` +
        `⏱️ <b>ស្ថានភាព៖</b> ${cooldownText}\n`
      : `🎰 <b>${escapeHtml(liveInfo.pool_name.toUpperCase())} — LIVE OVERVIEW</b>\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🎫 <b>Your Tickets:</b> ${liveInfo.tickets}\n` +
        `💎 <b>Your Points:</b> ${liveInfo.points} Pts\n` +
        `💰 <b>Ticket Price:</b> ${liveInfo.ticket_price_pts} Pts\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `🏆 <b>Top Prizes:</b>\n` +
        `  ${liveInfo.top_mythical_item}\n` +
        `  ${liveInfo.top_legendary_item}\n` +
        `━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Mythical Drop Rate:</b> ${liveInfo.mythical_drop_rate}%\n` +
        `⏱️ <b>Status:</b> ${cooldownText}\n`;

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
    `  • 50 Uchiro Points\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏷️ <b>Rare Items:</b>\n` +
    `  • $1.00 Uchiro Store Coupon\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚡ <b>Epic Items:</b>\n` +
    `  • Uchiro 2x EXP Booster Pass\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚔️ <b>Legendary Items:</b>\n` +
    `  • Shadow Katana V2 Game Voucher\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🌟 <b>Mythical Items:</b>\n` +
    `  • Mythic Uchiro Champion Account (Jackpot)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💰 <b>Odds:</b> Common 70.0% | Rare 20.0% | Epic 7.0% | Legendary 2.5% | Mythical 0.5%\n`;

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
    `  • Common: 70.0% (50 Uchiro Points)\n` +
    `  • Rare: 20.0% ($1.00 Store Coupon)\n` +
    `  • Epic: 7.0% (2x EXP Booster Pass)\n` +
    `  • Legendary: 2.5% (Shadow Katana V2)\n` +
    `  • Mythical: 0.5% (Mythic Uchiro Champion Account)\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎯 <b>Current Focus:</b>\n` +
    `  • Mythical Drop Rate: ${liveInfo.mythical_drop_rate}%\n` +
    `  • Guaranteed Single Spin Server Enforcement\n` +
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

  const cooldownText =
    gacha.cooldown_seconds > 0
      ? `⏳ ${Math.floor(gacha.cooldown_seconds / 60)}m ${gacha.cooldown_seconds % 60}s (Wait for cooldown)`
      : `✅ Ready to spin`;

  const text =
    `🎰 <b>${escapeHtml(gacha.pool_name.toUpperCase())} — LIVE OVERVIEW</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>Your Tickets:</b> ${gacha.tickets}\n` +
    `💎 <b>Your Points:</b> ${gacha.points} Pts\n` +
    `💰 <b>Ticket Price:</b> ${gacha.ticket_price_pts} Pts\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏆 <b>Top Prizes:</b>\n` +
    `  ${gacha.top_mythical_item}\n` +
    `  ${gacha.top_legendary_item}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⚠️ <b>Mythical Drop Rate:</b> ${gacha.mythical_drop_rate}%\n` +
    `⏱️ <b>Status:</b> ${cooldownText}\n`;

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