import { Markup } from 'telegraf';
import { DeliveredAccount } from '../../database/data-store';
import { TELEGRAM_EMOJIS, TelegramEmojiKey } from '../../config/telegram-emojis';
import { getLocale } from './locales';

// Helper to strip leading unicode emoji / symbols from button labels
export function stripLeadingEmoji(text: string): string {
  return text
    .replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE0F}\u{200D}\u{2300}-\u{23FF}\u{2B50}\u{20E3}]+\s*/u, '')
    .trim();
}

/**
 * Core Button Factory conforming to Telegram Premium Custom Emoji specification:
 * - If key has customEmojiId and BUTTON_CUSTOM_EMOJI != 'off': sets icon_custom_emoji_id.
 * - Stores fallback in a NON-enumerable __fallback property for automatic callApi guard retry.
 * - Retains full label so standard clients show the unicode emoji fallback.
 * - NEVER injects <tg-emoji> in button text.
 */
export function makeButton(
  type: 'callback' | 'url' | 'web_app',
  label: string,
  target: string,
  iconKey?: string
): any {
  const customEmojiDisabled = process.env.BUTTON_CUSTOM_EMOJI === 'off';
  const emojiDef = iconKey ? TELEGRAM_EMOJIS[iconKey as TelegramEmojiKey] : undefined;
  const customId = !customEmojiDisabled ? emojiDef?.customEmojiId : undefined;
  const fallback = emojiDef?.fallback || '';

  const cleanLabel = stripLeadingEmoji(label);
  const buttonText = label;
  let btn: any;

  if (type === 'callback') {
    btn = Markup.button.callback(buttonText, target);
  } else if (type === 'url') {
    btn = Markup.button.url(buttonText, target);
  } else {
    btn = Markup.button.webApp(buttonText, target);
  }

  if (customId && customId.trim() !== '') {
    btn.icon_custom_emoji_id = customId.trim();
  }

  Object.defineProperty(btn, '__fallback', {
    value: fallback,
    enumerable: false,
    writable: true,
    configurable: true,
  });

  return btn;
}

export function cb(text: string, callbackData: string, iconKey?: string) {
  return makeButton('callback', text, callbackData, iconKey);
}

export function urlBtn(text: string, url: string, iconKey?: string) {
  return makeButton('url', text, url, iconKey);
}

export function webBtn(text: string, url: string, iconKey?: string) {
  return makeButton('web_app', text, url, iconKey);
}

export function createWebAppOrUrlButton(text: string, targetUrl: string, iconKey?: string) {
  const rawPublicUrl = (process.env.PUBLIC_URL || '').trim();
  const appUrl = (rawPublicUrl.startsWith('https://') ? rawPublicUrl : 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');

  let resolvedUrl = targetUrl;
  if (targetUrl && targetUrl.startsWith('https://')) {
    resolvedUrl = targetUrl;
  } else if (targetUrl) {
    if (targetUrl.startsWith('/')) {
      resolvedUrl = `${appUrl}${targetUrl}`;
    } else {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        resolvedUrl = `${appUrl}${pathAndQuery}`;
      } catch {
        resolvedUrl = appUrl;
      }
    }
  } else {
    resolvedUrl = appUrl;
  }

  if (!resolvedUrl.startsWith('https://')) {
    resolvedUrl = 'https://web-production-2d8bd.up.railway.app';
  }

  if (resolvedUrl.startsWith('https://t.me/')) {
    return urlBtn(text, resolvedUrl, iconKey);
  }
  return webBtn(text, resolvedUrl, iconKey);
}

/**
 * 4-Row Authoritative Main Menu In-Chat Keyboard (Specification 2, 100% English):
 * Row 1: 🛍️ Open Store (Shop Now)
 * Row 2: 🇰🇭 How to Buy & Pay | 🔑 Get 2FA Code
 * Row 3: 🎁 Claim Free Points (or ⏳ Cooldown (Wait 24h)) | 📦 My Orders & Vault
 * Row 4: 💬 Chat with Admin / Support (24/7)
 */
export function buildMainMenuKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  supportUsername: string = 'UchiroSupport',
  opts?: { onCooldown?: boolean }
) {
  const cleanSupport = supportUsername.replace(/^@/, '') || 'UchiroSupport';
  const supportUrl = `https://t.me/${cleanSupport}`;
  const claimText = opts?.onCooldown ? '⏳ Cooldown (Wait 24h)' : '🎁 Claim Free Points';

  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ Open Store (Shop Now)', storeUrl, 'PACKAGE')],
    [
      cb('🇰🇭 How to Buy & Pay', 'cb_how_to_buy'),
      cb('🔑 Get 2FA Code', 'cb_vault_2fa', 'KEY'),
    ],
    [
      cb(claimText, 'cb_claim_daily', opts?.onCooldown ? 'CLOCK' : 'GIFT'),
      cb('📦 My Orders & Vault', 'cb_orders_menu', 'PACKAGE'),
    ],
    [
      urlBtn('💬 Chat with Admin / Support (24/7)', supportUrl, 'SUPPORT'),
    ],
  ]);
}

/**
 * 5-Row Main Menu In-Chat Keyboard (Specification 1 & 2):
 * Row 1: 🎰 លេង Gacha (cb_gacha_menu) | 🎁 ពិន្ទុប្រចាំថ្ងៃ (cb_daily_menu)
 * Row 2: 🎒 កាតាបឥវ៉ាន់ & Vault (cb_vault_menu) | 📜 ប្រវត្តិបញ្ជាទិញ (cb_orders_menu)
 * Row 3: 👤 ព័ត៌មានគណនី (Profile) (cb_profile_menu) | 🌐 ភាសា / Language (cb_lang_menu)
 * Row 4: 📜 ច្បាប់ទូទៅ (Rules) (cb_main_rules) | ❓ ជំនួយ & FAQ (Help) (cb_main_help)
 * Row 5: 🛍️ បើកហាង Mini App (ស្រេចចិត្ត) (WebApp) | 💬 ឆាតទៅ Admin 24/7 (Link)
 */
export function getMainMenuKeyboard(
  storeUrl: string,
  lang: string = 'km',
  supportUsername: string = 'UchiroSupport'
) {
  const loc = getLocale(lang);
  const cleanSupport = supportUsername.replace(/^@/, '') || 'UchiroSupport';
  const supportUrl = `https://t.me/${cleanSupport}`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_gacha, 'cb_gacha_menu', 'GAMEPAD'),
      cb(loc.btn_daily, 'cb_daily_menu', 'GIFT'),
    ],
    [
      cb(loc.btn_vault, 'cb_vault_menu', 'BACKPACK'),
      cb(loc.btn_orders, 'cb_orders_menu', 'RECEIPT'),
    ],
    [
      cb(loc.btn_profile, 'cb_profile_menu', 'USER'),
      cb(loc.btn_language, 'cb_lang_menu', 'GLOBE'),
    ],
    [
      cb(loc.btn_rules, 'cb_main_rules', 'DOCUMENT'),
      cb(loc.btn_help, 'cb_main_help', 'QUESTION'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_store, storeUrl, 'PACKAGE'),
      urlBtn(loc.btn_support_admin, supportUrl, 'SUPPORT'),
    ],
  ]);
}

/**
 * Language selection inline keyboard:
 * 🇰🇭 ភាសាខ្មែរ | 🇬🇧 English
 * 🔙 ត្រឡប់ទៅដើម (Back Home)
 */
export function getLanguageSelectionKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb('🇰🇭 ភាសាខ្មែរ', 'set_lang:km'),
      cb('🇬🇧 English', 'set_lang:en'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

/**
 * Profile Keyboard:
 * Row 1: 📜 ប្រវត្តិពិន្ទុ (Points Ledger) | 🎁 ប្តូរពិន្ទុយករង្វាន់
 * Row 2: 🎒 មើលកាតាបឥវ៉ាន់ & Accounts
 * Row 3: 📱 បើកក្នុង Mini App (ស្រេចចិត្ត) | 🔙 ត្រឡប់ទៅដើម
 */
export function buildProfileKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const profileWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=profile` : `${storeUrl}?tab=profile`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_points_ledger, 'cb_points_ledger', 'RECEIPT'),
      cb(loc.btn_redeem_pts, 'cb_redeem_pts', 'GIFT'),
    ],
    [
      cb(loc.btn_view_vault, 'cb_vault_menu', 'BACKPACK'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_profile_webapp, profileWebUrl, 'PACKAGE'),
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildPointsLedgerKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_redeem_pts, 'cb_redeem_pts', 'GIFT'),
    ],
    [
      cb(lang === 'en' ? '🔙 Back to Profile' : '🔙 ត្រឡប់ទៅ Profile', 'cb_profile_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

export function buildRedeemPointsKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(lang === 'en' ? '🎟️ Exchange Gacha Ticket (-50 Pts)' : '🎟️ ប្តូរសំបុត្រ Gacha (-50 Pts)', 'cb_gacha_buy_ticket', 'TICKET'),
    ],
    [
      cb(lang === 'en' ? '🔙 Back to Profile' : '🔙 ត្រឡប់ទៅ Profile', 'cb_profile_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * Store Rules Keyboard
 */
export function buildMainRulesKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_gacha_rules, 'cb_gacha_rules', 'GAMEPAD'),
      cb(loc.btn_daily_rules, 'cb_daily_rules', 'GIFT'),
    ],
    [
      cb(loc.btn_warranty_policy, 'cb_warranty_policy', 'SHIELD'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildSubRulesKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_back_to_rules, 'cb_main_rules', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * Help & FAQ Center Keyboard
 */
export function buildMainHelpKeyboard(supportUsername: string = 'UchiroSupport', lang: string = 'km') {
  const loc = getLocale(lang);
  const clean = supportUsername.replace(/^@/, '') || 'UchiroSupport';
  const supportUrl = `https://t.me/${clean}`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_guide_2fa, 'cb_guide_2fa', 'KEY'),
    ],
    [
      cb(loc.btn_guide_payment, 'cb_guide_payment', 'CREDIT_CARD'),
    ],
    [
      urlBtn(loc.btn_contact_admin, supportUrl, 'SUPPORT'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildSubHelpKeyboard(supportUsername: string = 'UchiroSupport', lang: string = 'km') {
  const loc = getLocale(lang);
  const clean = supportUsername.replace(/^@/, '') || 'UchiroSupport';
  const supportUrl = `https://t.me/${clean}`;

  return Markup.inlineKeyboard([
    [
      urlBtn(loc.btn_support_admin, supportUrl, 'SUPPORT'),
    ],
    [
      cb(loc.btn_back_to_help, 'cb_main_help', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * How to Buy & Pay In-Chat Keyboard (Specification 3.1):
 * [ 📖 Step-by-Step Guide ]
 * [ 💳 KHQR Payment Guide ]
 * [ 🛍️ Open Store Now ]
 * [ 🔙 Back Home ]
 */
export function buildHowToBuyKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
) {
  return Markup.inlineKeyboard([
    [
      cb('📖 Step-by-Step Guide', 'cb_guide_2fa', 'DOCUMENT'),
      cb('💳 KHQR Payment Guide', 'cb_guide_khqr', 'CREDIT_CARD'),
    ],
    [
      createWebAppOrUrlButton('🛍️ Open Store Now', storeUrl, 'PACKAGE'),
    ],
    [
      cb('🔙 Back Home', 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * KHQR Payment Guide Sub-Keyboard (Specification 3.2):
 * [ 🔙 Back to How to Buy ]
 * [ 🔙 Back Home ]
 */
export function buildKhqrGuideKeyboard() {
  return Markup.inlineKeyboard([
    [
      cb('🔙 Back to How to Buy', 'cb_how_to_buy', 'BACK'),
      cb('🔙 Back Home', 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * Gacha Dashboard Keyboard
 */
export function buildGachaKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_buy_ticket, 'cb_gacha_buy_ticket', 'TICKET'),
      cb(loc.btn_view_prizes, 'cb_gacha_prizes', 'TROPHY'),
    ],
    [
      cb(loc.btn_drop_rates, 'cb_gacha_odds', 'LIGHTNING'),
      cb(loc.btn_gacha_rules, 'cb_gacha_rules', 'DOCUMENT'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_gacha_webapp, gachaWebUrl, 'PACKAGE'),
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildSubGachaKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_buy_ticket, 'cb_gacha_buy_ticket', 'TICKET'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_gacha_webapp, gachaWebUrl, 'PACKAGE'),
    ],
    [
      cb(loc.btn_back_to_gacha, 'cb_gacha_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * Daily Reward & Streak Keyboard
 */
export function buildDailyKeyboard(
  storeUrlOrClaimable: string | boolean = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  langOrIsCooldown: string | boolean = 'km',
  isCooldownParam: boolean = false
) {
  let storeUrl = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app';
  let lang = 'km';
  let isCooldown = false;

  if (typeof storeUrlOrClaimable === 'boolean') {
    // Called as: buildDailyKeyboard(isClaimable, lang)
    isCooldown = !storeUrlOrClaimable;
    lang = typeof langOrIsCooldown === 'string' ? langOrIsCooldown : 'km';
  } else {
    storeUrl = storeUrlOrClaimable;
    if (typeof langOrIsCooldown === 'string') {
      lang = langOrIsCooldown;
      isCooldown = isCooldownParam;
    } else if (typeof langOrIsCooldown === 'boolean') {
      isCooldown = langOrIsCooldown;
    }
  }

  const loc = getLocale(lang);
  const claimBtnText = isCooldown
    ? (lang === 'en' ? '⏳ Cooldown Active...' : '⏳ Cooldown (កំពុងរង់ចាំ 24h)...')
    : (lang === 'en' ? '🎁 Claim Daily Points Now' : '🎁 ទទួលពិន្ទុភ្លាមៗ (Claim Daily)');
  const claimCallback = isCooldown ? 'cb_noop' : 'cb_claim_daily_instant';

  return Markup.inlineKeyboard([
    [
      cb(claimBtnText, claimCallback, isCooldown ? 'CLOCK' : 'GIFT'),
    ],
    [
      cb(loc.btn_daily_rules, 'cb_daily_rules', 'DOCUMENT'),
      cb(loc.btn_daily_shop, 'cb_daily_shop', 'GEM'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildDailyShopKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(lang === 'en' ? '🎟️ Exchange Gacha Ticket (-50 Pts)' : '🎟️ ប្តូរសំបុត្រ Gacha (-50 Pts)', 'cb_gacha_buy_ticket', 'TICKET'),
    ],
    [
      cb(loc.btn_back_to_daily, 'cb_daily_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

export const buildSubDailyShopKeyboard = buildDailyShopKeyboard;

/**
 * Vault & Accounts Keyboard
 */
export function buildVaultMenuKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_live_2fa, 'cb_vault_2fa', 'KEY'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildEmptyVaultKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      createWebAppOrUrlButton(loc.btn_open_vault_webapp, storeUrl, 'PACKAGE'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildVaultListKeyboard(
  accounts: DeliveredAccount[],
  storeUrlOrPage: string | number = 0,
  pageSize: number = 5,
  lang: string = 'km'
) {
  if (typeof storeUrlOrPage === 'string') {
    const storeUrl = storeUrlOrPage;
    const buttons: any[][] = accounts.map((acc) => [
      Markup.button.callback(
        `🎮 [#${acc.order_code}] ${acc.game_title} (@${acc.username})`,
        `cb_view_acc_${acc.account_id}`
      ),
    ]);
    const webAppVaultUrl = storeUrl.includes('?') ? `${storeUrl}&tab=vault` : `${storeUrl}?tab=vault`;
    buttons.push([createWebAppOrUrlButton('📱 បើក Vault ក្នុង Mini App', webAppVaultUrl)]);
    buttons.push([Markup.button.callback('🔙 ត្រឡប់ទៅដើម (Back Home)', 'cb_main_menu')]);
    return Markup.inlineKeyboard(buttons);
  }

  const loc = getLocale(lang);
  const page = storeUrlOrPage;
  const total = accounts.length;
  const totalPages = Math.ceil(total / pageSize);
  const currentPage = Math.min(Math.max(0, page), Math.max(0, totalPages - 1));
  const start = currentPage * pageSize;
  const pagedAccounts = accounts.slice(start, start + pageSize);

  const buttons: any[][] = [];

  for (const acc of pagedAccounts) {
    const title = acc.game_title ? `${acc.game_title} (@${acc.username})` : `@${acc.username}`;
    buttons.push([
      cb(`🎮 [#${acc.order_code}] ${title}`, `cb_vault_acc:${acc.account_id}`),
    ]);
  }

  const navRow: any[] = [];
  if (currentPage > 0) {
    navRow.push(cb('⬅️ Prev', `cb_vault_page:${currentPage - 1}`, 'BACK'));
  }
  if (currentPage < totalPages - 1) {
    navRow.push(cb('Next ➡️', `cb_vault_page:${currentPage + 1}`));
  }
  if (navRow.length > 0) {
    buttons.push(navRow);
  }

  buttons.push([
    cb(loc.btn_back_to_vault, 'cb_vault_menu', 'BACK'),
    cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
  ]);

  return Markup.inlineKeyboard(buttons);
}

export function buildAccountDetailKeyboard(account: DeliveredAccount, storeUrl: string) {
  const accountId = account.account_id;
  const webAppDetailUrl = storeUrl.includes('?')
    ? `${storeUrl}&tab=vault&orderId=${account.order_code}&accountId=${accountId}`
    : `${storeUrl}?tab=vault&orderId=${account.order_code}&accountId=${accountId}`;

  const buttons: any[][] = [];

  if (account.two_factor_secret) {
    buttons.push([Markup.button.callback('🔑 បង្កើតកូដ 2FA ផ្ទាល់ (Live OTP)', `cb_gen_2fa_${accountId}`)]);
  }

  buttons.push([createWebAppOrUrlButton('📱 មើលព័ត៌មានលម្អិតក្នុង Mini App', webAppDetailUrl)]);
  buttons.push([
    Markup.button.callback('🎒 ត្រឡប់ទៅ Vault', 'cb_vault_menu'),
    Markup.button.callback('🏠 ដើម', 'cb_main_menu'),
  ]);

  return Markup.inlineKeyboard(buttons);
}

export function buildTwoFactorKeyboard(accountId: string, lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_refresh_2fa, `cb_vault_2fa_acc:${accountId}`, 'REPEAT'),
    ],
    [
      cb(loc.btn_back_to_vault, 'cb_vault_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}

/**
 * Order History Keyboard
 */
export function buildOrdersMenuKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const openOrdersUrl = storeUrl.includes('?') ? `${storeUrl}&tab=orders` : `${storeUrl}?tab=orders`;
  const recentOrdersText = lang === 'en' ? '📜 Recent Orders' : '📜 ការបញ្ជាទិញថ្មីៗ';
  const trackOrderText = lang === 'en' ? '🔍 Track Order' : '🔍 តាមដានការបញ្ជាទិញ';
  const openOrdersText = lang === 'en' ? '📱 Open Orders in Mini App' : '📱 បើកមើលក្នុង Mini App';

  return Markup.inlineKeyboard([
    [
      cb(recentOrdersText, 'cb_orders_recent', 'RECEIPT'),
      cb(trackOrderText, 'cb_orders_track', 'SEARCH'),
    ],
    [
      createWebAppOrUrlButton(openOrdersText, openOrdersUrl, 'PACKAGE'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildOrderHistoryKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const openOrdersUrl = storeUrl.includes('?') ? `${storeUrl}&tab=orders` : `${storeUrl}?tab=orders`;
  const openOrdersText = lang === 'en' ? '📱 Open Orders in Mini App' : '📱 បើកមើលការបញ្ជាទិញក្នុង Mini App';
  const backToOrdersText = lang === 'en' ? '🔙 Back to Orders' : '🔙 ត្រឡប់ទៅ Orders';

  return Markup.inlineKeyboard([
    [
      createWebAppOrUrlButton(openOrdersText, openOrdersUrl, 'PACKAGE'),
    ],
    [
      cb(backToOrdersText, 'cb_orders_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOUSE'),
    ],
  ]);
}
