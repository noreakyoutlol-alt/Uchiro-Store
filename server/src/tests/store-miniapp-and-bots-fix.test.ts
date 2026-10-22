import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { resolveStoreUrl, resolveServerUrl, resolveAdminPortalUrl } from '../config/app-url';
import { getStoreBotWebhookSecrets, getAdminBotWebhookSecrets } from '../bots/webhook-security';
import { webhookRouter } from '../routes/bots.routes';
import { buildMainMenuKeyboard, createWebAppOrUrlButton } from '../bots/store-bot/keyboards';
import { ADMIN_BASE_PATH } from '../config/admin-slug';

describe('Store Mini App & Telegram Bots Comprehensive Verification', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Store and Server URL Resolution', () => {
    it('resolves SERVER_URL when configured', () => {
      process.env.SERVER_URL = 'https://uchiro-production.up.railway.app';
      delete process.env.STORE_MINIAPP_URL;
      delete process.env.STORE_WEBAPP_URL;
      delete process.env.STORE_URL;
      delete process.env.PUBLIC_URL;
      expect(resolveStoreUrl()).toBe('https://uchiro-production.up.railway.app');
      expect(resolveServerUrl()).toBe('https://uchiro-production.up.railway.app');
    });

    it('filters out obsolete placeholder domains like web-production-2d8bd', () => {
      process.env.PUBLIC_URL = 'https://web-production-2d8bd.up.railway.app';
      process.env.SERVER_URL = 'https://real-production.up.railway.app';
      expect(resolveStoreUrl()).toBe('https://real-production.up.railway.app');
    });

    it('filters out template placeholder domain your-production-app', () => {
      process.env.PUBLIC_URL = 'https://your-production-app.up.railway.app';
      process.env.SERVER_URL = 'https://real-production.up.railway.app';
      expect(resolveStoreUrl()).toBe('https://real-production.up.railway.app');
    });

    it('resolves Admin Portal URL preserving custom secret slug', () => {
      process.env.SERVER_URL = 'https://uchiro-production.up.railway.app';
      const adminUrl = resolveAdminPortalUrl();
      expect(adminUrl).toBe(`https://uchiro-production.up.railway.app${ADMIN_BASE_PATH}`);
    });
  });

  describe('2. Store Bot Keyboards & Launch URLs', () => {
    it('creates Main Menu button pointing to resolved production store URL', () => {
      process.env.SERVER_URL = 'https://uchiro-live.up.railway.app';
      const keyboard = buildMainMenuKeyboard();
      const firstRow = (keyboard as any).reply_markup.inline_keyboard[0];
      const openStoreBtn = firstRow[0];

      expect(openStoreBtn.text).toContain('Open Store');
      expect(openStoreBtn.web_app).toBeDefined();
      expect(openStoreBtn.web_app.url).toBe('https://uchiro-live.up.railway.app');
      expect(openStoreBtn.web_app.url).not.toContain('web-production-2d8bd');
    });

    it('sanitizes defunct placeholder domain in createWebAppOrUrlButton', () => {
      process.env.SERVER_URL = 'https://uchiro-live.up.railway.app';
      const btn = createWebAppOrUrlButton('Open', 'https://web-production-2d8bd.up.railway.app?tab=profile');
      expect((btn as any).web_app.url).toBe('https://uchiro-live.up.railway.app?tab=profile');
    });
  });

  describe('3. Webhook Secret Dual-Name Compatibility', () => {
    it('returns both STORE_WEBHOOK_SECRET and STORE_BOT_WEBHOOK_SECRET if configured', () => {
      process.env.STORE_WEBHOOK_SECRET = 'secret_variant_one_12345';
      process.env.STORE_BOT_WEBHOOK_SECRET = 'secret_variant_two_67890';
      const secrets = getStoreBotWebhookSecrets();
      expect(secrets).toContain('secret_variant_one_12345');
      expect(secrets).toContain('secret_variant_two_67890');
    });

    it('authenticates Store Bot webhook when Telegram sends STORE_WEBHOOK_SECRET', async () => {
      process.env.STORE_WEBHOOK_SECRET = 'active_railway_secret_998877';
      process.env.STORE_BOT_WEBHOOK_SECRET = 'different_env_secret_112233';

      const app = express();
      app.use(express.json());
      app.use('/webhook', webhookRouter);

      const res = await request(app)
        .post('/webhook/store-bot')
        .set('x-telegram-bot-api-secret-token', 'active_railway_secret_998877')
        .send({ update_id: 123456 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('authenticates Admin Bot webhook when Telegram sends ADMIN_WEBHOOK_SECRET', async () => {
      process.env.ADMIN_WEBHOOK_SECRET = 'active_admin_railway_secret_554433';
      process.env.ADMIN_BOT_WEBHOOK_SECRET = 'different_admin_secret_998877';

      const app = express();
      app.use(express.json());
      app.use('/webhook', webhookRouter);

      const res = await request(app)
        .post('/webhook/admin-bot')
        .set('x-telegram-bot-api-secret-token', 'active_admin_railway_secret_554433')
        .send({ update_id: 654321 });

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('rejects webhooks with 403 when secret token does not match any configured secret', async () => {
      process.env.STORE_WEBHOOK_SECRET = 'correct_secret_value_123456';

      const app = express();
      app.use(express.json());
      app.use('/webhook', webhookRouter);

      const res = await request(app)
        .post('/webhook/store-bot')
        .set('x-telegram-bot-api-secret-token', 'wrong_token')
        .send({ update_id: 999 });

      expect(res.status).toBe(403);
    });

    it('rejects webhooks with 401 when secret token header is missing entirely', async () => {
      process.env.STORE_WEBHOOK_SECRET = 'correct_secret_value_123456';

      const app = express();
      app.use(express.json());
      app.use('/webhook', webhookRouter);

      const res = await request(app)
        .post('/webhook/store-bot')
        .send({ update_id: 999 });

      expect(res.status).toBe(401);
    });

    it('provides GET diagnostic probe for bot webhooks', async () => {
      const app = express();
      app.use('/webhook', webhookRouter);

      const resStore = await request(app).get('/webhook/store-bot');
      expect(resStore.status).toBe(200);
      expect(resStore.body.ok).toBe(true);
      expect(resStore.body.bot).toBe('store-bot');

      const resAdmin = await request(app).get('/webhook/admin-bot');
      expect(resAdmin.status).toBe(200);
      expect(resAdmin.body.ok).toBe(true);
      expect(resAdmin.body.bot).toBe('admin-bot');
    });
  });
});
