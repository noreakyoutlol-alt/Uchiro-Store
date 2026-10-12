import { Context } from 'telegraf';
import { DataStore } from '../../../database/data-store';
import { supabase, isSupabaseConfigured } from '../../../database/supabase';
import {
  buildProfileKeyboard,
  buildPointsLedgerKeyboard,
  buildRedeemPointsKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { escapeHtml, isMessageNotModifiedError } from './orders';

export interface UserProfileData {
  telegram_id: string | number;
  username: string;
  tier_name: string;
  points: number;
  tickets: number;
  streak_count: number;
  total_orders: number;
}

export async function fetchUserProfileData(telegramId: number | string): Promise<UserProfileData> {
  const tid = String(telegramId);
  const numId = Number(telegramId);

  let points = 0;
  let streak_count = 0;
  let tickets = 0;
  let username = 'Member';
  let total_orders = 0;

  // 1. Fetch from Supabase if configured
  if (isSupabaseConfigured()) {
    try {
      const { data: userRow } = await supabase
        .from('users')
        .select('*')
        .eq('telegram_id', tid)
        .maybeSingle();

      if (userRow) {
        points = userRow.points ?? 0;
        streak_count = userRow.streak_count ?? 0;
        username = userRow.username || userRow.first_name || 'Member';
        tickets = (userRow.extra as any)?.gacha_tickets ?? 0;
      }

      const { count } = await supabase
        .from('orders')
        .select('*', { count: 'exact', head: true })
        .eq('telegram_id', tid);

      total_orders = count || 0;
    } catch {
      // Fallback on error
    }
  }

  // 2. Fallback / Merge with DataStore
  if (!points && !total_orders) {
    const dsUser = DataStore.getTelegramUser(numId);
    const dsProfile = DataStore.getProfile(numId);
    if (dsUser) {
      username = dsUser.username || dsUser.first_name || username;
      points = dsUser.points || points;
    }
    if (dsProfile) {
      points = dsProfile.points || points;
      tickets = dsProfile.gacha_tickets || tickets;
    }
    const dsOrders = DataStore.getOrdersByTelegramId(numId);
    if (dsOrders && dsOrders.length > 0) {
      total_orders = dsOrders.length;
    }
  }

  // Calculate Tier Name based on order count and activity
  let tier_name = '🌟 សមាជិកទូទៅ (Standard)';
  if (total_orders >= 10 || points >= 1000) {
    tier_name = '👑 VIP Mythic Member';
  } else if (total_orders >= 5 || points >= 500) {
    tier_name = '⭐ Diamond Member';
  } else if (total_orders >= 2 || points >= 200) {
    tier_name = '🔥 Platinum Member';
  } else if (total_orders >= 1 || points >= 50) {
    tier_name = '💎 Gold Member';
  }

  return {
    telegram_id: tid,
    username,
    tier_name,
    points,
    tickets,
    streak_count,
    total_orders,
  };
}

/**
 * Handle Profile Dashboard (cb_profile_menu / /profile)
 */
export async function handleProfileMenu(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const profile = await fetchUserProfileData(telegramId);
  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';

  const text =
    `👤 <b>ព័ត៌មានគណនី UCHIRO (MY PROFILE)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>Telegram ID:</b> <code>${profile.telegram_id}</code>\n` +
    `👤 <b>ឈ្មោះគណនី:</b> @${escapeHtml(profile.username)}\n` +
    `⭐ <b>កម្រិតសមាជិក:</b> ${profile.tier_name}\n` +
    `🪙 <b>ពិន្ទុសន្សំ:</b> <code>${profile.points}</code> Pts\n` +
    `🎟️ <b>សំបុត្រ Gacha:</b> <code>${profile.tickets}</code> សំបុត្រ\n` +
    `🔥 <b>Streak ប្រចាំថ្ងៃ:</b> <code>${profile.streak_count}</code> / 7 ថ្ងៃ\n` +
    `📦 <b>ការទិញសរុប:</b> <code>${profile.total_orders}</code> កញ្ចប់\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildProfileKeyboard(storeUrl, userLang);
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
      console.warn('[Profile Menu] Render warning:', err);
    }
  }
}

/**
 * Handle Points Ledger (cb_points_ledger)
 */
export async function handlePointsLedger(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';
  const profile = await fetchUserProfileData(telegramId);

  // Fetch recent ledger entries from DataStore
  const ledger = DataStore.getPointLedger(telegramId);
  let ledgerText = '';

  if (ledger.length === 0) {
    ledgerText = `<i>មិនទាន់មានប្រវត្តិប្រតិបត្តិការនៅឡើយទេ។</i>\n`;
  } else {
    const recent = ledger.slice(0, 5);
    ledgerText = recent
      .map((entry) => {
        const sign = entry.amount >= 0 ? '+' : '';
        return `• <b>${sign}${entry.amount} Pts</b> — ${escapeHtml(entry.description || entry.type)} (សមតុល្យ: ${entry.balance_after})`;
      })
      .join('\n');
  }

  const text =
    `📜 <b>ប្រវត្តិពិន្ទុសន្សំ (POINTS LEDGER)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>ពិន្ទុបច្ចុប្បន្ន:</b> <code>${profile.points}</code> Pts\n\n` +
    `<b>ប្រតិបត្តិការ 5 ចុងក្រោយ:</b>\n` +
    ledgerText + `\n` +
    `💡 <i>ចំណាំ: អ្នកអាចទទួលបានពិន្ទុដោយឥតគិតថ្លៃតាមរយៈការ Claim ប្រចាំថ្ងៃ ឬការទិញទំនិញក្នុងហាង។</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildPointsLedgerKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Points Ledger] Render warning:', err);
    }
  }
}

/**
 * Handle Redeem Points (cb_redeem_pts / cb_redeem_menu)
 */
export async function handleRedeemPoints(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const userLang = DataStore.getUserLanguagePreference(telegramId) || 'km';
  const profile = await fetchUserProfileData(telegramId);

  const text =
    `🎁 <b>ប្តូរពិន្ទុយករង្វាន់ (REDEEM POINTS)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>ពិន្ទុរបស់អ្នក:</b> <code>${profile.points}</code> Pts\n\n` +
    `<b>តារាងតម្លៃប្តូរយករង្វាន់:</b>\n` +
    `🎟️ <b>សំបុត្រ Gacha 1 សន្លឹក:</b> <code>50 Pts</code>\n` +
    `🏷️ <b>ប័ណ្ណបញ្ចុះតម្លៃ $0.50:</b> <code>100 Pts</code> (កុម្ម៉ង់ចាប់ពី $3)\n` +
    `🏷️ <b>ប័ណ្ណបញ្ចុះតម្លៃ $1.20:</b> <code>200 Pts</code> (កុម្ម៉ង់ចាប់ពី $6)\n` +
    `🏷️ <b>ប័ណ្ណបញ្ចុះតម្លៃ $3.50:</b> <code>500 Pts</code> (កុម្ម៉ង់ចាប់ពី $15)\n\n` +
    `👇 ចុចប្តូរសំបុត្រ Gacha ភ្លាមៗ ឬចូលទៅកាន់កម្មវិធី Store ដើម្បីប្តូរប័ណ្ណបញ្ចុះតម្លៃ:\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildRedeemPointsKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Redeem Points] Render warning:', err);
    }
  }
}
