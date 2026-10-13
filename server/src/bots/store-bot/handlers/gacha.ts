import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { pgPool, isPostgresConfigured } from '../../../database/postgres';
import {
  buildGachaKeyboard,
  buildSubGachaKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { escapeHtml, isMessageNotModifiedError } from './orders';

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
  const ticket_price_pts = 100;
  let top_mythical_item = '🍎 Kitsune Fruit Permanent (Jackpot)';
  let top_legendary_item = '⚔️ Dark Blade (Yoru) Account';
  let mythical_drop_rate = 1.5;

  // 1. Fetch user data from PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      const { rows } = await pgPool.query(
        'SELECT points, extra FROM users WHERE telegram_id = $1 LIMIT 1',
        [tid]
      );
      if (rows.length > 0) {
        points = Number(rows[0].points || 0);
        const extra = typeof rows[0].extra === 'string' ? JSON.parse(rows[0].extra) : (rows[0].extra || {});
        tickets = Number(extra.gacha_tickets || 0);
      }
    } catch (err: any) {
      console.warn('[fetchGachaLiveInfo] Postgres query warning:', err?.message);
    }
  }

  // 2. Fallback to / sync with DataStore
  const dsUser = DataStore.getTelegramUser(numId);
  const dsProfile = DataStore.getProfile(numId);
  if (dsUser) {
    if (!points) points = Number(dsUser.points || 0);
    if (!tickets && dsUser.gacha_tickets) tickets = Number(dsUser.gacha_tickets);
  }
  if (dsProfile) {
    if (!points) points = Number(dsProfile.points || 0);
    if (dsProfile.gacha_tickets) tickets = Number(dsProfile.gacha_tickets);
  }

  // Fetch pool prizes from DataStore
  try {
    const activePool = DataStore.getActiveGachaPool();
    if (activePool) {
      const poolPrizes = DataStore.getGachaPrizesByPoolId(activePool.id);
      const mythical = poolPrizes.find((p: any) => p.rarity === 'mythical');
      const legendary = poolPrizes.find((p: any) => p.rarity === 'legendary');
      if (mythical) top_mythical_item = `${mythical.name} (Jackpot)`;
      if (legendary) top_legendary_item = legendary.name;
    }
  } catch {}

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
 * Handle Gacha Dashboard (cb_gacha_menu / /gacha)
 */
export async function handleGachaMenu(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  await DataStore.syncUserFromPostgres(telegramId);
  const gacha = await fetchGachaLiveInfo(telegramId);

  const text =
    `🎰 <b>UCHIRO MYTHICAL GACHA — LIVE OVERVIEW</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>Your Tickets:</b> <code>${gacha.tickets} Tickets</code>\n` +
    `💎 <b>Your Points:</b> <code>${gacha.points} Pts</code>\n` +
    `💰 <b>Ticket Price:</b> <code>100 Pts / Ticket</code>\n\n` +
    `🏆 <b>Jackpot Pool Prizes:</b>\n` +
    `• 🔴 🍎 <b>Kitsune Fruit Permanent</b> (Jackpot)\n` +
    `• 🟣 ⚔️ <b>Dark Blade (Yoru) Account</b>\n` +
    `• ⚡ <b>Mythical Drop Rate:</b> <code>1.5%</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Exchange points for tickets below or launch the Mini App to spin!</i>`;

  const keyboard = buildGachaKeyboard(storeUrl);
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
      console.warn('[Gacha Menu] Render warning:', err);
    }
  }
}

/**
 * Handle In-Bot Ticket Buy (cb_buy_ticket_pts / cb_gacha_buy_ticket)
 */
export async function handleBuyGachaTicket(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const tid = String(telegramId);
  const numId = Number(telegramId);
  const TICKET_COST = 100;

  await DataStore.syncUserFromPostgres(numId);
  const liveInfo = await fetchGachaLiveInfo(telegramId);
  const currentPoints = liveInfo.points;

  // Insufficient Points Check
  if (currentPoints < TICKET_COST) {
    try {
      await ctx.answerCbQuery(
        `⚠️ You need at least 100 Points to buy 1 Ticket! (You have: ${currentPoints} Pts)`,
        { show_alert: true }
      );
    } catch {}
    return;
  }

  // Deduct 100 Points via DataStore.adjustPoints
  const adjustRes = await DataStore.adjustPoints(telegramId, -TICKET_COST, 'GACHA_TICKET');
  if (!adjustRes.success) {
    try {
      await ctx.answerCbQuery(
        `⚠️ Failed to exchange ticket: ${adjustRes.error || 'INSUFFICIENT_POINTS'}`,
        { show_alert: true }
      );
    } catch {}
    return;
  }

  const newBalance = adjustRes.points;

  // Increment user's gacha_tickets by 1 in in-memory profile and user
  let newTickets = liveInfo.tickets + 1;
  const dsUser = DataStore.getTelegramUser(numId);
  if (dsUser) {
    dsUser.points = newBalance;
    dsUser.reward_points = newBalance;
    dsUser.gacha_tickets = (dsUser.gacha_tickets || 0) + 1;
    newTickets = dsUser.gacha_tickets;
  }
  const dsProfile = DataStore.getProfile(numId);
  if (dsProfile) {
    dsProfile.points = newBalance;
    dsProfile.reward_points = newBalance;
    dsProfile.loyalty_points = newBalance;
    dsProfile.gacha_tickets = (dsProfile.gacha_tickets || 0) + 1;
    newTickets = dsProfile.gacha_tickets;
  }

  // Persist updated tickets to extra in PostgreSQL if configured
  if (isPostgresConfigured()) {
    try {
      await pgPool.query(
        `UPDATE users
         SET extra = jsonb_set(COALESCE(extra::jsonb, '{}'::jsonb), '{gacha_tickets}', $2::jsonb),
             updated_at = NOW()
         WHERE telegram_id = $1`,
        [tid, JSON.stringify(newTickets)]
      );
    } catch (err: any) {
      console.warn('[handleBuyGachaTicket] Postgres extra tickets save warning:', err?.message);
    }
  }

  // Success Alert Popup
  try {
    await ctx.answerCbQuery(
      `🎉 Successfully exchanged 100 Points for 1 Gacha Ticket! (Remaining: ${newBalance} Pts, Tickets: ${newTickets})`,
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
    `🎫 <b>Your Tickets:</b> <code>${newTickets} Tickets</code>\n` +
    `💎 <b>Your Points:</b> <code>${newBalance} Pts</code>\n` +
    `💰 <b>Ticket Price:</b> <code>100 Pts / Ticket</code>\n\n` +
    `🏆 <b>Jackpot Pool Prizes:</b>\n` +
    `• 🔴 🍎 <b>Kitsune Fruit Permanent</b> (Jackpot)\n` +
    `• 🟣 ⚔️ <b>Dark Blade (Yoru) Account</b>\n` +
    `• ⚡ <b>Mythical Drop Rate:</b> <code>1.5%</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Exchange points for tickets below or launch the Mini App to spin!</i>`;

  const keyboard = buildGachaKeyboard(storeUrl);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Buy Ticket] Render warning:', err);
    }
  }
}

/**
 * Handle View All Gacha Prizes (cb_gacha_prizes)
 */
export async function handleGachaPrizes(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const activePool = DataStore.getActiveGachaPool();
  const poolPrizes = activePool ? DataStore.getGachaPrizesByPoolId(activePool.id) : [];

  let prizeList = '';
  if (poolPrizes.length > 0) {
    prizeList = poolPrizes
      .map((p: any) => {
        const rarityBadge =
          p.rarity === 'mythical'
            ? '🔴 Mythical'
            : p.rarity === 'legendary'
            ? '🟣 Legendary'
            : p.rarity === 'epic'
            ? '🔵 Epic'
            : p.rarity === 'rare'
            ? '🟢 Rare'
            : '⚪ Common';
        return `• ${rarityBadge}: <b>${escapeHtml(p.name)}</b> (${p.drop_rate}%)`;
      })
      .join('\n');
  } else {
    prizeList =
      `• 🔴 Mythical: <b>Kitsune Fruit Permanent</b> (1.5%)\n` +
      `• 🟣 Legendary: <b>Dark Blade (Yoru) Account</b> (5.0%)\n` +
      `• 🔵 Epic: <b>50% Discount Coupon</b> (15.0%)\n` +
      `• 🟢 Rare: <b>2x Mastery & Money Gamepass</b> (30.0%)\n` +
      `• ⚪ Common: <b>+25 Points Cashback</b> (48.5%)`;
  }

  const text =
    `🏆 <b>CURRENT GACHA POOL PRIZES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    prizeList +
    `\n\n` +
    `💡 <i>All won accounts and codes are instantly delivered to your 🎒 Vault!</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubGachaKeyboard(storeUrl);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Prizes] Render warning:', err);
    }
  }
}

/**
 * Handle Gacha Drop Rates & Odds (cb_gacha_rates / cb_gacha_odds)
 */
export async function handleGachaOdds(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `⚡ <b>OFFICIAL GACHA DROP RATES &amp; FAIR PLAY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔴 <b>MYTHICAL (Jackpot):</b> <code>1.50%</code>\n` +
    `• Chance to win high-tier Max Level Accounts or Permanent Fruits\n\n` +
    `🟣 <b>LEGENDARY:</b> <code>5.00%</code>\n` +
    `• Chance to win Dark Blade, Godhuman Accounts\n\n` +
    `🔵 <b>EPIC:</b> <code>15.00%</code>\n` +
    `• 50% Off Discount Vouchers & Fruit Codes\n\n` +
    `🟢 <b>RARE:</b> <code>30.00%</code>\n` +
    `• Gamepass Codes, 2x Money & Mastery Boosts\n\n` +
    `⚪ <b>COMMON:</b> <code>48.50%</code>\n` +
    `• Loyalty Points Cashback (+25 Pts)\n\n` +
    `🔒 <i>Provably Fair RNG Engine 100% verified — no manipulation.</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubGachaKeyboard(storeUrl);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Odds] Render warning:', err);
    }
  }
}
