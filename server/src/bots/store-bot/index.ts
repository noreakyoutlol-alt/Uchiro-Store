import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { DataStore } from '../../database/data-store';
import { TELEGRAM_EMOJIS, renderTgEmoji, enrichWithTgEmojis, TelegramEmojiKey } from '../../config/telegram-emojis';
import { FulfillmentService } from '../../services/fulfillment.service';
import {
  handleVaultMenu,
  handleViewAccount,
  handleGen2fa,
  isMessageNotModifiedError,
} from './handlers/orders';
import {
  handleProfileMenu,
  handlePointsLedger,
  handleRedeemPoints,
} from './handlers/profile';
import {
  handleMainRules,
  handleGachaRules,
  handleDailyRules,
  handleWarrantyPolicy,
} from './handlers/rules';
import {
  handleMainHelp,
  handleGuide2fa,
  handleGuidePayment,
} from './handlers/help';
import {
  handleGachaMenu,
  handleBuyGachaTicket,
  handleGachaPrizes,
  handleGachaOdds,
} from './handlers/gacha';
import {
  handleDailyMenu,
  handleClaimDailyInstant,
  handleDailyShop,
  fetchDailyLiveInfo,
} from './handlers/daily';
import {
  buildMainMenuKeyboard,
  getMainMenuKeyboard,
  getLanguageSelectionKeyboard,
  createWebAppOrUrlButton,
} from './keyboards';
import { getLocale } from './locales';

export {
  TELEGRAM_EMOJIS,
  renderTgEmoji,
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
  const emojiDef = opts.emojiKey ? TELEGRAM_EMOJIS[opts.emojiKey] : undefined;
  const customEmojiId = opts.customEmojiId || emojiDef?.customEmojiId;
  const fallback = emojiDef?.fallback;

  // Enforce strictly ONE emoji per button:
  // If customEmojiId is present or text already has an emoji, do NOT prepend fallback.
  // Otherwise, prepend fallback if available.
  const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u.test(opts.text);
  const finalText = (customEmojiId || hasEmoji) ? opts.text : (fallback ? `${fallback} ${opts.text}` : opts.text);

  let btn: any;
  if (opts.targetUrl) {
    btn = Markup.button.webApp(finalText, opts.targetUrl);
  } else if (opts.url) {
    btn = Markup.button.url(finalText, opts.url);
  } else if (opts.callbackData) {
    btn = Markup.button.callback(finalText, opts.callbackData);
  } else {
    btn = Markup.button.callback(finalText, 'noop');
  }

  if (customEmojiId) {
    btn.icon_custom_emoji_id = customEmojiId;
  }

  return btn;
}

export const storeKeyboard = getMainMenuKeyboard;
export const mainMenuKeyboard = getMainMenuKeyboard;

export function getWelcomeMessage(lang: string = 'km'): string {
  const lightning = renderTgEmoji('LIGHTNING');
  const fire = renderTgEmoji('FIRE');

  if (lang !== 'en') {
    return (
      `${lightning} <b>សូមស្វាគមន៍មកកាន់ UCHIRO STORE</b> ${lightning}\n\n` +
      `ហាងលក់ Account ហ្គេម វត្ថុក្នុងហ្គេម និងរង្វាន់ពិសេសៗ។\n\n` +
      `${fire} <b>លក្ខណៈពិសេស:</b>\n` +
      `• ផ្ញើជូន Account និង Digital Code ភ្លាមៗដោយស្វ័យប្រវត្តិ\n` +
      `• Blox Fruits, MM2, Blade Ball និង Evade\n` +
      `• កងបង្វិលរង្វាន់ Mythical Gacha ឱកាសឈ្នះខ្ពស់\n` +
      `• ទូទាត់រហ័សតាម KHQR / Bakong\n` +
      `• សុវត្ថិភាព ១០០% ជាមួយការធានារយៈពេល ១៤ ថ្ងៃពេញ\n\n` +
      `ចុចប៊ូតុងខាងក្រោមដើម្បីជ្រើសរើសមុខងារ:`
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
        this.setupHandlers();
      }
    }
  }

  private setupHandlers(): void {
    if (!this.bot) return;

    const appUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
    const supportUsername = (process.env.SUPPORT_TELEGRAM_USERNAME || env.TELEGRAM_SUPPORT_USERNAME || 'UchiroSupport').replace(/^@/, '');
    const channelUsername = (process.env.TELEGRAM_CHANNEL_USERNAME || env.TELEGRAM_CHANNEL_USERNAME || 'UchiroStore').replace(/^@/, '');
    const storeWebAppUrl = (process.env.STORE_MINIAPP_URL && process.env.STORE_MINIAPP_URL.startsWith('https://'))
      ? process.env.STORE_MINIAPP_URL
      : (env.STORE_WEBAPP_URL && env.STORE_WEBAPP_URL.startsWith('https://'))
        ? env.STORE_WEBAPP_URL
        : (env.CLIENT_STORE_URL && env.CLIENT_STORE_URL.startsWith('https://'))
          ? env.CLIENT_STORE_URL
          : appUrl;

    // /start command: Defaults strictly to Khmer
    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const existingUser = DataStore.getTelegramUser(from.id);
      const userLang = existingUser?.language_preference || 'km';

      // Parse referral code if present
      let refCode: string | undefined = undefined;
      const startPayload = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ')[1] : undefined;
      if (startPayload && startPayload.startsWith('ref_')) {
        refCode = startPayload.replace('ref_', '').trim();
      }

      // Upsert telegram user in DataStore
      DataStore.upsertTelegramUser({
        telegram_id: from.id,
        username: from.username,
        first_name: from.first_name,
        last_name: from.last_name,
        language_code: from.language_code || 'km',
      });

      // Send localized welcome & main menu
      await ctx.reply(
        formatTelegramHtml(getWelcomeMessage(userLang)),
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(storeWebAppUrl, userLang, supportUsername),
        }
      );
    });

    // Universal Back Home Navigation (cb_main_menu)
    this.bot.action('cb_main_menu', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const userLang = ctx.from ? DataStore.getUserLanguagePreference(ctx.from.id) || 'km' : 'km';
      const welcomeText = getWelcomeMessage(userLang);
      const keyboard = getMainMenuKeyboard(storeWebAppUrl, userLang, supportUsername);

      try {
        await ctx.editMessageText(formatTelegramHtml(welcomeText), {
          parse_mode: 'HTML',
          ...keyboard,
        });
      } catch (err) {
        if (!isMessageNotModifiedError(err)) {
          console.warn('[cb_main_menu] Edit warning:', err);
        }
      }
    });

    // Language selection callback query: set_lang:km or set_lang:en
    this.bot.action(/^set_lang:(km|en)$/, async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const lang = ctx.match[1];
      const fromId = ctx.from?.id;
      if (fromId) {
        DataStore.setUserLanguagePreference(fromId, lang);
      }

      const confirmText =
        lang === 'km'
          ? '✅ បានជ្រើសរើស <b>ភាសាខ្មែរ</b> រួចរាល់!'
          : '✅ Language preference set to <b>English</b>!';

      try {
        await ctx.editMessageText(
          formatTelegramHtml(confirmText + '\n\n' + getWelcomeMessage(lang)),
          {
            parse_mode: 'HTML',
            ...getMainMenuKeyboard(storeWebAppUrl, lang, supportUsername),
          }
        );
      } catch {
        await ctx.reply(formatTelegramHtml(confirmText), { parse_mode: 'HTML' });
        await ctx.reply(
          formatTelegramHtml(getWelcomeMessage(lang)),
          {
            parse_mode: 'HTML',
            ...getMainMenuKeyboard(storeWebAppUrl, lang, supportUsername),
          }
        );
      }
    });

    // Language change prompt callback & command
    this.bot.action(['cb_lang_menu', 'select_language'], async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

      const promptText =
        `🌐 <b>ជ្រើសរើសភាសា / CHANGE LANGUAGE</b>\n\n` +
        `សូមជ្រើសរើសភាសាដែលអ្នកចង់ប្រើ / Select your preferred language:`;

      try {
        await ctx.editMessageText(formatTelegramHtml(promptText), {
          parse_mode: 'HTML',
          ...getLanguageSelectionKeyboard(),
        });
      } catch {
        await ctx.reply(formatTelegramHtml(promptText), {
          parse_mode: 'HTML',
          ...getLanguageSelectionKeyboard(),
        });
      }
    });

    this.bot.command(['language', 'lang'], async (ctx) => {
      await ctx.reply(
        formatTelegramHtml(
          `🌐 <b>ជ្រើសរើសភាសា / CHANGE LANGUAGE</b>\n\n` +
          `សូមជ្រើសរើសភាសាដែលអ្នកចង់ប្រើ / Select your preferred language:`
        ),
        {
          parse_mode: 'HTML',
          ...getLanguageSelectionKeyboard(),
        }
      );
    });

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
    this.bot.action('cb_redeem_pts', async (ctx) => {
      await handleRedeemPoints(ctx);
    });

    // MODULE 2: STORE RULES & WARRANTIES
    this.bot.action(['cb_main_rules', 'menu_rules'], async (ctx) => {
      await handleMainRules(ctx);
    });
    this.bot.command('rules', async (ctx) => {
      await handleMainRules(ctx);
    });
    this.bot.action('cb_gacha_rules', async (ctx) => {
      await handleGachaRules(ctx);
    });
    this.bot.action('cb_daily_rules', async (ctx) => {
      await handleDailyRules(ctx);
    });
    this.bot.action('cb_warranty_policy', async (ctx) => {
      await handleWarrantyPolicy(ctx);
    });

    // MODULE 2: HELP & FAQ CENTER
    this.bot.action(['cb_main_help', 'menu_help'], async (ctx) => {
      await handleMainHelp(ctx, supportUsername);
    });
    this.bot.command('help', async (ctx) => {
      await handleMainHelp(ctx, supportUsername);
    });
    this.bot.action('cb_guide_2fa', async (ctx) => {
      await handleGuide2fa(ctx, supportUsername);
    });
    this.bot.action('cb_guide_payment', async (ctx) => {
      await handleGuidePayment(ctx, supportUsername);
    });

    // MODULE 3: REAL-TIME GACHA
    this.bot.action(['cb_gacha_menu', 'menu_gacha'], async (ctx) => {
      await handleGachaMenu(ctx, storeWebAppUrl);
    });
    this.bot.command('gacha', async (ctx) => {
      await handleGachaMenu(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_gacha_buy_ticket', async (ctx) => {
      await handleBuyGachaTicket(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_gacha_prizes', async (ctx) => {
      await handleGachaPrizes(ctx, storeWebAppUrl);
    });
    this.bot.action('cb_gacha_odds', async (ctx) => {
      await handleGachaOdds(ctx, storeWebAppUrl);
    });

    // MODULE 3: REAL-TIME DAILY POINTS & IN-CHAT CLAIM
    this.bot.action(['cb_daily_menu', 'menu_rewards'], async (ctx) => {
      await handleDailyMenu(ctx);
    });
    this.bot.command('daily', async (ctx) => {
      await handleDailyMenu(ctx);
    });
    this.bot.action('cb_claim_daily_instant', async (ctx) => {
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
            `⏳ នៅសល់ពេល ${daily.cooldown_str} ទៀតទើបអាច Claim បានម្តងទៀត`,
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
    this.bot.action(['cb_orders_menu', 'menu_orders'], async (ctx) => {
      await handleVaultMenu(ctx, storeWebAppUrl);
    });
    this.bot.command(['vault', 'orders'], async (ctx) => {
      await handleVaultMenu(ctx, storeWebAppUrl);
    });
    this.bot.action(/^cb_view_acc_(.+)$/, async (ctx) => {
      const accountId = ctx.match[1];
      await handleViewAccount(ctx, accountId, storeWebAppUrl);
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
          `📦 <b>ព័ត៌មានលម្អិតការកុម្ម៉ង់ #${orderId}</b>\n\n` +
          `ចុចប៊ូតុងខាងក្រោមដើម្បីបើកមើលក្នុង Mini App:`
        ),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [createWebAppOrUrlButton('📱 បើកក្នុង Mini App', webAppUrl)],
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
