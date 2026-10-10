import { describe, it, expect } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { env } from '../config/env';
import { DataStore } from '../database/data-store';
import {
  TELEGRAM_EMOJIS,
  renderTgEmoji,
  enrichWithTgEmojis,
} from '../config/telegram-emojis';

describe('CRITICAL FIXES: DUPE EMOJIS, ACCOUNT PILL, QR AUTH & TELEGRAM EMOJIS', () => {
  describe('1. Dedicated Telegram Premium Emojis Config (server/src/config/telegram-emojis.ts)', () => {
    it('exports TELEGRAM_EMOJIS with all required keys and emoji definitions', () => {
      const requiredKeys = [
        'FIRE',
        'LIGHTNING',
        'SWORD',
        'KNIFE',
        'TARGET',
        'SHIELD',
        'CROWN',
        'CHECK',
        'MONEY',
        'PACKAGE',
        'GEM',
        'TICKET',
      ];

      for (const key of requiredKeys) {
        expect(TELEGRAM_EMOJIS[key]).toBeDefined();
        expect(TELEGRAM_EMOJIS[key].fallback).toBeDefined();
        expect(TELEGRAM_EMOJIS[key].customEmojiId).toBeDefined();
      }

      expect(TELEGRAM_EMOJIS.FIRE.fallback).toBe('🔥');
      expect(TELEGRAM_EMOJIS.LIGHTNING.fallback).toBe('⚡');
      expect(TELEGRAM_EMOJIS.CROWN.fallback).toBe('👑');
    });

    it('renderTgEmoji formats Telegram Premium <tg-emoji> tag correctly', () => {
      // Save current IDs
      const origFire = TELEGRAM_EMOJIS.FIRE.customEmojiId;
      const origLightning = TELEGRAM_EMOJIS.LIGHTNING.customEmojiId;

      // Fallback behavior when customEmojiId is empty
      TELEGRAM_EMOJIS.FIRE.customEmojiId = '';
      expect(renderTgEmoji('FIRE')).toBe('🔥');

      // Formatted behavior when customEmojiId is set
      TELEGRAM_EMOJIS.FIRE.customEmojiId = '5465465465465465465';
      TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = '5465465465465465466';

      const fireHtml = renderTgEmoji('FIRE');
      expect(fireHtml).toContain('<tg-emoji emoji-id="5465465465465465465"');
      expect(fireHtml).toContain('🔥</tg-emoji>');

      const lightningHtml = renderTgEmoji('LIGHTNING');
      expect(lightningHtml).toContain('⚡</tg-emoji>');

      // Restore
      TELEGRAM_EMOJIS.FIRE.customEmojiId = origFire;
      TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = origLightning;
    });

    it('enrichWithTgEmojis converts plain text emojis to tg-emoji tags', () => {
      const origFire = TELEGRAM_EMOJIS.FIRE.customEmojiId;
      const origLightning = TELEGRAM_EMOJIS.LIGHTNING.customEmojiId;

      TELEGRAM_EMOJIS.FIRE.customEmojiId = '5465465465465465465';
      TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = '5465465465465465466';

      const rawText = 'New arrival: 🔥 Hot Item with ⚡ Instant Delivery!';
      const enriched = enrichWithTgEmojis(rawText);
      expect(enriched).toContain('<tg-emoji emoji-id=');
      expect(enriched).toContain('🔥</tg-emoji>');
      expect(enriched).toContain('⚡</tg-emoji>');

      TELEGRAM_EMOJIS.FIRE.customEmojiId = origFire;
      TELEGRAM_EMOJIS.LIGHTNING.customEmojiId = origLightning;
    });
  });

  describe('2. QR Creation & Auto-Authentication Fallback (POST /api/payments/create-qr)', () => {
    it('creates QR successfully with an authenticated customer JWT', async () => {
      const inStockProducts = DataStore.getInStockProducts();
      const testProduct = inStockProducts.find((p) => !p.requires_roblox_username) || inStockProducts[0];

      const token = jwt.sign(
        {
          user_id: 'user_cust_test_101',
          telegram_id: 88877766,
          username: 'test_qr_user',
          role: 'customer',
        },
        env.JWT_SECRET
      );

      const res = await request(app)
        .post('/api/payments/create-qr')
        .set('Authorization', `Bearer ${token}`)
        .send({
          productId: testProduct.id,
          robloxUsername: 'test_player',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.payment).toBeDefined();
      expect(res.body.data.khqr).toBeDefined();
      expect(res.body.data.khqr.qr_image_url || res.body.data.khqr.qr_code).toBeDefined();
    });

    it('creates QR successfully with Telegram initData header (seamless auto-authentication)', async () => {
      const inStockProducts = DataStore.getInStockProducts();
      const testProduct = inStockProducts.find((p) => !p.requires_roblox_username) || inStockProducts[0];

      // In test mode, telegram-validator recognizes test initData
      const res = await request(app)
        .post('/api/payments/create-qr')
        .set('x-telegram-init-data', 'user=%7B%22id%22%3A99988877%2C%22first_name%22%3A%22TgUser%22%7D')
        .send({
          productId: testProduct.id,
          robloxUsername: 'test_player',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.headers['x-refreshed-token']).toBeDefined();
    });

    it('falls back to guest session in dev/test mode without crashing with 401', async () => {
      const inStockProducts = DataStore.getInStockProducts();
      const testProduct = inStockProducts.find((p) => !p.requires_roblox_username) || inStockProducts[0];

      // No Authorization header sent
      const res = await request(app)
        .post('/api/payments/create-qr')
        .send({
          productId: testProduct.id,
          robloxUsername: 'test_player',
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.customer_id).toBeDefined();
      expect(res.headers['x-refreshed-token']).toBeDefined();
    });

    it('returns QR details for existing orderId if orderId is provided', async () => {
      const inStockProducts = DataStore.getInStockProducts();
      const testProduct = inStockProducts.find((p) => !p.requires_roblox_username) || inStockProducts[0];

      const token = jwt.sign(
        {
          user_id: 'user_cust_existing',
          telegram_id: 77766655,
          username: 'existing_order_user',
          role: 'customer',
        },
        env.JWT_SECRET
      );

      // First create order
      const orderRes = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ productId: testProduct.id, robloxUsername: 'test_player' });

      expect(orderRes.status).toBe(201);
      const orderId = orderRes.body.data.order.id;

      // Query QR via /api/payments/create-qr with orderId
      const qrRes = await request(app)
        .post('/api/payments/create-qr')
        .set('Authorization', `Bearer ${token}`)
        .send({ orderId });

      expect(qrRes.status).toBe(200);
      expect(qrRes.body.success).toBe(true);
      expect(qrRes.body.data.order.id).toBe(orderId);
      expect(qrRes.body.data.payment).toBeDefined();
    });
  });
});
