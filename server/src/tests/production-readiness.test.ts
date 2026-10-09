import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../production';
import { env } from '../config/env';

describe('Task 8: Production Readiness & Final Verification Suite', () => {
  describe('1. Railway Primary Service & Health Check', () => {
    it('GET /health returns status ok with timestamp and HTTP 200 without Telegram authorization', async () => {
      const res = await request(app).get('/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.ok).toBe(true);
      expect(res.body.service).toBe('uchiro-store');
      expect(res.body.timestamp).toBeDefined();
      expect(new Date(res.body.timestamp).getTime()).not.toBeNaN();
    });

    it('GET /api/health returns detailed health diagnostics', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.version).toBe('3.0.0');
      expect(res.body.bots).toBeDefined();
    });
  });

  describe('2. Single-Service Routing & Static Frontend Delivery', () => {
    it('serves client-store at / and SPA routes', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.text).toContain('<!doctype html>');
      // Either store or admin html
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('serves client-admin at /admin and /admin/*', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('UCHIRO ADMIN');

      const deepRes = await request(app).get('/admin/orders');
      expect(deepRes.status).toBe(200);
      expect(deepRes.headers['content-type']).toContain('text/html');
      expect(deepRes.text).toContain('UCHIRO ADMIN');
    });

    it('routes /api/* to backend REST APIs and does not return HTML', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });
  });

  describe('3. Telegram Bot Webhook Routing & Validation', () => {
    it('processes store-bot webhook via /api/webhook/store-bot', async () => {
      const res = await request(app)
        .post('/api/webhook/store-bot')
        .set('x-telegram-bot-api-secret-token', env.STORE_BOT_WEBHOOK_SECRET)
        .send({
          update_id: 10001,
          message: {
            message_id: 1,
            from: { id: 1234567, is_bot: false, first_name: 'Test' },
            chat: { id: 1234567, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: '/start',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('processes admin-bot webhook via /api/webhook/admin-bot', async () => {
      const res = await request(app)
        .post('/api/webhook/admin-bot')
        .set('x-telegram-bot-api-secret-token', env.ADMIN_BOT_WEBHOOK_SECRET)
        .send({
          update_id: 10002,
          message: {
            message_id: 2,
            from: { id: env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789, is_bot: false, first_name: 'Admin' },
            chat: { id: env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: '/stats',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects store-bot webhook with invalid secret token', async () => {
      const res = await request(app)
        .post('/api/webhook/store-bot')
        .set('x-telegram-bot-api-secret-token', 'invalid_fake_secret')
        .send({ update_id: 10003 });

      expect(res.status).toBe(403);
    });

    it('safely acknowledges store-bot webhook with empty payload to prevent retry spam', async () => {
      const res = await request(app)
        .post('/api/webhook/store-bot')
        .set('x-telegram-bot-api-secret-token', env.STORE_BOT_WEBHOOK_SECRET)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects admin-bot webhook with invalid secret token', async () => {
      const res = await request(app)
        .post('/api/webhook/admin-bot')
        .set('x-telegram-bot-api-secret-token', 'invalid_fake_secret')
        .send({ update_id: 10004 });

      expect(res.status).toBe(403);
    });

    it('safely acknowledges admin-bot webhook with empty payload to prevent retry spam', async () => {
      const res = await request(app)
        .post('/api/webhook/admin-bot')
        .set('x-telegram-bot-api-secret-token', env.ADMIN_BOT_WEBHOOK_SECRET)
        .send({});

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('supports backwards-compatible /api/bots/* webhook endpoints', async () => {
      const storeRes = await request(app)
        .post('/api/bots/store/webhook')
        .set('x-telegram-bot-api-secret-token', env.STORE_BOT_WEBHOOK_SECRET)
        .send({
          update_id: 10005,
          message: {
            message_id: 5,
            from: { id: 1234567, is_bot: false, first_name: 'Test' },
            chat: { id: 1234567, type: 'private' },
            date: Math.floor(Date.now() / 1000),
            text: '/start',
          },
        });

      expect(storeRes.status).toBe(200);
      expect(storeRes.body.ok).toBe(true);
    });
  });

  describe('4. Canonical Environment Configuration', () => {
    it('verifies all mandatory canonical configuration keys exist', () => {
      expect(env.PORT).toBeDefined();
      expect(env.NODE_ENV).toBeDefined();
      expect(env.JWT_SECRET).toBeDefined();
      expect(env.ADMIN_TELEGRAM_IDS).toBeDefined();
      expect(Array.isArray(env.ADMIN_TELEGRAM_IDS)).toBe(true);
      expect(env.SUPABASE_URL).toBeDefined();
      expect(env.SUPABASE_SERVICE_ROLE_KEY).toBeDefined();
      expect(env.KHPAY_BASE_URL).toBeDefined();
      expect(env.KHPAY_API_KEY).toBeDefined();
      expect(env.PUBLIC_URL).toBeDefined();
      expect(env.WEBHOOK_URL).toBeDefined();
    });
  });
});
