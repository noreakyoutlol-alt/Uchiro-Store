import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { resolveServerUrl } from '../config/app-url';
import { env } from '../config/env';

type SecretEnvName = 'STORE_WEBHOOK_SECRET' | 'ADMIN_WEBHOOK_SECRET';

export function getStoreBotWebhookSecrets(): string[] {
  return [
    process.env.STORE_WEBHOOK_SECRET,
    process.env.STORE_BOT_WEBHOOK_SECRET,
    env.STORE_BOT_WEBHOOK_SECRET,
  ].filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim().length > 0));
}

export function getAdminBotWebhookSecrets(): string[] {
  return [
    process.env.ADMIN_WEBHOOK_SECRET,
    process.env.ADMIN_BOT_WEBHOOK_SECRET,
    env.ADMIN_BOT_WEBHOOK_SECRET,
  ].filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim().length > 0));
}

/** Rejects any POST that does not carry the secret Telegram sends in X-Telegram-Bot-Api-Secret-Token. */
export function webhookSecretGuard(envName: SecretEnvName): RequestHandler {
  return (req, res, next): void => {
    const fallbackName =
      envName === 'STORE_WEBHOOK_SECRET' ? 'STORE_BOT_WEBHOOK_SECRET' : 'ADMIN_BOT_WEBHOOK_SECRET';
    const expected = process.env[envName] || process.env[fallbackName];
    const received = req.headers['x-telegram-bot-api-secret-token'];
    if (!expected || typeof received !== 'string') {
      res.sendStatus(401);
      return;
    }
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      res.sendStatus(403);
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
  const serverUrl = resolveServerUrl();
  if (!serverUrl) {
    console.error('[webhook] Server URL is not set; webhooks not registered');
    return;
  }
  const storeSecret =
    process.env.STORE_WEBHOOK_SECRET ||
    process.env.STORE_BOT_WEBHOOK_SECRET ||
    env.STORE_BOT_WEBHOOK_SECRET;

  const adminSecret =
    process.env.ADMIN_WEBHOOK_SECRET ||
    process.env.ADMIN_BOT_WEBHOOK_SECRET ||
    env.ADMIN_BOT_WEBHOOK_SECRET;

  await registerTelegramWebhook({
    label: 'store-bot',
    token: (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim(),
    url: `${serverUrl}/api/webhook/store-bot`,
    secret: storeSecret,
  });
  await registerTelegramWebhook({
    label: 'admin-bot',
    token: (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim(),
    url: `${serverUrl}/api/webhook/admin-bot`,
    secret: adminSecret,
  });
}
