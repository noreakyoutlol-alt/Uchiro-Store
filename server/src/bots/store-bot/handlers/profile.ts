import { Context, Markup } from 'telegraf';
import { DataStore, getUserSnapshot } from '../../../database/data-store';
import {
  buildProfileKeyboard,
  buildPointsLedgerKeyboard,
  buildRedeemPointsKeyboard,
  cb,
  createWebAppOrUrlButton,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { escapeHtml, isMessageNotModifiedError } from './orders';
import { RedeemCodeService } from '../../../services/redeem.service';

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

  let tier_name = '🌟 សមាជិកទូទៅ (Standard Member)';
  if (total_orders >= 10 || points >= 1000) {
    tier_name = '👑 សមាជិក VIP (VIP Mythic Member)';
  } else if (total_orders >= 5 || points >= 500) {
    tier_name = '⭐ សមាជិក Diamond (Diamond Member)';
  } else if (total_orders >= 2 || points >= 200) {
    tier_name = '🔥 សមាជិក Platinum (Platinum Member)';
  } else if (total_orders >= 1 || points >= 50) {
    tier_name = '💎 សមាជិក Gold (Gold Member)';
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
    `🏷️ <b>$0.50 Discount Voucher:</b> <code>50 Pts</code> (Orders from $1.50)\n` +
    `🏷️ <b>$1.00 Discount Voucher:</b> <code>100 Pts</code> (Orders from $3)\n` +
    `🏷️ <b>$2.00 Discount Voucher:</b> <code>200 Pts</code> (Orders from $5)\n\n` +
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

/**
 * Handle Redeem Code Menu (cb_redeem_code)
 */
export async function handleRedeemCodeMenu(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const profileWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=profile` : `${storeUrl}?tab=profile`;

  const text =
    `🎟️ <b>REDEEM PROMO CODE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Have a gift or promo code? You can redeem it right now for Points, Gacha Tickets, or Discount Coupons!\n\n` +
    `💬 <b>How to redeem:</b>\n` +
    `Send: <code>/redeem YOUR_CODE</code>\n` +
    `<i>Example: <code>/redeem WELCOME100</code></i>\n\n` +
    `Or open your Profile in the Store Mini App to enter it with 1 tap.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [createWebAppOrUrlButton('Open Profile in Mini App', profileWebUrl, 'PACKAGE')],
    [
      cb('Back to Profile', 'cb_profile_menu', 'BACK'),
      cb('Main Menu', 'cb_main_menu', 'HOME'),
    ],
  ]);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(enrichWithTgEmojis(text), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Redeem Code Menu] Render warning:', err);
    }
  }
}

/**
 * Handle /redeem <code> command in Store Bot
 */
export async function handleRedeemCommand(ctx: Context, storeUrl: string): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  const msgText = (ctx.message as any)?.text || '';
  const parts = msgText.trim().split(/\s+/);
  const code = parts[1];

  if (!code) {
    return handleRedeemCodeMenu(ctx, storeUrl);
  }

  const result = await RedeemCodeService.redeem(telegramId, code);

  if (!result.success) {
    let errDesc = 'Failed to redeem code. Please verify and try again.';
    if (result.error_code === 'INVALID_CODE') errDesc = 'Invalid or unrecognized redeem code.';
    else if (result.error_code === 'CODE_EXPIRED') errDesc = 'This redeem code has expired.';
    else if (result.error_code === 'CODE_DISABLED') errDesc = 'This redeem code is currently inactive.';
    else if (result.error_code === 'CODE_EXHAUSTED') errDesc = 'This redeem code has reached its maximum redemption limit.';
    else if (result.error_code === 'MEMBER_LIMIT_REACHED') errDesc = 'You have already redeemed this code.';

    await ctx.reply(
      `❌ <b>REDEEM FAILED</b>\n\n${errDesc}`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  const profileWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=profile` : `${storeUrl}?tab=profile`;
  let rewardDetails = `🎁 <b>${result.reward_title}</b>\n${result.reward_description}\n\n`;
  if (result.reward_type === 'points') {
    rewardDetails += `🪙 <b>Current Points:</b> <code>${result.points_balance?.toLocaleString()}</code> Pts`;
  } else if (result.reward_type === 'gacha_tickets') {
    rewardDetails += `🎟️ <b>Current Tickets:</b> <code>${result.tickets_balance}</code> Tickets`;
  } else if (result.coupon) {
    rewardDetails += `🏷️ <b>Coupon Code:</b> <code>${result.coupon.code}</code>\n<i>Ready to use at checkout!</i>`;
  }

  const text =
    `🎉 <b>CODE REDEEMED SUCCESSFULLY!</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Code: <code>${result.code}</code>\n\n` +
    rewardDetails + `\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [createWebAppOrUrlButton('Open Store Profile', profileWebUrl, 'PACKAGE')],
    [cb('Back to Profile', 'cb_profile_menu', 'BACK')],
  ]);

  await ctx.reply(enrichWithTgEmojis(text), {
    parse_mode: 'HTML',
    ...keyboard,
  });
}
