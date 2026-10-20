import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../database/data-store';
import {
  getMainMenuKeyboard,
  getLanguageSelectionKeyboard,
  buildProfileKeyboard,
  buildMainRulesKeyboard,
  buildMainHelpKeyboard,
  buildGachaKeyboard,
  buildDailyKeyboard,
} from '../bots/store-bot/keyboards';
import { fetchUserProfileData } from '../bots/store-bot/handlers/profile';
import { fetchGachaLiveInfo } from '../bots/store-bot/handlers/gacha';
import { fetchDailyLiveInfo, formatCooldownSeconds } from '../bots/store-bot/handlers/daily';
import { getCustomerDeliveredAccounts, getCustomerDeliveredAccountById } from '../bots/store-bot/handlers/orders';

describe('Standalone In-Chat Telegram Bot Master Architecture', () => {
  const TEST_TG_ID = 8899771122;

  beforeEach(() => {
    DataStore.upsertTelegramUser({
      telegram_id: TEST_TG_ID,
      username: 'pro_gamer_kh',
      first_name: 'Sokha',
      language_code: 'km',
    });
    DataStore.setUserLanguagePreference(TEST_TG_ID, 'km');
  });

  describe('1. 5-Row Main Menu Navigation & Emoji Quality', () => {
    it('builds exactly 5 rows in English with clean singular emojis and single WebApp button', () => {
      const keyboard = getMainMenuKeyboard('https://uchiro.store', 'km', 'UchiroSupport');
      const rows = keyboard.reply_markup.inline_keyboard;

      expect(rows.length).toBe(5);

      // Verify no radioactive emoji anywhere
      const allText = rows.flatMap((r) => r.map((b) => b.text)).join(' ');
      expect(allText).not.toContain('☢️');
      expect(allText).not.toContain('☢');

      // Row 1: Gacha & Daily Points (both have custom emojis)
      expect(rows[0][0].text).toBe('Play Gacha');
      expect((rows[0][0] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_menu');
      expect(rows[0][1].text).toBe('Daily Points');
      expect((rows[0][1] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[0][1] as any).callback_data).toBe('cb_daily_menu');

      // Row 2: Vault (fallback to text emoji) & Orders (custom emoji)
      expect(rows[1][0].text).toBe('🎒 My Vault & Accounts');
      expect((rows[1][0] as any).icon_custom_emoji_id).toBeUndefined();
      expect((rows[1][0] as any).callback_data).toBe('cb_vault_menu');
      expect(rows[1][1].text).toBe('Order History');
      expect((rows[1][1] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[1][1] as any).callback_data).toBe('cb_orders_menu');

      // Row 3: Profile & Language (both have custom emojis)
      expect(rows[2][0].text).toBe('My Profile');
      expect((rows[2][0] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[2][0] as any).callback_data).toBe('cb_profile_menu');
      expect(rows[2][1].text).toBe('Language');
      expect((rows[2][1] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[2][1] as any).callback_data).toBe('cb_lang_menu');

      // Row 4: Rules (custom emoji) & Help (fallback to text emoji)
      expect(rows[3][0].text).toBe('Store Rules');
      expect((rows[3][0] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[3][0] as any).callback_data).toBe('cb_main_rules');
      expect(rows[3][1].text).toBe('❓ Help & FAQ');
      expect((rows[3][1] as any).icon_custom_emoji_id).toBeUndefined();
      expect((rows[3][1] as any).callback_data).toBe('cb_main_help');

      // Row 5: Open Mini App (ONLY WebApp) & Admin Support link
      expect(rows[4][0].text).toBe('Open Store');
      expect((rows[4][0] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[4][0] as any).web_app?.url).toBe('https://uchiro.store');
      expect(rows[4][1].text).toBe('Contact Support');
      expect((rows[4][1] as any).icon_custom_emoji_id).toBeDefined();
      expect((rows[4][1] as any).url).toBe('https://t.me/UchiroSupport');

      // Verify ONLY Row 4 Col 0 has web_app
      for (let r = 0; r < 4; r++) {
        for (const btn of rows[r]) {
          expect((btn as any).web_app).toBeUndefined();
        }
      }
    });

    it('builds 5 rows in English with matching callbacks', () => {
      const keyboard = getMainMenuKeyboard('https://uchiro.store', 'en', 'UchiroSupport');
      const rows = keyboard.reply_markup.inline_keyboard;
      expect(rows.length).toBe(5);

      expect(rows[0][0].text).toBe('Play Gacha');
      expect(rows[0][1].text).toBe('Daily Points');
      expect(rows[1][0].text).toBe('🎒 My Vault & Accounts');
      expect(rows[1][1].text).toBe('Order History');
      expect(rows[2][0].text).toBe('My Profile');
      expect(rows[2][1].text).toBe('Language');
      expect(rows[3][0].text).toBe('Store Rules');
      expect(rows[3][1].text).toBe('❓ Help & FAQ');
      expect(rows[4][0].text).toBe('Open Store');
      expect(rows[4][1].text).toBe('Contact Support');

      // Verify no Khmer characters anywhere in visible button labels
      const allText = rows.flatMap((r) => r.map((b) => b.text)).join(' ');
      expect(/[ក-៿]/.test(allText)).toBe(false);
    });

    it('builds Language Selection Keyboard with Khmer and English options in English', () => {
      const kb = getLanguageSelectionKeyboard('km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(2);
      expect(rows[0][0].text).toBe('Khmer');
      expect((rows[0][0] as any).icon_custom_emoji_id).toBe('5294018354527353443');
      expect((rows[0][0] as any).callback_data).toBe('set_lang:km');
      expect(rows[0][1].text).toBe('English');
      expect((rows[0][1] as any).icon_custom_emoji_id).toBe('5458416160586342331');
      expect((rows[0][1] as any).callback_data).toBe('set_lang:en');
      expect(rows[1][0].text).toBe('Back Home');
      expect((rows[1][0] as any).callback_data).toBe('cb_main_menu');

      // Verify visible button text contains no Khmer characters
      const allText = rows.flatMap((r) => r.map((b) => b.text)).join(' ');
      expect(/[ក-៿]/.test(allText)).toBe(false);
    });
  });

  describe('2. User Profile, Tier Calculations & Points Ledger', () => {
    it('fetches profile data with correct membership tier progression', async () => {
      const p1 = await fetchUserProfileData(TEST_TG_ID);
      expect(p1.telegram_id).toBe(String(TEST_TG_ID));
      expect(p1.tier_name).toContain('សមាជិកទូទៅ');

      // Award points
      DataStore.adjustUserPoints(TEST_TG_ID, 250, 'test_award');
      const p2 = await fetchUserProfileData(TEST_TG_ID);
      expect(p2.points).toBeGreaterThanOrEqual(250);
      expect(p2.tier_name).toContain('Platinum');

      DataStore.adjustUserPoints(TEST_TG_ID, 800, 'vip_award');
      const p3 = await fetchUserProfileData(TEST_TG_ID);
      expect(p3.tier_name).toContain('VIP');
    });

    it('builds Profile Keyboard with points ledger, redeem points, and back navigation', () => {
      const kb = buildProfileKeyboard('https://uchiro.store', 'km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(3);
      expect(rows[0][0].text).toContain('Points Ledger');
      expect((rows[0][0] as any).callback_data).toBe('cb_points_ledger');
      expect(rows[0][1].text).toContain('Redeem Points');
      expect((rows[0][1] as any).callback_data).toBe('cb_redeem_pts');
      expect(rows[1][0].text).toContain('View Vault');
      expect((rows[1][0] as any).callback_data).toBe('cb_vault_menu');
      expect(rows[2][1].text).toContain('Back Home');
      expect((rows[2][1] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('3. Store Rules & Warranties', () => {
    it('builds Rules sub-menu keyboard with Gacha, Daily, and 14-day warranty options', () => {
      const kb = buildMainRulesKeyboard('km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(5);
      expect(rows[0][0].text).toContain('Gacha Rules');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_rules');
      expect(rows[0][1].text).toContain('Daily Streak Rules');
      expect((rows[0][1] as any).callback_data).toBe('cb_daily_rules');
      expect(rows[1][0].text).toContain('14-Day Warranty');
      expect((rows[1][0] as any).callback_data).toBe('cb_warranty_policy');
      expect(rows[2][0].text).toContain('Payment & Delivery');
      expect((rows[2][0] as any).callback_data).toBe('cb_payment_delivery');
      expect(rows[2][1].text).toContain('Refund Policy');
      expect((rows[2][1] as any).callback_data).toBe('cb_refund_policy');
      expect(rows[3][0].text).toContain('Points & Coupons');
      expect((rows[3][0] as any).callback_data).toBe('cb_points_coupons');
      expect(rows[3][1].text).toContain('FAQ & Help');
      expect((rows[3][1] as any).callback_data).toBe('cb_faq_help');
      expect(rows[4][0].text).toContain('Contact Support');
      expect((rows[4][0] as any).callback_data).toBe('cb_contact_support');
      expect(rows[4][1].text).toContain('Back Home');
      expect((rows[4][1] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('4. Help & FAQ Center', () => {
    it('builds Help Keyboard with 2FA guide, payment guide, and admin contact', () => {
      const kb = buildMainHelpKeyboard('UchiroSupport', 'km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(4);
      expect(rows[0][0].text).toContain('2FA Authenticator Guide');
      expect((rows[0][0] as any).callback_data).toBe('cb_guide_2fa');
      expect(rows[1][0].text).toContain('How to Pay with KHQR');
      expect((rows[1][0] as any).callback_data).toBe('cb_guide_payment');
      expect(rows[2][0].text).toContain('Contact Support');
      expect((rows[2][0] as any).url).toBe('https://t.me/UchiroSupport');
      expect(rows[3][0].text).toContain('Back Home');
      expect((rows[3][0] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('5. Real-Time Gacha In-Chat Module', () => {
    it('fetches live pool information and user ticket balance', async () => {
      const info = await fetchGachaLiveInfo(TEST_TG_ID);
      expect(info.ticket_price_pts).toBe(100);
      expect(info.top_mythical_item).toBeDefined();
      expect(info.mythical_drop_rate).toBeGreaterThan(0);
    });

    it('builds Gacha keyboard with ticket purchase, prizes list, and odds', () => {
      const kb = buildGachaKeyboard('https://uchiro.store', 'km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(3);
      expect(rows[0][0].text).toContain('Exchange Points for Ticket');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_buy_ticket');
      expect(rows[0][1].text).toContain('View All Prizes');
      expect((rows[0][1] as any).callback_data).toBe('cb_gacha_prizes');
      expect(rows[1][0].text).toContain('Drop Rates');
      expect((rows[1][0] as any).callback_data).toBe('cb_gacha_odds');
    });
  });

  describe('6. Real-Time Daily Points & Streak Claim Logic', () => {
    it('formats countdown seconds accurately into HH:MM:SS', () => {
      expect(formatCooldownSeconds(3665)).toBe('01:01:05');
      expect(formatCooldownSeconds(86400)).toBe('24:00:00');
      expect(formatCooldownSeconds(0)).toBe('00:00:00');
    });

    it('enforces rolling 24-hour claim cooldown and awards points on initial claim', async () => {
      // 1. Initial status - can claim
      const info1 = await fetchDailyLiveInfo(TEST_TG_ID);
      expect(info1.is_claimable).toBe(true);

      // 2. Perform claim
      const claimResult = DataStore.claimDailyReward(TEST_TG_ID);
      expect(claimResult.success).toBe(true);
      expect(claimResult.pointsAwarded).toBe(5);
      expect(claimResult.streak).toBe(1);

      // 3. Second claim attempt within 24h must be blocked by rolling server lock
      const claimResult2 = DataStore.claimDailyReward(TEST_TG_ID);
      expect(claimResult2.success).toBe(false);
      expect(claimResult2.error).toBe('ALREADY_CLAIMED_TODAY');
      expect(claimResult2.seconds_remaining).toBeGreaterThan(0);

      // 4. Daily live info reflects cooldown
      const info2 = await fetchDailyLiveInfo(TEST_TG_ID);
      expect(info2.is_claimable).toBe(false);
      expect(info2.seconds_remaining).toBeGreaterThan(0);
    });

    it('builds dynamic Daily Keyboard showing claim or cooldown state', () => {
      const claimableKb = buildDailyKeyboard(true, 'km');
      expect(claimableKb.reply_markup.inline_keyboard[0][0].text).toContain('Claim Daily');
      expect((claimableKb.reply_markup.inline_keyboard[0][0] as any).callback_data).toBe('cb_claim_daily_instant');

      const cooldownKb = buildDailyKeyboard(false, 'km');
      expect(cooldownKb.reply_markup.inline_keyboard[0][0].text).toContain('Cooldown');
      expect((cooldownKb.reply_markup.inline_keyboard[0][0] as any).callback_data).toBe('cb_noop');
    });
  });

  describe('7. Account Vault & Live 2FA Generator', () => {
    it('delivers and queries accounts by customer Telegram ID without hardcoded fallbacks', async () => {
      // Deliver a test account
      DataStore.recordDeliveredAccount({
        telegram_id: TEST_TG_ID,
        order_code: 'TESTORD-77',
        game_title: 'Blox Fruits Mythical',
        username: 'dragon_master',
        password: 'SecretPassword99!',
        two_factor_secret: 'JBSWY3DPEHPK3PXP',
        backup_codes: ['112233', '445566'],
        notes: 'Max Level 2550 + Kitsune',
      });

      const accounts = await getCustomerDeliveredAccounts(TEST_TG_ID);
      expect(accounts.length).toBeGreaterThan(0);
      const acc = accounts[0];
      expect(acc.game_title).toBe('Blox Fruits Mythical');
      expect(acc.username).toBe('dragon_master');
      expect(acc.two_factor_secret).toBe('JBSWY3DPEHPK3PXP');

      const single = await getCustomerDeliveredAccountById(TEST_TG_ID, acc.account_id);
      expect(single).toBeDefined();
      expect(single?.password).toBe('SecretPassword99!');
    });
  });
});
