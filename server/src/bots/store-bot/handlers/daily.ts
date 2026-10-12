import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
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
  const numId = Number(telegramId);
  const now = Date.now();
  const cooldownMs = 24 * 60 * 60 * 1000;

  let streak_count = 0;
  let points = 0;
  let last_claimed_at: string | null = null;

  // 1. Fetch from Supabase
  if (isSupabaseConfigured()) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tid)
        .maybeSingle();

      if (userRow) {
        streak_count = userRow.streak_count ?? 0;
        points = userRow.points ?? 0;
        last_claimed_at = userRow.last_daily_claim_at;
      }
    } catch {}
  }

  // Fallback to DataStore
  if (!last_claimed_at && !points) {
    const dsUser = DataStore.getTelegramUser(numId);
    const dsProfile = DataStore.getProfile(numId);
    if (dsUser) {
      points = dsUser.points || points;
      last_claimed_at = dsUser.last_daily_claim_at || null;
    }
    if (dsProfile) {
      points = dsProfile.points || points;
    }
    const rewardRecord = DataStore.getDailyRewardStatus(numId);
    if (rewardRecord) {
      streak_count = rewardRecord.current_streak || streak_count;
      if (rewardRecord.last_claimed_at) last_claimed_at = rewardRecord.last_claimed_at;
    }
  }

  let is_claimable = true;
  let seconds_remaining = 0;
  let cooldown_str = '00:00:00';

  if (last_claimed_at) {
    const lastClaimTime = new Date(last_claimed_at).getTime();
    if (now - lastClaimTime < cooldownMs) {
      is_claimable = false;
      const remainingMs = cooldownMs - (now - lastClaimTime);
      seconds_remaining = Math.max(0, Math.ceil(remainingMs / 1000));
      cooldown_str = formatCooldownSeconds(seconds_remaining);
    }
  }

  // Next reward points
  const nextStreak = is_claimable ? ((streak_count % 7) + 1) : (streak_count || 1);
  const next_pts = nextStreak === 7 ? 20 : 5;

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
 * Handle Live Daily Points Dashboard (cb_daily_menu / /daily)
 */
export async function handleDailyMenu(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const daily = await fetchDailyLiveInfo(telegramId);
  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const statusText = daily.is_claimable
    ? '✅ អាចទទួលពិន្ទុបានឥឡូវនេះ!'
    : `⏳ នៅសល់ម៉ោង: <code>${daily.cooldown_str}</code>`;

  const text =
    `🎁 <b>ប្រព័ន្ធពិន្ទុប្រចាំថ្ងៃ (DAILY STREAK)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 <b>Streak បច្ចុប្បន្ន:</b> <code>${daily.streak_count}</code> / 7 ថ្ងៃ\n` +
    `💎 <b>ពិន្ទុសរុប:</b> <code>${daily.points}</code> Pts\n` +
    `⏳ <b>ស្ថានភាព:</b> ${statusText}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildDailyKeyboard(daily.is_claimable, userLang);
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
 * Handle Atomic In-Bot Daily Claim (cb_claim_daily_instant)
 */
export async function handleClaimDailyInstant(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const tid = String(telegramId);
  const numId = Number(telegramId);

  let success = false;
  let pointsAwarded = 5;
  let newStreak = 1;
  let totalPoints = 0;

  // 1. Try Supabase Atomic RPC
  if (isSupabaseConfigured()) {
    try {
      const { data, error } = await supabase.rpc('claim_daily_reward', {
        p_telegram_id: tid,
      });

      if (!error && data) {
        const res = data as any;
        if (res.success) {
          success = true;
          pointsAwarded = res.points_awarded;
          newStreak = res.streak;
          totalPoints = res.points;

          // Immediately sync in-memory DataStore so Mini App reflects bot claim instantaneously
          const u = DataStore.getTelegramUser(numId);
          if (u) {
            u.points = totalPoints;
            u.reward_points = totalPoints;
            u.streak_count = newStreak;
            u.last_daily_claim_at = new Date().toISOString();
          }
          const p = DataStore.getProfile(numId);
          if (p) {
            p.points = totalPoints;
            p.loyalty_points = totalPoints;
            p.reward_points = totalPoints;
            p.last_daily_claim_at = new Date().toISOString();
          }
          DataStore.dailyRewards.set(numId, {
            streak: newStreak,
            lastClaimed: Date.now(),
          });
        } else {
          // Cooldown active
          const remSec = Math.ceil((Number(res.remaining_ms) || 0) / 1000);
          try {
            await ctx.answerCbQuery(
              `⏳ អ្នកបានទទួលពិន្ទុរួចហើយ! សូមរង់ចាំ: ${formatCooldownSeconds(remSec)}`,
              { show_alert: true }
            );
          } catch {}
          await handleDailyMenu(ctx);
          return;
        }
      }
    } catch {
      // Fallback
    }
  }

  // 2. Fallback to DataStore atomic claim
  if (!success) {
    const dsResult = DataStore.claimDailyReward(numId);
    if (dsResult.success) {
      success = true;
      pointsAwarded = dsResult.pointsAwarded || 5;
      newStreak = dsResult.streak || 1;
      totalPoints = dsResult.points || 0;
    } else {
      const remSec = dsResult.seconds_remaining || 0;
      try {
        await ctx.answerCbQuery(
          `⏳ អ្នកបានទទួលពិន្ទុរួចហើយ! សូមរង់ចាំ: ${formatCooldownSeconds(remSec)}`,
          { show_alert: true }
        );
      } catch {}
      await handleDailyMenu(ctx);
      return;
    }
  }

  // Alert Popup
  try {
    await ctx.answerCbQuery(
      `🎉 ទទួលបាន +${pointsAwarded} Pts ជោគជ័យ!\n🔥 Streak: ${newStreak}/7 ថ្ងៃ (ពិន្ទុសរុប: ${totalPoints} Pts)`,
      { show_alert: true }
    );
  } catch {}

  // Refresh Dashboard
  const daily = await fetchDailyLiveInfo(telegramId);
  daily.is_claimable = false;
  daily.streak_count = newStreak;
  daily.points = totalPoints;

  const text =
    `🎁 <b>ពិន្ទុប្រចាំថ្ងៃ (DAILY REWARD STREAK)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🔥 <b>Streak បច្ចុប្បន្ន:</b> <code>${daily.streak_count}</code> / 7 ថ្ងៃជាប់គ្នា\n` +
    `💎 <b>ពិន្ទុសរុបរបស់អ្នក:</b> <code>${daily.points}</code> Pts\n` +
    `⚡ <b>រង្វាន់បន្ទាប់:</b> <b>+${daily.next_pts} Pts</b>\n\n` +
    `⏳ <b>ស្ថានភាព:</b> ⏳ <b>នៅសល់ម៉ោង:</b> <code>${daily.cooldown_str}</code>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildDailyKeyboard(false, 'en');

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

  const daily = await fetchDailyLiveInfo(telegramId);

  const text =
    `💎 <b>ហាងប្តូរពិន្ទុរង្វាន់ (POINTS REWARDS SHOP)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>ពិន្ទុសន្សំបច្ចុប្បន្ន:</b> <code>${daily.points}</code> Pts\n\n` +
    `<b>ទំនិញដែលអាចប្តូរបាន:</b>\n` +
    `🎟️ <b>សំបុត្រ Gacha Spin:</b> <code>50 Pts</code> (បង្វិលយករង្វាន់ Mythical)\n` +
    `🏷️ <b>Coupon $0.50 Off:</b> <code>100 Pts</code> (ប្រើបានគ្រប់ហ្គេម)\n` +
    `🏷️ <b>Coupon $1.20 Off:</b> <code>200 Pts</code> (ប្រើបានគ្រប់ហ្គេម)\n` +
    `🏷️ <b>Coupon $3.50 Off:</b> <code>500 Pts</code> (ប្រើបានគ្រប់ហ្គេម)\n\n` +
    `👇 ចុចប្តូរសំបុត្រ Gacha ភ្លាមៗ ឬបើក Mini App ដើម្បីទិញទំនិញបញ្ចុះតម្លៃ:\n` +
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
