import { Telegraf, Markup } from 'telegraf';
import { env } from '../../config/env';
import { DataStore } from '../../database/data-store';
import { TELEGRAM_EMOJIS, renderTgEmoji, enrichWithTgEmojis } from '../../config/telegram-emojis';
import { FulfillmentService } from '../../services/fulfillment.service';

export { TELEGRAM_EMOJIS, renderTgEmoji, enrichWithTgEmojis };

export const STORE_BOT_DEFAULT_USERNAME = 'UchiroStore_BOT';
export const STORE_BOT_DISPLAY_NAME = 'UchiroStore_BOT';
export const STORE_BOT_USERNAME = STORE_BOT_DEFAULT_USERNAME;

/**
 * Returns the resolved Store Bot username (without leading '@').
 * Dynamic lookup: env.STORE_BOT_USERNAME || process.env.STORE_BOT_USERNAME || 'UchiroStore_BOT'.
 */
export function getStoreBotUsername(): string {
  const raw = process.env.STORE_BOT_USERNAME || env.STORE_BOT_USERNAME || STORE_BOT_DEFAULT_USERNAME;
  return raw.replace(/^@/, '').trim();
}

/**
 * Generates dynamic deep links to the Store Telegram Bot.
 * e.g. https://t.me/UchiroStore_BOT or https://t.me/UchiroStore_BOT?start=referral_code
 */
export function getStoreBotLink(startParam?: string): string {
  const username = getStoreBotUsername();
  if (startParam) {
    return `https://t.me/${username}?start=${encodeURIComponent(startParam)}`;
  }
  return `https://t.me/${username}`;
}

/**
 * Generates dynamic Telegram Mini App direct links.
 * e.g. https://t.me/UchiroStore_BOT?startapp=tab_orders
 */
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
 * Telegram strictly requires https:// for inline keyboard web_app buttons.
 * If target URL does not start with https://:
 * - Replace any fallback with: (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '')
 * - Ensure all buttons using Markup.button.webApp(...) or Markup.button.url(...) strictly use appUrl or a valid HTTPS URL (no http:// and no localhost).
 */
export function createWebAppOrUrlButton(text: string, targetUrl: string) {
  const appUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');

  // If the target URL already starts with https://
  if (targetUrl && targetUrl.startsWith('https://')) {
    // If it is a Telegram deep link (e.g. https://t.me/...), it must use url button, not webApp
    if (targetUrl.startsWith('https://t.me/')) {
      return Markup.button.url(text, targetUrl);
    }
    return Markup.button.webApp(text, targetUrl);
  }

  // If targetUrl does not start with https:// (e.g. http://localhost:3000 or relative path), resolve path & query onto appUrl
  let resolvedUrl = appUrl;
  if (targetUrl) {
    if (targetUrl.startsWith('/')) {
      resolvedUrl = `${appUrl}${targetUrl}`;
    } else {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        if (pathAndQuery) {
          resolvedUrl = `${appUrl}${pathAndQuery}`;
        }
      } catch {
        resolvedUrl = appUrl;
      }
    }
  }

  // Guarantee strictly HTTPS URL (never http:// or localhost)
  if (!resolvedUrl.startsWith('https://')) {
    resolvedUrl = 'https://web-production-2d8bd.up.railway.app';
  }

  return Markup.button.webApp(text, resolvedUrl);
}

/**
 * Creates an inline keyboard button enriched with native icon_custom_emoji_id.
 * If icon_custom_emoji_id is empty or missing, gracefully prepends the fallback Unicode emoji to text.
 */
export function createEmojiInlineButton(opts: {
  text: string;
  emojiKey: string;
  targetUrl?: string;
  url?: string;
  callbackData?: string;
}): any {
  const emoji = TELEGRAM_EMOJIS[opts.emojiKey];
  const customEmojiId = emoji?.customEmojiId?.trim();
  const fallback = emoji?.fallback?.trim() || '';

  // Safe Fallback: Ensure text always includes the Unicode fallback emoji so non-premium Telegram clients see crisp emojis
  const hasFallback = fallback && opts.text.includes(fallback);
  const finalText = hasFallback ? opts.text : (fallback ? `${fallback} ${opts.text}` : opts.text);

  let btn: any;
  if (opts.targetUrl) {
    btn = createWebAppOrUrlButton(finalText, opts.targetUrl);
  } else if (opts.url) {
    btn = createWebAppOrUrlButton(finalText, opts.url);
  } else if (opts.callbackData) {
    btn = Markup.button.callback(finalText, opts.callbackData);
  } else {
    btn = { text: finalText };
  }

  if (customEmojiId) {
    btn.icon_custom_emoji_id = customEmojiId;
  }

  return btn;
}

/**
 * Language selection inline keyboard:
 * 🇰🇭 ភាសាខ្មែរ | 🇬🇧 English
 */
export function getLanguageSelectionKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇰🇭 ភាសាខ្មែរ', 'set_lang:km'),
      Markup.button.callback('🇬🇧 English', 'set_lang:en'),
    ],
  ]);
}

/**
 * Main menu 6-button interactive grid with Telegram custom emojis:
 * [ OPEN UCHIRO STORE (Mini App) ] (icon: SHOPPING_BAGS)
 * [ Play Gacha ] (icon: FERRIS_WHEEL) [ Daily Points ] (icon: GIFT)
 * [ My Inventory & Vault ] (icon: PACKAGE) [ Orders ] (icon: SCROLL)
 * [ ភាសា / Language ] (icon: GLOBE) [ 24/7 Support ] (icon: SUPPORT)
 */
/**
 * Main menu 6-button interactive grid with Telegram custom emojis (Specification 2: 100% Khmer):
 * [ បើក UCHIRO STORE (កម្មវិធី) ] (icon: SHOPPING_BAGS)
 * [ បង្វិល Gacha ] (icon: FERRIS_WHEEL) [ ពិន្ទុប្រចាំថ្ងៃ ] (icon: GIFT)
 * [ ទូផ្ទុកទំនិញ ] (icon: PACKAGE) [ ប្រវត្តិបញ្ជាទិញ ] (icon: SCROLL)
 * [ 🇰🇭 ភាសាខ្មែរ / EN ] (icon: GLOBE) [ ជំនួយ ២៤/៧ ] (icon: SUPPORT)
 */
export function getMainMenuKeyboard(storeWebAppUrl?: string, lang: string = 'en') {
  const appUrl = (process.env.PUBLIC_URL || 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');
  const rawSupport = process.env.SUPPORT_TELEGRAM_USERNAME || env.TELEGRAM_SUPPORT_USERNAME || 'UchiroSupport';
  const supportUsername = rawSupport.replace('@', '');
  const isKm = lang === 'km';

  const resolvedStoreUrl = (storeWebAppUrl && storeWebAppUrl.startsWith('https://'))
    ? storeWebAppUrl.replace(/\/$/, '')
    : appUrl;

  return Markup.inlineKeyboard([
    [
      createEmojiInlineButton({
        text: isKm ? 'បើក UCHIRO STORE (កម្មវិធី)' : 'OPEN UCHIRO STORE (Mini App)',
        emojiKey: 'SHOPPING_BAGS',
        targetUrl: resolvedStoreUrl,
      }),
    ],
    [
      createEmojiInlineButton({
        text: isKm ? 'បង្វិល Gacha' : 'Play Gacha',
        emojiKey: 'FERRIS_WHEEL',
        targetUrl: `${resolvedStoreUrl}?tab=gacha`,
      }),
      createEmojiInlineButton({
        text: isKm ? 'ពិន្ទុប្រចាំថ្ងៃ' : 'Daily Points',
        emojiKey: 'GIFT',
        targetUrl: `${resolvedStoreUrl}?tab=rewards`,
      }),
    ],
    [
      createEmojiInlineButton({
        text: isKm ? 'ទូផ្ទុកទំនិញ' : 'My Inventory & Vault',
        emojiKey: 'PACKAGE',
        targetUrl: `${resolvedStoreUrl}?tab=vault`,
      }),
      createEmojiInlineButton({
        text: isKm ? 'ប្រវត្តិបញ្ជាទិញ' : 'Orders',
        emojiKey: 'SCROLL',
        targetUrl: `${resolvedStoreUrl}?tab=orders`,
      }),
    ],
    [
      createEmojiInlineButton({
        text: isKm ? '🇰🇭 ភាសាខ្មែរ / English' : 'ភាសា / Language',
        emojiKey: 'GLOBE',
        callbackData: 'select_language',
      }),
      createEmojiInlineButton({
        text: isKm ? 'ជំនួយ ២៤/៧' : '24/7 Support',
        emojiKey: 'SUPPORT',
        url: `https://t.me/${supportUsername}`,
      }),
    ],
  ]);
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
      `ចុចប៊ូតុងខាងក្រោមដើម្បីបើកកម្មវិធី Store:`
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
    `Tap below to open the official Mini App:`
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
    const storeWebAppUrl = (env.STORE_WEBAPP_URL && env.STORE_WEBAPP_URL.startsWith('https://'))
      ? env.STORE_WEBAPP_URL
      : (env.CLIENT_STORE_URL && env.CLIENT_STORE_URL.startsWith('https://'))
        ? env.CLIENT_STORE_URL
        : appUrl;

    // /start command: Defaults strictly to Khmer (Specification 2: 100% Khmer)
    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const existingUser = DataStore.getTelegramUser(from.id);
      const userLang = existingUser?.language_preference || 'km';

      // Register or update customer
      DataStore.findOrCreateTelegramUser({
        telegram_id: from.id,
        username: from.username || null,
        first_name: from.first_name,
        last_name: from.last_name || null,
        language_code: from.language_code || 'km',
      });

      // Send localized welcome & main menu in Khmer by default
      await ctx.reply(
        formatTelegramHtml(getWelcomeMessage(userLang)),
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(storeWebAppUrl, userLang),
        }
      );
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

      await ctx.reply(formatTelegramHtml(confirmText), { parse_mode: 'HTML' });
      await ctx.reply(
        formatTelegramHtml(getWelcomeMessage(lang)),
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(storeWebAppUrl, lang),
        }
      );
    });

    // Language change prompt callback & command
    this.bot.action('select_language', async (ctx) => {
      try {
        await ctx.answerCbQuery();
      } catch {}

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

    // /help command (Specification 2: 100% Khmer by default)
    this.bot.help(async (ctx) => {
      const userLang = ctx.from ? DataStore.getUserLanguagePreference(ctx.from.id) || 'km' : 'km';
      const helpText =
        userLang === 'en'
          ? `<b>UCHIRO STORE HELP</b>\n\n` +
            `• Tap <b>🛍️ OPEN UCHIRO STORE</b> to browse items or check your orders.\n` +
            `• Payments and account delivery are tracked securely inside the Mini App.\n` +
            `• Need assistance? Contact our 24/7 Support: @${supportUsername}`
          : `<b>ជំនួយ UCHIRO STORE</b>\n\n` +
            `• ចុចប៊ូតុង <b>🛍️ បើក UCHIRO STORE</b> ដើម្បីមើលទំនិញ ឬការកុម្ម៉ង់របស់អ្នក។\n` +
            `• ការទូទាត់ និងការផ្ញើជូនទាំងអស់ត្រូវបានតាមដាននៅក្នុង Mini App។\n` +
            `• សម្រាប់ការគាំទ្រ សូមទាក់ទងមកកាន់ផ្នែកជំនួយ ២៤/៧៖ @${supportUsername}`;

      await ctx.reply(
        formatTelegramHtml(helpText),
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(storeWebAppUrl),
        }
      );
    });

    // /orders command
    this.bot.command('orders', async (ctx) => {
      const pkg = renderTgEmoji('PACKAGE');
      await ctx.reply(
        formatTelegramHtml(`${pkg} <b>MY ORDERS</b>\n\nView all your active deliveries and account credentials in the Mini App:`),
        {
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              createEmojiInlineButton({
                text: 'VIEW ORDERS',
                emojiKey: 'PACKAGE',
                targetUrl: `${storeWebAppUrl}?tab=orders`,
              }),
            ],
          ]),
        }
      );
    });

    // =========================================================================
    // INTERACTIVE IN-PLACE ACCOUNT DELIVERY SUB-SCREENS (ZERO-SPAM ARCHITECTURE)
    // =========================================================================

    // 1. Live 2FA Sub-Screen
    this.bot.action(/^sub_2fa:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const { text, keyboard } = await FulfillmentService.get2FaSubScreen(orderId);
        await ctx.editMessageText(formatTelegramHtml(text), {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await ctx.answerCbQuery('Code refreshed!');
      } catch (err: any) {
        try {
          await ctx.answerCbQuery('Error refreshing 2FA code.');
        } catch {}
      }
    });

    // 2. On-Demand 2FA QR Code Dispatch
    this.bot.action(/^send_qr:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const qrBuffer = await FulfillmentService.generate2FaQrBuffer(orderId);
        await ctx.replyWithPhoto(
          { source: qrBuffer },
          {
            caption: '📷 Scan with Google Authenticator or 2FAS',
          }
        );
        await ctx.answerCbQuery('QR Code sent!');
      } catch (err: any) {
        try {
          await ctx.answerCbQuery('Error generating 2FA QR code.');
        } catch {}
      }
    });

    // 3. Warranty Sub-Screen
    this.bot.action(/^sub_warranty:(.+)$/, async (ctx) => {
      const orderId = ctx.match[1];
      try {
        const { text, keyboard } = FulfillmentService.getWarrantySubScreen(orderId);
        await ctx.editMessageText(formatTelegramHtml(text), {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        await ctx.answerCbQuery();
      } catch (err: any) {
        try {
          await ctx.answerCbQuery('Error checking warranty.');
        } catch {}
      }
    });

    // 4. Return to Main Delivery Card in-place
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
      } catch (err: any) {
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
      console.warn(`[STORE BOT] Failed to send message to ${chatId}:`, err.message);
      return false;
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

  public async setWebhook(url: string, secret?: string): Promise<{ success: boolean; message?: string }> {
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

  public async deleteWebhook(): Promise<{ success: boolean; message?: string }> {
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
}

export const storeBot = new StoreBotService();
