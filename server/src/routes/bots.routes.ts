import { Router, Request, Response } from 'express';
import { storeBot } from '../bots/store-bot';
import { adminBot } from '../bots/admin-bot';
import { env } from '../config/env';

export const botsRouter = Router();
export const webhookRouter = Router();

/**
 * Store Bot Webhook Handler (@UchiroStore_BOT)
 * Validates incoming Telegram updates and secret token, then processes commands & customer fulfillment
 */
export async function handleStoreBotWebhook(req: Request, res: Response): Promise<void> {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expectedStoreSecret =
    process.env.STORE_BOT_WEBHOOK_SECRET ||
    process.env.STORE_WEBHOOK_SECRET ||
    env.STORE_BOT_WEBHOOK_SECRET;

  if (expectedStoreSecret && (!secret || secret !== expectedStoreSecret)) {
    res.status(401).send('Unauthorized: Invalid or missing secret token');
    return;
  }

  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      // Return HTTP 200 to prevent Telegram retry spam on empty/probe payloads
      res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
      return;
    }

    await storeBot.handleWebhookUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Store bot webhook error:', err);
    // Respond HTTP 200 to prevent Telegram retry spam on unexpected payload errors
    res.status(200).json({ ok: true, warning: err.message });
  }
}

/**
 * Admin Bot Webhook Handler (@uchiro_v2_admin_bot)
 * Validates incoming Telegram updates and secret token, then processes admin actions & alerts
 */
export async function handleAdminBotWebhook(req: Request, res: Response): Promise<void> {
  const secret = req.headers['x-telegram-bot-api-secret-token'];
  const expectedAdminSecret =
    process.env.ADMIN_BOT_WEBHOOK_SECRET ||
    process.env.ADMIN_WEBHOOK_SECRET ||
    env.ADMIN_BOT_WEBHOOK_SECRET;

  if (expectedAdminSecret && (!secret || secret !== expectedAdminSecret)) {
    res.status(401).send('Unauthorized: Invalid or missing secret token');
    return;
  }

  try {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      // Return HTTP 200 to prevent Telegram retry spam on empty/probe payloads
      res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
      return;
    }

    await adminBot.handleWebhookUpdate(req.body);
    res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error('Admin bot webhook error:', err);
    // Respond HTTP 200 to prevent Telegram retry spam on unexpected payload errors
    res.status(200).json({ ok: true, warning: err.message });
  }
}

// ----------------------------------------------------------------------
// Dedicated /api/webhook/* Router (Task 8 Section 1 & Section 3)
// ----------------------------------------------------------------------
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

  const storeRes = await storeBot.setWebhook(storeWebhookUrl, env.STORE_BOT_WEBHOOK_SECRET);
  const adminRes = await adminBot.setWebhook(adminWebhookUrl, env.ADMIN_BOT_WEBHOOK_SECRET);

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
