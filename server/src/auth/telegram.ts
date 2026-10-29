import { createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, RequestHandler, Response } from 'express';
import { DataStore } from '../database/data-store';

export interface VerifiedTelegramUser {
  id: string;
  username: string | null;
  firstName: string | null;
  authDate: number;
}

/** Env var names the bots/server already use for bot tokens. Add the exact names found in server/src/bots/* if different. */
const BOT_TOKEN_ENV_NAMES = ['STORE_BOT_TOKEN', 'ADMIN_BOT_TOKEN', 'TELEGRAM_BOT_TOKEN', 'BOT_TOKEN'];

export function getBotTokens(): string[] {
  const tokens: string[] = [];
  for (const name of BOT_TOKEN_ENV_NAMES) {
    const value = process.env[name];
    if (value && value.trim()) tokens.push(value.trim());
  }
  return Array.from(new Set(tokens));
}

function matchesToken(initData: string, botToken: string): boolean {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return false;
  params.delete('hash');

  const dataCheckString = Array.from(params.entries())
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('\n');

  const secretKey = createHmac('sha256', 'WebAppData').update(botToken).digest();
  const calculated = createHmac('sha256', secretKey).update(dataCheckString).digest();
  const received = Buffer.from(hash, 'hex');
  return received.length === calculated.length && timingSafeEqual(received, calculated);
}

export function verifyTelegramInitData(
  initData: string,
  botTokens: string[],
  maxAgeSeconds = 86400,
): VerifiedTelegramUser | null {
  if (!initData || botTokens.length === 0) return null;
  if (!botTokens.some((token) => matchesToken(initData, token))) return null;

  const params = new URLSearchParams(initData);
  const authDate = Number(params.get('auth_date'));
  if (!Number.isFinite(authDate) || Math.floor(Date.now() / 1000) - authDate > maxAgeSeconds) {
    return null;
  }

  const rawUser = params.get('user');
  if (!rawUser) return null;
  try {
    const parsed = JSON.parse(rawUser) as { id?: number | string; username?: string; first_name?: string };
    if (parsed.id === undefined || parsed.id === null) return null;
    return {
      id: String(parsed.id),
      username: parsed.username ?? null,
      firstName: parsed.first_name ?? null,
      authDate,
    };
  } catch {
    return null;
  }
}

export function extractInitData(req: Request): string {
  const header = req.headers['x-telegram-init-data'];
  if (typeof header === 'string' && header.length > 0) return header;
  const auth = req.headers.authorization;
  if (typeof auth === 'string' && auth.toLowerCase().startsWith('tma ')) return auth.slice(4).trim();
  return '';
}

export function getAdminIds(): Set<string> {
  const rawSources = [
    process.env.ADMIN_TELEGRAM_IDS,
    process.env.ADMIN_TELEGRAM_USER_IDS,
  ];
  const set = new Set<string>();
  for (const raw of rawSources) {
    if (!raw) continue;
    for (const part of raw.split(',')) {
      const trimmed = part.trim();
      if (trimmed) set.add(trimmed);
    }
  }

  // Also include durable admin users from DataStore (PostgreSQL admin_users)
  try {
    const dbAdmins = DataStore.getAdminUsers();
    for (const admin of dbAdmins) {
      if (admin.is_active && admin.telegram_id) {
        set.add(String(admin.telegram_id));
      }
    }
  } catch {
    // DataStore not ready yet fallback
  }

  return set;
}

/** Sets res.locals.telegramUser or answers 401. */
export function requireTelegramUser(req: Request, res: Response, next: NextFunction): void {
  const user = verifyTelegramInitData(extractInitData(req), getBotTokens());
  if (!user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  res.locals.telegramUser = user;
  next();
}

/** Valid initData AND Telegram id in ADMIN_TELEGRAM_IDS. Fails closed if the env var is empty. */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  const user = verifyTelegramInitData(extractInitData(req), getBotTokens());
  if (!user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return;
  }
  if (!getAdminIds().has(user.id)) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return;
  }
  res.locals.telegramUser = user;
  next();
}

export function getTelegramUserId(res: Response): string {
  const user = res.locals.telegramUser as VerifiedTelegramUser | undefined;
  if (!user) throw new Error('telegramUser missing: requireTelegramUser was not applied');
  return user.id;
}

/** Same, with a custom maximum initData age (used by the daily claim so long-open Mini Apps keep working). */
export function requireTelegramUserFor(maxAgeSeconds: number): RequestHandler {
  return (req, res, next): void => {
    const user = verifyTelegramInitData(extractInitData(req), getBotTokens(), maxAgeSeconds);
    if (!user) {
      res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
      return;
    }
    res.locals.telegramUser = user;
    next();
  };
}

