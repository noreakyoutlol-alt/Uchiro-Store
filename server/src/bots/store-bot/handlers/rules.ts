import { Context } from 'telegraf';
import {
  buildMainRulesKeyboard,
  buildSubRulesKeyboard,
} from '../keyboards';
import { enrichWithTgEmojis } from '../utils/emoji-registry';
import { isMessageNotModifiedError } from './orders';

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
