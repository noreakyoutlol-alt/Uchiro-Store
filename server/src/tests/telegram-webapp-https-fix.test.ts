import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createWebAppOrUrlButton as storeButtonHelper } from '../bots/store-bot/index';
import { createWebAppOrUrlButton as adminButtonHelper } from '../bots/admin-bot/index';
import { env } from '../config/env';

describe('Telegram Bot WebApp HTTPS Requirement (Error 400 Fix)', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('Store Bot Button Creation', () => {
    it('creates web_app button directly when target URL starts with https://', () => {
      const btn = storeButtonHelper('🛒 OPEN STORE', 'https://store.uchiro.com');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://store.uchiro.com');
      expect((btn as any).url).toBeUndefined();
    });

    it('uses PUBLIC_URL as web_app button when target is http:// but PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'https://my-production-app.up.railway.app';
      const btn = storeButtonHelper('🛒 OPEN STORE', 'http://localhost:3000');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://my-production-app.up.railway.app');
      expect((btn as any).url).toBeUndefined();
    });

    it('preserves query params onto PUBLIC_URL when target is http:// but PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'https://my-production-app.up.railway.app';
      const btn = storeButtonHelper('📦 VIEW ORDERS', 'http://localhost:3000?tab=orders');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://my-production-app.up.railway.app?tab=orders');
      expect((btn as any).url).toBeUndefined();
    });

    it('falls back to public HTTPS production app URL when neither target nor PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'http://localhost:5000';
      const btn = storeButtonHelper('🛒 OPEN STORE', 'http://localhost:3000');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://web-production-2d8bd.up.railway.app');
      expect((btn as any).url).toBeUndefined();
    });
  });

  describe('Admin Bot Button Creation', () => {
    it('creates web_app button directly when target URL starts with https://', () => {
      const btn = adminButtonHelper('🛡️ OPEN ADMIN APP', 'https://admin.uchiro.com');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://admin.uchiro.com');
      expect((btn as any).url).toBeUndefined();
    });

    it('uses PUBLIC_URL as web_app button when target is http:// but PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'https://my-production-app.up.railway.app';
      const btn = adminButtonHelper('🛡️ OPEN ADMIN APP', 'http://localhost:3001');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://my-production-app.up.railway.app');
      expect((btn as any).url).toBeUndefined();
    });

    it('preserves subpath onto PUBLIC_URL when target is http:// but PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'https://my-production-app.up.railway.app';
      const btn = adminButtonHelper('🔎 MANAGE ALL ORDERS', 'http://localhost:3001/orders');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://my-production-app.up.railway.app/orders');
      expect((btn as any).url).toBeUndefined();
    });

    it('falls back to public HTTPS production app URL when neither target nor PUBLIC_URL is https://', () => {
      process.env.PUBLIC_URL = 'http://localhost:5000';
      const btn = adminButtonHelper('🛡️ OPEN ADMIN APP', 'http://localhost:3001');
      expect((btn as any).web_app).toBeDefined();
      expect((btn as any).web_app.url).toBe('https://web-production-2d8bd.up.railway.app');
      expect((btn as any).url).toBeUndefined();
    });
  });

  describe('STORE_WEBAPP_URL and ADMIN_WEBAPP_URL configuration preference', () => {
    it('automatically prefers PUBLIC_URL when configured with https://', () => {
      // In server/.env, PUBLIC_URL is set to https://your-production-app.up.railway.app
      expect(env.PUBLIC_URL.startsWith('https://')).toBe(true);
      expect(env.STORE_WEBAPP_URL.startsWith('https://')).toBe(true);
      expect(env.ADMIN_WEBAPP_URL.startsWith('https://')).toBe(true);
      expect(env.STORE_WEBAPP_URL).toBe(env.PUBLIC_URL);
      expect(env.ADMIN_WEBAPP_URL).toBe(env.PUBLIC_URL);
    });
  });
});
