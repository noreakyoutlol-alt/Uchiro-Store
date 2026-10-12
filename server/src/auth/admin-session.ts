import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import { extractInitData, getAdminIds, verifyTelegramInitData } from './telegram';

export const ADMIN_SESSION_HEADER = 'x-admin-session';
const SESSION_TTL_SECONDS = 2 * 60 * 60;
const INITDATA_MAX_AGE_SECONDS = 24 * 60 * 60;

interface SessionPayload {
  sub: string;
  iat: number;
  exp: number;
}

function getSessionSecret(): Buffer | null {
  const secret = process.env.ADMIN_SESSION_SECRET;
  return secret && secret.length >= 32 ? Buffer.from(secret, 'utf8') : null;
}

function sign(payloadB64: string, secret: Buffer): Buffer {
  return createHmac('sha256', secret).update(payloadB64).digest();
}

/** PIN must be exactly 6 digits and the session secret at least 32 chars; otherwise admin login is disabled. */
export function isAdminPinConfigured(): boolean {
  return /^\d{6}$/.test(process.env.ADMIN_SECRET_PIN ?? '') && getSessionSecret() !== null;
}

export function pinMatches(candidate: string): boolean {
  const expected = process.env.ADMIN_SECRET_PIN ?? '';
  if (!/^\d{6}$/.test(expected) || !/^\d{6}$/.test(candidate)) return false;
  const a = createHash('sha256').update(candidate).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

export function issueAdminSession(telegramId: string): { token: string; expiresAt: number } {
  const secret = getSessionSecret();
  if (!secret) throw new Error('ADMIN_SESSION_SECRET missing or shorter than 32 characters');
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + SESSION_TTL_SECONDS;
  const payload: SessionPayload = { sub: telegramId, iat, exp };
  const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const signatureB64 = sign(payloadB64, secret).toString('base64url');
  return { token: `${payloadB64}.${signatureB64}`, expiresAt: exp * 1000 };
}

/** Returns the Telegram id the session belongs to, or null if the token is invalid/expired. */
export function verifyAdminSession(token: string): string | null {
  const secret = getSessionSecret();
  if (!secret) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const payloadB64 = parts[0] ?? '';
  const received = Buffer.from(parts[1] ?? '', 'base64url');
  const expected = sign(payloadB64, secret);
  if (received.length !== expected.length || !timingSafeEqual(received, expected)) return null;
  try {
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as Partial<SessionPayload>;
    if (typeof payload.sub !== 'string' || typeof payload.exp !== 'number') return null;
    if (payload.exp <= Math.floor(Date.now() / 1000)) return null;
    return payload.sub;
  } catch {
    return null;
  }
}

/** initData must be signed by the ADMIN bot (not the store bot) and belong to an id in ADMIN_TELEGRAM_IDS. */
function authenticateAdminIdentity(req: Request, res: Response): boolean {
  const adminToken = process.env.ADMIN_BOT_TOKEN?.trim();
  if (!adminToken) {
    res.status(503).json({ success: false, error: 'ADMIN_NOT_CONFIGURED' });
    return false;
  }
  const user = verifyTelegramInitData(extractInitData(req), [adminToken], INITDATA_MAX_AGE_SECONDS);
  if (!user) {
    res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    return false;
  }
  if (!getAdminIds().has(user.id)) {
    res.status(403).json({ success: false, error: 'FORBIDDEN' });
    return false;
  }
  res.locals.telegramUser = user;
  return true;
}

/** Step 1 only (used by POST /api/admin/verify-pin). */
export function requireAdminIdentity(req: Request, res: Response, next: NextFunction): void {
  if (authenticateAdminIdentity(req, res)) next();
}

/** Full guard for every other admin API: admin identity + PIN session issued to that same identity. */
export function requireAdminSession(req: Request, res: Response, next: NextFunction): void {
  if (!authenticateAdminIdentity(req, res)) return;
  const header = req.headers[ADMIN_SESSION_HEADER];
  const token = typeof header === 'string' ? header : '';
  const sessionUser = token ? verifyAdminSession(token) : null;
  const user = res.locals.telegramUser as { id: string } | undefined;
  if (!sessionUser || !user || sessionUser !== user.id) {
    res.status(401).json({ success: false, error: 'PIN_REQUIRED' });
    return;
  }
  next();
}
