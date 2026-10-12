import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { ADMIN_BASE_PATH } from '../config/admin-slug';

describe('STEALTH ADMIN CLOAKING & SECRET SLUG VERIFICATION', () => {
  describe('1. Stealth 404 Trap (/admin and /admin/*)', () => {
    it('returns 404 with Express fake error HTML on GET /admin', async () => {
      const res = await request(app).get('/admin');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Cannot GET /admin');
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('returns 404 with Express fake error HTML on GET /admin/', async () => {
      const res = await request(app).get('/admin/');
      expect(res.status).toBe(404);
      expect(res.text).toContain('Cannot GET /admin');
      expect(res.headers['content-type']).toContain('text/html');
    });

    it('returns 404 with Express fake error HTML on deep /admin paths', async () => {
      const paths = ['/admin/orders', '/admin/inventory', '/admin/settings'];
      for (const p of paths) {
        const res = await request(app).get(p);
        expect(res.status).toBe(404);
        expect(res.text).toContain(`Cannot GET ${p}`);
      }
    });

    it('escapes special characters in fake 404 output to prevent XSS reflection', async () => {
      const res = await request(app).get('/admin/<script>alert(1)</script>');
      expect(res.status).toBe(404);
      expect(res.text).not.toContain('<script>alert(1)</script>');
      expect(res.text).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
    });
  });

  describe('2. Secret Slug Admin Access', () => {
    it('serves Admin SPA on secret slug', async () => {
      const res = await request(app).get(ADMIN_BASE_PATH);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
    });

    it('serves Admin SPA on secret slug deep paths', async () => {
      const res = await request(app).get(`${ADMIN_BASE_PATH}/orders`);
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });

  describe('3. Public Store Access', () => {
    it('serves Store SPA on GET /', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
    });
  });
});
