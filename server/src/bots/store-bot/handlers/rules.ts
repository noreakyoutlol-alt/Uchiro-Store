import { Context } from 'telegraf';
import {
  buildMainRulesKeyboard,
  buildSubRulesKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { isMessageNotModifiedError } from './orders';
import { Markup } from 'telegraf';

/**
 * Handle Store Rules & Warranties Main Screen (cb_main_rules / /rules)
 */
export async function handleMainRules(ctx: Context): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `📜 <b>UCHIRO STORE GENERAL RULES &amp; POLICIES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ <b>Account Warranty (14-Day Warranty):</b>\n` +
    `• All gaming accounts come with a full 14-day replacement/refund guarantee.\n` +
    `• Instant replacement or refund if an account is locked or doesn't match description.\n\n` +
    `⚠️ <b>Customer Responsibilities:</b>\n` +
    `• Change your password and bind your personal email/2FA immediately after purchase.\n` +
    `• Uchiro Store is not responsible for shared passwords or compromised 2FA codes.\n\n` +
    `🎰 <b>Gacha &amp; Streak Rules:</b>\n` +
    `• Daily streaks reset to Day 1 if uncollected for more than 48 hours.\n` +
    `• Gacha prizes are automatically deposited into your 🎒 Vault within 3 seconds.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildMainRulesKeyboard('en');

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
      console.warn('[Rules Menu] Render warning:', err);
    }
  }
}

/**
 * Handle Gacha Rules & Rates View (cb_gacha_rules / cb_rules_gacha)
 */
export async function handleGachaRules(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🎰 <b>GACHA RULES &amp; DROP RATES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🎫 <b>Ticket Cost:</b> <code>100 Pts</code> per 1 Spin Ticket\n\n` +
    `⚡ <b>Drop Rate Probabilities:</b>\n` +
    `• 🔴 <b>Mythical (Jackpot):</b> <code>1.5%</code> (High-tier Accounts / Mythical Fruits)\n` +
    `• 🟣 <b>Legendary:</b> <code>5.0%</code> (Rare Items / Dark Blade)\n` +
    `• 🔵 <b>Rare:</b> <code>15.0%</code> (In-game Currency &amp; Gamepasses)\n` +
    `• 🟢 <b>Uncommon:</b> <code>30.0%</code> (Level Boosters)\n` +
    `• ⚪ <b>Common:</b> <code>48.5%</code> (Refund Points &amp; Bonus Spins)\n\n` +
    `📦 <b>Prize Delivery:</b>\n` +
    `• Won accounts and digital codes are delivered instantly to your <b>🎒 My Vault</b> within 3 seconds.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Gacha Rules] Render warning:', err);
    }
  }
}

/**
 * Handle Daily Streak Rules (cb_daily_rules)
 */
export async function handleDailyRules(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🎁 <b>DAILY REWARD &amp; STREAK RULES</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `⏳ <b>Cooldown Duration:</b>\n` +
    `• 24-hour rolling cooldown between daily claims.\n\n` +
    `🔥 <b>Streak Multipliers &amp; Rewards:</b>\n` +
    `• <b>Days 1 to 6:</b> <code>+5 Pts</code> each day\n` +
    `• <b>Day 7 (Grand Bonus):</b> <code>+20 Pts</code> milestone reward!\n\n` +
    `⚠️ <b>Streak Reset:</b>\n` +
    `• Missing a claim for more than 48 hours resets your streak back to Day 1.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Daily Rules] Render warning:', err);
    }
  }
}

/**
 * Handle Warranty Policy (cb_warranty_policy / cb_rules_warranty)
 */
export async function handleWarrantyPolicy(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🔐 <b>14-DAY FULL WARRANTY POLICY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ <b>100% Protection:</b>\n` +
    `• All accounts are guaranteed against recovery and lockouts for 14 days from delivery.\n\n` +
    `⚡ <b>Resolution Process:</b>\n` +
    `1. Contact 24/7 Support with your Order ID.\n` +
    `2. Our automated inspection verifies the status.\n` +
    `3. Receive an instant account replacement or 100% refund.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Warranty Policy] Render warning:', err);
    }
  }
}

/**
 * Handle Payment & Delivery Policy (cb_payment_delivery)
 */
export async function handlePaymentDeliveryPolicy(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `📦 <b>PAYMENT &amp; DELIVERY POLICY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💳 <b>Accepted Payment Methods:</b>\n` +
    `• Bakong KHQR (USD &amp; KHR - Instant Verification)\n` +
    `• Local Bank Transfers (ABA, Wing, ACLEDA)\n` +
    `• Credit/Debit Cards (Visa, Mastercard)\n` +
    `• Cryptocurrency (USDT TRC20/BEP20)\n\n` +
    `🚚 <b>Delivery Methods:</b>\n` +
    `• Instant Digital Delivery to Telegram &amp; Mini App Vault\n` +
    `• Credentials unlocked automatically upon payment confirmation\n\n` +
    `⏱️ <b>Delivery Timeframe:</b>\n` +
    `• Automated Accounts &amp; Codes: Instant (&lt; 3 seconds)\n` +
    `• Manual Fulfillment / Verification: Under 15 minutes\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Payment & Delivery Policy] Render warning:', err);
    }
  }
}

/**
 * Handle Refund Policy (cb_refund_policy)
 */
export async function handleRefundPolicy(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `💰 <b>REFUND &amp; REPLACEMENT POLICY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🛡️ <b>Eligible for 100% Refund / Replacement:</b>\n` +
    `• Account locked or credentials invalid upon initial delivery\n` +
    `• Account reclaimed or recovered within the 14-day warranty period\n` +
    `• In-game items or ranks not matching catalog description\n` +
    `• System payment failure or duplicate charge\n\n` +
    `⚠️ <b>Non-Refundable Circumstances:</b>\n` +
    `• User violation of third-party game TOS (e.g. cheating, scripting)\n` +
    `• Password sharing or compromised personal devices\n` +
    `• Voluntary change of mind after credentials revealed\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Refund Policy] Render warning:', err);
    }
  }
}

/**
 * Handle Points & Coupons Policy (cb_points_coupons)
 */
export async function handlePointsCouponsPolicy(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🏷️ <b>POINTS &amp; COUPONS POLICY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🪙 <b>Points Earning Rules:</b>\n` +
    `• <b>Daily Check-in:</b> +5 Pts daily (+20 Pts on Day 7 milestone)\n` +
    `• <b>Shopping Rewards:</b> Earn points on every verified order\n\n` +
    `🎟️ <b>Gacha Ticket Exchange:</b>\n` +
    `• <b>100 Points:</b> 1x Mythical Gacha Ticket (Stackable, no expiration)\n\n` +
    `🏷️ <b>Discount Coupon Exchange:</b>\n` +
    `• <b>50 Points:</b> $0.50 Discount Voucher (Min. Order $1.50)\n` +
    `• <b>100 Points:</b> $1.00 Discount Voucher (Min. Order $3.00)\n` +
    `• <b>200 Points:</b> $2.00 Discount Voucher (Min. Order $5.00)\n\n` +
    `🔒 <b>Usage Terms:</b>\n` +
    `• 1 coupon per order, non-transferable, bound to your Telegram ID\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Points & Coupons Policy] Render warning:', err);
    }
  }
}

/**
 * Handle FAQ & Help (cb_faq_help)
 */
export async function handleFaqHelp(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `❓ <b>FREQUENTLY ASKED QUESTIONS (FAQ)</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Q: How quickly do I get my account?</b>\n` +
    `A: Delivery is instant. Credentials and live 2FA OTP are immediately available in 🎒 My Vault.\n\n` +
    `<b>Q: How do I generate live 2FA codes?</b>\n` +
    `A: Go to 🎒 My Vault -> Tap 'Get Live 2FA Code' or use the in-bot button to receive a valid 6-digit OTP.\n\n` +
    `<b>Q: What if the account stops working?</b>\n` +
    `A: All accounts are covered by our 14-Day Warranty. Contact support for an immediate replacement or refund.\n\n` +
    `<b>Q: Can I use coupons on any product?</b>\n` +
    `A: Yes, as long as your cart meets the minimum order threshold.\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubRulesKeyboard('en');

  try {
    await ctx.editMessageText(enrichWithTgEmojis(text), {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[FAQ & Help] Render warning:', err);
    }
  }
}

/**
 * Handle Contact Support (cb_contact_support)
 */
export async function handleContactSupport(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `💬 <b>CONTACT 24/7 SUPPORT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🕐 <b>Support Availability:</b>\n` +
    `• 24 Hours a Day, 7 Days a Week\n` +
    `• Average response time: under 5 minutes\n\n` +
    `📱 <b>Official Channels:</b>\n` +
    `• <b>Telegram Support:</b> <a href="https://t.me/uchirosupport">@UchiroSupport</a> (https://t.me/uchirosupport)\n` +
    `• <b>Email Support:</b> support@uchiro.store\n\n` +
    `📋 <b>Information to Include:</b>\n` +
    `• Your Order ID or Transaction Number\n` +
    `• Clear description of the issue\n` +
    `• Screenshots or video proof if applicable\n\n` +
    `⚡ <b>Issues Handled:</b>\n` +
    `• Warranty account replacements & refunds\n` +
    `• 2FA authentication assistance\n` +
    `• Payment confirmations\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = Markup.inlineKeyboard([
    [Markup.button.url('💬 Open @UchiroSupport', 'https://t.me/uchirosupport')],
    [
      Markup.button.callback('🔙 Back to Rules', 'cb_main_rules'),
      Markup.button.callback('🏠 Back Home', 'cb_main_menu'),
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
      console.warn('[Contact Support] Render warning:', err);
    }
  }
}

/**
 * Handle Back to Rules (cb_main_rules)
 */
export async function handleBackToRules(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  await handleMainRules(ctx);
}
