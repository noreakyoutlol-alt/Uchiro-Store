import { describe, it, expect, beforeEach } from 'vitest';
import { DataStore } from '../database/data-store';
import {
  buildMainMenuKeyboard,
  buildProfileKeyboard,
  buildPointsLedgerKeyboard,
  buildRedeemPointsKeyboard,
  buildMainRulesKeyboard,
  buildSubRulesKeyboard,
  buildMainHelpKeyboard,
  buildSubHelpKeyboard,
  buildHowToBuyKeyboard,
  buildKhqrGuideKeyboard,
  buildGachaKeyboard,
  buildSubGachaKeyboard,
  buildDailyKeyboard,
  buildDailyShopKeyboard,
  buildVaultMenuKeyboard,
  buildEmptyVaultKeyboard,
  buildVaultListKeyboard,
  buildAccountDetailKeyboard,
  buildTwoFactorKeyboard,
  buildOrdersMenuKeyboard,
  buildOrderHistoryKeyboard,
} from '../bots/store-bot/keyboards';
import { handleHowToBuy, handleGuideStepByStep, handleGuideKhqr } from '../bots/store-bot/handlers/help';
import { handleVaultDashboard, handleVault2fa, handleVaultAccounts } from '../bots/store-bot/handlers/vault';
import { handleOrdersTrack } from '../bots/store-bot/handlers/orders';
import { handleGachaPrizes, handleGachaOdds } from '../bots/store-bot/handlers/gacha';
import { FulfillmentService } from '../services/fulfillment.service';

describe('Telegram Bot Buttons & Message Localization', () => {
  const KHMER_CHAR_REGEX = /[ក-៿]/;

  beforeEach(() => {
    DataStore.setUserLanguagePreference(11223344, 'km');
    DataStore.setUserLanguagePreference(55667788, 'en');
  });

  describe('1. Button Labels are 100% English (Never Khmer)', () => {
    function extractButtonTexts(keyboard: any): string[] {
      const rows = keyboard?.reply_markup?.inline_keyboard || keyboard?.inline_keyboard || [];
      const texts: string[] = [];
      for (const row of rows) {
        for (const btn of row) {
          if (btn?.text) texts.push(btn.text);
        }
      }
      return texts;
    }

    it('buildMainMenuKeyboard has English labels with no Khmer characters', () => {
      const buttons = extractButtonTexts(buildMainMenuKeyboard());
      expect(buttons.length).toBeGreaterThan(0);
      for (const text of buttons) {
        // Exclude Cambodia flag emoji if present, but the word itself is English
        const cleanText = text.replace(/🇰🇭/g, '').trim();
        expect(cleanText).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(buttons.some((b) => b.includes('Open Store'))).toBe(true);
      expect(buttons.some((b) => b.includes('Buy Robux'))).toBe(true);
      expect(buttons.some((b) => b.includes('Get 2FA Code'))).toBe(true);
      expect(buttons.some((b) => b.includes('How to Buy & Pay'))).toBe(true);
    });

    it('buildProfileKeyboard has English labels in both Khmer and English modes', () => {
      const buttonsKm = extractButtonTexts(buildProfileKeyboard(undefined, 'km'));
      const buttonsEn = extractButtonTexts(buildProfileKeyboard(undefined, 'en'));

      for (const text of [...buttonsKm, ...buttonsEn]) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(buttonsKm.some((b) => b.includes('Points Ledger'))).toBe(true);
      expect(buttonsKm.some((b) => b.includes('Redeem Points'))).toBe(true);
      expect(buttonsKm.some((b) => b.includes('View Vault & Accounts'))).toBe(true);
      expect(buttonsKm.some((b) => b.includes('Back Home'))).toBe(true);
    });

    it('buildMainRulesKeyboard has English labels', () => {
      const buttons = extractButtonTexts(buildMainRulesKeyboard('km'));
      for (const text of buttons) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(buttons.some((b) => b.includes('Gacha Rules'))).toBe(true);
      expect(buttons.some((b) => b.includes('Daily Streak Rules'))).toBe(true);
      expect(buttons.some((b) => b.includes('14-Day Warranty Policy'))).toBe(true);
      expect(buttons.some((b) => b.includes('Payment & Delivery'))).toBe(true);
      expect(buttons.some((b) => b.includes('Refund Policy'))).toBe(true);
      expect(buttons.some((b) => b.includes('Back Home'))).toBe(true);
    });

    it('buildGachaKeyboard & buildSubGachaKeyboard have English labels', () => {
      const buttons = extractButtonTexts(buildGachaKeyboard(undefined, 'km'));
      for (const text of buttons) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(buttons.some((b) => b.includes('Exchange Points for Ticket'))).toBe(true);
      expect(buttons.some((b) => b.includes('View All Prizes'))).toBe(true);
      expect(buttons.some((b) => b.includes('Drop Rates'))).toBe(true);
      expect(buttons.some((b) => b.includes('Gacha Rules'))).toBe(true);
      expect(buttons.some((b) => b.includes('Back Home'))).toBe(true);
    });

    it('buildDailyKeyboard & buildDailyShopKeyboard have English labels', () => {
      const buttons = extractButtonTexts(buildDailyKeyboard(true, 'km'));
      for (const text of buttons) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(buttons.some((b) => b.includes('Claim Daily Points Now'))).toBe(true);
      expect(buttons.some((b) => b.includes('Daily Streak Rules'))).toBe(true);
      expect(buttons.some((b) => b.includes('Points Rewards Shop'))).toBe(true);
      expect(buttons.some((b) => b.includes('Back Home'))).toBe(true);
    });

    it('buildVaultMenuKeyboard, buildTwoFactorKeyboard & buildAccountDetailKeyboard have English labels', () => {
      const vaultBtns = extractButtonTexts(buildVaultMenuKeyboard('km'));
      const twoFaBtns = extractButtonTexts(buildTwoFactorKeyboard('acc_1', 'km'));
      for (const text of [...vaultBtns, ...twoFaBtns]) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(vaultBtns.some((b) => b.includes('Request Live 2FA OTP'))).toBe(true);
      expect(twoFaBtns.some((b) => b.includes('Refresh 2FA Code'))).toBe(true);
    });

    it('buildOrdersMenuKeyboard & buildOrderHistoryKeyboard have English labels', () => {
      const orderBtns = extractButtonTexts(buildOrdersMenuKeyboard(undefined, 'km'));
      const histBtns = extractButtonTexts(buildOrderHistoryKeyboard(undefined, 'km'));
      for (const text of [...orderBtns, ...histBtns]) {
        expect(text).not.toMatch(KHMER_CHAR_REGEX);
      }
      expect(orderBtns.some((b) => b.includes('Recent Orders'))).toBe(true);
      expect(orderBtns.some((b) => b.includes('Track Order'))).toBe(true);
      expect(histBtns.some((b) => b.includes('Back to Orders'))).toBe(true);
    });
  });

  describe('2. Button Destination Explanatory Messages Localize to Natural Khmer', () => {
    function createMockCtx(userId: number) {
      let sentText = '';
      let sentKeyboard: any = null;
      return {
        from: { id: userId, username: 'testuser' },
        callbackQuery: { data: 'test_cb' },
        answerCbQuery: async () => true,
        editMessageText: async (text: string, opts?: any) => {
          sentText = text;
          sentKeyboard = opts;
          return true;
        },
        reply: async (text: string, opts?: any) => {
          sentText = text;
          sentKeyboard = opts;
          return true;
        },
        getSentText: () => sentText,
        getSentKeyboard: () => sentKeyboard,
      };
    }

    it('handleHowToBuy sends Khmer text when Khmer selected, English when English selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleHowToBuy(ctxKm as any);
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('របៀបទិញ និងទូទាត់ប្រាក់នៅ UCHIRO STORE');

      const ctxEn = createMockCtx(55667788);
      await handleHowToBuy(ctxEn as any);
      expect(ctxEn.getSentText()).not.toMatch(KHMER_CHAR_REGEX);
      expect(ctxEn.getSentText()).toContain('HOW TO BUY &amp; PAY AT UCHIRO STORE');
    });

    it('handleGuideStepByStep sends natural Khmer text when Khmer selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleGuideStepByStep(ctxKm as any);
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('ការណែនាំអំពីការបញ្ជាទិញជាជំហានៗ');

      const ctxEn = createMockCtx(55667788);
      await handleGuideStepByStep(ctxEn as any);
      expect(ctxEn.getSentText()).toContain('STEP-BY-STEP PURCHASE GUIDE');
    });

    it('handleGuideKhqr sends natural Khmer text when Khmer selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleGuideKhqr(ctxKm as any);
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('របៀបទូទាត់ប្រាក់តាម BAKONG KHQR លើទូរស័ព្ទដៃតែមួយ');
    });

    it('handleVaultDashboard sends natural Khmer text when Khmer selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleVaultDashboard(ctxKm as any, 'https://store.uchiro.store');
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('កាតាបឥវ៉ាន់');
    });

    it('handleVault2fa empty state sends natural Khmer text when Khmer selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleVault2fa(ctxKm as any, 'https://store.uchiro.store');
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('ប្រព័ន្ធបង្កើតកូដ 2FA LIVE');
    });

    it('handleOrdersTrack sends natural Khmer text when Khmer selected', async () => {
      const ctxKm = createMockCtx(11223344);
      await handleOrdersTrack(ctxKm as any);
      expect(ctxKm.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm.getSentText()).toContain('តាមដានការបញ្ជាទិញរបស់អ្នក');
    });

    it('handleGachaPrizes and handleGachaOdds send natural Khmer text when Khmer selected', async () => {
      const ctxKm1 = createMockCtx(11223344);
      await handleGachaPrizes(ctxKm1 as any);
      expect(ctxKm1.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm1.getSentText()).toContain('បញ្ជីរង្វាន់កាឆា');

      const ctxKm2 = createMockCtx(11223344);
      await handleGachaOdds(ctxKm2 as any);
      expect(ctxKm2.getSentText()).toMatch(KHMER_CHAR_REGEX);
      expect(ctxKm2.getSentText()).toContain('តារាងឱកាសឈ្នះរង្វាន់កាឆា');
    });

    it('FulfillmentService localized sub-screens render natural Khmer for Khmer language', () => {
      const order = DataStore.saveOrder({
        id: 'ord_test_fulfillment_1',
        order_number: 'ORD-TEST-FULFILL-1',
        telegram_id: 11223344,
        total_amount: 15.0,
        status: 'delivered',
        product_title: 'Blox Fruits Account',
        delivery_mode: 'auto_account',
        delivery_credentials: [
          {
            account_id: 'acc_123',
            username: 'UchiroPlayer',
            password: 'secretPassword123',
            two_factor: 'JBSWY3DPEHPK3PXP',
          },
        ],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      } as any);

      const deliveryCardKm = FulfillmentService.getMainDeliveryCardText(order.id, 'km');
      expect(deliveryCardKm).toMatch(KHMER_CHAR_REGEX);
      expect(deliveryCardKm).toContain('ការប្រគល់គណនី');

      const warrantyKm = FulfillmentService.getWarrantySubScreen(order.id, 'km');
      expect(warrantyKm.text).toMatch(KHMER_CHAR_REGEX);
      expect(warrantyKm.text).toContain('ការធានា និងការការពារគណនី');
    });
  });
});
