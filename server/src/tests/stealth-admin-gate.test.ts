import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app, { isTelegramMiniApp } from '../production';
import { env } from '../config/env';

describe('STEALTH ADMIN CLOAKING & TELEGRAM MINI APP GATE VERIFICATION', () => {
  describe('1. Public Web Cloaking (HTTP 404 Hard-Lock)', () => {
    it('returns strict HTTP 404 Not Found when /admin is accessed from a normal public browser', async () => {
      const chromeUA =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36';
      const res = await request(app)
        .get('/admin')
        .set('User-Agent', chromeUA);

      expect(res.status).toBe(404);
    });

    it('returns strict HTTP 404 Not Found when /admin/ is accessed from Safari without Telegram context', async () => {
      const safariUA =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 14_3_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15';
      const res = await request(app)
        .get('/admin/')
        .set('User-Agent', safariUA);

      expect(res.status).toBe(404);
    });

    it('cloaks deep admin routes (/admin/orders, /admin/inventory, /admin/settings) with HTTP 404', async () => {
      const paths = ['/admin/orders', '/admin/inventory', '/admin/settings', '/admin/users'];
      for (const p of paths) {
        const res = await request(app).get(p);
        expect(res.status).toBe(404);
      }
    });

    it('does not affect public store routes (GET / serves Store SPA with 200)', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Uchiro Store');
    });
  });

  describe('2. Telegram Mini App Access (HTTP 200 Admin Portal)', () => {
    it('serves Admin SPA when accessed with ?tgWebAppData= query parameter', async () => {
      const adminTgId = env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789;
      const fakeInitData = `user=${encodeURIComponent(JSON.stringify({ id: adminTgId, first_name: 'SuperAdmin' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock_hash`;

      const res = await request(app).get(`/admin?tgWebAppData=${encodeURIComponent(fakeInitData)}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('serves Admin SPA when accessed with ?tgWebAppVersion= query parameter', async () => {
      const res = await request(app).get('/admin/?tgWebAppVersion=8.0&tgWebAppPlatform=ios');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('serves Admin SPA when User-Agent indicates Telegram client (iOS / Android / Desktop)', async () => {
      const telegramUAs = [
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Telegram-iOS/10.9',
        'Mozilla/5.0 (Linux; Android 14; SM-S928B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.6261.64 Mobile Safari/537.36 TelegramAndroid/10.9.1',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Telegram Desktop/4.16.8',
      ];

      for (const ua of telegramUAs) {
        const res = await request(app)
          .get('/admin')
          .set('User-Agent', ua);
        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('text/html');
        expect(res.text).toContain('UCHIRO ADMIN');
      }
    });

    it('serves Admin SPA when x-telegram-init-data header is present', async () => {
      const res = await request(app)
        .get('/admin')
        .set('x-telegram-init-data', 'user=%7B%22id%22%3A123456789%7D&hash=test');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('serves Admin SPA when Referer header is from web.telegram.org', async () => {
      const res = await request(app)
        .get('/admin')
        .set('Referer', 'https://web.telegram.org/a/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('UCHIRO ADMIN');
    });
  });

  describe('3. Admin Whitelist Validation inside Mini App (POST /api/auth/admin)', () => {
    it('successfully authorizes an authorized Admin Telegram ID from whitelist', async () => {
      const authorizedAdminId = env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789;
      const initData = `user=${encodeURIComponent(JSON.stringify({ id: authorizedAdminId, first_name: 'Lead Admin', username: 'uchiro_admin' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=valid_hash`;

      const res = await request(app)
        .post('/api/auth/admin')
        .send({ initData });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.admin).toBeDefined();
      expect(res.body.data.admin.telegram_id).toBe(authorizedAdminId);
      expect(res.body.data.admin.role).toBe('admin');
      expect(res.body.data.token).toBeDefined();
    });

    it('strictly rejects an unauthorized Telegram User ID with HTTP 403 Forbidden', async () => {
      const unauthorizedId = 9999999888; // Not in ADMIN_TELEGRAM_USER_IDS
      const initData = `user=${encodeURIComponent(JSON.stringify({ id: unauthorizedId, first_name: 'Normal Customer', username: 'regular_user' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=customer_hash`;

      const res = await request(app)
        .post('/api/auth/admin')
        .send({ initData });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('FORBIDDEN_ADMIN');
      expect(res.body.error.message).toContain('Forbidden');
    });
  });
});
