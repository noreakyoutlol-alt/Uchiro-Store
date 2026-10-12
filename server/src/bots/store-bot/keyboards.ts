import { Markup } from 'telegraf';
import { DeliveredAccount } from '../../database/data-store';
import { getLocale } from './locales';

export function createWebAppOrUrlButton(text: string, targetUrl: string) {
  const rawPublicUrl = (process.env.PUBLIC_URL || '').trim();
  const appUrl = (rawPublicUrl.startsWith('https://') ? rawPublicUrl : 'https://web-production-2d8bd.up.railway.app').replace(/\/$/, '');

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
 * 6-Row Main Menu In-Chat Keyboard with Hero Open Store at Row 1 (Module 1 Directive):
 * ROW 1: PRIMARY HERO BUTTON AT THE VERY TOP
 * ROW 2: IN-CHAT GAMING & DAILY REWARDS
 * ROW 3: INVENTORY VAULT & ORDER HISTORY
 * ROW 4: PROFILE & LANGUAGE
 * ROW 5: RULES & HELP CENTER
 * ROW 6: DIRECT SUPPORT
 */
export function buildMainMenuKeyboard() {
  const storeUrl = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app';
  return {
    inline_keyboard: [
      // ROW 1: PRIMARY HERO BUTTON AT THE TOP
      [
        { text: '🛍️ Open Store (UCHIRO STORE)', web_app: { url: storeUrl } }
      ],
      // ROW 2: GAMING & REWARDS
      [
        { text: '🎰 Play Gacha', callback_data: 'cb_gacha_menu' },
        { text: '🎁 Daily Reward', callback_data: 'cb_daily_menu' }
      ],
      // ROW 3: VAULT & ORDERS
      [
        { text: '🎒 My Vault & Accounts', callback_data: 'cb_vault_menu' },
        { text: '📜 Order History', callback_data: 'cb_orders_menu' }
      ],
      // ROW 4: PROFILE & LANGUAGE
      [
        { text: '👤 My Profile', callback_data: 'cb_profile_menu' },
        { text: '🌐 Language', callback_data: 'cb_lang_menu' }
      ],
      // ROW 5: RULES & FAQ
      [
        { text: '📜 Store Rules & Warranty', callback_data: 'cb_main_rules' },
        { text: '❓ Help & FAQ', callback_data: 'cb_main_help' }
      ],
      // ROW 6: SUPPORT
      [
        { text: '💬 Contact Support 24/7', url: 'https://t.me/UchiroSupport' }
      ]
    ]
  };
}

/**
 * 5-Row Main Menu In-Chat Keyboard (Legacy test compatibility):
 * Row 1: 🎰 លេង Gacha (cb_gacha_menu) | 🎁 ពិន្ទុប្រចាំថ្ងៃ (cb_daily_menu)
 * Row 2: 🎒 កាតាបឥវ៉ាន់ & Vault (cb_vault_menu) | 📜 ប្រវត្តិបញ្ជាទិញ (cb_orders_menu)
 * Row 3: 👤 ព័ត៌មានគណនី (Profile) (cb_profile_menu) | 🌐 ភាសា / Language (cb_lang_menu)
 * Row 4: 📜 ច្បាប់ទូទៅ (Rules) (cb_main_rules) | ❓ ជំនួយ & FAQ (Help) (cb_main_help)
 * Row 5: 🛍️ បើកហាង Mini App (ស្រេចចិត្ត) (WebApp) | 💬 ឆាតទៅ Admin 24/7 (Link)
 */
export function getMainMenuKeyboard(storeUrl: string, lang: string = 'km', supportUsername: string = 'UchiroSupport') {
  const loc = getLocale(lang);
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_gacha, 'cb_gacha_menu'),
      Markup.button.callback(loc.btn_daily, 'cb_daily_menu'),
    ],
    [
      Markup.button.callback(loc.btn_vault, 'cb_vault_menu'),
      Markup.button.callback(loc.btn_orders, 'cb_orders_menu'),
    ],
    [
      Markup.button.callback(loc.btn_profile, 'cb_profile_menu'),
      Markup.button.callback(loc.btn_language, 'cb_lang_menu'),
    ],
    [
      Markup.button.callback(loc.btn_rules, 'cb_main_rules'),
      Markup.button.callback(loc.btn_help, 'cb_main_help'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_store, storeUrl),
      Markup.button.url(loc.btn_support_admin, supportUrl),
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
      Markup.button.callback('🇰🇭 ភាសាខ្មែរ', 'set_lang:km'),
      Markup.button.callback('🇬🇧 English', 'set_lang:en'),
    ],
    [
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Profile Keyboard:
 * Row 1: 📜 ប្រវត្តិពិន្ទុ (Points Ledger) | 🎁 ប្តូរពិន្ទុយករង្វាន់
 * Row 2: 🎒 មើលកាតាបឥវ៉ាន់ & Accounts
 * Row 3: 📱 បើកក្នុង Mini App (ស្រេចចិត្ត) | 🔙 ត្រឡប់ទៅដើម
 */
export function buildProfileKeyboard(storeUrl?: string, _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎁 Redeem Points for Coupons', 'cb_redeem_menu'),
    ],
    [
      Markup.button.callback('📜 Points Ledger History', 'cb_points_ledger'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildPointsLedgerKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎁 Redeem Points for Coupons', 'cb_redeem_menu'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildRedeemPointsKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Store Rules Keyboard:
 * Row 1: 📜 Store Warranty & Guarantee
 * Row 2: 🔙 Back Home
 */
export function buildMainRulesKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📜 Store Warranty & Guarantee', 'cb_rules_warranty'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildSubRulesKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Help & FAQ Keyboard:
 * Row 1: 🔑 2FA Security Guide
 * Row 2: 💬 Chat with Support 24/7
 * Row 3: 🔙 Back Home
 */
export function buildMainHelpKeyboard(supportUsername: string = 'UchiroSupport', _lang: string = 'en') {
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = supportUsername.startsWith('http') ? supportUsername : `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔑 2FA Security Guide', 'cb_help_2fa'),
    ],
    [
      Markup.button.url('💬 Chat with Support 24/7', supportUrl),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildSubHelpKeyboard(supportUsername: string = 'UchiroSupport', _lang: string = 'en') {
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = supportUsername.startsWith('http') ? supportUsername : `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.url('💬 Chat with Support 24/7', supportUrl),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Gacha Dashboard Keyboard:
 * 🎟️ Exchange Points (100 Pts) (cb_buy_ticket_pts)
 * 🏆 View All Prizes (cb_gacha_prizes)
 * ⚡ Win Rates % (Drop Rates) (cb_gacha_rates)
 * 🎰 Gacha Rules (cb_gacha_rules)
 * 📱 Play Mini App (Visual) (web_app link)
 * 🔙 Back Home (cb_main_menu)
 */
export function buildGachaKeyboard(storeUrl: string, _lang: string = 'en') {
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts'),
      Markup.button.callback('🏆 View All Prizes', 'cb_gacha_prizes'),
    ],
    [
      Markup.button.callback('⚡ Win Rates % (Drop Rates)', 'cb_gacha_rates'),
      Markup.button.callback('🎰 Gacha Rules', 'cb_gacha_rules'),
    ],
    [
      createWebAppOrUrlButton('📱 Play Mini App (Visual)', gachaWebUrl),
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildSubGachaKeyboard(storeUrl: string, _lang: string = 'en') {
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts'),
    ],
    [
      createWebAppOrUrlButton('📱 Play Mini App (Visual)', gachaWebUrl),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Daily Reward Streak Keyboard:
 * 🎁 Claim Daily Points (+5 Pts) (cb_claim_daily)
 * 📜 Streak Rules & Multipliers (cb_daily_rules)
 * 🔙 Back Home (cb_main_menu)
 */
export function buildDailyKeyboard(_isClaimable: boolean = true, _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎁 Claim Daily Points (+5 Pts)', 'cb_claim_daily'),
    ],
    [
      Markup.button.callback('📜 Streak Rules & Multipliers', 'cb_daily_rules'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

export function buildSubDailyShopKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Vault & Accounts Menu Keyboard:
 * 🔑 Get Live 2FA Code (cb_vault_2fa)
 * 🎒 View Delivered Accounts (cb_vault_accounts)
 * 🔙 Back Home (cb_main_menu)
 */
export function buildVaultMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔑 Get Live 2FA Code', 'cb_vault_2fa'),
    ],
    [
      Markup.button.callback('🎒 View Delivered Accounts', 'cb_vault_accounts'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Orders Menu Keyboard:
 * 📜 Order History (cb_orders_recent)
 * 🔍 Track Order ID (cb_orders_track)
 * 🔙 Back Home (cb_main_menu)
 */
export function buildOrdersMenuKeyboard() {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('📜 Order History', 'cb_orders_recent'),
    ],
    [
      Markup.button.callback('🔍 Track Order ID', 'cb_orders_track'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Vault List Keyboard
 */
export function buildVaultListKeyboard(accounts: DeliveredAccount[], storeUrl: string, _lang: string = 'en') {
  const buttons: any[][] = accounts.map((acc) => [
    Markup.button.callback(
      `🎮 [#${acc.order_code}] ${acc.game_title} (@${acc.username})`,
      `cb_view_acc_${acc.account_id}`
    ),
  ]);

  const webAppVaultUrl = storeUrl.includes('?') ? `${storeUrl}&tab=vault` : `${storeUrl}?tab=vault`;

  buttons.push([createWebAppOrUrlButton('📱 Open Vault in Mini App', webAppVaultUrl)]);
  buttons.push([Markup.button.callback('🔙 Back Home', 'cb_main_menu')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Empty Vault Keyboard
 */
export function buildEmptyVaultKeyboard(storeUrl: string, _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ Open Store', storeUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

/**
 * Account Detail Keyboard
 * Row 1: 🔑 Request Live 2FA OTP (if two_factor_secret)
 * Row 2: 📱 Open in Mini App (1-Click Copy)
 * Row 3: 🔙 Back to Accounts | 🏠 Back Home
 */
export function buildAccountDetailKeyboard(account: DeliveredAccount, storeUrl: string, _lang: string = 'en') {
  const accountId = account.account_id;
  const webAppDetailUrl = storeUrl.includes('?')
    ? `${storeUrl}&tab=vault&orderId=${account.order_code}&accountId=${accountId}`
    : `${storeUrl}?tab=vault&orderId=${account.order_code}&accountId=${accountId}`;

  const rows: any[][] = [];

  if (account.two_factor_secret) {
    rows.push([
      Markup.button.callback('🔑 Request Live 2FA OTP', `cb_gen_2fa_${accountId}`),
    ]);
  }

  rows.push([
    createWebAppOrUrlButton('📱 Open in Mini App (1-Click Copy)', webAppDetailUrl),
  ]);

  rows.push([
    Markup.button.callback('🔙 Back to Accounts', 'cb_vault_menu'),
    Markup.button.callback('🏠 Back Home', 'cb_main_menu'),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Live 2FA Keyboard
 * Row 1: 🔄 Refresh 2FA Code
 * Row 2: 🔙 Back to Account | 🏠 Back Home
 */
export function buildTwoFactorKeyboard(accountId: string, _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔄 Refresh 2FA Code', `cb_gen_2fa_${accountId}`),
    ],
    [
      Markup.button.callback('🔙 Back to Account', `cb_view_acc_${accountId}`),
      Markup.button.callback('🏠 Back Home', 'cb_main_menu'),
    ],
  ]);
}
