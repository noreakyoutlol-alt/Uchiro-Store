import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import app, { isTelegramMiniApp } from '../production';
import { getMainMenuKeyboard } from '../bots/store-bot/index';
import { TELEGRAM_EMOJIS } from '../config/telegram-emojis';
import { ADMIN_BASE_PATH } from '../config/admin-slug';

describe('PHASE 4: TELEGRAM BOT BUTTON OPTIMIZATION & FINAL STEALTH ADMIN', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('1. Telegram Store Bot Button Optimization', () => {
    it('ensures ONLY the main "Open Store" button launches the Telegram WebApp across the 5 structured rows', () => {
      process.env.STORE_MINIAPP_URL = 'https://store.uchiro.com';
      const keyboard = getMainMenuKeyboard('https://store.uchiro.com', 'km');
      const rows = keyboard.reply_markup.inline_keyboard;

      expect(rows.length).toBe(5);

      // Row 0: Gacha & Daily Points - MUST NOT have web_app
      const gachaBtn = rows[0][0] as any;
      const rewardsBtn = rows[0][1] as any;
      expect(gachaBtn.text).toBe('🎰 Play Gacha');
      expect(gachaBtn.web_app).toBeUndefined();
      expect(gachaBtn.callback_data).toBe('cb_gacha_menu');
      expect(rewardsBtn.text).toBe('🎁 Daily Points');
      expect(rewardsBtn.web_app).toBeUndefined();
      expect(rewardsBtn.callback_data).toBe('cb_daily_menu');

      // Row 1: Inventory & Orders - MUST NOT have web_app
      const vaultBtn = rows[1][0] as any;
      const ordersBtn = rows[1][1] as any;
      expect(vaultBtn.text).toBe('🎒 My Vault & Accounts');
      expect(vaultBtn.web_app).toBeUndefined();
      expect(vaultBtn.callback_data).toBe('cb_vault_menu');
      expect(ordersBtn.text).toBe('📜 Order History');
      expect(ordersBtn.web_app).toBeUndefined();
      expect(ordersBtn.callback_data).toBe('cb_orders_menu');

      // Row 2: Profile & Language - MUST NOT have web_app
      const profileBtn = rows[2][0] as any;
      const langBtn = rows[2][1] as any;
      expect(profileBtn.text).toBe('👤 My Profile');
      expect(profileBtn.web_app).toBeUndefined();
      expect(profileBtn.callback_data).toBe('cb_profile_menu');
      expect(langBtn.text).toBe('🌐 Language');
      expect(langBtn.web_app).toBeUndefined();
      expect(langBtn.callback_data).toBe('cb_lang_menu');

      // Row 3: Rules & Help - MUST NOT have web_app
      const rulesBtn = rows[3][0] as any;
      const helpBtn = rows[3][1] as any;
      expect(rulesBtn.text).toBe('📜 Store Rules & Policies');
      expect(rulesBtn.web_app).toBeUndefined();
      expect(rulesBtn.callback_data).toBe('cb_main_rules');
      expect(helpBtn.text).toBe('❓ Help & FAQ');
      expect(helpBtn.web_app).toBeUndefined();
      expect(helpBtn.callback_data).toBe('cb_main_help');

      // Row 4: Primary WebApp button & Support Link
      const openStoreBtn = rows[4][0] as any;
      const supportBtn = rows[4][1] as any;
      expect(openStoreBtn.text).toBe('🛍️ Open Store');
      expect(openStoreBtn.web_app).toBeDefined();
      expect(openStoreBtn.web_app.url).toBe('https://store.uchiro.com');
      expect(supportBtn.text).toBe('💬 Contact Support');
      expect(supportBtn.web_app).toBeUndefined();
      expect(supportBtn.url).toMatch(/^https:\/\/t\.me\//);
    });

    it('honors English locale while maintaining single-WebApp-button policy', () => {
      const keyboard = getMainMenuKeyboard('https://store.uchiro.com', 'en');
      const rows = keyboard.reply_markup.inline_keyboard;

      expect(rows.length).toBe(5);

      const mainBtn = rows[4][0] as any;
      expect(mainBtn.text).toBe('🛍️ Open Mini App (Optional)');
      expect(mainBtn.web_app).toBeDefined();

      // Check that no button in rows 0..3 has web_app
      for (let r = 0; r < 4; r++) {
        for (const btn of rows[r]) {
          expect((btn as any).web_app).toBeUndefined();
        }
      }
    });
  });

  describe('2. Final Stealth Admin Gateway in production.ts', () => {
    it('returns strict HTTP 404 when /admin is accessed from a normal public browser', async () => {
      const res = await request(app)
        .get('/admin')
        .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/122.0.0.0 Safari/537.36');

      expect(res.status).toBe(404);
    });

    it('returns strict HTTP 404 when deep admin paths are accessed without Telegram context', async () => {
      const paths = ['/admin/orders', '/admin/inventory', '/admin/settings'];
      for (const p of paths) {
        const res = await request(app).get(p);
        expect(res.status).toBe(404);
      }
    });

    it('serves Admin SPA (never Store SPA) when launched inside Telegram Mini App on the secret slug', async () => {
      const res = await request(app)
        .get(`${ADMIN_BASE_PATH}?tgWebAppData=query_id%3DAAH_xxxxxx%26user%3D%257B%2522id%2522%253A123456789%257D`);

      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.headers['cache-control']).toBe('no-cache, no-store, must-revalidate');
      expect(res.text).toContain('UCHIRO ADMIN');
      expect(res.text).not.toContain('Uchiro Store - Blox Fruits');
    });

    it('serves Store SPA at / without colliding with /admin', async () => {
      const res = await request(app).get('/');
      expect(res.status).toBe(200);
      expect(res.headers['content-type']).toContain('text/html');
      expect(res.text).toContain('Uchiro Store');
    });
  });
});
