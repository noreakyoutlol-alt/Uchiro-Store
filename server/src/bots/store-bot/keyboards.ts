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
export function buildProfileKeyboard(storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  const profileWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=profile` : `${storeUrl}?tab=profile`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_points_ledger, 'cb_points_ledger'),
      Markup.button.callback(loc.btn_redeem_pts, 'cb_redeem_pts'),
    ],
    [
      Markup.button.callback(loc.btn_view_vault, 'cb_vault_menu'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_profile_webapp, profileWebUrl),
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

export function buildPointsLedgerKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_redeem_pts, 'cb_redeem_pts'),
    ],
    [
      Markup.button.callback('🔙 ត្រឡប់ទៅ Profile', 'cb_profile_menu'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

export function buildRedeemPointsKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ ប្តូរសំបុត្រ Gacha (-50 Pts)', 'cb_gacha_buy_ticket'),
    ],
    [
      Markup.button.callback('🔙 ត្រឡប់ទៅ Profile', 'cb_profile_menu'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Store Rules Keyboard:
 * Row 1: 🎰 ច្បាប់ Gacha លម្អិត | 🎁 ច្បាប់ Daily Streak
 * Row 2: 🔐 គោលការណ៍ធានា 14 ថ្ងៃ
 * Row 3: 🔙 ត្រឡប់ទៅដើម (Back Home)
 */
export function buildMainRulesKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_gacha_rules, 'cb_gacha_rules'),
      Markup.button.callback(loc.btn_daily_rules, 'cb_daily_rules'),
    ],
    [
      Markup.button.callback(loc.btn_warranty_policy, 'cb_warranty_policy'),
    ],
    [
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

export function buildSubRulesKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_back_to_rules, 'cb_main_rules'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Help & FAQ Keyboard:
 * Row 1: 🔑 មគ្គុទ្ទេសក៍ប្រើ 2FA Authenticator
 * Row 2: 💳 របៀបទិញ និងបង់ប្រាក់ KHQR
 * Row 3: 💬 ទាក់ទង Admin ជំនួយផ្ទាល់ (Link)
 * Row 4: 🔙 ត្រឡប់ទៅដើម (Back Home)
 */
export function buildMainHelpKeyboard(supportUsername: string = 'UchiroSupport', lang: string = 'km') {
  const loc = getLocale(lang);
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_guide_2fa, 'cb_guide_2fa'),
    ],
    [
      Markup.button.callback(loc.btn_guide_payment, 'cb_guide_payment'),
    ],
    [
      Markup.button.url(loc.btn_contact_admin, supportUrl),
    ],
    [
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

export function buildSubHelpKeyboard(supportUsername: string = 'UchiroSupport', lang: string = 'km') {
  const loc = getLocale(lang);
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [
      Markup.button.url(loc.btn_support_admin, supportUrl),
    ],
    [
      Markup.button.callback(loc.btn_back_to_help, 'cb_main_help'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Gacha Dashboard Keyboard:
 * Row 1: 🎟️ ប្តូរសំបុត្រតាមពិន្ទុ (In-Bot) | 🏆 មើលរង្វាន់ទាំងអស់
 * Row 2: ⚡ អត្រាឈ្នះ % (Drop Rates) | 📜 ច្បាប់ & របៀបលេង
 * Row 3: 📱 បើកលេង Mini App (Visual Spin) | 🔙 ត្រឡប់ទៅដើម
 */
export function buildGachaKeyboard(storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_buy_ticket, 'cb_gacha_buy_ticket'),
      Markup.button.callback(loc.btn_view_prizes, 'cb_gacha_prizes'),
    ],
    [
      Markup.button.callback(loc.btn_drop_rates, 'cb_gacha_odds'),
      Markup.button.callback(loc.btn_gacha_rules, 'cb_gacha_rules'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_gacha_webapp, gachaWebUrl),
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

export function buildSubGachaKeyboard(storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  const gachaWebUrl = storeUrl.includes('?') ? `${storeUrl}&tab=gacha` : `${storeUrl}?tab=gacha`;

  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_buy_ticket, 'cb_gacha_buy_ticket'),
    ],
    [
      createWebAppOrUrlButton(loc.btn_open_gacha_webapp, gachaWebUrl),
    ],
    [
      Markup.button.callback(loc.btn_back_to_gacha, 'cb_gacha_menu'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Daily Reward Streak Keyboard:
 * Row 1: If claimable: 🎁 ទទួលពិន្ទុភ្លាមៗតាម Bot (Claim Now)
 *        If cooldown:  ⏳ កំពុងរង់ចាំ Cooldown... (cb_noop)
 * Row 2: 📜 ច្បាប់ពិន្ទុ (Rules) | 💎 ហាងប្តូរពិន្ទុ
 * Row 3: 🔙 ត្រឡប់ទៅដើម (Back Home)
 */
export function buildDailyKeyboard(isClaimable: boolean, lang: string = 'km') {
  const loc = getLocale(lang);
  const claimButton = isClaimable
    ? Markup.button.callback(loc.btn_claim_daily_instant, 'cb_claim_daily_instant')
    : Markup.button.callback(loc.btn_daily_cooldown, 'cb_noop');

  return Markup.inlineKeyboard([
    [claimButton],
    [
      Markup.button.callback(loc.btn_daily_rules, 'cb_daily_rules'),
      Markup.button.callback(loc.btn_daily_shop, 'cb_daily_shop'),
    ],
    [
      Markup.button.callback(loc.btn_back_home, 'cb_main_menu'),
    ],
  ]);
}

export function buildSubDailyShopKeyboard(lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ ប្តូរសំបុត្រ Gacha (-50 Pts)', 'cb_gacha_buy_ticket'),
    ],
    [
      Markup.button.callback(loc.btn_back_to_daily, 'cb_daily_menu'),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}

/**
 * Vault List Keyboard
 */
export function buildVaultListKeyboard(accounts: DeliveredAccount[], storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  const buttons: any[][] = accounts.map((acc) => [
    Markup.button.callback(
      `🎮 [#${acc.order_code}] ${acc.game_title} (@${acc.username})`,
      `cb_view_acc_${acc.account_id}`
    ),
  ]);

  const webAppVaultUrl = storeUrl.includes('?') ? `${storeUrl}&tab=vault` : `${storeUrl}?tab=vault`;

  buttons.push([createWebAppOrUrlButton('📱 បើក Vault ក្នុង Mini App', webAppVaultUrl)]);
  buttons.push([Markup.button.callback(loc.btn_back_home, 'cb_main_menu')]);

  return Markup.inlineKeyboard(buttons);
}

/**
 * Empty Vault Keyboard
 */
export function buildEmptyVaultKeyboard(storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ ចូលហាងទំនិញ (Open Store)', storeUrl)],
    [Markup.button.callback(loc.btn_back_home, 'cb_main_menu')],
  ]);
}

/**
 * Account Detail Keyboard
 * Row 1: 🔑 ស្នើសុំកូដ 2FA OTP ផ្ទាល់ (Live OTP) (if two_factor_secret)
 * Row 2: 📱 បើកក្នុង Mini App (1-Click Copy)
 * Row 3: 🔙 ត្រឡប់ទៅបញ្ជីគណនី | 🏠 ត្រឡប់ទៅដើម
 */
export function buildAccountDetailKeyboard(account: DeliveredAccount, storeUrl: string, lang: string = 'km') {
  const loc = getLocale(lang);
  const accountId = account.account_id;
  const webAppDetailUrl = storeUrl.includes('?')
    ? `${storeUrl}&tab=vault&orderId=${account.order_code}&accountId=${accountId}`
    : `${storeUrl}?tab=vault&orderId=${account.order_code}&accountId=${accountId}`;

  const rows: any[][] = [];

  if (account.two_factor_secret) {
    rows.push([
      Markup.button.callback(loc.btn_live_2fa, `cb_gen_2fa_${accountId}`),
    ]);
  }

  rows.push([
    createWebAppOrUrlButton(loc.btn_open_vault_webapp, webAppDetailUrl),
  ]);

  rows.push([
    Markup.button.callback(loc.btn_back_to_vault, 'cb_vault_menu'),
    Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
  ]);

  return Markup.inlineKeyboard(rows);
}

/**
 * Live 2FA Keyboard
 * Row 1: 🔄 ពិនិត្យកូដ 2FA ឡើងវិញ (Refresh)
 * Row 2: 🔙 ត្រឡប់ទៅគណនី | 🏠 ត្រឡប់ទៅដើម
 */
export function buildTwoFactorKeyboard(accountId: string, lang: string = 'km') {
  const loc = getLocale(lang);
  return Markup.inlineKeyboard([
    [
      Markup.button.callback(loc.btn_refresh_2fa, `cb_gen_2fa_${accountId}`),
    ],
    [
      Markup.button.callback('🔙 ត្រឡប់ទៅគណនី', `cb_view_acc_${accountId}`),
      Markup.button.callback(loc.btn_back_home_short, 'cb_main_menu'),
    ],
  ]);
}
