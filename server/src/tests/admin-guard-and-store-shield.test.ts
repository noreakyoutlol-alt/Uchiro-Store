import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { env } from '../config/env';
import jwt from 'jsonwebtoken';

describe('Admin Guard & Store Browser Shield Route Verification', () => {
  describe('1. Server-Level Admin Hard-Lock (/admin)', () => {
    it('returns strict HTTP 404 HTML when accessed by an unauthenticated regular web browser', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(404);
      expect(res.text).toBe(
        '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>'
      );
    });

    it('returns strict HTTP 404 HTML on deep admin routes (/admin/orders, /admin/settings) without credentials', async () => {
      const resOrders = await request(app).get('/admin/orders');
      expect(resOrders.status).toBe(404);
      expect(resOrders.text).toContain('404 Not Found');

      const resSettings = await request(app).get('/admin/settings');
      expect(resSettings.status).toBe(404);
      expect(resSettings.text).toContain('404 Not Found');
    });

    it('allows access when valid x-telegram-init-data for authorized admin is provided', async () => {
      const adminTgId = env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789;
      const fakeInitData = `user=${encodeURIComponent(JSON.stringify({ id: adminTgId, first_name: 'SuperAdmin' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock_hash`;

      const res = await request(app)
        .get('/admin')
        .set('x-telegram-init-data', fakeInitData);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('allows access via ?tgWebAppData= query parameter', async () => {
      const adminTgId = env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789;
      const fakeInitData = `user=${encodeURIComponent(JSON.stringify({ id: adminTgId, first_name: 'SuperAdmin' }))}&auth_date=${Math.floor(Date.now() / 1000)}&hash=mock_hash`;

      const res = await request(app).get(`/admin?tgWebAppData=${encodeURIComponent(fakeInitData)}`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('UCHIRO ADMIN');
    });

    it('allows access via valid signed admin session JWT in Authorization header or cookie', async () => {
      const adminTgId = env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789;
      const token = jwt.sign(
        { role: 'admin', telegram_id: adminTgId },
        env.JWT_SECRET,
        { expiresIn: '1h' }
      );

      // Via Authorization Bearer
      const bearerRes = await request(app)
        .get('/admin')
        .set('Authorization', `Bearer ${token}`);
      expect(bearerRes.status).toBe(200);
      expect(bearerRes.text).toContain('UCHIRO ADMIN');

      // Via cookie
      const cookieRes = await request(app)
        .get('/admin')
        .set('Cookie', `uchiro_admin_token=${token}`);
      expect(cookieRes.status).toBe(200);
      expect(cookieRes.text).toContain('UCHIRO ADMIN');
    });

    it('allows access via admin secret query parameter (?admin_secret=)', async () => {
      const res = await request(app).get(`/admin?admin_secret=${env.ADMIN_BOT_WEBHOOK_SECRET}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain('UCHIRO ADMIN');
    });
  });

  describe('2. SPA Wildcard Route Ordering', () => {
    it('routes /api/admin/* to Admin API and returns JSON, not HTML', async () => {
      const res = await request(app).get('/api/admin/stats');
      // Returns 401 JSON because requireAdminAuth middleware checks token, proving route is reached
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.success).toBe(false);
    });

    it('routes /api/* to Store API and returns JSON, not HTML', async () => {
      const res = await request(app).get('/api/categories');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('application/json');
      expect(res.body.success).toBe(true);
    });

    it('serves client-store dist for regular root / visits', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('<!doctype html>');
    });
  });
});
