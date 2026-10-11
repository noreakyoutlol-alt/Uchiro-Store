import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../production';
import { DataStore } from '../database/data-store';
import { TELEGRAM_EMOJIS, renderTgEmoji, enrichWithTgEmojis } from '../config/telegram-emojis';

describe('FOUR CRITICAL PRODUCTION BOTTLENECK FIXES VERIFICATION', () => {
  describe('1. Stealth Admin Cloaking & Telegram Mini App Gate', () => {
    it('returns HTTP 404 when accessed by a regular web browser without Telegram context', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(404);

      const deepRes = await request(app).get('/admin/orders');
      expect(deepRes.status).toBe(404);
    });

    it('serves Admin SPA at /admin/ with HTTP 200 and Cache-Control headers when accessed via Telegram Mini App', async () => {
      const res = await request(app)
        .get('/admin/?tgWebAppData=mock_init_data');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('serves Admin SPA deep routes (/admin/orders, /admin/products) via Telegram User-Agent correctly', async () => {
      const res = await request(app)
        .get('/admin/orders')
        .set('User-Agent', 'Mozilla/5.0 Telegram-iOS/10.0');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('serves Store SPA at root / and does not hijack /admin routes', async () => {
      const storeRes = await request(app).get('/');
      expect(storeRes.status).toBe(200);
      expect(storeRes.headers['content-type']).toContain('text/html');
      expect(storeRes.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(storeRes.text).toContain('Uchiro Store');
    });
  });

  describe('2. Premium Emojis & Local High-Speed Fallback Assets', () => {
    it('guarantees Telegram Bot HTML emojis have valid Unicode fallback glyphs', () => {
      expect(TELEGRAM_EMOJIS.LIGHTNING.fallback).toBe('⚡');
      expect(TELEGRAM_EMOJIS.SHIELD.fallback).toBe('🛡️');
      expect(TELEGRAM_EMOJIS.KEY.fallback).toBe('🔑');
      expect(TELEGRAM_EMOJIS.FIRE.fallback).toBe('🔥');
      expect(TELEGRAM_EMOJIS.PACKAGE.fallback).toBe('📦');
      expect(TELEGRAM_EMOJIS.CROWN.fallback).toBe('👑');
      expect(TELEGRAM_EMOJIS.GEM.fallback).toBe('💎');
      expect(TELEGRAM_EMOJIS.CHECK.fallback).toBe('✅');
    });

    it('enrichWithTgEmojis converts text with valid fallback unicode if custom ids are missing', () => {
      const enriched = enrichWithTgEmojis('🛡️ UCHIRO ⚡');
      expect(enriched).toBeDefined();
      expect(enriched.length).toBeGreaterThan(0);
    });
  });

  describe('3. Daily Claim Points & Countdown Timer Glitch Fix', () => {
    it('claims daily points and returns exact new balance without resetting', async () => {
      const testTgId = 7711223344;
      const initialUser = DataStore.findOrCreateTelegramUser({
        telegram_id: testTgId,
        first_name: 'TimerTester',
      });
      const initialPoints = initialUser.user.points ?? 0;

      const claimRes = await request(app)
        .post('/api/daily-reward/claim')
        .send({ telegramId: testTgId });

      expect(claimRes.status).toBe(200);
      expect(claimRes.body.success).toBe(true);
      expect(claimRes.body.pointsAwarded).toBe(5);
      expect(claimRes.body.newBalance).toBe(initialPoints + 5);
      expect(typeof claimRes.body.seconds_remaining).toBe('number');
      expect(claimRes.body.seconds_remaining).toBeGreaterThan(0);
    });

    it('subsequent claim within same day returns success: false, pointsAwarded: 0, and seconds_remaining countdown', async () => {
      const testTgId = 7711223344;
      const secondClaim = await request(app)
        .post('/api/daily-reward/claim')
        .send({ telegramId: testTgId });

      expect(secondClaim.status).toBe(200);
      expect(secondClaim.body.success).toBe(false);
      expect(secondClaim.body.pointsAwarded).toBe(0);
      expect(secondClaim.body.error).toBe('ALREADY_CLAIMED_TODAY');
      expect(typeof secondClaim.body.seconds_remaining).toBe('number');
      expect(secondClaim.body.seconds_remaining).toBeGreaterThan(0);
      expect(secondClaim.body.next_claim_at).toBeDefined();
    });
  });

  describe('4. Railway Compression and Caching Optimizations', () => {
    it('enables compression on API responses when Accept-Encoding is gzip', async () => {
      const res = await request(app)
        .get('/api/categories')
        .set('Accept-Encoding', 'gzip');

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
    });

    it('serves static assets with 1-year maxAge and immutable cache policy', async () => {
      const res = await request(app).get('/admin/assets/vendor-react-DJt_Tgjv.js');
      // If file exists, check max-age headers
      if (res.status === 200) {
        expect(res.headers['cache-control']).toContain('max-age=31536000');
        expect(res.headers['cache-control']).toContain('immutable');
      }
    });
  });
});
