import { describe, it, expect, beforeEach, vi } from 'vitest';
import { IpSecurityService } from '../security/ip-security.service';
import { RobuxService } from '../services/robux.service';
import { AnnouncementService } from '../services/announcement.service';
import { TELEGRAM_EMOJIS, enrichWithTgEmojis, renderTgEmoji } from '../config/telegram-emojis';
import { stripLeadingEmoji, makeButton } from '../bots/store-bot/keyboards';

describe('Security, Robux Shared Pool & Group Announcement Test Suite', () => {
  beforeEach(() => {
    IpSecurityService._resetForTesting();
    RobuxService._resetForTesting(1000, 3.50);
    AnnouncementService._resetForTesting();
  });

  // =========================================================================
  // 1. TELEGRAM CUSTOM EMOJI & BUTTON COMPLIANCE (Phase 2)
  // =========================================================================
  describe('Phase 2 — Telegram Custom Emoji Integrity', () => {
    it('should have fallbacks and valid keys for every defined emoji', () => {
      for (const [key, def] of Object.entries(TELEGRAM_EMOJIS)) {
        expect(def.fallback, `Emoji ${key} must have a fallback`).toBeTruthy();
        expect(typeof def.fallback).toBe('string');
        if (def.customEmojiId) {
          expect(def.customEmojiId.trim().length).toBeGreaterThan(0);
        }
      }
    });

    it('should cleanly strip leading emoji characters from button labels', () => {
      expect(stripLeadingEmoji('🛍️ Open Store')).toBe('Open Store');
      expect(stripLeadingEmoji('🔑 Get 2FA Code')).toBe('Get 2FA Code');
      expect(stripLeadingEmoji('🎁 Claim Points')).toBe('Claim Points');
      expect(stripLeadingEmoji('Plain Label')).toBe('Plain Label');
    });

    it('should create buttons with icon_custom_emoji_id and hidden __fallback property', () => {
      const btn = makeButton('callback', '🛍️ Open Store', 'cb_open_store', 'PACKAGE');
      expect(btn.text).toBe('🛍️ Open Store');
      expect(btn.callback_data).toBe('cb_open_store');
      // icon_custom_emoji_id should be set from PACKAGE definition
      if (TELEGRAM_EMOJIS.PACKAGE.customEmojiId) {
        expect(btn.icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.PACKAGE.customEmojiId);
      }
      // __fallback must be defined non-enumerable
      expect((btn as any).__fallback).toBe(TELEGRAM_EMOJIS.PACKAGE.fallback);
    });

    it('should enrich text with custom Telegram emojis without breaking plain text', () => {
      const rendered = renderTgEmoji('FIRE', '🔥');
      expect(rendered).toContain('emoji-id=');
      expect(rendered).toContain(TELEGRAM_EMOJIS.FIRE.customEmojiId);

      const enriched = enrichWithTgEmojis('Congratulations! 💎 Claim your prize');
      expect(enriched).toContain('emoji-id=');
      expect(enriched).toContain(TELEGRAM_EMOJIS.DIAMOND.customEmojiId);
    });
  });

  // =========================================================================
  // 2. IP SECURITY, BRUTE-FORCE DEFENSE & AUTO-BLOCK (Phase 3)
  // =========================================================================
  describe('Phase 3 — IP Security & Automated Brute-Force Rate Limiter', () => {
    it('should correctly normalize IPv4 and IPv6 mapped addresses', () => {
      expect(IpSecurityService.normalizeIp('192.168.1.50')).toBe('192.168.1.50');
      expect(IpSecurityService.normalizeIp('::ffff:192.168.1.50')).toBe('192.168.1.50');
      expect(IpSecurityService.normalizeIp('2001:0db8:85a3::8a2e:0370:7334')).toBe(
        '2001:0db8:85a3::8a2e:0370:7334'
      );
      expect(IpSecurityService.normalizeIp('127.0.0.1, 10.0.0.1')).toBe('127.0.0.1');
    });

    it('should track failed attempts and trigger auto-ban after threshold', async () => {
      const testIp = '203.0.113.42';

      // Record 4 failed attempts (threshold is 5)
      for (let i = 1; i <= 4; i++) {
        const res = await IpSecurityService.recordFailedAttempt(testIp);
        expect(res.blocked).toBe(false);
        expect(res.remainingAttempts).toBe(5 - i);
      }

      // 5th failed attempt triggers automated IP block
      const fifthRes = await IpSecurityService.recordFailedAttempt(testIp);
      expect(fifthRes.blocked).toBe(true);
      expect(fifthRes.remainingAttempts).toBe(0);

      // Verify that IP is now recognized as blocked
      const checkStatus = IpSecurityService.isIpBlocked(testIp);
      expect(checkStatus.blocked).toBe(true);
      expect(checkStatus.retryAfterSeconds).toBeGreaterThan(0);
      expect(checkStatus.reason).toContain('Exceeded maximum failed attempts');

      // Async check should also reflect blocked status
      const asyncStatus = await IpSecurityService.isIpBlockedAsync(testIp);
      expect(asyncStatus.blocked).toBe(true);
    });

    it('should clear failed attempts upon successful login', async () => {
      const testIp = '203.0.113.43';

      await IpSecurityService.recordFailedAttempt(testIp);
      await IpSecurityService.recordFailedAttempt(testIp);
      expect(IpSecurityService.isIpBlocked(testIp).blocked).toBe(false);

      await IpSecurityService.recordSuccessfulLogin(testIp, 'Mozilla/5.0');
      const freshStatus = await IpSecurityService.recordFailedAttempt(testIp);
      expect(freshStatus.remainingAttempts).toBe(4); // Reset to 1 attempt counted
    });

    it('should support manual administrative block and unban', async () => {
      const targetIp = '198.51.100.99';

      const blockRecord = await IpSecurityService.applyBlock({
        ip: targetIp,
        reason: 'Malicious automated attack',
        isPermanent: true,
        adminUser: 'security_officer',
      });

      expect(blockRecord.is_permanent).toBe(true);
      expect(IpSecurityService.isIpBlocked(targetIp).blocked).toBe(true);
      expect(IpSecurityService.isIpBlocked(targetIp).isPermanent).toBe(true);

      // Unban
      await IpSecurityService.unbanIp(targetIp, 'security_officer');
      expect(IpSecurityService.isIpBlocked(targetIp).blocked).toBe(false);
    });
  });

  // =========================================================================
  // 3. SHARED ROBUX STOCK POOL CALCULATIONS & RESERVATIONS (Phase 4)
  // =========================================================================
  describe('Phase 4 — Shared Robux Stock Pool & Pack Calculations', () => {
    it('Specification Test A: Total available = 1,000 Robux', async () => {
      // Set pool to 1,000 Robux
      await RobuxService.setStock('admin1', 1000, 'Initial restock');
      const stock = await RobuxService.getStockConfig();
      const tiers = RobuxService.calculateTiers(stock);

      const t100 = tiers.find((t) => t.denomination === 100);
      const t200 = tiers.find((t) => t.denomination === 200);
      const t1000 = tiers.find((t) => t.denomination === 1000);
      const t2000 = tiers.find((t) => t.denomination === 2000);

      // 100 Robux shows stock 10
      expect(t100?.available_packs).toBe(10);
      expect(t100?.is_sold_out).toBe(false);

      // 200 Robux shows stock 5
      expect(t200?.available_packs).toBe(5);
      expect(t200?.is_sold_out).toBe(false);

      // 1,000 Robux shows stock 1
      expect(t1000?.available_packs).toBe(1);
      expect(t1000?.is_sold_out).toBe(false);

      // 2,000 Robux and higher show SOLD OUT
      expect(t2000?.available_packs).toBe(0);
      expect(t2000?.is_sold_out).toBe(true);
      expect(t2000?.display_text).toContain('SOLD OUT');
    });

    it('Specification Test B: Pool becomes 900 after one 100-Robux fulfillment', async () => {
      await RobuxService.setStock('admin1', 1000, 'Test setup');

      // Create order for 100 Robux
      const orderRes = await RobuxService.createOrder({
        telegramId: '12345678',
        robloxUsername: 'test_player',
        robuxAmount: 100,
      });

      expect(orderRes.success).toBe(true);
      const orderCode = orderRes.order!.order_code;

      // While pending, reservation is active: available is 900
      let stock = await RobuxService.getStockConfig();
      let tiers = RobuxService.calculateTiers(stock);
      let t100 = tiers.find((t) => t.denomination === 100);
      expect(t100?.available_packs).toBe(9);

      // Fulfill order
      const fulfilled = await RobuxService.commitFulfillment(orderCode, 'admin1');
      expect(fulfilled).toBe(true);

      stock = await RobuxService.getStockConfig();
      expect(stock.total_balance).toBe(900);
      expect(stock.reserved_balance).toBe(0);

      tiers = RobuxService.calculateTiers(stock);
      t100 = tiers.find((t) => t.denomination === 100);
      const t200 = tiers.find((t) => t.denomination === 200);
      const t1000 = tiers.find((t) => t.denomination === 1000);

      // 100 Robux shows stock 9
      expect(t100?.available_packs).toBe(9);
      // 200 Robux shows stock 4
      expect(t200?.available_packs).toBe(4);
      // 1,000 Robux shows stock 0 (sold out)
      expect(t1000?.available_packs).toBe(0);
      expect(t1000?.is_sold_out).toBe(true);
    });

    it('should safely release reservation if order is cancelled', async () => {
      await RobuxService.setStock('admin1', 500, 'Initial setup');

      const orderRes = await RobuxService.createOrder({
        telegramId: '87654321',
        robloxUsername: 'buyer_two',
        robuxAmount: 400,
      });

      expect(orderRes.success).toBe(true);
      const orderCode = orderRes.order!.order_code;

      // Available should be 100
      let stock = await RobuxService.getStockConfig();
      expect(stock.total_balance - stock.reserved_balance).toBe(100);

      // Cancel order
      await RobuxService.releaseReservation(orderCode);

      // Available should be restored to 500
      stock = await RobuxService.getStockConfig();
      expect(stock.total_balance - stock.reserved_balance).toBe(500);
    });

    it('should reject reservations exceeding available pool', async () => {
      await RobuxService.setStock('admin1', 200, 'Small pool');

      const orderRes = await RobuxService.createOrder({
        telegramId: '11112222',
        robloxUsername: 'greedy_buyer',
        robuxAmount: 400, // 400 > 200 available
      });

      expect(orderRes.success).toBe(false);
      expect(orderRes.error).toBe('INSUFFICIENT_ROBUX_STOCK');
    });
  });

  // =========================================================================
  // 4. TELEGRAM GROUP ANNOUNCEMENTS (Phase 5)
  // =========================================================================
  describe('Phase 5 — Telegram Store Group Automated Announcements', () => {
    it('should format announcement with rich text and Buy Here button', () => {
      const { text, keyboard } = AnnouncementService.formatAnnouncement('new_product', {
        productTitle: 'Roblox Blox Fruits Account (Max Lv)',
        priceUsd: 15.00,
        stockCount: 3,
        productId: 'prod_123',
      });

      expect(text).toContain('NEW ARRIVAL');
      expect(text).toContain('Blox Fruits Account');
      expect(text).toContain('$15.00');
      expect(text).toContain('3 available');

      // Check inline button
      const buttons = keyboard.reply_markup.inline_keyboard[0];
      expect(buttons[0].text).toContain('Buy Here');
      expect(buttons[0].url).toContain('t.me');
    });

    it('should mask buyer names for privacy in order announcements', () => {
      expect(AnnouncementService.maskBuyerName('Noreak')).toBe('Nor####');
      expect(AnnouncementService.maskBuyerName('@chann_s')).toBe('cha####');
      expect(AnnouncementService.maskBuyerName('Jo')).toBe('J###');
      expect(AnnouncementService.maskBuyerName('')).toBe('Customer####');
    });

    it('should prevent duplicate announcements for identical event IDs', async () => {
      const mockBot = {
        telegram: {
          sendMessage: vi.fn().mockResolvedValue({ message_id: 9999 }),
        },
      };

      await AnnouncementService.updateSettings({ target_chat_id: '-1001234567890' });

      // First publication
      const res1 = await AnnouncementService.publishAnnouncement(
        mockBot,
        'order_success',
        'event_order_1001',
        { productTitle: 'Account X', buyerName: 'Noreak' }
      );
      expect(res1.success).toBe(true);
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);

      // Duplicate publication attempt
      const res2 = await AnnouncementService.publishAnnouncement(
        mockBot,
        'order_success',
        'event_order_1001',
        { productTitle: 'Account X', buyerName: 'Noreak' }
      );
      expect(res2.success).toBe(true);
      expect(res2.error).toBe('ALREADY_ANNOUNCED');
      // Should not have called sendMessage a second time
      expect(mockBot.telegram.sendMessage).toHaveBeenCalledTimes(1);
    });
  });
});
