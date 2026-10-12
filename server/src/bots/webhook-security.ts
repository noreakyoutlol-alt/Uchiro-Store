import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';

type SecretEnvName = 'STORE_WEBHOOK_SECRET' | 'ADMIN_WEBHOOK_SECRET';

/** Rejects any POST that does not carry the secret Telegram sends in X-Telegram-Bot-Api-Secret-Token. */
export function webhookSecretGuard(envName: SecretEnvName): RequestHandler {
  return (req, res, next): void => {
    const expected = process.env[envName];
    const received = req.headers['x-telegram-bot-api-secret-token'];
    if (!expected || typeof received !== 'string') {
      res.sendStatus(401);
      return;
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.sendStatus(401);
      return;
    }
    next();
  };
}

interface RegisterOptions {
  label: string;
  token: string | undefined;
  url: string;
  secret: string | undefined;
}

async function registerTelegramWebhook(options: RegisterOptions): Promise<void> {
  const { label, token, url, secret } = options;
  if (!token) {
    console.error(`[webhook] ${label}: bot token missing, not registered`);
    return;
  }
  if (!secret || !/^[A-Za-z0-9_-]{16,256}$/.test(secret)) {
    console.error(`[webhook] ${label}: secret missing/invalid (16-256 chars of A-Za-z0-9_-), not registered`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: secret }),
    });
    const body = (await res.json()) as { ok: boolean; description?: string };
    if (!res.ok || !body.ok) {
      console.error(`[webhook] ${label}: setWebhook failed: ${body.description ?? res.status}`);
      return;
    }
    console.log(`[webhook] ${label}: registered ${url}`);
  } catch (err) {
    console.error(`[webhook] ${label}: setWebhook error:`, err instanceof Error ? err.message : 'unknown error');
  }
}

/** Call once after the server is listening, production only. */
export async function registerBotWebhooks(): Promise<void> {
  const serverUrl = (process.env.SERVER_URL ?? '').replace(/\/+$/, '');
  if (!serverUrl) {
    console.error('[webhook] SERVER_URL is not set; webhooks not registered');
    return;
  }
  await registerTelegramWebhook({
    label: 'store-bot',
    token: process.env.STORE_BOT_TOKEN,
    url: `${serverUrl}/api/webhook/store-bot`,
    secret: process.env.STORE_WEBHOOK_SECRET,
  });
  await registerTelegramWebhook({
    label: 'admin-bot',
    token: process.env.ADMIN_BOT_TOKEN,
    url: `${serverUrl}/api/webhook/admin-bot`,
    secret: process.env.ADMIN_WEBHOOK_SECRET,
  });
}
