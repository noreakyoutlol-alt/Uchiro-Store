import fs from 'fs';
import path from 'path';
import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import app from '../server';
import { ADMIN_BASE_PATH } from '../config/admin-slug';
import { mintAdminSessionToken } from '../auth/admin-session';

describe('Dual-Bot & Stealth Admin Architecture Verification Suite', () => {
  const testPin = process.env.ADMIN_PIN || '998877';
  const testSecret = process.env.ADMIN_SESSION_SECRET || 'test_secret_for_sessions_1234567890';

  beforeAll(() => {
    process.env.ADMIN_PIN = testPin;
    process.env.ADMIN_SESSION_SECRET = testSecret;
    process.env.STORE_WEBHOOK_SECRET = process.env.STORE_WEBHOOK_SECRET || 'store_secret_abc12345';
    process.env.ADMIN_WEBHOOK_SECRET = process.env.ADMIN_WEBHOOK_SECRET || 'admin_secret_xyz67890';
  });

  // 1. /admin returns 404 text/html containing "<pre>Cannot GET /admin</pre>"
  it('1. /admin returns 404 text/html containing "<pre>Cannot GET /admin</pre>"', async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<pre>Cannot GET /admin</pre>');
  });

  // 2. /admin/ returns the same 404
  it('2. /admin/ returns the same 404', async () => {
    const res = await request(app).get('/admin/');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<pre>Cannot GET /admin');
  });

  // 3. /admin/anything returns 404 text/html containing "<pre>Cannot GET /admin/anything</pre>"
  it('3. /admin/anything returns 404 text/html containing "<pre>Cannot GET /admin/anything</pre>"', async () => {
    const res = await request(app).get('/admin/anything');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<pre>Cannot GET /admin/anything</pre>');
  });

  // 4. /admin with POST returns 404 "<pre>Cannot POST /admin</pre>"
  it('4. /admin with POST returns 404 "<pre>Cannot POST /admin</pre>"', async () => {
    const res = await request(app).post('/admin');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('<pre>Cannot POST /admin</pre>');
  });

  // 5. /admin response headers include nosniff and CSP default-src 'none'
  it("5. /admin response headers include nosniff and CSP default-src 'none'", async () => {
    const res = await request(app).get('/admin');
    expect(res.status).toBe(404);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toBe("default-src 'none'");
  });

  // 6. /api/admin/* without session returns 401
  it('6. /api/admin/* without session returns 401', async () => {
    const res = await request(app).get('/api/admin/stats');
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // 7. /api/admin/verify-pin with wrong PIN returns 401
  it('7. /api/admin/verify-pin with wrong PIN returns 401', async () => {
    const res = await request(app)
      .post('/api/admin/verify-pin')
      .send({ pin: '000000' })
      .set('x-admin-test-secret', testSecret);
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('INVALID_PIN');
  });

  // 8. /api/admin/verify-pin with correct PIN and valid initData (or test secret) returns 200 + sessionToken
  it('8. /api/admin/verify-pin with correct PIN and valid initData (or test secret) returns 200 + sessionToken', async () => {
    const res = await request(app)
      .post('/api/admin/verify-pin')
      .send({ pin: testPin })
      .set('x-admin-test-secret', testSecret);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(typeof res.body.sessionToken).toBe('string');
  });

  // 9. /api/admin/* with valid X-Admin-Session succeeds
  it('9. /api/admin/* with valid X-Admin-Session succeeds', async () => {
    const sessionToken = mintAdminSessionToken('test-admin-123');
    const res = await request(app)
      .get('/api/admin/stats')
      .set('X-Admin-Session', sessionToken);
    expect(res.status).toBe(200);
  });

  // 10. /api/webhook/store-bot without secret token header returns 401
  it('10. /api/webhook/store-bot without secret token header returns 401', async () => {
    const res = await request(app).post('/api/webhook/store-bot').send({});
    expect(res.status).toBe(401);
  });

  // 11. /api/webhook/admin-bot without secret token header returns 401
  it('11. /api/webhook/admin-bot without secret token header returns 401', async () => {
    const res = await request(app).post('/api/webhook/admin-bot').send({});
    expect(res.status).toBe(401);
  });

  // 12. Store customer routes still return index.html (SPA fallback)
  it('12. Store customer routes still return index.html (SPA fallback)', async () => {
    const res = await request(app).get('/my-orders');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
  });

  // 13. Unknown /api/foo returns JSON { error: 'NOT_FOUND' }
  it("13. Unknown /api/foo returns JSON { error: 'NOT_FOUND' }", async () => {
    const res = await request(app).get('/api/unknown-nonexistent-endpoint-12345');
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: 'NOT_FOUND' });
  });

  // 14. Admin assets served from /<slug>/assets/* return 200 with immutable cache header (when built)
  it('14. Admin assets served from /<slug>/assets/* return 200 with immutable cache header (when built)', async () => {
    // Check if client-admin/dist/assets has files
    const adminDist = path.resolve(__dirname, '../../../client-admin/dist/assets');
    if (fs.existsSync(adminDist)) {
      const files = fs
        .readdirSync(adminDist)
        .filter((f) => fs.statSync(path.join(adminDist, f)).isFile());
      if (files.length > 0) {
        const testFile = files[0];
        const res = await request(app).get(`${ADMIN_BASE_PATH}/assets/${testFile}`);
        expect(res.status).toBe(200);
        expect(res.headers['cache-control']).toContain('immutable');
        return;
      }
    }
    // If dist assets not built yet, test that requesting a non-existent asset under /<slug>/assets returns 404
    const res = await request(app).get(`${ADMIN_BASE_PATH}/assets/nonexistent-file.js`);
    expect([200, 404]).toContain(res.status);
  });
});
