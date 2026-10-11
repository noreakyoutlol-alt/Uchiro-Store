import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { validateTelegramInitData } from '../security/telegram-validator';
import { DataStore } from '../database/data-store';
import { TelegramAuthSession, AdminAuthSession } from '../types';
import { AppError } from '../middleware/error-handler';

export class AuthService {
  // ================= CUSTOMER TELEGRAM AUTH =================
  static async authenticateCustomer(initDataRaw: string): Promise<TelegramAuthSession> {
    // STRICT_TELEGRAM_AUTH=true in production: never trust initDataUnsafe.
    // Only validated Telegram Mini App initData is accepted.
    const validation = validateTelegramInitData(initDataRaw, env.STORE_BOT_TOKEN);

    if (!validation.isValid || !validation.data?.user) {
      throw new AppError(`Invalid Telegram authentication: ${validation.error || 'INVALID_INIT_DATA'}`, 401, 'INVALID_AUTH');
    }

    const tgUser = validation.data.user;
    const { user, profile } = DataStore.findOrCreateTelegramUser({
      telegram_id: tgUser.id,
      first_name: tgUser.first_name,
      last_name: tgUser.last_name,
      username: tgUser.username,
      photo_url: tgUser.photo_url,
      language_code: tgUser.language_code || 'en',
    });

    const token = jwt.sign(
      {
        user_id: user.id,
        telegram_id: user.telegram_id,
        username: user.username,
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    return { user, profile, token };
  }

  // ================= ADMIN TELEGRAM AUTH =================
  static async authenticateAdmin(initDataRaw?: string, adminKey?: string): Promise<AdminAuthSession> {
    // 1. Direct admin access token check (for dev / direct admin dashboard)
    if (adminKey && adminKey === env.ADMIN_BOT_WEBHOOK_SECRET) {
      const admin = {
        id: 'admin-super-01',
        telegram_id: env.ADMIN_TELEGRAM_USER_IDS[0] || 0,
        username: 'uchiro_founder',
        display_name: 'Uchiro SuperAdmin',
        role: 'superadmin' as const,
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const token = jwt.sign(
        {
          user_id: admin.id,
          telegram_id: admin.telegram_id,
          username: admin.username,
          role: 'admin',
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return { admin, token };
    }

    // 2. Validate via Telegram Admin Bot initData
    if (initDataRaw) {
      const validation = validateTelegramInitData(initDataRaw, env.ADMIN_BOT_TOKEN || env.STORE_BOT_TOKEN);
      if (validation.isValid && validation.data?.user) {
        const tgId = Number(validation.data.user.id);
        const isApproved = env.ADMIN_TELEGRAM_USER_IDS.includes(tgId);

        if (!isApproved) {
          throw new AppError('Forbidden: Telegram account is not authorized as an admin', 403, 'FORBIDDEN_ADMIN');
        }

        const admin = {
          id: `admin-${tgId}`,
          telegram_id: tgId,
          username: validation.data.user.username || 'admin',
          display_name: validation.data.user.first_name || 'Admin',
          role: 'admin' as const,
          is_active: true,
          last_login_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        };

        const token = jwt.sign(
          {
            user_id: admin.id,
            telegram_id: admin.telegram_id,
            username: admin.username,
            role: 'admin',
          },
          env.JWT_SECRET,
          { expiresIn: '24h' }
        );

        return { admin, token };
      } else {
        throw new AppError('Invalid Telegram authentication signature', 401, 'INVALID_TELEGRAM_AUTH');
      }
    }

    // 3. Test mode fallback (strictly in test environment)
    if (process.env.NODE_ENV === 'test') {
      const defaultAdmin = {
        id: 'admin-dev-01',
        telegram_id: env.ADMIN_TELEGRAM_USER_IDS[0] || 0,
        username: 'uchiro_dev_admin',
        display_name: 'Lead Developer Admin',
        role: 'superadmin' as const,
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
      const token = jwt.sign(
        {
          user_id: defaultAdmin.id,
          telegram_id: defaultAdmin.telegram_id,
          username: defaultAdmin.username,
          role: 'admin',
        },
        env.JWT_SECRET,
        { expiresIn: '24h' }
      );
      return { admin: defaultAdmin, token };
    }

    throw new AppError('Admin authentication failed: Telegram Mini App context required', 401, 'INVALID_ADMIN_AUTH');
  }

  // ================= GET ME =================
  static async getMe(telegramId: number) {
    const user = DataStore.getTelegramUser(telegramId);
    const profile = DataStore.getProfile(telegramId);

    if (!user || !profile) {
      throw new AppError('User profile not found', 404, 'NOT_FOUND');
    }

    return { user, profile };
  }
}
