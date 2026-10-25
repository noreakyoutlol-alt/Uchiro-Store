import { Router, Request, Response } from 'express';
import { timingSafeEqual } from 'crypto';
import { storeBot } from '../bots/store-bot';
import { adminBot } from '../bots/admin-bot';
import { env } from '../config/env';
import { getStoreBotWebhookSecrets, getAdminBotWebhookSecrets } from '../bots/webhook-security';

export const botsRouter = Router();
export const webhookRouter = Router();

/**
 * Store Bot Webhook Handler (@UchiroStore_BOT)
 * Validates incoming Telegram updates and secret token, then processes commands & customer fulfillment
 */
export async function handleStoreBotWebhook(req: Request, res: Response): Promise<void> {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const validSecrets = getStoreBotWebhookSecrets();

  if (validSecrets.length === 0) {
    if (env.NODE_ENV === 'production') {
      console.warn('[webhook] Store bot unauthorized: No webhook secret configured in production');
      res.status(401).send('Unauthorized: Webhook secret not configured');
      return;
    }
  } else {
    if (!secret || typeof secret !== 'string') {
      console.warn('[webhook] Store bot unauthorized: Missing x-telegram-bot-api-secret-token header');
      res.status(401).send('Unauthorized: Missing secret token');
      return;
    }
    const cleanSecret = secret.trim();
    const matched = validSecrets.some((expected) => {
      if (expected.length !== cleanSecret.length) return false;
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(cleanSecret));
      } catch {
        return expected === cleanSecret;
      }
    });

    if (!matched) {
      console.warn(`[webhook] Store bot forbidden: Invalid secret token header (length ${cleanSecret.length})`);
      res.status(403).send('Forbidden: Invalid secret token');
      return;
    }
  }

  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      // Return HTTP 200 to prevent Telegram retry spam on empty/probe payloads
      res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
      return;
    }

    const updateId = req.body.update_id;
    console.log('[webhook] Store bot processing update ID:', updateId ?? 'unknown');
    const processed = await storeBot.handleWebhookUpdate(req.body);
    if (!res.headersSent) {
      if (processed === false) {
        res.status(503).json({ ok: false, error: 'bot_unavailable' });
      } else {
        res.status(200).json({ ok: true });
      }
    }
  } catch (err: any) {
    console.error('[webhook] Store bot processing error:', err?.message || 'unknown error');
    // Respond HTTP 200 to prevent Telegram retry spam on unexpected payload errors
    if (!res.headersSent) {
      res.status(200).json({ ok: true, warning: 'update_error' });
    }
  }
}

/**
 * Admin Bot Webhook Handler (@uchiro_v2_admin_bot)
 * Validates incoming Telegram updates and secret token, then processes admin actions & alerts
 */
export async function handleAdminBotWebhook(req: Request, res: Response): Promise<void> {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const validSecrets = getAdminBotWebhookSecrets();

  if (validSecrets.length === 0) {
    if (env.NODE_ENV === 'production') {
      console.warn('[webhook] Admin bot unauthorized: No webhook secret configured in production');
      res.status(401).send('Unauthorized: Webhook secret not configured');
      return;
    }
  } else {
    if (!secret || typeof secret !== 'string') {
      console.warn('[webhook] Admin bot unauthorized: Missing x-telegram-bot-api-secret-token header');
      res.status(401).send('Unauthorized: Missing secret token');
      return;
    }
    const cleanSecret = secret.trim();
    const matched = validSecrets.some((expected) => {
      if (expected.length !== cleanSecret.length) return false;
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(cleanSecret));
      } catch {
        return expected === cleanSecret;
      }
    });

    if (!matched) {
      console.warn(`[webhook] Admin bot forbidden: Invalid secret token header (length ${cleanSecret.length})`);
      res.status(403).send('Forbidden: Invalid secret token');
      return;
    }
  }

  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      // Return HTTP 200 to prevent Telegram retry spam on empty/probe payloads
      res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
      return;
    }

    const updateId = req.body.update_id;
    console.log('[webhook] Admin bot processing update ID:', updateId ?? 'unknown');
    const processed = await adminBot.handleWebhookUpdate(req.body);
    if (!res.headersSent) {
      if (processed === false) {
        res.status(503).json({ ok: false, error: 'bot_unavailable' });
      } else {
        res.status(200).json({ ok: true });
      }
    }
  } catch (err: any) {
    console.error('[webhook] Admin bot processing error:', err?.message || 'unknown error');
    // Respond HTTP 200 to prevent Telegram retry spam on unexpected payload errors
    if (!res.headersSent) {
      res.status(200).json({ ok: true, warning: 'update_error' });
    }
  }
}

// ----------------------------------------------------------------------
// Dedicated /api/webhook/* Router (Task 8 Section 1 & Section 3)
// ----------------------------------------------------------------------
webhookRouter.get(['/store-bot', '/store'], (_req, res) => res.json({ ok: true, bot: 'store-bot' }));
webhookRouter.get(['/admin-bot', '/admin'], (_req, res) => res.json({ ok: true, bot: 'admin-bot' }));

webhookRouter.post('/store-bot', handleStoreBotWebhook);
webhookRouter.post('/store', handleStoreBotWebhook);
webhookRouter.post('/admin-bot', handleAdminBotWebhook);
webhookRouter.post('/admin', handleAdminBotWebhook);

// ----------------------------------------------------------------------
// /api/bots/* Router (Diagnostics, Setup, & Backwards Compatibility)
// ----------------------------------------------------------------------
botsRouter.post('/store/webhook', handleStoreBotWebhook);
botsRouter.post('/store-bot', handleStoreBotWebhook);
botsRouter.post('/admin/webhook', handleAdminBotWebhook);
botsRouter.post('/admin-bot', handleAdminBotWebhook);

// Webhook Status & Diagnostics
botsRouter.get('/webhook/status', async (_req, res) => {
  const storeInfo = await storeBot.getWebhookInfo();
  const adminInfo = await adminBot.getWebhookInfo();

  res.json({
    success: true,
    data: {
      store_bot: {
        username: env.STORE_BOT_USERNAME,
        configured_webhook_url: env.STORE_BOT_WEBHOOK_URL,
        has_secret: Boolean(env.STORE_BOT_WEBHOOK_SECRET),
        telegram_status: storeInfo,
      },
      admin_bot: {
        username: env.ADMIN_BOT_USERNAME,
        configured_webhook_url: env.ADMIN_BOT_WEBHOOK_URL,
        has_secret: Boolean(env.ADMIN_BOT_WEBHOOK_SECRET),
        telegram_status: adminInfo,
      },
    },
  });
});

// Webhook Setup
botsRouter.post('/webhook/setup', async (req, res) => {
  const baseUrl = req.body?.base_url || env.APP_URL;
  const storeWebhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhook/store-bot`;
  const adminWebhookUrl = `${baseUrl.replace(/\/$/, '')}/api/webhook/admin-bot`;

  const activeStoreSecret = getStoreBotWebhookSecrets()[0];
  const activeAdminSecret = getAdminBotWebhookSecrets()[0];
  const storeRes = await storeBot.setWebhook(storeWebhookUrl, activeStoreSecret);
  const adminRes = await adminBot.setWebhook(adminWebhookUrl, activeAdminSecret);

  res.json({
    success: storeRes.success && adminRes.success,
    data: {
      store_bot: { url: storeWebhookUrl, result: storeRes },
      admin_bot: { url: adminWebhookUrl, result: adminRes },
    },
  });
});

// Webhook Teardown
botsRouter.post('/webhook/delete', async (_req, res) => {
  const storeRes = await storeBot.deleteWebhook();
  const adminRes = await adminBot.deleteWebhook();

  res.json({
    success: storeRes.success && adminRes.success,
    data: {
      store_bot: storeRes,
      admin_bot: adminRes,
    },
  });
});
