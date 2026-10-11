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
    it('builds exactly 5 rows in Khmer with clean singular emojis and single WebApp button', () => {
      const keyboard = getMainMenuKeyboard('https://uchiro.store', 'km', 'UchiroSupport');
      const rows = keyboard.reply_markup.inline_keyboard;

      expect(rows.length).toBe(5);

      // Verify no radioactive emoji anywhere
      const allText = rows.flatMap((r) => r.map((b) => b.text)).join(' ');
      expect(allText).not.toContain('☢️');
      expect(allText).not.toContain('☢');

      // Row 1: Gacha & Daily Points
      expect(rows[0][0].text).toBe('🎰 លេង Gacha');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_menu');
      expect(rows[0][1].text).toBe('🎁 ពិន្ទុប្រចាំថ្ងៃ');
      expect((rows[0][1] as any).callback_data).toBe('cb_daily_menu');

      // Row 2: Vault & Orders
      expect(rows[1][0].text).toBe('🎒 កាតាបឥវ៉ាន់ & Vault');
      expect((rows[1][0] as any).callback_data).toBe('cb_vault_menu');
      expect(rows[1][1].text).toBe('📜 ប្រវត្តិបញ្ជាទិញ');
      expect((rows[1][1] as any).callback_data).toBe('cb_orders_menu');

      // Row 3: Profile & Language
      expect(rows[2][0].text).toBe('👤 ព័ត៌មានគណនី (Profile)');
      expect((rows[2][0] as any).callback_data).toBe('cb_profile_menu');
      expect(rows[2][1].text).toBe('🌐 ភាសា / Language');
      expect((rows[2][1] as any).callback_data).toBe('cb_lang_menu');

      // Row 4: Rules & Help
      expect(rows[3][0].text).toBe('📜 ច្បាប់ទូទៅ (Rules)');
      expect((rows[3][0] as any).callback_data).toBe('cb_main_rules');
      expect(rows[3][1].text).toBe('❓ ជំនួយ & FAQ (Help)');
      expect((rows[3][1] as any).callback_data).toBe('cb_main_help');

      // Row 5: Open Mini App (ONLY WebApp) & Admin Support link
      expect(rows[4][0].text).toBe('🛍️ បើកហាង Mini App (ស្រេចចិត្ត)');
      expect((rows[4][0] as any).web_app?.url).toBe('https://uchiro.store');
      expect(rows[4][1].text).toBe('💬 ឆាតទៅ Admin 24/7');
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

      expect(rows[0][0].text).toBe('🎰 Play Gacha');
      expect(rows[0][1].text).toBe('🎁 Daily Points');
      expect(rows[1][0].text).toBe('🎒 My Vault & Accounts');
      expect(rows[1][1].text).toBe('📜 Order History');
      expect(rows[2][0].text).toBe('👤 My Profile');
      expect(rows[2][1].text).toBe('🌐 Language / ភាសា');
      expect(rows[3][0].text).toBe('📜 Store Rules');
      expect(rows[3][1].text).toBe('❓ Help & FAQ');
      expect(rows[4][0].text).toBe('🛍️ Open Mini App (Optional)');
      expect(rows[4][1].text).toBe('💬 Contact Admin 24/7');
    });

    it('builds Language Selection Keyboard with Khmer and English options', () => {
      const kb = getLanguageSelectionKeyboard('km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(2);
      expect(rows[0][0].text).toBe('🇰🇭 ភាសាខ្មែរ');
      expect((rows[0][0] as any).callback_data).toBe('set_lang:km');
      expect(rows[0][1].text).toBe('🇬🇧 English');
      expect((rows[0][1] as any).callback_data).toBe('set_lang:en');
      expect(rows[1][0].text).toContain('ត្រឡប់ទៅដើម');
      expect((rows[1][0] as any).callback_data).toBe('cb_main_menu');
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
      expect(rows[0][0].text).toContain('ប្រវត្តិពិន្ទុ');
      expect((rows[0][0] as any).callback_data).toBe('cb_points_ledger');
      expect(rows[0][1].text).toContain('ប្តូរពិន្ទុ');
      expect((rows[0][1] as any).callback_data).toBe('cb_redeem_pts');
      expect(rows[1][0].text).toContain('មើលកាតាបឥវ៉ាន់');
      expect((rows[1][0] as any).callback_data).toBe('cb_vault_menu');
      expect(rows[2][1].text).toContain('ត្រឡប់ទៅដើម');
      expect((rows[2][1] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('3. Store Rules & Warranties', () => {
    it('builds Rules sub-menu keyboard with Gacha, Daily, and 14-day warranty options', () => {
      const kb = buildMainRulesKeyboard('km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(3);
      expect(rows[0][0].text).toContain('ច្បាប់ Gacha');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_rules');
      expect(rows[0][1].text).toContain('ច្បាប់ Daily');
      expect((rows[0][1] as any).callback_data).toBe('cb_daily_rules');
      expect(rows[1][0].text).toContain('គោលការណ៍ធានា 14 ថ្ងៃ');
      expect((rows[1][0] as any).callback_data).toBe('cb_warranty_policy');
      expect(rows[2][0].text).toContain('ត្រឡប់ទៅដើម');
      expect((rows[2][0] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('4. Help & FAQ Center', () => {
    it('builds Help Keyboard with 2FA guide, payment guide, and admin contact', () => {
      const kb = buildMainHelpKeyboard('UchiroSupport', 'km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(4);
      expect(rows[0][0].text).toContain('2FA Authenticator');
      expect((rows[0][0] as any).callback_data).toBe('cb_guide_2fa');
      expect(rows[1][0].text).toContain('KHQR');
      expect((rows[1][0] as any).callback_data).toBe('cb_guide_payment');
      expect(rows[2][0].text).toContain('ទាក់ទង Admin');
      expect((rows[2][0] as any).url).toBe('https://t.me/UchiroSupport');
      expect(rows[3][0].text).toContain('ត្រឡប់ទៅដើម');
      expect((rows[3][0] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('5. Real-Time Gacha In-Chat Module', () => {
    it('fetches live pool information and user ticket balance', async () => {
      const info = await fetchGachaLiveInfo(TEST_TG_ID);
      expect(info.ticket_price_pts).toBe(50);
      expect(info.top_mythical_item).toBeDefined();
      expect(info.mythical_drop_rate).toBeGreaterThan(0);
    });

    it('builds Gacha keyboard with ticket purchase, prizes list, and odds', () => {
      const kb = buildGachaKeyboard('https://uchiro.store', 'km');
      const rows = kb.reply_markup.inline_keyboard;
      expect(rows.length).toBe(3);
      expect(rows[0][0].text).toContain('ប្តូរសំបុត្រ');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_buy_ticket');
      expect(rows[0][1].text).toContain('រង្វាន់ទាំងអស់');
      expect((rows[0][1] as any).callback_data).toBe('cb_gacha_prizes');
      expect(rows[1][0].text).toContain('អត្រាឈ្នះ');
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
      expect(claimableKb.reply_markup.inline_keyboard[0][0].text).toContain('ទទួលពិន្ទុភ្លាមៗ');
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
