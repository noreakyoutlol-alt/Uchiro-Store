import { Markup } from 'telegraf';
import { DeliveredAccount } from '../../database/data-store';

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
 * 5-Row Main Menu In-Chat Keyboard (100% English):
 * Row 1: 🎰 Play Gacha | 🎁 Daily Reward
 * Row 2: 🎒 My Vault & Accounts | 📜 Order History
 * Row 3: 👤 My Profile | 🌐 Language
 * Row 4: 📜 Terms & Rules | ❓ Help & Support
 * Row 5: 🛍️ Open Store (Mini App) | 💬 Contact Admin
 */
export function buildMainMenuKeyboard(storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app') {
  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎰 Play Gacha', 'cb_gacha_menu'),
      Markup.button.callback('🎁 Daily Reward', 'cb_daily_menu'),
    ],
    [
      Markup.button.callback('🎒 My Vault & Accounts', 'cb_vault_menu'),
      Markup.button.callback('📜 Order History', 'cb_orders_menu'),
    ],
    [
      Markup.button.callback('👤 My Profile', 'cb_profile_menu'),
      // Language button removed - always English
    ],
    [
      Markup.button.callback('📜 Terms & Rules', 'cb_rules_menu'),
      Markup.button.callback('❓ Help & Support', 'cb_help_menu'),
    ],
    [
      Markup.button.webApp('🛍️ Open Store (Mini App)', storeUrl),
      Markup.button.url('💬 Contact Admin', 'https://t.me/UchiroSupport'),
    ],
  ]);
  Object.assign(kb, kb.reply_markup);
  return kb;
}

export function getMainMenuKeyboard(storeUrl: string, _lang: string = 'en', supportUsername: string = 'UchiroSupport') {
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  const kb = Markup.inlineKeyboard([
    [
      Markup.button.callback('🎰 Play Gacha', 'cb_gacha_menu'),
      Markup.button.callback('🎁 Daily Reward', 'cb_daily_menu'),
    ],
    [
      Markup.button.callback('🎒 My Vault & Accounts', 'cb_vault_menu'),
      Markup.button.callback('📜 Order History', 'cb_orders_menu'),
    ],
    [
      Markup.button.callback('👤 My Profile', 'cb_profile_menu'),
      Markup.button.callback('🌐 Language', 'cb_lang_menu'),
    ],
    [
      Markup.button.callback('📜 Terms & Rules', 'cb_rules_menu'),
      Markup.button.callback('❓ Help & Support', 'cb_help_menu'),
    ],
    [
      createWebAppOrUrlButton('🛍️ Open Store (Mini App)', storeUrl),
      Markup.button.url('💬 Contact Admin', supportUrl),
    ],
  ]);
  Object.assign(kb, kb.reply_markup);
  return kb;
}

/**
 * Language selection inline keyboard:
 * 🇰🇭 Khmer | 🇬🇧 English
 * 🔙 Back Home
 */
export function getLanguageSelectionKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🇰🇭 Khmer', 'set_lang:km'),
      Markup.button.callback('🇬🇧 English', 'set_lang:en'),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Profile Keyboard (100% English)
 */
export function buildProfileKeyboard(storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app', _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎁 Redeem Points', 'cb_redeem_menu')],
    [Markup.button.callback('📜 Points History', 'cb_points_ledger')],
    [Markup.button.webApp('🛍️ Open Store Profile', storeUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
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
 * Store Rules Keyboard (100% English)
 */
export function buildMainRulesKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📜 Store Warranty & Guarantee', 'cb_rules_warranty')],
    [Markup.button.callback('🎰 Gacha Fair Play Rules', 'cb_rules_gacha')],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

export function buildSubRulesKeyboard(_lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🔙 Back to Rules', 'cb_rules_menu'),
    ],
    [
      Markup.button.callback('🏠 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Help & FAQ Keyboard (100% English)
 */
export function buildMainHelpKeyboard(supportUsername: string = 'UchiroSupport', _lang: string = 'en') {
  const cleanSupport = supportUsername.replace(/^@/, '');
  const supportUrl = supportUsername.startsWith('http') ? supportUsername : `https://t.me/${cleanSupport || 'UchiroSupport'}`;

  return Markup.inlineKeyboard([
    [Markup.button.callback('🔑 2FA Security Guide', 'cb_help_2fa')],
    [Markup.button.url('💬 Chat with Support 24/7', supportUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
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
      Markup.button.callback('🔙 Back to Help', 'cb_help_menu'),
    ],
  ]);
}

/**
 * Gacha Dashboard Keyboard (100% English)
 */
export function buildGachaKeyboard(storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app', _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts')],
    [
      Markup.button.callback('🏆 View Prizes', 'cb_gacha_prizes'),
      Markup.button.callback('⚡ Win Rates %', 'cb_gacha_rates'),
    ],
    [Markup.button.callback('🎰 Gacha Rules', 'cb_gacha_rules')],
    [Markup.button.webApp('📱 Play Mini App (Visual)', storeUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

export function buildSubGachaKeyboard(storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app', _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [
      Markup.button.callback('🎟️ Exchange Points (100 Pts)', 'cb_buy_ticket_pts'),
    ],
    [
      createWebAppOrUrlButton('📱 Play Mini App (Visual)', storeUrl),
    ],
    [
      Markup.button.callback('🔙 Back Home', 'cb_main_menu'),
    ],
  ]);
}

/**
 * Daily Reward Streak Keyboard (100% English)
 */
export function buildDailyKeyboard(isClaimable: boolean = true, _lang: string = 'en') {
  const claimBtn = isClaimable
    ? Markup.button.callback('🎁 Claim Daily Points (+5 Pts)', 'cb_claim_daily')
    : Markup.button.callback('⏳ Cooldown (Wait 24h)', 'cb_noop');

  return Markup.inlineKeyboard([
    [claimBtn],
    [Markup.button.callback('📜 Streak Rules & Multipliers', 'cb_daily_rules')],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
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
 * Vault & Accounts Menu Keyboard (100% English)
 */
export function buildVaultMenuKeyboard(storeUrl: string = process.env.STORE_URL || 'https://web-production-2d8bd.up.railway.app') {
  return Markup.inlineKeyboard([
    [Markup.button.callback('🔑 Get Live 2FA Code', 'cb_vault_2fa')],
    [Markup.button.callback('🎒 View Delivered Accounts', 'cb_vault_accounts')],
    [Markup.button.webApp('🛍️ Open Store', storeUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

/**
 * Orders Menu Keyboard (100% English)
 */
export function buildOrdersMenuKeyboard() {
  return Markup.inlineKeyboard([
    [Markup.button.callback('📜 Order History', 'cb_orders_recent')],
    [Markup.button.callback('🔍 Track Order ID', 'cb_orders_track')],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

/**
 * Vault List Keyboard (100% English)
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
 * Empty Vault Keyboard (100% English)
 */
export function buildEmptyVaultKeyboard(storeUrl: string, _lang: string = 'en') {
  return Markup.inlineKeyboard([
    [createWebAppOrUrlButton('🛍️ Open Store', storeUrl)],
    [Markup.button.callback('🔙 Back Home', 'cb_main_menu')],
  ]);
}

/**
 * Account Detail Keyboard (100% English)
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
 * Live 2FA Keyboard (100% English)
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
