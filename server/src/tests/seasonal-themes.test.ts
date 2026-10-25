import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { DataStore, ALLOWED_SEASONAL_THEMES } from '../database/data-store';
import { env } from '../config/env';
import { handleAdminCallback, isMessageNotModifiedError } from '../bots/admin-bot/admin-actions';
import { SeasonalThemeId } from '../types';

describe('PROMPT 6: Seasonal Themes System Verification Suite', () => {
  let adminToken: string;
  let customerToken: string;
  const adminTgId = 88776655;
  const unauthorizedTgId = 12345678;

  beforeAll(() => {
    // Generate valid admin JWT token
    adminToken = jwt.sign(
      {
        id: 'admin_test_p6',
        telegram_id: adminTgId,
        user_id: String(adminTgId),
        role: 'admin',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Generate customer token (for non-admin testing)
    customerToken = jwt.sign(
      {
        id: 'customer_test_p6',
        telegram_id: unauthorizedTgId,
        user_id: String(unauthorizedTgId),
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    process.env.ADMIN_TELEGRAM_IDS = String(adminTgId);
  });

  beforeEach(() => {
    // Reset theme to default gaming before each test
    DataStore.setSeasonalTheme(adminTgId, 'gaming');
  });

  // =========================================================================
  // 1. Theme Configuration & Allowed Themes
  // =========================================================================
  describe('1. Theme Configuration & Allowed Themes', () => {
    it('provides exactly 4 supported theme IDs', () => {
      expect(ALLOWED_SEASONAL_THEMES).toEqual(['gaming', 'halloween', 'christmas', 'angkor-khmer']);
    });

    it('defaults to "gaming" when initialized', () => {
      const themeConfig = DataStore.getSeasonalTheme();
      expect(themeConfig.active_theme).toBe('gaming');
      expect(themeConfig.available_themes).toContain('gaming');
      expect(themeConfig.available_themes).toContain('halloween');
      expect(themeConfig.available_themes).toContain('christmas');
      expect(themeConfig.available_themes).toContain('angkor-khmer');
    });

    it('validates allowed themes and rejects unknown theme IDs in DataStore', () => {
      expect(DataStore.isValidSeasonalTheme('gaming')).toBe(true);
      expect(DataStore.isValidSeasonalTheme('halloween')).toBe(true);
      expect(DataStore.isValidSeasonalTheme('christmas')).toBe(true);
      expect(DataStore.isValidSeasonalTheme('angkor-khmer')).toBe(true);

      expect(DataStore.isValidSeasonalTheme('invalid_theme')).toBe(false);
      expect(DataStore.isValidSeasonalTheme('easter')).toBe(false);
      expect(DataStore.isValidSeasonalTheme(null)).toBe(false);
      expect(DataStore.isValidSeasonalTheme(123)).toBe(false);

      expect(() => {
        DataStore.setSeasonalTheme(adminTgId, 'unknown_theme');
      }).toThrow();
    });
  });

  // =========================================================================
  // 2. Public Store Endpoints (Read-Only)
  // =========================================================================
  describe('2. Public Store Endpoints (Read-Only)', () => {
    it('GET /api/store/theme returns active theme and timestamp', async () => {
      const res = await request(app).get('/api/store/theme');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.active_theme).toBe('gaming');
      expect(res.body.data.updated_at).toBeDefined();
    });

    it('GET /api/store/settings includes current seasonal theme info', async () => {
      const res = await request(app).get('/api/store/settings');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.seasonal_theme).toBe('gaming');
    });

    it('public routes forbid theme mutation (POST/PUT on store route)', async () => {
      const postRes = await request(app).post('/api/store/theme').send({ theme: 'halloween' });
      // Should return 404 or 405 (route does not exist on storeRouter)
      expect([404, 405]).toContain(postRes.status);

      const putRes = await request(app).put('/api/store/theme').send({ theme: 'halloween' });
      expect([404, 405]).toContain(putRes.status);
    });
  });

  // =========================================================================
  // 3. Admin Authentication & Mutation Security
  // =========================================================================
  describe('3. Admin Authentication & Mutation Security', () => {
    it('rejects unauthenticated requests to GET /api/admin/theme with 401', async () => {
      const res = await request(app).get('/api/admin/theme');
      expect(res.status).toBe(401);
    });

    it('rejects unauthenticated requests to PUT /api/admin/theme with 401', async () => {
      const res = await request(app).put('/api/admin/theme').send({ theme: 'halloween' });
      expect(res.status).toBe(401);
    });

    it('rejects customer tokens (non-admin role) with 403 or 401', async () => {
      const res = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ theme: 'halloween' });
      expect([401, 403]).toContain(res.status);
    });

    it('rejects invalid theme IDs with 400', async () => {
      const res = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'cyberpunk_2077' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('rejects empty or missing theme with 400', async () => {
      const res = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  // =========================================================================
  // 4. Admin Activation & Public Synchronization
  // =========================================================================
  describe('4. Admin Activation & Public Synchronization', () => {
    const testThemes: SeasonalThemeId[] = ['halloween', 'christmas', 'angkor-khmer', 'gaming'];

    for (const theme of testThemes) {
      it(`activates "${theme}" via admin PUT and reflects immediately in public store`, async () => {
        const updateRes = await request(app)
          .put('/api/admin/theme')
          .set('Authorization', `Bearer ${adminToken}`)
          .send({ theme });

        expect(updateRes.status).toBe(200);
        expect(updateRes.body.success).toBe(true);
        expect(updateRes.body.data.active_theme).toBe(theme);

        // Immediate public store check
        const storeRes = await request(app).get('/api/store/theme');
        expect(storeRes.status).toBe(200);
        expect(storeRes.body.data.active_theme).toBe(theme);

        // Immediate store settings check
        const settingsRes = await request(app).get('/api/store/settings');
        expect(settingsRes.status).toBe(200);
        expect(settingsRes.body.data.seasonal_theme).toBe(theme);
      });
    }

    it('is idempotent: activating the same theme repeatedly succeeds cleanly', async () => {
      const res1 = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'halloween' });
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'halloween' });
      expect(res2.status).toBe(200);
      expect(res2.body.data.active_theme).toBe('halloween');
    });

    it('switching back to "gaming" restores default gaming state cleanly', async () => {
      // First switch to Christmas
      await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'christmas' });

      // Then restore to gaming
      const restoreRes = await request(app)
        .put('/api/admin/theme')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ theme: 'gaming' });

      expect(restoreRes.status).toBe(200);
      expect(restoreRes.body.data.active_theme).toBe('gaming');

      const storeRes = await request(app).get('/api/store/theme');
      expect(storeRes.body.data.active_theme).toBe('gaming');
    });
  });

  // =========================================================================
  // 5. Admin Telegram Bot Controls & Actions
  // =========================================================================
  describe('5. Admin Telegram Bot Controls & Actions', () => {
    const mockStoreUrl = 'https://t.me/uchiro_bot/store';
    const mockAdminUrl = 'https://uchiro.example.com/noreakyoutadmindashboard';

    it('rejects unauthorized Telegram users from theme menu', async () => {
      const unauthorizedFrom = { id: unauthorizedTgId, first_name: 'Hacker' };
      const view = await handleAdminCallback('admin:theme:menu', unauthorizedFrom, mockStoreUrl, mockAdminUrl);
      expect(view?.text).toContain('Access denied');
    });

    it('renders theme menu for authorized admin with all supported themes', async () => {
      const adminFrom = { id: adminTgId, first_name: 'Admin' };
      const view = await handleAdminCallback('admin:theme:menu', adminFrom, mockStoreUrl, mockAdminUrl);

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Seasonal Store Themes');
      expect(view?.text).toContain('Default Gaming');
      expect(view?.text).toContain('Halloween');
      expect(view?.text).toContain('Christmas');
      expect(view?.text).toContain('Angkor / Khmer');

      // Check inline buttons
      const flatButtons = view?.replyMarkup.inline_keyboard.flat() || [];
      const buttonCallbacks = flatButtons.map((b: any) => b.callback_data).filter(Boolean);
      expect(buttonCallbacks).toContain('admin:theme:select:gaming');
      expect(buttonCallbacks).toContain('admin:theme:select:halloween');
      expect(buttonCallbacks).toContain('admin:theme:select:christmas');
      expect(buttonCallbacks).toContain('admin:theme:select:angkor-khmer');
    });

    it('theme select callback shows details and store preview link with query parameter', async () => {
      const adminFrom = { id: adminTgId, first_name: 'Admin' };
      const view = await handleAdminCallback('admin:theme:select:halloween', adminFrom, mockStoreUrl, mockAdminUrl);

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Theme: Halloween');
      expect(view?.text).toContain('Spooky web decorations');

      const flatButtons = view?.replyMarkup.inline_keyboard.flat() || [];
      const previewButton = flatButtons.find((b: any) => b.text.includes('Preview in Store'));
      expect(previewButton).toBeDefined();
      expect((previewButton as any)?.url).toContain('theme=halloween');

      const activateButton = flatButtons.find((b: any) => b.text.includes('Activate Globally'));
      expect(activateButton).toBeDefined();
      expect((activateButton as any)?.callback_data).toBe('admin:theme:confirm:halloween');
    });

    it('theme confirm callback presents explicit confirmation before changing global setting', async () => {
      const adminFrom = { id: adminTgId, first_name: 'Admin' };
      const view = await handleAdminCallback('admin:theme:confirm:angkor-khmer', adminFrom, mockStoreUrl, mockAdminUrl);

      expect(view).not.toBeNull();
      expect(view?.text).toContain('CONFIRM GLOBAL THEME ACTIVATION');
      expect(view?.text).toContain('Angkor / Khmer');
      expect(view?.text?.toLowerCase()).toContain('immediate across all customer sessions');

      const flatButtons = view?.replyMarkup.inline_keyboard.flat() || [];
      const yesButton = flatButtons.find((b: any) => (b as any).callback_data === 'admin:theme:do_activate:angkor-khmer');
      const cancel = flatButtons.find((b: any) => (b as any).callback_data === 'admin:theme:select:angkor-khmer');
      expect(yesButton).toBeDefined();
      expect(cancel).toBeDefined();
    });

    it('theme do_activate callback mutates global theme and confirms success', async () => {
      const adminFrom = { id: adminTgId, first_name: 'Admin' };
      const view = await handleAdminCallback('admin:theme:do_activate:christmas', adminFrom, mockStoreUrl, mockAdminUrl);

      expect(view).not.toBeNull();
      expect(view?.text).toContain('Theme Activated Successfully!');
      expect(view?.text).toContain('Christmas');

      // Verify global state updated
      const current = DataStore.getSeasonalTheme();
      expect(current.active_theme).toBe('christmas');
    });

    it('handles Telegram "message is not modified" error safely', () => {
      expect(isMessageNotModifiedError({ message: 'Bad Request: message is not modified' })).toBe(true);
      expect(isMessageNotModifiedError({ description: 'message is not modified: specified new message content is the same' })).toBe(true);
      expect(isMessageNotModifiedError({ message: 'Network timeout' })).toBe(false);
      expect(isMessageNotModifiedError(null)).toBe(false);
    });
  });
});
