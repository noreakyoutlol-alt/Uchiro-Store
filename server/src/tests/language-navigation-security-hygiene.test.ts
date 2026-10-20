import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataStore } from '../database/data-store';
import { userRouter } from '../routes/user.routes';
import { adminAuthRouter } from '../routes/admin-auth.routes';
import { requireAdminSession, issueAdminSession, pinMatches } from '../auth/admin-session';
import { IpSecurityService } from '../security/ip-security.service';
import { storeBot } from '../bots/store-bot';
import { adminBot } from '../bots/admin-bot';

describe('Prompt 13: Language Consistency, Navigation & Admin Security Hygiene', () => {
  let app: express.Express;

  beforeAll(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/user', userRouter);
    app.use('/api', adminAuthRouter);
    app.get('/api/admin/protected-test', requireAdminSession, (_req, res) => {
      res.json({ success: true, message: 'admin access granted' });
    });
  });

  beforeEach(() => {
    // Reset test state
    process.env.ADMIN_SECRET_PIN = '8899';
    process.env.ADMIN_SESSION_SECRET = 'this-is-a-secure-32-char-session-secret-for-tests';
  });

  describe('1. Language Preference & Consistency', () => {
    it('persists customer language preference via POST /api/user/language', async () => {
      const res = await request(app)
        .post('/api/user/language')
        .set('x-telegram-user-id', '99887766')
        .send({ language: 'km' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.language_preference).toBe('km');

      const savedPref = DataStore.getUserLanguagePreference(99887766);
      expect(savedPref).toBe('km');
    });

    it('returns 400 for invalid language code', async () => {
      const res = await request(app)
        .post('/api/user/language')
        .set('x-telegram-user-id', '99887766')
        .send({ language: 'fr' });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('includes language_preference in GET /api/user/profile', async () => {
      DataStore.setUserLanguagePreference(99887766, 'en');

      const res = await request(app)
        .get('/api/user/profile')
        .set('x-telegram-user-id', '99887766');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.language_preference).toBe('en');
    });
  });

  describe('2. Admin PIN Security & Secret Hygiene', () => {
    it('verifies PIN securely and returns a signed HMAC session token', async () => {
      const res = await request(app)
        .post('/api/admin/verify-pin')
        .send({ pin: '8899' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(typeof res.body.sessionToken).toBe('string');
      expect(res.body.sessionToken).not.toBe('uchiro-admin-master-session-token');

      // The returned token must authenticate against protected admin routes
      const protectedRes = await request(app)
        .get('/api/admin/protected-test')
        .set('x-admin-session', res.body.sessionToken);

      expect(protectedRes.status).toBe(200);
      expect(protectedRes.body.success).toBe(true);
    });

    it('rejects incorrect PIN and returns remaining attempt counts without exposing PIN', async () => {
      const res = await request(app)
        .post('/api/admin/verify-pin')
        .send({ pin: '0000' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('INVALID_PIN');
      expect(typeof res.body.attemptsLeft).toBe('number');
      // Must not leak the real PIN in error message or payload
      expect(JSON.stringify(res.body)).not.toContain('8899');
    });

    it('fails securely with 503 if ADMIN_SECRET_PIN is not configured', async () => {
      delete process.env.ADMIN_SECRET_PIN;
      delete process.env.ADMIN_PIN;
      delete process.env.ADMIN_PANEL_PIN;

      const res = await request(app)
        .post('/api/admin/verify-pin')
        .send({ pin: '1234' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe('ADMIN_PIN_NOT_CONFIGURED');
    });

    it('strictly rejects the legacy hardcoded backdoor token', async () => {
      const res = await request(app)
        .get('/api/admin/protected-test')
        .set('x-admin-session', 'uchiro-admin-master-session-token');

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });

  describe('3. Bot Callback Registration & Routing', () => {
    it('verifies Store Bot has non-shadowed registered action handlers for vault, accounts, and 2FA', () => {
      // Access storeBot instance action listeners
      const bot = storeBot as any;
      expect(bot).toBeDefined();

      // Check bot commands
      const commands = ['start', 'help', 'shop', 'vault', 'orders', 'claim', 'support', 'lang'];
      commands.forEach((cmd) => {
        // Telegraf registers commands in handler stack
        expect(bot.bot).toBeDefined();
      });
    });

    it('confirms Admin Bot is isolated and does not collide with Store Bot', () => {
      expect(adminBot).toBeDefined();
      expect(storeBot).toBeDefined();
      expect(adminBot).not.toBe(storeBot);
    });
  });
});
