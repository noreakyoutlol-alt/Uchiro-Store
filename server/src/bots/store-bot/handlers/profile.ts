import { Context } from 'telegraf';
import { DataStore, getUserSnapshot } from '../../../database/data-store';
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
  const numId = Number(telegramId) || 0;

  const snap = await getUserSnapshot(tid);
  let username = 'Member';

  const dsUser = DataStore.getTelegramUser(numId);
  if (dsUser?.username) {
    username = dsUser.username;
  } else if (dsUser?.first_name) {
    username = dsUser.first_name;
  }

  const points = snap.points;
  const tickets = snap.gachaTickets || 0;
  const streak_count = snap.streak || 0;
  const total_orders = snap.ordersCount || 0;

  let tier_name = '🌟 Standard Member';
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

  const text =
    `👤 <b>UCHIRO ACCOUNT PROFILE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🆔 <b>Telegram ID:</b> <code>${profile.telegram_id}</code>\n` +
    `👤 <b>Account Name:</b> @${escapeHtml(profile.username)}\n` +
    `⭐ <b>Membership Tier:</b> ${profile.tier_name}\n` +
    `🪙 <b>Points Balance:</b> <code>${profile.points}</code> Pts\n` +
    `🎟️ <b>Gacha Tickets:</b> <code>${profile.tickets}</code> Tickets\n` +
    `🔥 <b>Daily Streak:</b> <code>${profile.streak_count}</code> / 7 Days\n` +
    `📦 <b>Total Orders:</b> <code>${profile.total_orders}</code> Orders\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildProfileKeyboard(storeUrl, 'en');
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

  const profile = await fetchUserProfileData(telegramId);

  // Fetch recent ledger entries from DataStore
  const ledger = DataStore.getPointLedger(telegramId);
  let ledgerText = '';

  if (ledger.length === 0) {
    ledgerText = `<i>No transaction history recorded yet.</i>\n`;
  } else {
    const recent = ledger.slice(0, 5);
    ledgerText = recent
      .map((entry) => {
        const sign = entry.amount >= 0 ? '+' : '';
        return `• <b>${sign}${entry.amount} Pts</b> — ${escapeHtml(entry.description || entry.type)} (Balance: ${entry.balance_after})`;
      })
      .join('\n');
  }

  const text =
    `📜 <b>POINTS LEDGER &amp; HISTORY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>Current Balance:</b> <code>${profile.points}</code> Pts\n\n` +
    `<b>Last 5 Transactions:</b>\n` +
    ledgerText + `\n` +
    `💡 <i>Tip: Earn free points via daily check-ins or by shopping in our store!</i>\n` +
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

  const profile = await fetchUserProfileData(telegramId);
  const ticketCost = DataStore.getStoreSettings().gacha_ticket_points_cost || 100;

  const text =
    `🎁 <b>REDEEM REWARD POINTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>Your Points Balance:</b> <code>${profile.points}</code> Pts\n\n` +
    `<b>Available Redemptions:</b>\n` +
    `🎟️ <b>1x Gacha Ticket:</b> <code>${ticketCost} Pts</code>\n` +
    `🏷️ <b>$0.50 Discount Voucher:</b> <code>100 Pts</code> (Orders from $3)\n` +
    `🏷️ <b>$1.20 Discount Voucher:</b> <code>200 Pts</code> (Orders from $6)\n` +
    `🏷️ <b>$3.50 Discount Voucher:</b> <code>500 Pts</code> (Orders from $15)\n\n` +
    `👇 Exchange for Gacha Tickets below or open Mini App to redeem vouchers:\n` +
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
