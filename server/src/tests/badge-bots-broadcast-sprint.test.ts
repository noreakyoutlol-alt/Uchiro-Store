import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { env } from '../config/env';
import { DataStore } from '../database/data-store';
import { formatTelegramHtml, getMainMenuKeyboard, getWelcomeMessage } from '../bots/store-bot';
import { getAdminKeyboard } from '../bots/admin-bot';
import { TELEGRAM_EMOJIS } from '../config/telegram-emojis';
import { formatShortOrderId } from '../utils/order.util';
import { NotificationService } from '../services/notification.service';
import { BroadcastService } from '../services/broadcast.service';
import { OrderService } from '../services/order.service';

describe('UCHIRO SPRINT: BADGE REPOSITION, ADVANCED BOTS, BROADCAST & ZERO-FAKES', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('1. Store Bot Language Selection & Rich Menus', () => {
    it('persists and retrieves user language preference', () => {
      const testTgId = 888777111;
      DataStore.findOrCreateTelegramUser({
        telegram_id: testTgId,
        username: 'test_gamer',
        first_name: 'Test',
        language_code: 'en',
      });

      expect(DataStore.getUserLanguagePreference(testTgId)).toBeNull();

      DataStore.setUserLanguagePreference(testTgId, 'km');
      expect(DataStore.getUserLanguagePreference(testTgId)).toBe('km');

      DataStore.setUserLanguagePreference(testTgId, 'en');
      expect(DataStore.getUserLanguagePreference(testTgId)).toBe('en');
    });

    it('generates localized welcome messages for Khmer and English', () => {
      const kmMsg = getWelcomeMessage('km');
      expect(kmMsg).toContain('សូមស្វាគមន៍មកកាន់ UCHIRO STORE');
      expect(kmMsg).toContain('KHQR');

      const enMsg = getWelcomeMessage('en');
      expect(enMsg).toContain('WELCOME TO UCHIRO STORE');
      expect(enMsg).toContain('Instant KHQR');
    });

    it('constructs the main menu interactive grid with custom emoji button icons', () => {
      const keyboard = getMainMenuKeyboard('https://uchiro.store', 'en');
      expect(keyboard).toBeDefined();
      const rows = keyboard.reply_markup.inline_keyboard;
      expect(rows.length).toBe(5);

      // Row 1: Gacha & Daily Points
      expect(rows[0][0].text).toContain('Gacha');
      expect(rows[0][1].text).toContain('Daily');

      // Row 2: Vault & Orders
      expect(rows[1][0].text).toContain('Vault');
      expect(rows[1][1].text).toContain('Order');

      // Row 3: Profile & Language
      expect(rows[2][0].text).toContain('Profile');
      expect(rows[2][1].text).toContain('Language');

      // Row 4: Rules & Help
      expect(rows[3][0].text).toContain('Rules');
      expect(rows[3][1].text).toContain('Help');

      // Row 5: Open Mini App & Support link
      expect(rows[4][0].text).toContain('Mini App');
      expect(rows[4][1].text).toContain('Support');
    });

    it('normalizes custom Telegram emoji tags to tg-emoji emoji-id', () => {
      const rawText = 'Welcome <tg-emoji id="5368324170671202286">🔥</tg-emoji> to Uchiro!';
      const formatted = formatTelegramHtml(rawText);
      expect(formatted).toBe('Welcome <tg-emoji emoji-id="5368324170671202286">🔥</tg-emoji> to Uchiro!');
    });

    it('returns HTTP 200 on empty or invalid webhook bodies to prevent Telegram retry spam loops', async () => {
      const storeRes = await request(app)
        .post('/api/webhook/store-bot')
        .send({})
        .set('x-telegram-bot-api-secret-token', env.STORE_BOT_WEBHOOK_SECRET);

      expect(storeRes.status).toBe(200);
      expect(storeRes.body.ok).toBe(true);

      const adminRes = await request(app)
        .post('/api/webhook/admin-bot')
        .send({})
        .set('x-telegram-bot-api-secret-token', env.ADMIN_BOT_WEBHOOK_SECRET);

      expect(adminRes.status).toBe(200);
      expect(adminRes.body.ok).toBe(true);
    });
  });

  describe('2. Admin Bot Zero-Fakes & Real Transaction Alerts', () => {
    it('constructs the exact 4-button interactive admin control keyboard with custom emoji icons', () => {
      const adminKeyboard = getAdminKeyboard('https://admin.uchiro.store');
      const rows = adminKeyboard.reply_markup.inline_keyboard;
      expect(rows.length).toBe(3);

      // Row 1: [ OPEN ADMIN PORTAL ] with SHIELD custom emoji
      expect(rows[0][0].text).toContain('OPEN ADMIN PORTAL');
      expect((rows[0][0] as any).icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.SHIELD.customEmojiId);

      // Row 2: [ Real-Time Metrics ] [ Live Inventory ]
      expect(rows[1][0].text).toBe('Real-Time Metrics');
      expect((rows[1][0] as any).icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.BAR_CHART.customEmojiId);
      expect(rows[1][1].text).toBe('Live Inventory');
      expect((rows[1][1] as any).icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.PACKAGE.customEmojiId);

      // Row 3: [ Create Broadcast ] [ Store Settings ]
      expect(rows[2][0].text).toBe('Create Broadcast');
      expect((rows[2][0] as any).icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.MEGAPHONE.customEmojiId);
      expect(rows[2][1].text).toBe('Store Settings');
      expect((rows[2][1] as any).icon_custom_emoji_id).toBe(TELEGRAM_EMOJIS.WRENCH.customEmojiId);
    });

    it('dispatches real transaction alert 🚨 REAL ORDER PAID with short order badge', async () => {
      const spy = vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();

      await NotificationService.alertAdminRealOrderPaid(
        'ord_real_123',
        'Blox Fruits Max Level Account',
        18.5,
        999888777
      );

      expect(spy).toHaveBeenCalledTimes(1);
      const [msg] = spy.mock.calls[0];
      expect(msg).toContain('🚨 <b>REAL ORDER PAID</b>');
      expect(msg).toContain(formatShortOrderId('ord_real_123'));
      expect(msg).toContain('$18.50 USD');
      expect(msg).toContain('999888777');
    });

    it('dispatches 🎁 ROBLOX GIFT CLAIM with profile link for friending', async () => {
      const spy = vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();

      await NotificationService.alertAdminRobloxGiftClaim('UchiroGamer2025', '12345678', {
        orderId: 'ord_gift_999',
        itemTitle: 'Dragon Fruit Perm Gift',
        amount: 25.0,
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const [msg, markup] = spy.mock.calls[0];
      expect(msg).toContain('🎁 <b>ROBLOX GIFT CLAIM</b>');
      expect(msg).toContain('UchiroGamer2025');
      expect(msg).toContain('https://www.roblox.com/users/12345678/profile');
      expect(markup?.inline_keyboard?.[0]?.[0]?.text).toContain('Friend on Roblox');
    });

    it('dispatches 🤝 TRADE CLAIM with trade rendezvous details', async () => {
      const spy = vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();

      await NotificationService.alertAdminTradeClaim('TraderPro_KH', {
        orderId: 'ord_trade_777',
        itemTitle: 'MM2 Corrupt Ancient Knife',
        rendezvousDetails: 'Private Trade VIP Server',
      });

      expect(spy).toHaveBeenCalledTimes(1);
      const [msg] = spy.mock.calls[0];
      expect(msg).toContain('🤝 <b>TRADE CLAIM</b>');
      expect(msg).toContain('TraderPro_KH');
      expect(msg).toContain('Private Trade VIP Server');
    });
  });

  describe('3. Broadcast Engine (Stock Arrival with "⚡ Buy Now" Direct Link)', () => {
    it('formats broadcast message and attaches direct Buy Now deep link button', async () => {
      const sendSpy = vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);

      // Seed test customer
      DataStore.findOrCreateTelegramUser({
        telegram_id: 555444333,
        username: 'broadcast_recipient',
        first_name: 'Recipient',
      });

      const res = await BroadcastService.broadcastStockArrival({
        title: 'Blox Fruits Kitsune Fruit',
        stockCount: 5,
        price: 19.99,
        productId: 'prod_kitsune_01',
      });

      expect(res.total).toBeGreaterThanOrEqual(1);
      expect(sendSpy).toHaveBeenCalled();

      // Verify the formatted text and button link
      const matchingCall = sendSpy.mock.calls.find((call) => call[0] === 555444333);
      expect(matchingCall).toBeDefined();
      const [tgId, message, markup] = matchingCall!;

      expect(message).toContain('🔥 <b>NEW STOCK ARRIVAL — UCHIRO STORE</b>');
      expect(message).toContain('Blox Fruits Kitsune Fruit');
      expect(message).toContain('Available Units: <b>5</b>');
      expect(message).toContain('$19.99 USD');

      const button = markup.inline_keyboard[0][0];
      expect(button.text).toBe('⚡ Buy Now ($19.99)');
      const buttonUrl = button.web_app?.url || button.url;
      expect(buttonUrl).toContain('?product=prod_kitsune_01');
    });

    it('provides working admin endpoint POST /api/admin/broadcast/send', async () => {
      vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);

      const adminToken = jwt.sign(
        { telegram_id: 123456789, user_id: 'admin_test_1', role: 'admin' },
        env.JWT_SECRET
      );

      // Test validation
      const invalidRes = await request(app)
        .post('/api/admin/broadcast/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});

      expect(invalidRes.status).toBe(400);

      // Test successful dispatch
      const validRes = await request(app)
        .post('/api/admin/broadcast/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          title: 'MM2 Harvester Ancient Gun',
          stockCount: 3,
          price: 14.5,
          productId: '22222222-2222-2222-2222-222222222203',
        });

      expect(validRes.status).toBe(200);
      expect(validRes.body.success).toBe(true);
      expect(validRes.body.data.productId).toBe('22222222-2222-2222-2222-222222222203');
    });
  });
});
