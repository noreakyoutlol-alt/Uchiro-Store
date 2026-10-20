import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { DataStore } from '../../database/data-store';
import { TELEGRAM_EMOJIS, renderTgEmoji, tgEmoji, enrichWithTgEmojis, TelegramEmojiKey } from '../../config/telegram-emojis';
import { FulfillmentService } from '../../services/fulfillment.service';
import { RobuxService } from '../../services/robux.service';
import {
  handleVaultMenu,
  handleViewAccount,
  handleGen2fa,
  handleOrdersMenu,
  handleOrdersRecent,
  handleOrdersTrack,
  isMessageNotModifiedError,
} from './handlers/orders';
import { applyTelegramOutboundGuard } from '../telegram-guard';
import {
  handleProfileMenu,
  handlePointsLedger,
  handleRedeemPoints,
  handleRedeemCodeMenu,
  handleRedeemCommand,
} from './handlers/profile';
import {
  handleMainRules,
  handleGachaRules,
  handleDailyRules,
  handleWarrantyPolicy,
  handlePaymentDeliveryPolicy,
  handleRefundPolicy,
  handlePointsCouponsPolicy,
  handleFaqHelp,
  handleContactSupport,
  handleBackToRules,
  handleStoreRules,
} from './handlers/rules';
import {
  handleMainHelp,
  handleGuide2fa,
  handleGuidePayment,
  handleHowToBuy,
  handleGuideKhqr,
  handleGuideStepByStep,
} from './handlers/help';
import {
  handleVault2fa,
  handleVaultAccounts,
} from './handlers/vault';
import {
  handleBuyGachaTicket,
} from './handlers/gacha';
import {
  handleGachaOdds,
  handleGachaPrizes,
  handleGachaMenu,
} from './handlers/gacha';
import {
  handleDailyMenu,
  handleClaimDailyInstant,
  handleDailyShop,
  fetchDailyLiveInfo,
} from './handlers/daily';
import {
  handleRobuxMenu,
  handleSelectPack,
  handleRobuxUsernameInput,
  handleConfirmAccountProfile,
  handleSoldOutPack,
  handleReenterUsername,
  handleCancelRobux,
  handleDisabledPayment,
  clearRobuxSession,
} from './handlers/robux';
import {
  buildMainMenuKeyboard,
  getMainMenuKeyboard,
  getLanguageSelectionKeyboard,
  createWebAppOrUrlButton,
  stripLeadingEmoji,
  cb,
} from './keyboards';
import { getLocale } from './locales';

export {
  TELEGRAM_EMOJIS,
  renderTgEmoji,
  tgEmoji,
  enrichWithTgEmojis,
  buildMainMenuKeyboard,
  getMainMenuKeyboard,
  getLanguageSelectionKeyboard,
  createWebAppOrUrlButton,
};

export const STORE_BOT_DEFAULT_USERNAME = 'UchiroStore_BOT';
export const STORE_BOT_DISPLAY_NAME = 'UchiroStore_BOT';
export const STORE_BOT_USERNAME = STORE_BOT_DEFAULT_USERNAME;

/**
 * Returns the resolved Store Bot username (without leading '@').
 */
export function getStoreBotUsername(): string {
  const raw = process.env.STORE_BOT_USERNAME || env.STORE_BOT_USERNAME || STORE_BOT_DEFAULT_USERNAME;
  return raw.replace(/^@/, '').trim();
}

/**
 * Generates dynamic deep links to the Store Telegram Bot.
 */
export function getStoreBotLink(startParam?: string): string {
  const username = getStoreBotUsername();
  if (startParam) {
    return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}`;
}

export function getStoreBotMiniAppLink(startAppParam?: string): string {
  const username = getStoreBotUsername();
  if (startAppParam) {
    return `https://t.me/${username}?startapp=${encodeURIComponent(startAppParam)}`;
  }
  return `https://t.me/${username}`;
}

export const getStoreBotUrl = getStoreBotLink;
export const getBotLink = getStoreBotLink;

/**
 * Format message HTML, normalize custom Telegram emoji tags,
 * and enrich raw emojis with configured custom Telegram emojis.
 */
export function formatTelegramHtml(text: string): string {
  if (!text) return '';
  const normalized = text.replace(/<tg-emoji\s+id="([^"]+)">/gi, '<tg-emoji emoji-id="$1">');
  return enrichWithTgEmojis(normalized);
}

/**
 * Creates an inline button with emoji fallback and custom emoji support.
 * Strict de-duplication: Enforces strictly ONE emoji per button.
 */
export function createEmojiInlineButton(opts: {
  text: string;
  emojiKey?: TelegramEmojiKey;
  targetUrl?: string;
  url?: string;
  callbackData?: string;
  customEmojiId?: string;
}) {
  const customEmojiDisabled = process.env.BUTTON_CUSTOM_EMOJI === 'off';
  const emojiDef = opts.emojiKey ? TELEGRAM_EMOJIS[opts.emojiKey] : undefined;
  const customEmojiId = !customEmojiDisabled ? (opts.customEmojiId || emojiDef?.customEmojiId) : undefined;
  const fallback = emojiDef?.fallback;

  const cleanText = stripLeadingEmoji(opts.text);
  const hasCustom = Boolean(customEmojiId && customEmojiId.trim() !== '');

  let finalText: string;
  if (hasCustom) {
    finalText = cleanText;
  } else {
    const hasLeading = opts.text !== cleanText;
    finalText = hasLeading ? opts.text : (fallback ? `${fallback} ${cleanText}` : cleanText);
  }

  let btn: any;
  if (opts.targetUrl) {
    btn = Markup.button.webApp(finalText, opts.targetUrl);
  } else if (opts.url) {
    btn = Markup.button.url(finalText, opts.url);
  } else if (opts.callbackData) {
    btn = Markup.button.callback(finalText, opts.callbackData);
  } else {
    btn = Markup.button.callback(finalText, 'cb_noop');
  }

  if (hasCustom && customEmojiId) {
    btn.icon_custom_emoji_id = customEmojiId.trim();
  }

  if (fallback) {
    Object.defineProperty(btn, '__fallback', {
      value: fallback,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  }

  return btn;
}

export const storeKeyboard = getMainMenuKeyboard;
export const mainMenuKeyboard = getMainMenuKeyboard;

export function getWelcomeMessage(lang: string = 'en'): string {
  const lightning = renderTgEmoji('LIGHTNING');
  const fire = renderTgEmoji('FIRE');

  if (lang === 'km') {
    return (
      `${lightning} <b>សូមស្វាគមន៍មកកាន់ UCHIRO STORE</b> ${lightning}\n\n` +
      `គណនីហ្គេមពិសេស, ផ្លែឈើ និងរង្វាន់ជាច្រើន។\n\n` +
      `${fire} <b>សេវាកម្មចម្បង៖</b>\n` +
      `• Auto-Delivery ២ វិនាទី ទទួលបានគណនី និងកូដភ្លាមៗ\n` +
      `• Blox Fruits, MM2, Blade Ball & Evade\n` +
      `• ប្រអប់ Gacha ឱកាសឈ្នះខ្ពស់\n` +
      `• បង់ប្រាក់ងាយស្រួលតាម KHQR / Bakong (ABA, Wing, ACLEDA...)\n` +
      `• ធានាសុវត្ថិភាព ១០០% និងធានាជូន ១៤ ថ្ងៃ\n\n` +
      `សូមចុចជ្រើសរើសមុខងារខាងក្រោមដើម្បីចាប់ផ្តើម៖`
    );
  }

  return (
    `${lightning} <b>WELCOME TO UCHIRO STORE</b> ${lightning}\n\n` +
    `Premium Gaming Accounts, In-Game Items & Rewards.\n\n` +
    `${fire} <b>Features:</b>\n` +
    `• Instant Auto-Delivered Accounts & Digital Codes\n` +
    `• Blox Fruits, MM2, Blade Ball & Evade\n` +
    `• Mythical Gacha Chest with High Win-Rates\n` +
    `• Instant KHQR / Bakong Payments\n` +
    `• 100% Guaranteed Safe & 14-Day Warranty\n\n` +
    `Select an option below to get started:`
  );
}

export class StoreBotService {
  private bot: Telegraf | null = null;
  private token: string = '';

  constructor() {
    this.initBot();
  }

  private initBot(): void {
    const rawToken = (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim();
    this.token = rawToken;
    if (this.token && !this.token.startsWith('mock_')) {
      if (!this.bot) {
        this.bot = new Telegraf(this.token);
        applyTelegramOutboundGuard(this.bot);
        this.setupHandlers();
      }
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    const appUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const supportUsername = (process.env.SUPPORT_TELEGRAM_USERNAME || env.TELEGRAM_SUPPORT_USERNAME || 'UchiroSupport').replace(/^@/, '');
    const storeWebAppUrl = (process.env.STORE_MINIAPP_URL && process.env.STORE_MINIAPP_URL.startsWith('https://'))
      ? process.env.STORE_MINIAPP_URL
      : (env.STORE_WEBAPP_URL && env.STORE_WEBAPP_URL.startsWith('https://'))
        ? env.STORE_WEBAPP_URL
        : (env.CLIENT_STORE_URL && env.CLIENT_STORE_URL.startsWith('https://'))
          ? env.CLIENT_STORE_URL
          : appUrl;

    // Global middleware: wrap ctx.answerCbQuery (first call wins);
    // if no handler answered within 1.5s or it ended/threw without answering, answer silently and console.warn callback_data
    this.bot.use(async (ctx, next) => {
      if (ctx.callbackQuery) {
        const cbData = (ctx.callbackQuery as any).data || '';
        let answered = false;
        const originalAnswer = ctx.answerCbQuery.bind(ctx);

        (ctx as any).answerCbQuery = async (...args: any[]) => {
          if (answered) return true;
          answered = true;
          try {
            return await originalAnswer(...args);
          } catch {
            return false;
          }
        };

        const timer = setTimeout(async () => {
          if (!answered) {
            console.warn(`[answerCbQuery middleware] auto-answering timed-out callback: ${cbData}`);
            try {
              await ctx.answerCbQuery();
            } catch {}
          }
        }, 1500);

        try {
          await next();
        } catch (err) {
          if (!answered) {
            console.warn(`[answerCbQuery middleware] auto-answering error in callback: ${cbData}`);
            try {
              await ctx.answerCbQuery();
            } catch {}
          }
          throw err;
        } finally {
          clearTimeout(timer);
          if (!answered) {
            console.warn(`[answerCbQuery middleware] auto-answering unhandled callback: ${cbData}`);
            try {
              await ctx.answerCbQuery();
            } catch {}
          }
        }
        return;
      }
      return next();
    });

    this.bot.catch(async (err: any, ctx) => {
      console.error(`[STORE BOT ERROR] for ${ctx.updateType}:`, err);
      if (ctx.callbackQuery) {
        try {
          await ctx.reply('Something went wrong, send /start');
        } catch {}
      }
    });

    // /start command: Shows language selection for first-time user without saved language; returns main menu for returning users
    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const payload = (ctx as any).startPayload || '';
      if (payload === 'buy_robux' || payload === 'robux') {
        return handleRobuxMenu(ctx);
      }

      // Check if user already has a saved language preference
      const savedLang = DataStore.getUserLanguagePreference(from.id);

      if (!savedLang) {
        // First-time user: upsert record without hardcoding language, then show Language Selection
        DataStore.upsertTelegramUser({
          telegram_id: from.id,
          username: from.username,
          first_name: from.first_name,
          last_name: from.last_name,
          language_code: from.language_code || 'en',
        });

        const langPrompt =
          `${renderTgEmoji('GLOBE', '🌐')} <b>Welcome to UCHIRO STORE | សូមស្វាគមន៍</b>\n\n` +
          `Please select your preferred language to continue:\n` +
          `សូមជ្រើសរើសភាសារបស់អ្នកដើម្បីបន្ត៖`;

        const keyboard = getLanguageSelectionKeyboard(false);
        return ctx.reply(enrichWithTgEmojis(formatTelegramHtml(langPrompt)), {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }

      // Returning user: go straight to their menu with localized message & English buttons
      DataStore.upsertTelegramUser({
        telegram_id: from.id,
        username: from.username,
        first_name: from.first_name,
        last_name: from.last_name,
        language_preference: savedLang,
      });

      const welcomeText = getWelcomeMessage(savedLang);
      const keyboard = buildMainMenuKeyboard(storeWebAppUrl, supportUsername);
      await ctx.reply(enrichWithTgEmojis(formatTelegramHtml(welcomeText)), {
        parse_mode: 'HTML',
        ...keyboard,
      });
    });

    // ─── BUY ROBUX WORKFLOW ──────────────────────────────────────────────────
    this.bot.command(['robux', 'buyrobux'], async (ctx) => {
      await handleRobuxMenu(ctx);
    });

    this.bot.action('cb_buy_robux', async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      await handleRobuxMenu(ctx);
    });

    // Step 2 & 3: Profile Confirmation (Account Review occurs strictly BEFORE amount selection)
    this.bot.action(['cb_rbx_confirm_account', 'cb_rbx_confirm'], async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      await handleConfirmAccountProfile(ctx);
    });

    this.bot.action(['cb_rbx_reenter_username', 'cb_rbx_reenter'], async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      await handleReenterUsername(ctx);
    });

    this.bot.action('cb_rbx_cancel', async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      await handleCancelRobux(ctx);
    });

    // Step 4: Amount Selection (Only accessible after profile confirmation)
    this.bot.action(/^cb_rbx_pack_(\d+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      const denom = Number(ctx.match[1]);
      await handleSelectPack(ctx, denom);
    });

    this.bot.action(/^cb_rbx_soldout_(\d+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      const denom = Number(ctx.match[1]);
      await handleSoldOutPack(ctx, denom);
    });

    // Payment Attempt: Safely Disabled by Policy Gate
    this.bot.action(/^cb_rbx_pay_(.+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      await handleDisabledPayment(ctx);
    });

    this.bot.action(/^cb_rbx_check_(.+)$/, async (ctx) => {
      const orderCode = ctx.match[1];
      try {
        await ctx.answerCbQuery(`Checking payment status for #${orderCode}...`);
      } catch {}
      const order = await RobuxService.getOrderByCode(orderCode);
      if (!order) {
        return ctx.reply(
          formatTelegramHtml(`❌ <b>Order #${orderCode} not found in Robux order records.</b>`),
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([[cb('Back to Main Menu', 'cb_main_menu', 'HOME')]]),
          }
        );
      }
      const statusText = order.status;
      await ctx.reply(
        formatTelegramHtml(
          `📦 <b>Robux Order #${orderCode} Status:</b> <code>${statusText.toUpperCase()}</code>\n\n` +
          (statusText === 'completed'
            ? '✅ Order completed via authorized fulfillment channel.'
            : statusText === 'paid'
            ? '⏳ Payment received. Fulfillment pending verification.'
            : '🛡️ <b>Notice:</b> Direct third-party Robux purchase/payment is held safely disabled pending documented Roblox authorization.')
        ),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [cb('Back to Main Menu', 'cb_main_menu', 'HOME')],
          ]),
        }
      );
    });

    // Universal Back Home Navigation (cb_main_menu & aliases)
    this.bot.action(['cb_main_menu', 'cb_back_home', 'menu_home', 'back_home'], async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const fromId = ctx.from?.id;
      const lang = (fromId ? DataStore.getUserLanguagePreference(fromId) : null) || 'en';
      const welcomeText = getWelcomeMessage(lang);
      const keyboard = buildMainMenuKeyboard(storeWebAppUrl, supportUsername);

      const html = enrichWithTgEmojis(formatTelegramHtml(welcomeText));
      try {
        await ctx.editMessageText(html, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } catch (err) {
        if (!isMessageNotModifiedError(err)) {
          console.warn('[cb_main_menu] Edit warning:', err);
        }
      }
    });

    // Language selection callback: saves choice and renders main menu
    this.bot.action(/^set_lang:(.+)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const from = ctx.from;
      const rawCode = ctx.match[1];
      const selectedLang = rawCode === 'km' ? 'km' : 'en';

      if (from) {
        DataStore.setUserLanguagePreference(from.id, selectedLang);
        DataStore.upsertTelegramUser({
          telegram_id: from.id,
          username: from.username,
          first_name: from.first_name,
          last_name: from.last_name,
          language_preference: selectedLang,
        });
      }

      const welcomeText = getWelcomeMessage(selectedLang);
      const keyboard = buildMainMenuKeyboard(storeWebAppUrl, supportUsername);
      const html = enrichWithTgEmojis(formatTelegramHtml(welcomeText));

      try {
        await ctx.editMessageText(html, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } catch {
        await ctx.reply(html, {
          parse_mode: 'HTML',
          ...keyboard,
        });
      }
    });

    const showLanguageMenu = async (ctx: any) => {
      try {
        if (ctx.callbackQuery) await ctx.answerCbQuery();
      } catch {}

      const langPrompt =
        `${renderTgEmoji('GLOBE', '🌐')} <b>Choose Language / ជ្រើសរើសភាសា</b>\n\n` +
        `Please select your preferred language:\n` +
        `សូមជ្រើសរើសភាសារបស់អ្នក៖`;

      const keyboard = getLanguageSelectionKeyboard(true);
      const html = enrichWithTgEmojis(formatTelegramHtml(langPrompt));

      if (ctx.callbackQuery) {
        try {
          return await ctx.editMessageText(html, {
            parse_mode: 'HTML',
            ...keyboard,
          });
        } catch {}
      }
      return ctx.reply(html, {
        parse_mode: 'HTML',
        ...keyboard,
      });
    };

    this.bot.command(['language', 'lang'], showLanguageMenu);
    this.bot.action(['cb_lang_menu', 'select_language'], showLanguageMenu);

    // MODULE 2: PROFILE DASHBOARD
    this.bot.action(['cb_profile_menu', 'menu_profile'], async (ctx) => {
      await handleProfileMenu(ctx, storeWebAppUrl);
    });
    this.bot.command('profile', async (ctx) => {
      await handleProfileMenu(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_points_ledger', async (ctx) => {
      await handlePointsLedger(ctx);
    });
    this.bot.action(['cb_redeem_pts', 'cb_redeem_menu'], async (ctx) => {
      await handleRedeemPoints(ctx);
    });
    this.bot.action('cb_redeem_code', async (ctx) => {
      await handleRedeemCodeMenu(ctx, storeWebAppUrl);
    });
    this.bot.command(['redeem', 'code'], async (ctx) => {
      await handleRedeemCommand(ctx, storeWebAppUrl);
    });

    // MODULE 2: STORE RULES & WARRANTIES
    this.bot.action(['cb_main_rules', 'menu_rules', 'cb_rules_menu', 'cb_back_to_rules'], async (ctx) => {
      await handleMainRules(ctx);
    });
    this.bot.command('rules', async (ctx) => {
      await handleMainRules(ctx);
    });
    this.bot.action(['cb_gacha_rules', 'cb_rules_gacha'], async (ctx) => {
      await handleGachaRules(ctx);
    });
    this.bot.action('cb_daily_rules', async (ctx) => {
      await handleDailyRules(ctx);
    });
    this.bot.action(['cb_warranty_policy', 'cb_rules_warranty'], async (ctx) => {
      await handleWarrantyPolicy(ctx);
    });
    this.bot.action('cb_payment_delivery', async (ctx) => {
      await handlePaymentDeliveryPolicy(ctx);
    });
    this.bot.action('cb_refund_policy', async (ctx) => {
      await handleRefundPolicy(ctx);
    });
    this.bot.action('cb_points_coupons', async (ctx) => {
      await handlePointsCouponsPolicy(ctx);
    });
    this.bot.action('cb_faq_help', async (ctx) => {
      await handleFaqHelp(ctx);
    });
    this.bot.action('cb_contact_support', async (ctx) => {
      await handleContactSupport(ctx);
    });

    // MODULE 2: HELP & FAQ CENTER
    this.bot.action(['cb_main_help', 'menu_help', 'cb_help_menu'], async (ctx) => {
      await handleMainHelp(ctx, supportUsername);
    });
    this.bot.command('help', async (ctx) => {
      await handleMainHelp(ctx, supportUsername);
    });
    this.bot.action(['cb_guide_2fa', 'cb_help_2fa'], async (ctx) => {
      await handleGuide2fa(ctx, supportUsername);
    });
    this.bot.action('cb_guide_payment', async (ctx) => {
      await handleGuidePayment(ctx, supportUsername);
    });
    this.bot.action('cb_how_to_buy', async (ctx) => {
      await handleHowToBuy(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_guide_step_by_step', async (ctx) => {
      await handleGuideStepByStep(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_guide_khqr', async (ctx) => {
      await handleGuideKhqr(ctx);
    });

    // MODULE 3: INFO CENTER
    // Handle store info (product catalog, search) and rules entry points
    this.bot.action('cb_rules_store', async (ctx) => {
      await handleStoreRules(ctx);
    });

    // MODULE 4: REAL-TIME GACHA
    this.bot.action(['cb_gacha_menu', 'menu_gacha'], async (ctx) => {
      await handleGachaMenu(ctx, storeWebAppUrl);
    });
    this.bot.command('gacha', async (ctx) => {
      await handleGachaMenu(ctx, storeWebAppUrl);
    });
    this.bot.action(['cb_gacha_buy_ticket', 'cb_buy_ticket_pts'], async (ctx) => {
      await handleBuyGachaTicket(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_gacha_prizes', async (ctx) => {
      await handleGachaPrizes(ctx, storeWebAppUrl);
    });
    this.bot.action(['cb_gacha_odds', 'cb_gacha_rates'], async (ctx) => {
      await handleGachaOdds(ctx, storeWebAppUrl);
    });

    // MODULE 3: REAL-TIME DAILY POINTS & IN-CHAT CLAIM
    this.bot.action(['cb_daily_menu', 'menu_rewards'], async (ctx) => {
      await handleDailyMenu(ctx);
    });
    this.bot.command('daily', async (ctx) => {
      await handleDailyMenu(ctx);
    });
    this.bot.action(['cb_claim_daily', 'cb_claim_daily_instant'], async (ctx) => {
      await handleClaimDailyInstant(ctx);
    });
    this.bot.action('cb_daily_shop', async (ctx) => {
      await handleDailyShop(ctx);
    });
    this.bot.action('cb_noop', async (ctx) => {
      try {
        const fromId = ctx.from?.id;
        if (fromId) {
          const daily = await fetchDailyLiveInfo(fromId);
          await ctx.answerCbQuery(
            `⏳ ${daily.cooldown_str} remaining before next claim`,
            { show_alert: true }
          );
        } else {
          await ctx.answerCbQuery('⏳ Cooldown active...');
        }
      } catch {}
    });

    // MODULE 4: IN-CHAT ACCOUNT VAULT & LIVE 2FA GENERATOR
    this.bot.action(['cb_vault_menu', 'menu_vault'], async (ctx) => {
      await handleVaultMenu(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_vault_accounts', async (ctx) => {
      await handleVaultAccounts(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_vault_2fa', async (ctx) => {
      await handleVault2fa(ctx, storeWebAppUrl);
    });
    this.bot.action(/^cb_vault_2fa_acc:(.+)$/, async (ctx) => {
      const accountId = ctx.match[1];
      await handleGen2fa(ctx, accountId, storeWebAppUrl);
    });
    this.bot.command('vault', async (ctx) => {
      await handleVaultMenu(ctx, storeWebAppUrl);
    });

    // MODULE 4b: ORDER HISTORY & TRACKING
    this.bot.action(['cb_orders_menu', 'menu_orders', 'cb_orders_recent'], async (ctx) => {
      await handleOrdersRecent(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_orders_track', async (ctx) => {
      await handleOrdersTrack(ctx, storeWebAppUrl);
    });
    this.bot.command('orders', async (ctx) => {
      await handleOrdersRecent(ctx, storeWebAppUrl);
    });

    this.bot.action([/^cb_view_acc_(.+)$/, /^cb_vault_acc:(.+)$/], async (ctx) => {
      const accountId = ctx.match[1];
      await handleViewAccount(ctx, accountId, storeWebAppUrl);
    });

    this.bot.action(/^cb_vault_page:(\d+)$/, async (ctx) => {
      try { await ctx.answerCbQuery(); } catch {}
      const page = Number(ctx.match[1]);
      await handleVaultAccounts(ctx, storeWebAppUrl, page);
    });

    this.bot.action(/^cb_gen_2fa_(.+)$/, async (ctx) => {
      const accountId = ctx.match[1];
      await handleGen2fa(ctx, accountId, storeWebAppUrl);
    });

    // Fulfilled Order Interactive Callbacks
    this.bot.action(/^view_order:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        await ctx.answerCbQuery();
      } catch {}
      const webAppUrl = `${storeWebAppUrl}?tab=orders&orderId=${orderId}`;
      await ctx.reply(
        formatTelegramHtml(
          `📦 <b>Order Details #${orderId}</b>\n\n` +
          `Tap below to view full details in the Mini App:`
        ),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [createWebAppOrUrlButton('📱 Open in Mini App', webAppUrl, 'PACKAGE')],
          ]),
        }
      );
    });

    this.bot.action(/^send_qr:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const qrBuffer = await FulfillmentService.generate2FaQrBuffer(orderId);
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          { caption: '📷 Scan with Google Authenticator or 2FAS' }
        );
        await ctx.answerCbQuery('QR Code sent!');
      } catch {
        try {
          await ctx.answerCbQuery('Error generating 2FA QR code.');
        } catch {}
      }
    });

    this.bot.action(/^sub_warranty:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const { text, keyboard } = FulfillmentService.getWarrantySubScreen(orderId);
        await ctx.editMessageText(formatTelegramHtml(text), {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await ctx.answerCbQuery();
      } catch {
        try {
          await ctx.answerCbQuery('Error checking warranty.');
        } catch {}
      }
    });

    this.bot.action(/^sub_main:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const cardText = FulfillmentService.getMainDeliveryCardText(orderId);
        const keyboard = FulfillmentService.getMainDeliveryKeyboard(orderId);
        await ctx.editMessageText(formatTelegramHtml(cardText), {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await ctx.answerCbQuery();
      } catch {
        try {
          await ctx.answerCbQuery('Error loading delivery card.');
        } catch {}
      }
    });

    // Handle generic text messages (e.g. Roblox username input)
    this.bot.on('text', async (ctx, next) => {
      const text = ctx.message?.text?.trim();
      if (!text || text.startsWith('/')) {
        return next();
      }

      const handled = await handleRobuxUsernameInput(ctx, text);
      if (!handled) {
        return next();
      }
    });

    // Error handling
    this.bot.catch((err: any, ctx) => {
      console.error(`[STORE BOT ERROR] for ${ctx.updateType}:`, err);
    });
  }

  public getBot(): Telegraf | null {
    return this.bot;
  }

  public getTelegraf(): Telegraf | null {
    return this.bot;
  }

  public getDisplayName(): string {
    return STORE_BOT_DISPLAY_NAME;
  }

  public getUsername(): string {
    return getStoreBotUsername();
  }

  public getBotLink(startParam?: string): string {
    return getStoreBotLink(startParam);
  }

  public async startPolling(): Promise<void> {
    if (!this.bot) {
      this.initBot();
    }
    if (!this.bot) {
      console.log('⚡ [STORE BOT] Polling disabled (no token provided). Simulated mode active.');
      return;
    }
    try {
      await this.bot.launch();
      console.log(`✅ [STORE BOT] Running and listening for customers (@${getStoreBotUsername()})...`);
    } catch (err: any) {
      console.warn('⚠️ [STORE BOT] Polling launch warning:', err.message);
    }
  }

  public async handleWebhookUpdate(update: any): Promise<void> {
    if (this.bot) {
      try {
        await this.bot.handleUpdate(update);
      } catch (err: any) {
        console.error('[STORE BOT] Error processing update:', err);
      }
    }
  }

  public async getWebhookInfo(): Promise<any> {
    if (!this.bot) {
      return { configured: false, error: 'No bot token configured' };
    }
    try {
      return await this.bot.telegram.getWebhookInfo();
    } catch (err: any) {
      return { configured: true, error: err.message };
    }
  }

  public async setWebhook(url: string, secret?: string): Promise<any> {
    if (!this.bot) {
      return { success: false, message: 'No bot token configured' };
    }
    try {
      await this.bot.telegram.setWebhook(url, secret ? { secret_token: secret } : undefined);
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async deleteWebhook(): Promise<any> {
    if (!this.bot) {
      return { success: false, message: 'No bot token configured' };
    }
    try {
      await this.bot.telegram.deleteWebhook();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err.message };
    }
  }

  public async sendMessage(chatId: number, text: string, replyMarkup?: any): Promise<boolean> {
    const isTestRunner = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);
    if (isTestRunner || !this.bot) {
      console.log(`[STORE BOT to ${chatId}]:\n${text}`);
      return true;
    }
    try {
      await this.bot.telegram.sendMessage(chatId, formatTelegramHtml(text), {
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      });
      return true;
    } catch (err: any) {
      console.error(`[STORE BOT] Failed to send message to ${chatId}:`, err.message);
      return false;
    }
  }

  public webhookCallback(path: string) {
    if (!this.bot) {
      this.initBot();
    }
    if (this.bot) {
      return this.bot.webhookCallback(path);
    }
    return (_req: any, res: any) => {
      res.sendStatus(200);
    };
  }

  public stop(): void {
    if (this.bot) {
      try {
        this.bot.stop();
      } catch {}
    }
  }
}

export const storeBot = new StoreBotService();
