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
 * - If PUBLIC_URL starts with https://, use PUBLIC_URL instead.
 * - Otherwise fallback to a standard link button (url: targetUrl) to prevent Telegram API Error 400.
 */
export function createWebAppOrUrlButton(text: string, targetUrl: string) {
  const publicUrl = (process.env.PUBLIC_URL || env.PUBLIC_URL || '').trim();

  // If the target URL already starts with https://, use webApp button
  if (targetUrl.startsWith('https://')) {
    return Markup.button.webApp(text, targetUrl);
  }

  // If PUBLIC_URL starts with https://, use PUBLIC_URL instead
  if (publicUrl.startsWith('https://')) {
    let resolvedUrl = publicUrl;
    try {
      const parsed = new URL(targetUrl);
      const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
      if (pathAndQuery) {
        resolvedUrl = `${publicUrl.replace(/\/+$/, '')}${pathAndQuery}`;
      }
    } catch {
      resolvedUrl = publicUrl;
    }
    return Markup.button.webApp(text, resolvedUrl);
  }

  // Fallback to a standard link button to prevent Telegram API Error 400 during local development
  return Markup.button.url(text, targetUrl);
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

  // Safe Fallback: If icon_custom_emoji_id is empty or missing, prepend the fallback Unicode emoji in text
  const finalText = customEmojiId ? opts.text : (fallback ? `${fallback} ${opts.text}` : opts.text);

  let btn: any;
  if (opts.targetUrl) {
    btn = createWebAppOrUrlButton(finalText, opts.targetUrl);
  } else if (opts.url) {
    btn = Markup.button.url(finalText, opts.url);
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
export function getMainMenuKeyboard(storeWebAppUrl: string) {
  const rawSupport = process.env.SUPPORT_TELEGRAM_USERNAME || env.TELEGRAM_SUPPORT_USERNAME || 'UchiroSupport';
  const supportUsername = rawSupport.replace('@', '');

  return Markup.inlineKeyboard([
    [
      createEmojiInlineButton({
        text: 'OPEN UCHIRO STORE (Mini App)',
        emojiKey: 'SHOPPING_BAGS',
        targetUrl: storeWebAppUrl,
      }),
    ],
    [
      createEmojiInlineButton({
        text: 'Play Gacha',
        emojiKey: 'FERRIS_WHEEL',
        targetUrl: `${storeWebAppUrl}?tab=gacha`,
      }),
      createEmojiInlineButton({
        text: 'Daily Points',
        emojiKey: 'GIFT',
        targetUrl: `${storeWebAppUrl}?tab=rewards`,
      }),
    ],
    [
      createEmojiInlineButton({
        text: 'My Inventory & Vault',
        emojiKey: 'PACKAGE',
        targetUrl: `${storeWebAppUrl}?tab=vault`,
      }),
      createEmojiInlineButton({
        text: 'Orders',
        emojiKey: 'SCROLL',
        targetUrl: `${storeWebAppUrl}?tab=orders`,
      }),
    ],
    [
      createEmojiInlineButton({
        text: 'ភាសា / Language',
        emojiKey: 'GLOBE',
        callbackData: 'select_language',
      }),
      createEmojiInlineButton({
        text: '24/7 Support',
        emojiKey: 'SUPPORT',
        url: `https://t.me/${supportUsername}`,
      }),
    ],
  ]);
}

export const storeKeyboard = getMainMenuKeyboard;
export const mainMenuKeyboard = getMainMenuKeyboard;

export function getWelcomeMessage(lang: string = 'en'): string {
  const lightning = renderTgEmoji('LIGHTNING');
  const fire = renderTgEmoji('FIRE');

  if (lang === 'km') {
    return (
      `${lightning} <b>សូមស្វាគមន៍មកកាន់ UCHIRO STORE</b> ${lightning}\n\n` +
      `ហាងលក់ Account ហ្គេម វត្ថុក្នុងហ្គេម និងរង្វាន់ពិសេសៗ។\n\n` +
      `${fire} <b>លក្ខណៈពិសេស:</b>\n` +
      `• ផ្ញើជូន Account និង Digital Code ភ្លាមៗដោយស្វ័យប្រវត្តិ\n` +
      `• Blox Fruits, MM2, Blade Ball និង Evade\n` +
      `• កងបង្វិលរង្វាន់ Mythical Gacha ឱកាសឈ្នះខ្ពស់\n` +
      `• ទូទាត់រហ័សតាម KHQR / Bakong\n` +
      `• សុវត្ថិភាព ១០០% ជាមួយការធានារយៈពេល ១៤ ថ្ងៃ\n\n` +
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

    const storeWebAppUrl = env.STORE_WEBAPP_URL || env.CLIENT_STORE_URL || 'http://localhost:3000';

    // /start command: Prompt for language if not yet chosen
    this.bot.start(async (ctx) => {
      const from = ctx.from;
      if (!from) return;

      const existingUser = DataStore.getTelegramUser(from.id);
      const userLang = existingUser?.language_preference;

      // Register or update customer
      DataStore.findOrCreateTelegramUser({
        telegram_id: from.id,
        username: from.username || null,
        first_name: from.first_name,
        last_name: from.last_name || null,
        language_code: from.language_code || 'en',
      });

      // If user has not selected language, prompt with a language selector keyboard
      if (!userLang) {
        await ctx.reply(
          formatTelegramHtml(
            `🌐 <b>សូមជ្រើសរើសភាសា / PLEASE CHOOSE A LANGUAGE</b>\n\n` +
            `សូមជ្រើសរើសភាសារបស់អ្នកដើម្បីបន្តទៅកាន់ Uchiro Store:\n` +
            `Please select your preferred language to proceed:`
          ),
          {
            parse_mode: 'HTML',
            ...getLanguageSelectionKeyboard(),
          }
        );
        return;
      }

      // If already chosen, send localized welcome & main menu
      await ctx.reply(
        formatTelegramHtml(getWelcomeMessage(userLang)),
        {
          parse_mode: 'HTML',
          ...getMainMenuKeyboard(storeWebAppUrl),
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
          ...getMainMenuKeyboard(storeWebAppUrl),
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

    // /help command
    this.bot.help(async (ctx) => {
      const userLang = ctx.from ? DataStore.getUserLanguagePreference(ctx.from.id) || 'en' : 'en';
      const helpText =
        userLang === 'km'
          ? `<b>ជំនួយ UCHIRO STORE</b>\n\n` +
            `• ចុចប៊ូតុង <b>🛍️ OPEN UCHIRO STORE</b> ដើម្បីមើលទំនិញ ឬការកុម្ម៉ង់របស់អ្នក។\n` +
            `• ការទូទាត់ និងការផ្ញើជូនទាំងអស់ត្រូវបានតាមដាននៅក្នុង Mini App។\n` +
            `• សម្រាប់ការគាំទ្រ សូមទាក់ទងមកកាន់ក្រុមការងារ 24/7 Support។`
          : `<b>UCHIRO STORE HELP</b>\n\n` +
            `• Tap <b>🛍️ OPEN UCHIRO STORE</b> to browse items or view your orders.\n` +
            `• All purchases and deliveries are tracked securely in the Mini App.\n` +
            `• For assistance, contact our 24/7 customer support.`;

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
    if (!this.bot) {
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
