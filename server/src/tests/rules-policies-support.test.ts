import { describe, it, expect, vi } from 'vitest';
import {
  buildMainRulesKeyboard,
  buildSubRulesKeyboard,
  getLanguageSelectionKeyboard,
} from '../bots/store-bot/keyboards';
import {
  handleMainRules,
  handleGachaRules,
  handleDailyRules,
  handleWarrantyPolicy,
  handlePaymentDeliveryPolicy,
  handleRefundPolicy,
  handlePointsCouponsPolicy,
  handleFaqHelp,
  handleContactSupport,
  handleBackToRules,
} from '../bots/store-bot/handlers/rules';
import { Context } from 'telegraf';

function createMockContext(userId: number = 999888777): {
  ctx: Context;
  answeredCbQuery: boolean;
  replies: { text: string; options?: any }[];
  edits: { text: string; options?: any }[];
} {
  const replies: { text: string; options?: any }[] = [];
  const edits: { text: string; options?: any }[] = [];
  let answeredCbQuery = false;

  const ctx = {
    from: { id: userId, username: 'testuser', first_name: 'Test' },
    chat: { id: userId, type: 'private' },
    callbackQuery: { data: 'cb_test' },
    answerCbQuery: vi.fn(async () => {
      answeredCbQuery = true;
      return true;
    }),
    reply: vi.fn(async (text: string, options?: any) => {
      replies.push({ text, options });
      return { message_id: 123 };
    }),
    editMessageText: vi.fn(async (text: string, options?: any) => {
      edits.push({ text, options });
      return true;
    }),
  } as unknown as Context;

  return { ctx, answeredCbQuery, replies, edits };
}

describe('Rules, Policies & Official Support Verification Suite', () => {
  describe('1. Main Rules Keyboard Layout & Callbacks', () => {
    it('builds exactly 5 rows with 100% English button labels and correct callbacks', () => {
      const kb = buildMainRulesKeyboard('en');
      const rows = kb.reply_markup.inline_keyboard;

      expect(rows.length).toBe(5);

      // Row 1: Gacha Rules | Daily Streak Rules
      expect(rows[0][0].text).toContain('Gacha Rules');
      expect((rows[0][0] as any).callback_data).toBe('cb_gacha_rules');
      expect(rows[0][1].text).toContain('Daily Streak Rules');
      expect((rows[0][1] as any).callback_data).toBe('cb_daily_rules');

      // Row 2: 14-Day Warranty Policy
      expect(rows[1][0].text).toContain('14-Day Warranty Policy');
      expect((rows[1][0] as any).callback_data).toBe('cb_warranty_policy');

      // Row 3: Payment & Delivery | Refund Policy
      expect(rows[2][0].text).toContain('Payment & Delivery');
      expect((rows[2][0] as any).callback_data).toBe('cb_payment_delivery');
      expect(rows[2][1].text).toContain('Refund Policy');
      expect((rows[2][1] as any).callback_data).toBe('cb_refund_policy');

      // Row 4: Points & Coupons | FAQ & Help
      expect(rows[3][0].text).toContain('Points & Coupons');
      expect((rows[3][0] as any).callback_data).toBe('cb_points_coupons');
      expect(rows[3][1].text).toContain('FAQ & Help');
      expect((rows[3][1] as any).callback_data).toBe('cb_faq_help');

      // Row 5: Contact Support | Back Home
      expect(rows[4][0].text).toContain('Contact Support');
      expect((rows[4][0] as any).callback_data).toBe('cb_contact_support');
      expect(rows[4][1].text).toContain('Back Home');
      expect((rows[4][1] as any).callback_data).toBe('cb_main_menu');
    });

    it('ensures no duplicate emoji icons on any rule buttons', () => {
      const kb = buildMainRulesKeyboard('en');
      const rows = kb.reply_markup.inline_keyboard;

      for (const row of rows) {
        for (const btn of row) {
          // Verify no repeated emojis like 🎰 🎰 or 📦 📦
          const matchDouble = btn.text.match(/^(\p{Emoji}+)\s*\1/u);
          expect(matchDouble).toBeNull();
        }
      }
    });

    it('builds Sub-Rules Keyboard with Back to Rules and Back Home navigation', () => {
      const kb = buildSubRulesKeyboard('en');
      const rows = kb.reply_markup.inline_keyboard;

      expect(rows.length).toBe(1);
      expect(rows[0][0].text).toContain('Back to Rules');
      expect((rows[0][0] as any).callback_data).toBe('cb_main_rules');
      expect(rows[0][1].text).toContain('Back Home');
      expect((rows[0][1] as any).callback_data).toBe('cb_main_menu');
    });
  });

  describe('2. Rules Handlers Execution & Content Verification', () => {
    it('handleMainRules renders store warranty overview and main rules keyboard', async () => {
      const { ctx, edits } = createMockContext();
      await handleMainRules(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('UCHIRO STORE GENERAL RULES');
      expect(edits[0].text).toContain('14-Day Warranty');
      expect(edits[0].options?.reply_markup?.inline_keyboard?.length).toBe(5);
    });

    it('handleGachaRules renders gacha drop rates and probabilities', async () => {
      const { ctx, edits } = createMockContext();
      await handleGachaRules(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('GACHA RULES &amp; DROP RATES');
      expect(edits[0].text).toContain('100 Pts');
      expect(edits[0].text).toContain('Mythical');
      expect(edits[0].options?.reply_markup?.inline_keyboard?.length).toBe(1);
    });

    it('handleDailyRules renders streak bonuses and 48-hour reset rule', async () => {
      const { ctx, edits } = createMockContext();
      await handleDailyRules(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('DAILY REWARD &amp; STREAK RULES');
      expect(edits[0].text).toContain('24-hour rolling cooldown');
      expect(edits[0].text).toContain('+20 Pts');
    });

    it('handleWarrantyPolicy renders 14-day warranty coverage and replacement process', async () => {
      const { ctx, edits } = createMockContext();
      await handleWarrantyPolicy(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('14-DAY FULL WARRANTY POLICY');
      expect(edits[0].text).toContain('100% Protection');
      expect(edits[0].text).toContain('14 days from delivery');
    });

    it('handlePaymentDeliveryPolicy renders accepted payment methods and digital delivery speeds', async () => {
      const { ctx, edits } = createMockContext();
      await handlePaymentDeliveryPolicy(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('PAYMENT &amp; DELIVERY POLICY');
      expect(edits[0].text).toContain('Bakong KHQR');
      expect(edits[0].text).toContain('Instant Digital Delivery');
    });

    it('handleRefundPolicy renders refund criteria and non-refundable terms', async () => {
      const { ctx, edits } = createMockContext();
      await handleRefundPolicy(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('REFUND &amp; REPLACEMENT POLICY');
      expect(edits[0].text).toContain('100% Refund');
    });

    it('handlePointsCouponsPolicy renders earn rates, gacha tickets, and voucher exchange', async () => {
      const { ctx, edits } = createMockContext();
      await handlePointsCouponsPolicy(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('POINTS &amp; COUPONS POLICY');
      expect(edits[0].text).toContain('100 Points');
      expect(edits[0].text).toContain('Mythical Gacha Ticket');
    });

    it('handleFaqHelp renders common questions and answers', async () => {
      const { ctx, edits } = createMockContext();
      await handleFaqHelp(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('FREQUENTLY ASKED QUESTIONS');
      expect(edits[0].text).toContain('How quickly do I get my account?');
    });

    it('handleContactSupport renders official support link https://t.me/uchirosupport and action button', async () => {
      const { ctx, edits } = createMockContext();
      await handleContactSupport(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('CONTACT 24/7 SUPPORT');
      expect(edits[0].text).toContain('https://t.me/uchirosupport');
      expect(edits[0].text).toContain('@UchiroSupport');

      const kb = edits[0].options?.reply_markup?.inline_keyboard;
      expect(kb).toBeDefined();
      expect(kb[0][0].text).toContain('Open @UchiroSupport');
      expect(kb[0][0].url).toBe('https://t.me/uchirosupport');
      expect(kb[1][0].callback_data).toBe('cb_main_rules');
      expect(kb[1][1].callback_data).toBe('cb_main_menu');
    });

    it('handleBackToRules navigates smoothly back to main rules', async () => {
      const { ctx, edits } = createMockContext();
      await handleBackToRules(ctx);

      expect(edits.length).toBe(1);
      expect(edits[0].text).toContain('UCHIRO STORE GENERAL RULES');
    });
  });

  describe('3. Language Selection Dual-Option Requirement', () => {
    it('provides both Khmer and English options exclusively in English with custom icons', () => {
      const kb = getLanguageSelectionKeyboard('km');
      const rows = kb.reply_markup.inline_keyboard;

      expect(rows.length).toBe(2);
      expect(rows[0][0].text).toBe('Khmer');
      expect((rows[0][0] as any).icon_custom_emoji_id).toBe('5294018354527353443');
      expect((rows[0][0] as any).callback_data).toBe('set_lang:km');
      expect(rows[0][1].text).toBe('English');
      expect((rows[0][1] as any).icon_custom_emoji_id).toBe('5458416160586342331');
      expect((rows[0][1] as any).callback_data).toBe('set_lang:en');
      // Visible button text contains no Khmer characters
      const allText = rows.flatMap((r) => r.map((b) => b.text)).join(' ');
      expect(/[ក-៿]/.test(allText)).toBe(false);
    });
  });
});
