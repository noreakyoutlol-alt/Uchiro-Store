import { Context } from 'telegraf';
import {
  buildMainHelpKeyboard,
  buildSubHelpKeyboard,
  buildHowToBuyKeyboard,
  buildKhqrGuideKeyboard,
} from '../keyboards';
import { isMessageNotModifiedError } from './orders';

/**
 * Handle Main Help Center (cb_main_help / /help)
 */
export async function handleMainHelp(ctx: Context, supportUsername: string = 'UchiroSupport'): Promise<void> {
  const telegramId = ctx.from?.id;
  if (!telegramId) return;

  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `❓ <b>HELP CENTER &amp; FAQ</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Frequently asked questions and guides:\n\n` +
    `1️⃣ <b>How to log into an account with 2FA:</b>\n` +
    `• Go to <b>🎒 My Vault</b> -> Select account -> Tap <b>🔑 Request Live 2FA OTP</b> to get your 6-digit code.\n\n` +
    `2️⃣ <b>KHQR / Bakong Payments:</b>\n` +
    `• Scan payment QR with any Bakong-enabled banking app -> Verified automatically within 5 seconds.\n\n` +
    `3️⃣ <b>Need Assistance?</b>\n` +
    `• Contact our 24/7 Support team below for instant human help!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildMainHelpKeyboard(supportUsername, 'en');

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Help Menu] Render warning:', err);
    }
  }
}

/**
 * Handle 2FA Authenticator Guide (cb_guide_2fa)
 */
export async function handleGuide2fa(ctx: Context, _supportUsername: string = 'UchiroSupport'): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🔑 <b>2FA AUTHENTICATOR USER GUIDE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Step 1:</b>\n` +
    `• Open <b>🎒 My Vault</b> in this bot or the Mini App.\n\n` +
    `<b>Step 2:</b>\n` +
    `• Tap on your purchased account and select <b>🔑 Request Live 2FA OTP</b>.\n\n` +
    `<b>Step 3:</b>\n` +
    `• The bot generates your current 6-digit code (valid for 30s).\n` +
    `• Enter this code on the game login screen to log in immediately!\n\n` +
    `💡 <i>Tip: You can also copy the 2FA secret key into Google Authenticator or 2FAS app.</i>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubHelpKeyboard('en');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[2FA Guide] Render warning:', err);
    }
  }
}

/**
 * Handle Payment Guide (cb_guide_payment)
 */
export async function handleGuidePayment(ctx: Context, _supportUsername: string = 'UchiroSupport'): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `💳 <b>HOW TO PAY VIA KHQR</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<b>Step 1:</b>\n` +
    `• Open the Mini App store, select your item, and tap <b>Buy Now</b>.\n\n` +
    `<b>Step 2:</b>\n` +
    `• A standardized Bakong KHQR code will be displayed with the exact USD amount.\n\n` +
    `<b>Step 3:</b>\n` +
    `• Open your bank app (ABA, Bakong, ACLEDA, Wing, etc.) and scan the QR code.\n\n` +
    `<b>Step 4:</b>\n` +
    `• Payment verifies automatically within <b>5 seconds</b>, and credentials are instantly delivered to your <b>🎒 Vault</b>!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildSubHelpKeyboard('en');

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[Payment Guide] Render warning:', err);
    }
  }
}

/**
 * Handle How to Buy & Pay (cb_how_to_buy)
 */
export async function handleHowToBuy(
  ctx: Context,
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `🛒 <b>HOW TO BUY &amp; PAY AT UCHIRO STORE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Purchasing accounts, items, and tickets is fully automated 24/7:\n\n` +
    `1️⃣ <b>Step 1:</b> Open the Store Mini App.\n` +
    `2️⃣ <b>Step 2:</b> Select a product, package, or ticket and choose <b>Buy Now</b>.\n` +
    `3️⃣ <b>Step 3:</b> Follow the KHQR / Bakong payment prompt on screen.\n` +
    `4️⃣ <b>Step 4:</b> Wait for independent payment verification and automatic credential/order delivery in chat and in <b>My Orders &amp; Vault</b>!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👇 <i>Select a guide below:</i>`;

  const keyboard = buildHowToBuyKeyboard(storeUrl);

  try {
    if (ctx.callbackQuery) {
      await ctx.editMessageText(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    } else {
      await ctx.reply(text, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    }
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[HowToBuy] Render warning:', err);
    }
  }
}

/**
 * Handle Step-by-Step Purchase Guide (cb_guide_step_by_step)
 */
export async function handleGuideStepByStep(ctx: Context, _storeUrl?: string): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `📖 <b>STEP-BY-STEP PURCHASE GUIDE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `1️⃣ <b>Step 1: Open the Store Mini App</b>\n` +
    `• Tap <b>Open Store</b> from the main menu or click the store link.\n\n` +
    `2️⃣ <b>Step 2: Select &amp; Buy Now</b>\n` +
    `• Browse accounts, items, or tickets. Select your desired item and tap <b>Buy Now</b>.\n\n` +
    `3️⃣ <b>Step 3: Follow KHQR / Bakong Payment</b>\n` +
    `• A standardized Bakong KHQR code displays with the exact USD amount.\n` +
    `• Scan with your bank app (ABA, ACLEDA, Wing, Canadia, etc.).\n\n` +
    `4️⃣ <b>Step 4: Independent Verification &amp; Delivery</b>\n` +
    `• Our system independently verifies payment within seconds.\n` +
    `• Credentials and 2FA are delivered automatically here in chat and into <b>My Orders &amp; Vault</b>!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildKhqrGuideKeyboard();

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[GuideStepByStep] Render warning:', err);
    }
  }
}

/**
 * Handle KHQR Payment Guide (cb_guide_khqr)
 */
export async function handleGuideKhqr(ctx: Context): Promise<void> {
  try {
    await ctx.answerCbQuery();
  } catch {}

  const text =
    `💳 <b>HOW TO PAY VIA BAKONG KHQR ON A SINGLE PHONE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `If you are using a single phone, no need for a second device to scan:\n\n` +
    `• 📸 <b>Step 1:</b> Take a screenshot of the QR Code.\n` +
    `• 📲 <b>Step 2:</b> Open your mobile banking app (ABA / ACLEDA / Wing) and tap <b>Scan QR</b>.\n` +
    `• 🖼️ <b>Step 3:</b> Tap the photo gallery icon and select your screenshot.\n` +
    `• ✅ <b>Step 4:</b> Confirm payment and return to the bot; your items are delivered automatically!\n` +
    `━━━━━━━━━━━━━━━━━━━━━━`;

  const keyboard = buildKhqrGuideKeyboard();

  try {
    await ctx.editMessageText(text, {
      parse_mode: 'HTML',
      ...keyboard,
    });
  } catch (err) {
    if (!isMessageNotModifiedError(err)) {
      console.warn('[GuideKHQR] Render warning:', err);
    }
  }
}

