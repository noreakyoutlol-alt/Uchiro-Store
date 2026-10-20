import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { env } from '../config/env';
import { DataStore } from '../database/data-store';
import {
  BroadcastService,
  validateBroadcastParams,
  validateButtonUrl,
  validateButtonLabel,
  buildBroadcastMessageForRecipient,
} from '../services/broadcast.service';
import {
  startBroadcastWizard,
  handleBroadcastWizardCallback,
  handleBroadcastWizardMessage,
  hasActiveBroadcastWizard,
  clearBroadcastWizardSession,
  getBroadcastWizardSession,
} from '../bots/admin-bot/broadcast-wizard';
import { NotificationService } from '../services/notification.service';
import { BroadcastCampaign } from '../types';

describe('UNIFIED BROADCAST CENTER & IN-CHAT WIZARD SPRINT', () => {
  const adminTgId = 123456789;
  const adminToken = jwt.sign(
    { telegram_id: adminTgId, user_id: 'admin_test_1', role: 'admin' },
    env.JWT_SECRET
  );

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ADMIN_TELEGRAM_IDS = String(adminTgId);
    clearBroadcastWizardSession(adminTgId);
  });

  // ── 1. PAYLOAD VALIDATION & SECURITY SAFEGUARDS ─────────────────────────────

  describe('1. Validation & Security Safeguards', () => {
    it('validates custom button URLs and strictly rejects dangerous schemes', () => {
      expect(validateButtonUrl('https://uchiro.store').valid).toBe(true);
      expect(validateButtonUrl('http://uchiro.store').valid).toBe(true);

      // Dangerous schemes must be rejected
      expect(validateButtonUrl('javascript:alert(1)').valid).toBe(false);
      expect(validateButtonUrl('data:text/html,<script>alert(1)</script>').valid).toBe(false);
      expect(validateButtonUrl('file:///etc/passwd').valid).toBe(false);
      expect(validateButtonUrl('ftp://example.com').valid).toBe(false);
      expect(validateButtonUrl('').valid).toBe(false);
      expect(validateButtonUrl('not_a_url').valid).toBe(false);
    });

    it('validates button labels: allows English, rejects non-Latin scripts and overly long labels', () => {
      expect(validateButtonLabel('Shop Now').valid).toBe(true);
      expect(validateButtonLabel('Join Discord! 🚀').valid).toBe(true);
      expect(validateButtonLabel('').valid).toBe(false);
      expect(validateButtonLabel('a'.repeat(65)).valid).toBe(false); // Max 64 chars
      expect(validateButtonLabel('ទិញឥឡូវនេះ').valid).toBe(false); // Khmer script rejected for button label
      expect(validateButtonLabel('Купить сейчас').valid).toBe(false); // Cyrillic rejected for button label
    });

    it('rejects text exceeding Telegram 4096 character limit', () => {
      const longText = 'A'.repeat(4097);
      const res = validateBroadcastParams({
        type: 'text_only',
        text: longText,
      });
      expect(res.valid).toBe(false);
      expect(res.errors.some((e) => e.includes('4096'))).toBe(true);
    });

    it('validates media_caption parameters: requires https media_url and photo/video type', () => {
      const invalidType = validateBroadcastParams({
        type: 'media_caption',
        media_type: 'audio' as any,
        media_url: 'https://example.com/audio.mp3',
      });
      expect(invalidType.valid).toBe(false);

      const invalidUrl = validateBroadcastParams({
        type: 'media_caption',
        media_type: 'photo',
        media_url: 'http://insecure.com/pic.jpg', // must be https
      });
      expect(invalidUrl.valid).toBe(false);

      const validMedia = validateBroadcastParams({
        type: 'media_caption',
        media_type: 'photo',
        media_url: 'https://example.com/pic.jpg',
        text: 'Special promo caption',
      });
      expect(validMedia.valid).toBe(true);
    });
  });

  // ── 2. BILINGUAL RECIPIENT RESOLUTION & LANGUAGE PREFERENCE ─────────────────

  describe('2. Bilingual Support & Language Preference Routing', () => {
    it('routes Khmer text to Khmer-preference user and English to English user', () => {
      const campaign: BroadcastCampaign = {
        id: 'camp_bilingual_test',
        type: 'text_only',
        audience: 'all',
        text_km: 'សូមស្វាគមន៍មកកាន់ UCHIRO STORE',
        text_en: 'Welcome to Uchiro Store',
        status: 'draft',
        created_at: new Date().toISOString(),
        created_by_admin: 'test_admin',
        target_count: 2,
        sent_count: 0,
        failed_count: 0,
        blocked_count: 0,
        skipped_count: 0,
      };

      const kmMessage = buildBroadcastMessageForRecipient(campaign, 'km');
      expect(kmMessage.text).toBe('សូមស្វាគមន៍មកកាន់ UCHIRO STORE');

      const enMessage = buildBroadcastMessageForRecipient(campaign, 'en');
      expect(enMessage.text).toBe('Welcome to Uchiro Store');

      // Null or empty language defaults to English
      const defaultMessage = buildBroadcastMessageForRecipient(campaign, null);
      expect(defaultMessage.text).toBe('Welcome to Uchiro Store');
    });

    it('uses common text for all recipients when single text is provided without bilingual toggle', () => {
      const campaign: BroadcastCampaign = {
        id: 'camp_single_test',
        type: 'text_only',
        audience: 'all',
        text: 'Global Store Maintenance Notice',
        status: 'draft',
        created_at: new Date().toISOString(),
        created_by_admin: 'test_admin',
        target_count: 1,
        sent_count: 0,
        failed_count: 0,
        blocked_count: 0,
        skipped_count: 0,
      };

      expect(buildBroadcastMessageForRecipient(campaign, 'km').text).toBe('Global Store Maintenance Notice');
      expect(buildBroadcastMessageForRecipient(campaign, 'en').text).toBe('Global Store Maintenance Notice');
    });

    it('attaches official Store Mini App button for text_shop_now type', () => {
      const campaign: BroadcastCampaign = {
        id: 'camp_shop_now',
        type: 'text_shop_now',
        audience: 'all',
        text: 'Flash Sale Live Now!',
        status: 'draft',
        created_at: new Date().toISOString(),
        created_by_admin: 'test_admin',
        target_count: 1,
        sent_count: 0,
        failed_count: 0,
        blocked_count: 0,
        skipped_count: 0,
      };

      const msg = buildBroadcastMessageForRecipient(campaign, 'en');
      expect(msg.replyMarkup).toBeDefined();
      expect(msg.replyMarkup.inline_keyboard[0][0].text).toContain('Shop Now');
    });
  });

  // ── 3. REST API ENDPOINTS & ACCESS CONTROL ──────────────────────────────────

  describe('3. Admin REST API Protection & Endpoints', () => {
    it('rejects unauthenticated requests to broadcast endpoints', async () => {
      const res = await request(app).get('/api/admin/broadcast/campaigns');
      expect(res.status).toBe(401);
    });

    it('POST /api/admin/broadcast/preview generates preview without creating campaign', async () => {
      const res = await request(app)
        .post('/api/admin/broadcast/preview')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'text_custom_button',
          audience: 'all',
          text: 'Exclusive VIP Discount',
          button: {
            label: 'Claim VIP',
            url: 'https://uchiro.store/vip',
          },
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.target_count).toBeGreaterThanOrEqual(0);
      expect(res.body.data.preview_en.text).toBe('Exclusive VIP Discount');
      expect(res.body.data.preview_en.button.label).toBe('Claim VIP');
    });

    it('creates, lists, cancels and confirms a broadcast campaign', async () => {
      // 1. Create Campaign
      const createRes = await request(app)
        .post('/api/admin/broadcast/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'text_shop_now',
          audience: 'all',
          text: 'Restock Alert — 1,000 Robux Available!',
        });

      expect(createRes.status).toBe(201);
      expect(createRes.body.success).toBe(true);
      const campaignId = createRes.body.data.campaign.id;
      expect(campaignId).toBeDefined();

      // 2. List Campaigns
      const listRes = await request(app)
        .get('/api/admin/broadcast/campaigns')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(listRes.status).toBe(200);
      expect(listRes.body.data.some((c: any) => c.id === campaignId)).toBe(true);

      // 3. Confirm Send
      const confirmRes = await request(app)
        .post(`/api/admin/broadcast/campaigns/${campaignId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(confirmRes.status).toBe(200);
      expect(confirmRes.body.success).toBe(true);
      expect(confirmRes.body.data.status).toBe('pending');

      // 4. Double confirm is idempotent
      const doubleConfirm = await request(app)
        .post(`/api/admin/broadcast/campaigns/${campaignId}/confirm`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(doubleConfirm.status).toBe(200);
      // Status shouldn't crash or re-dispatch
      expect(['pending', 'running', 'completed']).toContain(doubleConfirm.body.data.status);
    });

    it('enforces idempotency key on creation', async () => {
      const key = `idem_${Date.now()}`;
      const res1 = await request(app)
        .post('/api/admin/broadcast/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          idempotency_key: key,
          type: 'text_only',
          text: 'Idempotent Broadcast Test',
        });

      const res2 = await request(app)
        .post('/api/admin/broadcast/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          idempotency_key: key,
          type: 'text_only',
          text: 'Idempotent Broadcast Test (retry)',
        });

      expect(res1.status).toBe(201);
      expect(res2.status).toBe(201);
      // Both return the exact same campaign ID
      expect(res1.body.data.campaign.id).toBe(res2.body.data.campaign.id);
    });

    it('allows cancelling a draft campaign', async () => {
      const createRes = await request(app)
        .post('/api/admin/broadcast/campaigns')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          type: 'text_only',
          text: 'To be cancelled',
        });

      const id = createRes.body.data.campaign.id;
      const cancelRes = await request(app)
        .post(`/api/admin/broadcast/campaigns/${id}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`);

      expect(cancelRes.status).toBe(200);
      expect(cancelRes.body.data.status).toBe('cancelled');
    });
  });

  // ── 4. TELEGRAM ADMIN BOT IN-CHAT WIZARD ────────────────────────────────────

  describe('4. Telegram Admin Bot In-Chat Wizard', () => {
    it('starts wizard with English button labels (Text Only, Text + Shop Now, Text + Custom Button, Media + Caption, Cancel)', () => {
      const view = startBroadcastWizard(adminTgId);
      expect(view.text).toContain('Store Broadcast Wizard');

      const buttons = view.replyMarkup.inline_keyboard.flat();
      const buttonTexts = buttons.map((b: any) => b.text);

      expect(buttonTexts).toContain('Text Only');
      expect(buttonTexts).toContain('Text + Shop Now');
      expect(buttonTexts).toContain('Text + Custom Button');
      expect(buttonTexts).toContain('Media + Caption');
      expect(buttonTexts).toContain('Cancel');
    });

    it('handles type selection and progresses wizard step', async () => {
      startBroadcastWizard(adminTgId);

      const view = await handleBroadcastWizardCallback('wiz_bc_type:text_shop_now', { id: adminTgId });
      expect(view).not.toBeNull();
      expect(view!.text).toContain('Enter Broadcast Message');

      const session = getBroadcastWizardSession(adminTgId);
      expect(session).toBeDefined();
      expect(session!.step).toBe('enter_text');
      expect(session!.type).toBe('text_shop_now');
    });

    it('progresses to preview_confirm when text is entered for text_shop_now', async () => {
      startBroadcastWizard(adminTgId);
      await handleBroadcastWizardCallback('wiz_bc_type:text_shop_now', { id: adminTgId });

      const fakeCtx = {
        from: { id: adminTgId },
        message: { text: 'Huge Black Friday Discount across all game keys!' },
        reply: vi.fn(),
      };

      const handled = await handleBroadcastWizardMessage(fakeCtx);
      expect(handled).toBe(true);

      const session = getBroadcastWizardSession(adminTgId);
      expect(session!.step).toBe('preview_confirm');
      expect(session!.campaignId).toBeDefined();
      expect(fakeCtx.reply).toHaveBeenCalled();

      const [replyText, replyOpts] = fakeCtx.reply.mock.calls[0];
      expect(replyText).toContain('BROADCAST PREVIEW & CONFIRMATION');
      expect(replyText).toContain('Shop Now');

      // Check confirm button is present
      const replyButtons = replyOpts.reply_markup.inline_keyboard.flat().map((b: any) => b.text);
      expect(replyButtons.some((t: string) => t.includes('Confirm Send'))).toBe(true);
      expect(replyButtons.some((t: string) => t.includes('Cancel'))).toBe(true);
    });

    it('requires English label and valid URL for custom button flow in chat', async () => {
      startBroadcastWizard(adminTgId);
      await handleBroadcastWizardCallback('wiz_bc_type:text_custom_button', { id: adminTgId });

      // Step 1: Send message text
      const msgCtx = {
        from: { id: adminTgId },
        message: { text: 'Join our official tournament!' },
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(msgCtx);

      let session = getBroadcastWizardSession(adminTgId);
      expect(session!.step).toBe('enter_btn_label');

      // Step 2: Send invalid label (Khmer or too long)
      const invalidLabelCtx = {
        from: { id: adminTgId },
        message: { text: 'ចូលរួមឥឡូវនេះ' }, // non-Latin rejected
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(invalidLabelCtx);
      expect(invalidLabelCtx.reply).toHaveBeenCalledWith(expect.stringContaining('English button label'));

      // Send valid English label
      const validLabelCtx = {
        from: { id: adminTgId },
        message: { text: 'Join Discord' },
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(validLabelCtx);

      session = getBroadcastWizardSession(adminTgId);
      expect(session!.step).toBe('enter_btn_url');

      // Step 3: Send invalid dangerous URL
      const invalidUrlCtx = {
        from: { id: adminTgId },
        message: { text: 'javascript:alert(1)' },
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(invalidUrlCtx);
      expect(invalidUrlCtx.reply).toHaveBeenCalledWith(expect.stringContaining('valid URL starting with http:// or https://'));

      // Send valid URL
      const validUrlCtx = {
        from: { id: adminTgId },
        message: { text: 'https://discord.gg/uchiro' },
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(validUrlCtx);

      session = getBroadcastWizardSession(adminTgId);
      expect(session!.step).toBe('preview_confirm');
      expect(validUrlCtx.reply).toHaveBeenCalledWith(
        expect.stringContaining('Join Discord'),
        expect.anything()
      );
    });

    it('cancels wizard cleanly on wiz_bc_cancel callback', async () => {
      startBroadcastWizard(adminTgId);
      expect(hasActiveBroadcastWizard(adminTgId)).toBe(true);

      const view = await handleBroadcastWizardCallback('wiz_bc_cancel', { id: adminTgId });
      expect(view!.text).toContain('Broadcast Cancelled');
      expect(hasActiveBroadcastWizard(adminTgId)).toBe(false);
    });

    it('confirms send and clears wizard session preventing duplicate sends', async () => {
      startBroadcastWizard(adminTgId);
      await handleBroadcastWizardCallback('wiz_bc_type:text_only', { id: adminTgId });

      const msgCtx = {
        from: { id: adminTgId },
        message: { text: 'System maintenance scheduled tonight at 12:00 AM UTC.' },
        reply: vi.fn(),
      };
      await handleBroadcastWizardMessage(msgCtx);

      expect(hasActiveBroadcastWizard(adminTgId)).toBe(true);

      // Confirm send
      const view = await handleBroadcastWizardCallback('wiz_bc_confirm', { id: adminTgId });
      expect(view!.text).toContain('Broadcast Dispatched!');
      expect(hasActiveBroadcastWizard(adminTgId)).toBe(false);

      // Second click returns not found / already dispatched
      const secondView = await handleBroadcastWizardCallback('wiz_bc_confirm', { id: adminTgId });
      expect(secondView!.text).toContain('No active broadcast wizard found');
    });
  });

  // ── 5. BOT INTEGRATION ON /broadcast COMMAND ────────────────────────────────

  describe('5. Admin Bot Interactive Menu / Broadcast Callback Entry', () => {
    it('opens wizard when admin clicks cb_admin_broadcast button in admin menu', async () => {
      const view = await handleBroadcastWizardCallback('cb_admin_broadcast', { id: adminTgId });
      expect(view).not.toBeNull();
      expect(view!.text).toContain('Store Broadcast Wizard');
      expect(hasActiveBroadcastWizard(adminTgId)).toBe(true);
    });
  });
});
