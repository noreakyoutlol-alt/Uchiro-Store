import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { validateTelegramInitData } from '../security/telegram-validator';

export const ADMIN_404_HTML =
  '<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested URL was not found on this server.</p></body></html>';

export interface AdminAuthCheckResult {
  isAuthorized: boolean;
  adminTgId?: number;
  reason?: string;
}

/**
 * Validates whether the incoming HTTP request carries valid Telegram Admin authentication,
 * a valid Admin JWT token, an authorized admin cookie, or a valid admin secret key.
 * Strictly blocks regular web browsers without valid credentials.
 */
export function checkAdminAuthorization(req: Request): AdminAuthCheckResult {
  // 1. Direct admin secret check (via query param, header, or cookie)
  const adminSecret =
    (req.query?.admin_secret as string) ||
    (req.query?.adminKey as string) ||
    (req.query?.key as string) ||
    (req.headers['x-admin-key'] as string);

  if (adminSecret && (adminSecret === env.ADMIN_BOT_WEBHOOK_SECRET || adminSecret === env.ADMIN_JWT_SECRET)) {
    return {
      isAuthorized: true,
      adminTgId: env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789,
      reason: 'admin_secret_verified',
    };
  }

  // 2. Check Bearer token (JWT) from Authorization header or ?token=
  const authHeader = req.headers.authorization;
  const token =
    (authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null) ||
    (req.query?.token as string);

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as any;
      const tgId = Number(decoded.telegram_id);
      const isApproved =
        decoded.role === 'admin' ||
        decoded.role === 'superadmin' ||
        env.ADMIN_TELEGRAM_USER_IDS.includes(tgId);

      if (isApproved) {
        return { isAuthorized: true, adminTgId: tgId, reason: 'bearer_token_verified' };
      }
    } catch {
      // Invalid or expired token
    }
  }

  // 3. Check Cookie for signed admin session token
  const cookies = req.headers.cookie;
  if (cookies) {
    const tokenMatch = cookies.match(/(?:uchiro_admin_token|admin_token)=([^;]+)/);
    if (tokenMatch && tokenMatch[1]) {
      try {
        const decoded = jwt.verify(tokenMatch[1], env.JWT_SECRET) as any;
        const tgId = Number(decoded.telegram_id);
        const isApproved =
          decoded.role === 'admin' ||
          decoded.role === 'superadmin' ||
          env.ADMIN_TELEGRAM_USER_IDS.includes(tgId);

        if (isApproved) {
          return { isAuthorized: true, adminTgId: tgId, reason: 'cookie_token_verified' };
        }
      } catch {
        // Invalid cookie token
      }
    }

    const secretMatch = cookies.match(/(?:admin_secret|admin_key)=([^;]+)/);
    if (secretMatch && (secretMatch[1] === env.ADMIN_BOT_WEBHOOK_SECRET || secretMatch[1] === env.ADMIN_JWT_SECRET)) {
      return {
        isAuthorized: true,
        adminTgId: env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789,
        reason: 'cookie_secret_verified',
      };
    }
  }

  // 4. Validate Telegram WebApp initData (via header x-telegram-init-data or query tgWebAppData / initData)
  const rawInitData =
    (req.headers['x-telegram-init-data'] as string) ||
    (req.query?.tgWebAppData as string) ||
    (req.query?.initData as string);

  if (rawInitData) {
    const validation = validateTelegramInitData(rawInitData, env.ADMIN_BOT_TOKEN || env.STORE_BOT_TOKEN);
    if (validation.isValid && validation.data?.user) {
      const tgId = Number(validation.data.user.id);
      const isApproved = env.ADMIN_TELEGRAM_USER_IDS.includes(tgId);

      if (isApproved) {
        return { isAuthorized: true, adminTgId: tgId, reason: 'telegram_init_data_verified' };
      }

      // In non-strict dev mode
      if (!env.STRICT_TELEGRAM_AUTH && process.env.NODE_ENV !== 'production') {
        return { isAuthorized: true, adminTgId: tgId, reason: 'dev_init_data_permitted' };
      }
    }
  }

  // 5. Referer verification for sub-resources (assets, scripts, styles loaded by the authenticated admin page)
  const referer = req.headers.referer || req.headers.referrer;
  if (typeof referer === 'string' && referer.includes('/admin')) {
    try {
      const parsedReferer = new URL(referer);
      const refInitData =
        parsedReferer.searchParams.get('tgWebAppData') || parsedReferer.searchParams.get('initData');
      if (refInitData) {
        const validation = validateTelegramInitData(refInitData, env.ADMIN_BOT_TOKEN || env.STORE_BOT_TOKEN);
        if (validation.isValid && validation.data?.user) {
          const tgId = Number(validation.data.user.id);
          if (env.ADMIN_TELEGRAM_USER_IDS.includes(tgId)) {
            return { isAuthorized: true, adminTgId: tgId, reason: 'referer_init_data_verified' };
          }
        }
      }

      const refSecret =
        parsedReferer.searchParams.get('admin_secret') || parsedReferer.searchParams.get('adminKey');
      if (refSecret && (refSecret === env.ADMIN_BOT_WEBHOOK_SECRET || refSecret === env.ADMIN_JWT_SECRET)) {
        return {
          isAuthorized: true,
          adminTgId: env.ADMIN_TELEGRAM_USER_IDS[0] || 123456789,
          reason: 'referer_secret_verified',
        };
      }
    } catch {
      // Ignore URL parse error
    }
  }

  return { isAuthorized: false, reason: 'unauthorized_browser_or_missing_telegram_auth' };
}

/**
 * Strict server middleware: Guard Admin Static & SPA delivery.
 * If opened directly in a regular web browser missing Telegram WebApp auth or valid admin session,
 * returns HTTP 404 with exact specification HTML.
 */
export function adminStaticGuard(req: Request, res: Response, next: NextFunction): void {
  const result = checkAdminAuthorization(req);

  if (result.isAuthorized) {
    // If authenticated via initData, set signed session cookie so sub-resources (scripts, css, images)
    // loaded by client-admin are seamlessly permitted by the browser
    if (result.adminTgId && !req.headers.cookie?.includes('uchiro_admin_token')) {
      try {
        const sessionToken = jwt.sign(
          { role: 'admin', telegram_id: result.adminTgId },
          env.JWT_SECRET,
          { expiresIn: '24h' }
        );
        res.setHeader(
          'Set-Cookie',
          `uchiro_admin_token=${sessionToken}; Path=/admin; HttpOnly; SameSite=Lax`
        );
      } catch {
        // Ignore cookie issue
      }
    }
    return next();
  }

  // Strictly block unauthorized regular browsers with 404
  res.status(404).send(ADMIN_404_HTML);
}
