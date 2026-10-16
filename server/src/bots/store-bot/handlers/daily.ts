import { Context } from 'telegraf';
import { DataStore, claimDailyReward, getUserSnapshot } from '../../../database/data-store';
import {
  buildDailyKeyboard,
  buildSubDailyShopKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { isMessageNotModifiedError } from './orders';

export interface DailyLiveInfo {
  streak_count: number;
  points: number;
  next_pts: number;
  is_claimable: boolean;
  cooldown_str: string;
  seconds_remaining: number;
}

export function formatCooldownSeconds(totalSec: number): string {
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

export async function fetchDailyLiveInfo(telegramId: number | string): Promise<DailyLiveInfo> {
  const tid = String(telegramId);
  const snap = await getUserSnapshot(tid);
  const now = Date.now();
  const cooldownMs = 24 * 60 * 60 * 1000;

  const streak_count = snap.streak || 0;
  const points = snap.points || 0;
  const last_claimed_at = snap.lastDailyClaimAt;

  let is_claimable = true;
  let seconds_remaining = 0;
  let cooldown_str = '00:00:00';

  if (last_claimed_at) {
    const lastClaimMs = new Date(last_claimed_at).getTime();
    const elapsed = now - lastClaimMs;
    if (elapsed < cooldownMs) {
      is_claimable = false;
      seconds_remaining = Math.ceil((cooldownMs - elapsed) / 1000);
      cooldown_str = formatCooldownSeconds(seconds_remaining);
    }
  }

  // Use DataStore settings for streak and reward calculation
  const storeSettings = DataStore.getStoreSettings();
  const streakInterval = storeSettings.streak_interval_days || 7;
  const next_streak = is_claimable ? (streak_count % streakInterval) + 1 : streak_count;
  const baseReward = storeSettings.daily_reward_points || 5;
  const streakBonus = storeSettings.streak_bonus_points || 15;
  const next_pts = next_streak % streakInterval === 0 ? baseReward + streakBonus : baseReward;

  return {
    streak_count,
    points,
    next_pts,
    is_claimable,
    cooldown_str,
    seconds_remaining,
  };
}

/**
 * Handle Daily Reward Dashboard (cb_daily_menu / /daily)
 */
export async function handleDailyMenu(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  await DataStore.syncUserFromPostgres(telegramId);
  const daily = await fetchDailyLiveInfo(telegramId);

  const statusText = daily.is_claimable
    ? '✅ <b>Ready to Claim (+5 Pts)</b>'
    : `⏳ <b>Cooldown Remaining:</b> <code>${daily.cooldown_str}</code>`;

  const text =
    `🎁 <b>DAILY REWARD &amp; STREAK DASHBOARD</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 <b>Current Streak:</b> <code>${daily.streak_count}</code> / 7 Days\n` +
    `💎 <b>Total Points:</b> <code>${daily.points}</code> Pts\n` +
    `⚡ <b>Next Reward:</b> <b>+${daily.next_pts} Pts</b>\n\n` +
    `⏳ <b>Status:</b> ${statusText}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Check in every 24 hours to keep your streak multiplier active!</i>`;

  const keyboard = buildDailyKeyboard(daily.is_claimable);
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
      console.warn('[Daily Menu] Render warning:', err);
    }
  }
}

/**
 * Handle Atomic In-Bot Daily Claim (cb_claim_daily / cb_claim_daily_instant)
 */
export async function handleClaimDailyInstant(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const numId = Number(telegramId);

  await DataStore.syncUserFromPostgres(numId);
  const res = await claimDailyReward(numId);

  if (!res.success) {
    const remSec = res.seconds_remaining || (res as any).remainingMs ? Math.ceil(((res as any).remainingMs || 0) / 1000) : 0;
    try {
      await ctx.answerCbQuery(
        `⏳ You have already claimed today! Please wait: ${formatCooldownSeconds(remSec)}`,
        { show_alert: true }
      );
    } catch {}
    await handleDailyMenu(ctx);
    return;
  }

  const pointsAwarded = res.pointsAwarded || 5;
  const newStreak = res.streak || 1;
  const totalPoints = res.points || 0;

  // Alert Popup
  try {
    await ctx.answerCbQuery(
      `🎉 Successfully claimed +${pointsAwarded} Pts!\n🔥 Streak: ${newStreak}/7 Days (Total: ${totalPoints} Pts)`,
      { show_alert: true }
    );
  } catch {}

  // Refresh Dashboard
  const daily = await fetchDailyLiveInfo(telegramId);
  daily.is_claimable = false;
  daily.streak_count = newStreak;
  daily.points = totalPoints;

  const text =
    `🎁 <b>DAILY REWARD &amp; STREAK DASHBOARD</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 <b>Current Streak:</b> <code>${daily.streak_count}</code> / 7 Days\n` +
    `💎 <b>Total Points:</b> <code>${daily.points}</code> Pts\n` +
    `⚡ <b>Next Reward:</b> <b>+${daily.next_pts} Pts</b>\n\n` +
    `⏳ <b>Status:</b> ⏳ <b>Cooldown Remaining:</b> <code>${daily.cooldown_str}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Check in every 24 hours to keep your streak multiplier active!</i>`;

  const keyboard = buildDailyKeyboard(false);

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Daily Instant Claim] Render warning:', err);
    }
  }
}

/**
 * Handle Daily Points Rewards Shop (cb_daily_shop)
 */
export async function handleDailyShop(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  await DataStore.syncUserFromPostgres(telegramId);
  const daily = await fetchDailyLiveInfo(telegramId);

  const text =
    `💎 <b>POINTS REWARDS SHOP</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>Current Balance:</b> <code>${daily.points}</code> Pts\n\n` +
    `<b>Available Items:</b>\n` +
    `🎟️ <b>Gacha Ticket:</b> <code>100 Pts</code> (1 Spin for Mythical Prizes)\n` +
    `🏷️ <b>Coupon $0.50 Off:</b> <code>100 Pts</code> (Valid on all games)\n` +
    `🏷️ <b>Coupon $1.20 Off:</b> <code>200 Pts</code> (Valid on all games)\n` +
    `🏷️ <b>Coupon $3.50 Off:</b> <code>500 Pts</code> (Valid on all games)\n\n` +
    `<i>Exchange points for tickets below or launch the Mini App to redeem coupons!</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubDailyShopKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Daily Shop] Render warning:', err);
    }
  }
}
