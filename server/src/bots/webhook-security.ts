import { timingSafeEqual } from 'crypto';
import type { RequestHandler } from 'express';
import { resolveServerUrl } from '../config/app-url';
import { env } from '../config/env';

type SecretEnvName = 'STORE_WEBHOOK_SECRET' | 'ADMIN_WEBHOOK_SECRET';

export function getStoreBotWebhookSecrets(): string[] {
  const configured = [
    process.env.STORE_WEBHOOK_SECRET,
    process.env.STORE_BOT_WEBHOOK_SECRET,
  ]
    .filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim().length > 0))
    .map((s) => s.trim());

  if (configured.length > 0) {
    return Array.from(new Set(configured));
  }

  const fallback = (env.STORE_BOT_WEBHOOK_SECRET || '').trim();
  return fallback ? [fallback] : [];
}

export function getAdminBotWebhookSecrets(): string[] {
  const configured = [
    process.env.ADMIN_WEBHOOK_SECRET,
    process.env.ADMIN_BOT_WEBHOOK_SECRET,
  ]
    .filter((s): s is string => Boolean(s && typeof s === 'string' && s.trim().length > 0))
    .map((s) => s.trim());

  if (configured.length > 0) {
    return Array.from(new Set(configured));
  }

  const fallback = (env.ADMIN_BOT_WEBHOOK_SECRET || '').trim();
  return fallback ? [fallback] : [];
}

/** Rejects any POST that does not carry the secret Telegram sends in X-Telegram-Bot-Api-Secret-Token. */
export function webhookSecretGuard(envName: SecretEnvName): RequestHandler {
  return (req, res, next): void => {
    const validSecrets =
      envName === 'STORE_WEBHOOK_SECRET'
        ? getStoreBotWebhookSecrets()
        : getAdminBotWebhookSecrets();

    const received = req.headers['x-telegram-bot-api-secret-token'];
    if (!received || typeof received !== 'string') {
      res.sendStatus(401);
      return;
    }

    if (validSecrets.length === 0) {
      res.sendStatus(401);
      return;
    }

    const cleanReceived = received.trim();
    const matched = validSecrets.some((expected) => {
      if (expected.length !== cleanReceived.length) return false;
      try {
        return timingSafeEqual(Buffer.from(expected), Buffer.from(cleanReceived));
      } catch {
        return expected === cleanReceived;
      }
    });

    if (!matched) {
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
  const cleanToken = (token || '').trim();
  if (!cleanToken) {
    console.error(`[webhook] ${label}: bot token missing, not registered`);
    return;
  }
  const cleanSecret = (secret || '').trim();
  if (!cleanSecret || !/^[A-Za-z0-9_-]{1,256}$/.test(cleanSecret)) {
    console.error(`[webhook] ${label}: secret missing or invalid (1-256 chars of A-Za-z0-9_-), not registered`);
    return;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${cleanToken}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url, secret_token: cleanSecret }),
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
  if (!serverUrl || !serverUrl.startsWith('https://')) {
    console.error(`[webhook] Valid HTTPS Server URL is not set (${serverUrl}); webhooks not registered`);
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

  await Promise.allSettled([
    registerTelegramWebhook({
      label: 'store-bot',
      token: (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim(),
      url: `${serverUrl}/api/webhook/store-bot`,
      secret: storeSecret,
    }),
    registerTelegramWebhook({
      label: 'admin-bot',
      token: (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim(),
      url: `${serverUrl}/api/webhook/admin-bot`,
      secret: adminSecret,
    }),
  ]);
}
