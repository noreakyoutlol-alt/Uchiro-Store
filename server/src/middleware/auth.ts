import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error-handler';
import { validateTelegramInitData } from '../security/telegram-validator';
import { DataStore } from '../database/data-store';

export interface AuthenticatedUserPayload {
  telegram_id: number;
  user_id: string;
  username: string | null;
  role?: string;
}

export interface RequestWithAuth extends Request {
  user?: AuthenticatedUserPayload;
  admin?: AuthenticatedUserPayload;
}

export function requireTelegramAuth(req: RequestWithAuth, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

  if (token) {
    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUserPayload;
      req.user = decoded;
      return next();
    } catch (err: any) {
      if (err.name === 'TokenExpiredError') {
        throw new AppError('Authentication token has expired', 401, 'TOKEN_EXPIRED');
      }
      throw new AppError('Invalid or forged authentication token', 401, 'INVALID_TOKEN');
    }
  }

  // 1. If browsing via Telegram WebApp with initData, perform seamless auto-authentication / token refresh
  const initData = (req.headers['x-telegram-init-data'] as string) || (req.query?.initData as string);
  if (initData) {
    try {
      const validation = validateTelegramInitData(initData, env.STORE_BOT_TOKEN);
      if (validation.isValid && validation.data?.user) {
        const tgUser = validation.data.user;
        const { user } = DataStore.findOrCreateTelegramUser({
          telegram_id: tgUser.id,
          first_name: tgUser.first_name,
          last_name: tgUser.last_name,
          username: tgUser.username,
          language_code: tgUser.language_code || 'en',
        });

        const refreshedToken = jwt.sign(
          {
            user_id: user.id,
            telegram_id: user.telegram_id,
            username: user.username,
            role: 'customer',
          },
          env.JWT_SECRET,
          { expiresIn: '7d' }
        );

        res.setHeader('x-refreshed-token', refreshedToken);

        req.user = {
          user_id: user.id,
          telegram_id: user.telegram_id,
          username: user.username,
          role: 'customer',
        };
        return next();
      }
    } catch {
      // Proceed to QR / guest fallback
    }
  }

  // 2. If running in local dev / guest checkout without Telegram initData on QR generation, provide fallback guest session so QR generation never crashes
  const isQrCreationOrCheckout =
    req.originalUrl?.includes('/create-qr') ||
    req.path?.includes('/create-qr') ||
    (req.method === 'POST' && (req.originalUrl?.includes('/payments') || req.originalUrl?.includes('/orders')));

  const isDevOrTest =
    env.NODE_ENV !== 'production' ||
    process.env.NODE_ENV === 'test' ||
    process.env.NODE_ENV === 'development';

  if (isQrCreationOrCheckout && isDevOrTest) {
    const guestTgId = 123456789;
    const { user } = DataStore.findOrCreateTelegramUser({
      telegram_id: guestTgId,
      first_name: 'Guest Customer',
      username: 'guest_customer',
      language_code: 'en',
    });

    const guestToken = jwt.sign(
      {
        user_id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.setHeader('x-refreshed-token', guestToken);

    req.user = {
      user_id: user.id,
      telegram_id: user.telegram_id,
      username: user.username,
      role: 'customer',
    };
    return next();
  }

  throw new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN');
}

export function requireAdminAuth(req: RequestWithAuth, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Admin authorization token required', 401, 'ADMIN_UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUserPayload;

    // Check role or authorized admin list
    const isApprovedAdmin =
      decoded.role === 'admin' ||
      decoded.role === 'superadmin' ||
      env.ADMIN_TELEGRAM_USER_IDS.includes(decoded.telegram_id);

    if (!isApprovedAdmin) {
      throw new AppError('Forbidden: Access denied to admin portal', 403, 'FORBIDDEN_NOT_ADMIN');
    }

    req.admin = decoded;
    next();
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    if (err.name === 'TokenExpiredError') {
      throw new AppError('Admin authorization token has expired', 401, 'ADMIN_TOKEN_EXPIRED');
    }
    throw new AppError('Invalid or forged admin authorization token', 401, 'ADMIN_INVALID_TOKEN');
  }
}
