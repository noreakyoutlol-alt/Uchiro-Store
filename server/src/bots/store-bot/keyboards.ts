import { Markup } from 'telegraf';
import { DeliveredAccount } from '../../database/data-store';
import { TELEGRAM_EMOJIS, TelegramEmojiKey } from '../../config/telegram-emojis';
import { getLocale } from './locales';
import { resolveStoreUrl, isValidUrl } from '../../config/app-url';

// Helper to strip leading unicode emoji / symbols from button labels
export function stripLeadingEmoji(text: string): string {
  if (!text) return '';
  return text
    .replace(/^([0-9#*]️?⃣|[\u{1F1E6}-\u{1F1FF}]{2}|[\u{1F000}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{2B00}-\u{2BFF}\u{2190}-\u{21FF}\u{2300}-\u{23FF}\u{25A0}-\u{25FF}\u{FE00}-\u{FE0F}\u{200D}\u{20E3}\u{00A9}\u{00AE}]+)+\s*/u, '')
    .trim();
}

/**
 * Detects matching TelegramEmojiKey from label's leading emoji if not explicitly supplied.
 */
export function findEmojiKeyForLabel(label: string): TelegramEmojiKey | undefined {
  if (!label) return undefined;
  for (const [key, def] of Object.entries(TELEGRAM_EMOJIS)) {
    if (def.fallback && label.startsWith(def.fallback)) {
      return key as TelegramEmojiKey;
    }
  }
  return undefined;
}

/**
 * Core Button Factory conforming to Telegram Premium Custom Emoji specification:
 * - If key has customEmojiId and BUTTON_CUSTOM_EMOJI != 'off': sets icon_custom_emoji_id.
 * - Strips duplicate leading unicode emoji from button text when custom emoji icon is active.
 * - Stores fallback in a NON-enumerable __fallback property for automatic callApi guard retry.
 * - NEVER injects <tg-emoji> in button text.
 */
export function makeButton(
  type: 'callback' | 'url' | 'web_app',
  label: string,
  target: string,
  iconKey?: string
): any {
  const customEmojiDisabled = process.env.BUTTON_CUSTOM_EMOJI === 'off';
  const effectiveKey = iconKey || findEmojiKeyForLabel(label);
  const emojiDef = effectiveKey ? TELEGRAM_EMOJIS[effectiveKey as TelegramEmojiKey] : undefined;
  const customId = !customEmojiDisabled ? emojiDef?.customEmojiId : undefined;
  const fallback = emojiDef?.fallback || '';

  const cleanLabel = stripLeadingEmoji(label);
  const hasCustomId = Boolean(customId && customId.trim() !== '');

  // A leading unicode emoji is only a *duplicate* when it matches the fallback of
  // the custom emoji icon that Telegram renders beside the label. In that case it is
  // stripped so the client shows the custom icon exactly once. A different leading
  // emoji is intentional and must be preserved.
  let buttonText = label;
  if (hasCustomId && fallback && label.startsWith(fallback)) {
    buttonText = cleanLabel;
  } else if (!hasCustomId && cleanLabel === label && fallback) {
    buttonText = `${fallback} ${cleanLabel}`.trim();
  }

  let btn: any;
  if (type === 'callback') {
    btn = Markup.button.callback(buttonText, target);
  } else if (type === 'url') {
    btn = Markup.button.url(buttonText, target);
  } else {
    btn = Markup.button.webApp(buttonText, target);
  }

  if (hasCustomId) {
    btn.icon_custom_emoji_id = customId!.trim();
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

export function createWebAppOrUrlButton(text: string, targetUrl?: string, iconKey?: string) {
  const appUrl = resolveStoreUrl();

  let resolvedUrl: string;
  if (targetUrl && targetUrl.startsWith('https://')) {
    if ((targetUrl.includes('your-production-app') || targetUrl.includes('web-production-2d8bd')) && isValidUrl(appUrl)) {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        resolvedUrl = appUrl ? `${appUrl}${pathAndQuery}` : targetUrl;
      } catch {
        resolvedUrl = appUrl || targetUrl;
      }
    } else {
      resolvedUrl = targetUrl;
    }
  } else if (targetUrl) {
    if (targetUrl.startsWith('/')) {
      resolvedUrl = appUrl ? `${appUrl}${targetUrl}` : targetUrl;
    } else {
      try {
        const parsed = new URL(targetUrl);
        const pathAndQuery = (parsed.pathname === '/' ? '' : parsed.pathname) + parsed.search + parsed.hash;
        resolvedUrl = appUrl ? `${appUrl}${pathAndQuery}` : targetUrl;
      } catch {
        resolvedUrl = appUrl || targetUrl;
      }
    }
  } else {
    resolvedUrl = appUrl;
  }

  if (resolvedUrl.startsWith('https://t.me/')) {
    return urlBtn(text, resolvedUrl, iconKey);
  }
  if (resolvedUrl.startsWith('https://')) {
    return webBtn(text, resolvedUrl, iconKey);
  }
  return urlBtn(text, resolvedUrl, iconKey);
}

/**
 * 4-Row Authoritative Main Menu In-Chat Keyboard (100% English):
 * Row 1: 🛍️ Open Store
 * Row 2: 💎 Buy Robux | 🔑 Get 2FA Code
 * Row 3: 🇰🇭 How to Buy & Pay | 📦 My Orders & Vault
 * Row 4: 🎁 Claim Free Points (or ⏳ Cooldown (Wait 24h)) | 💬 Chat with Admin / Support
 */
export function buildMainMenuKeyboard(
  storeUrl?: string,
  supportUsername: string = 'uchirosupport',
  opts?: { onCooldown?: boolean }
) {
  const effectiveStoreUrl =
    storeUrl &&
    !storeUrl.includes('your-production-app') &&
    !storeUrl.includes('web-production-2d8bd') &&
    (storeUrl.startsWith('https://') || storeUrl.startsWith('http://'))
      ? storeUrl
      : resolveStoreUrl();

  const cleanSupport = (supportUsername || 'uchirosupport').replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport}`;
  const claimText = opts?.onCooldown ? '⏳ Cooldown (Wait 24h)' : '🎁 Claim Free Points';

  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ Open Store', effectiveStoreUrl, 'SHOPPING_BAGS')],
    [
      cb('💎 Buy Robux', 'cb_buy_robux', 'ROBUX'),
      cb('🔑 Get 2FA Code', 'cb_vault_2fa', 'KEY'),
    ],
    [
      cb('🇰🇭 How to Buy & Pay', 'cb_how_to_buy', 'FLAG_CAMBODIA'),
      cb('📦 My Orders & Vault', 'cb_orders_menu', 'PACKAGE'),
    ],
    [
      cb(claimText, 'cb_claim_daily', opts?.onCooldown ? 'CLOCK' : 'GIFT'),
      urlBtn('💬 Chat with Admin / Support', supportUrl, 'SUPPORT'),
    ],
    [
      cb('📜 Rules & Policies', 'cb_main_rules', 'DOCUMENT'),
      cb('🌐 Language', 'cb_lang_menu', 'GLOBE'),
    ],
  ]);
}

/**
 * 5-Row Main Menu In-Chat Keyboard (Grid format):
 * Row 1: Gacha & Daily Points
 * Row 2: Vault & Orders
 * Row 3: Profile & Language
 * Row 4: Rules & Help
 * Row 5: Open Mini App & Support
 */
export function getMainMenuKeyboard(
  storeUrl: string,
  lang: string = 'en',
  supportUsername: string = 'UchiroSupport'
) {
  const loc = getLocale(lang);
  const cleanSupport = (supportUsername || 'UchiroSupport').replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport}`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_gacha, 'cb_gacha_menu', 'SLOT_MACHINE'),
      cb(loc.btn_daily, 'cb_daily_menu', 'GIFT'),
    ],
    [
      cb(loc.btn_vault, 'cb_vault_menu', 'BACKPACK'),
      cb(loc.btn_orders, 'cb_orders_menu', 'SCROLL'),
    ],
    [
      cb(loc.btn_profile, 'cb_profile_menu', 'USER'),
      cb(loc.btn_language, 'cb_lang_menu', 'GLOBE'),
    ],
    [
      cb(loc.btn_rules, 'cb_main_rules', 'SCROLL'),
      cb(loc.btn_help, 'cb_main_help', 'QUESTION'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_store, storeUrl, 'SHOPPING_BAGS'),
      urlBtn(loc.btn_support_admin, supportUrl, 'SUPPORT'),
    ],
  ]);
}

/**
 * Language selection inline keyboard:
 * 🇰🇭 Khmer | 🇬🇧 English
 * (Language selection explicitly requires Khmer and English options per Requirement 4 & 5)
 */
export function getLanguageSelectionKeyboard(langOrShowBackHome: string | boolean = false) {
  const showBackHome = typeof langOrShowBackHome === 'boolean' ? langOrShowBackHome : Boolean(langOrShowBackHome);
  const rows: any[][] = [
    [
      cb('🇰🇭 Khmer', 'set_lang:km', 'FLAG_CAMBODIA'),
      cb('🇬🇧 English', 'set_lang:en', 'FLAG_UK'),
    ],
  ];
  if (showBackHome) {
    rows.push([cb('🏠 Back Home', 'cb_main_menu', 'HOME')]);
  }
  return Markup.inlineKeyboard(rows);
}

/**
 * Profile Keyboard:
 * Row 1: 📜 ប្រវត្តិពិន្ទុ (Points Ledger) | 🎁 ប្តូរពិន្ទុយករង្វាន់
 * Row 2: 🎒 មើលកាតាបឥវ៉ាន់ & Accounts
 * Row 3: 📱 បើកក្នុង Mini App (ស្រេចចិត្ត) | 🔙 ត្រឡប់ទៅដើម
 */
export function buildProfileKeyboard(
  storeUrl?: string,
  lang: string = 'km'
) {
  const effectiveStoreUrl =
    storeUrl &&
    !storeUrl.includes('your-production-app') &&
    (storeUrl.startsWith('https://') || storeUrl.startsWith('http://'))
      ? storeUrl
      : resolveStoreUrl();
  const loc = getLocale(lang);
  const profileWebUrl = effectiveStoreUrl.includes('?') ? `${effectiveStoreUrl}&tab=profile` : `${effectiveStoreUrl}?tab=profile`;

  return Markup.inlineKeyboard([
    [
      cb(loc.btn_points_ledger, 'cb_points_ledger', 'RECEIPT'),
      cb(loc.btn_redeem_pts, 'cb_redeem_pts', 'GIFT'),
    ],
    [
      cb(loc.btn_view_vault, 'cb_vault_menu', 'BACKPACK'),
      cb('Redeem Code', 'cb_redeem_code', 'TICKET'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_profile_webapp, profileWebUrl, 'PACKAGE'),
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
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
      cb('Back to Profile', 'cb_profile_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
    ],
  ]);
}

export function buildRedeemPointsKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb('Exchange Gacha Ticket (-100 Pts)', 'cb_gacha_buy_ticket', 'TICKET'),
    ],
    [
      cb('Back to Profile', 'cb_profile_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_payment_delivery, 'cb_payment_delivery', 'RECEIPT'),
      cb(loc.btn_refund_policy, 'cb_refund_policy', 'MONEY_BAG'),
    ],
    [
      cb(loc.btn_points_coupons, 'cb_points_coupons', 'TICKET'),
      cb(loc.btn_faq_help, 'cb_faq_help', 'QUESTION'),
    ],
    [
      cb(loc.btn_contact_support, 'cb_contact_support', 'SUPPORT'),
      cb(loc.btn_back_home, 'cb_main_menu', 'BACK'),
    ],
  ]);
}

export function buildSubRulesKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_back_to_rules, 'cb_main_rules', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
    ],
  ]);
}

/**
 * How to Buy & Pay In-Chat Keyboard:
 * [ 📖 Step-by-Step Guide ]
 * [ 💳 KHQR Payment Guide ]
 * [ 🛍️ Open Store Now ]
 * [ 🏠 Back Home ]
 */
export function buildHowToBuyKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app'
) {
  return Markup.inlineKeyboard([
    [
      cb('📖 Step-by-Step Guide', 'cb_guide_step_by_step', 'DOCUMENT'),
      cb('💳 KHQR Payment Guide', 'cb_guide_khqr', 'CREDIT_CARD'),
    ],
    [
      createWebAppOrUrlButton('🛍️ Open Store Now', storeUrl, 'SHOPPING_BAGS'),
    ],
    [
      cb('🏠 Back Home', 'cb_main_menu', 'HOME'),
    ],
  ]);
}

/**
 * KHQR / Step-by-Step Payment Guide Sub-Keyboard:
 * [ 🔙 Back to How to Buy ]
 * [ 🏠 Back Home ]
 */
export function buildKhqrGuideKeyboard() {
  return Markup.inlineKeyboard([
    [
      cb('🔙 Back to How to Buy', 'cb_how_to_buy', 'BACK'),
      cb('🏠 Back Home', 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_view_prizes, 'cb_gacha_prizes', 'CROWN'),
    ],
    [
      cb(loc.btn_drop_rates, 'cb_gacha_odds', 'LIGHTNING'),
      cb(loc.btn_gacha_rules, 'cb_gacha_rules', 'DOCUMENT'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_gacha_webapp, gachaWebUrl, 'PACKAGE'),
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
    ? '⏳ Cooldown Active...'
    : '🎁 Claim Daily Points Now';
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
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
    ],
  ]);
}

export function buildDailyShopKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb('🎟️ Exchange Gacha Ticket (-100 Pts)', 'cb_gacha_buy_ticket', 'TICKET'),
    ],
    [
      cb(loc.btn_back_to_daily, 'cb_daily_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
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
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
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
    buttons.push([createWebAppOrUrlButton('Open Vault in Mini App', webAppVaultUrl, 'PACKAGE')]);
    buttons.push([cb('Back Home', 'cb_main_menu', 'HOME')]);
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
    cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
    buttons.push([cb('Get Live 2FA Code', `cb_gen_2fa_${accountId}`, 'KEY')]);
  }

  buttons.push([createWebAppOrUrlButton('View Details in Mini App', webAppDetailUrl, 'PACKAGE')]);
  buttons.push([
    cb('Back to Vault', 'cb_vault_menu', 'BACKPACK'),
    cb('Back Home', 'cb_main_menu', 'HOME'),
  ]);

  return Markup.inlineKeyboard(buttons);
}

export function buildTwoFactorKeyboard(accountId: string, lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      cb(loc.btn_refresh_2fa, `cb_vault_2fa_acc:${accountId}`, 'REFRESH'),
    ],
    [
      cb(loc.btn_back_to_vault, 'cb_vault_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
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
  const recentOrdersText = '📜 Recent Orders';
  const trackOrderText = '🔍 Track Order';
  const openOrdersText = '📱 Open Orders in Mini App';

  return Markup.inlineKeyboard([
    [
      cb(recentOrdersText, 'cb_orders_recent', 'RECEIPT'),
      cb(trackOrderText, 'cb_orders_track', 'SEARCH'),
    ],
    [
      createWebAppOrUrlButton(openOrdersText, openOrdersUrl, 'PACKAGE'),
    ],
    [
      cb(loc.btn_back_home, 'cb_main_menu', 'HOME'),
    ],
  ]);
}

export function buildOrderHistoryKeyboard(
  storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app',
  lang: string = 'km'
) {
  const loc = getLocale(lang);
  const openOrdersUrl = storeUrl.includes('?') ? `${storeUrl}&tab=orders` : `${storeUrl}?tab=orders`;
  const openOrdersText = '📱 Open Orders in Mini App';
  const backToOrdersText = '🔙 Back to Orders';

  return Markup.inlineKeyboard([
    [
      createWebAppOrUrlButton(openOrdersText, openOrdersUrl, 'PACKAGE'),
    ],
    [
      cb(backToOrdersText, 'cb_orders_menu', 'BACK'),
      cb(loc.btn_back_home_short, 'cb_main_menu', 'HOME'),
    ],
  ]);
}
