import { Router, Request, Response } from 'express';
import { DataStore } from '../database/data-store';
import { validateTelegramInitData } from '../security/telegram-validator';
import { env } from '../config/env';

export const userRouter = Router();

/**
 * Helper to extract telegram_id from various request channels:
 * 1. Bearer JWT / auth middleware user
 * 2. x-telegram-init-data header
 * 3. x-telegram-user-id header
 * 4. Query param ?telegramId=...
 * 5. Body { telegramId: ... }
 */
export function extractTelegramId(req: Request): string | null {
  // 1. From authenticated req.user if present
  const authUser = (req as any).user;
  if (authUser?.telegram_id) {
    return String(authUser.telegram_id);
  }

  // 2. From explicit headers
  const headerTgId = req.headers['x-telegram-user-id'];
  if (headerTgId) {
    return String(headerTgId).trim();
  }

  // 3. From Telegram initData header
  const initDataHeader = req.headers['x-telegram-init-data'] as string | undefined;
  if (initDataHeader) {
    try {
      const validation = validateTelegramInitData(initDataHeader, env.STORE_BOT_TOKEN);
      if (validation.isValid && validation.data?.user?.id) {
        return String(validation.data.user.id);
      }
    } catch {
      // Fallback
    }
  }

  // 4. From query param
  if (req.query.telegramId || req.query.telegram_id) {
    return String(req.query.telegramId || req.query.telegram_id).trim();
  }

  // 5. From body
  if (req.body?.telegramId || req.body?.telegram_id) {
    return String(req.body.telegramId || req.body.telegram_id).trim();
  }

  return null;
}

/**
 * GET /api/user/profile
 * Always returns live points & streak_count from Supabase users table.
 */
userRouter.get(['/profile', '/me'], async (req: Request, res: Response) => {
  try {
    const telegramId = extractTelegramId(req);
    if (!telegramId) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_TELEGRAM_ID', message: 'Telegram ID is required to fetch profile' },
      });
      return;
    }

    const user = await DataStore.getUserByTelegramId(telegramId);
    const numId = Number(telegramId) || 0;
    const profile = DataStore.getProfile(numId);

    res.json({
      success: true,
      data: {
        id: user.id || profile?.id,
        telegram_id: String(user.telegram_id || telegramId),
        username: user.username || null,
        first_name: user.first_name || 'Customer',
        points: user.points ?? profile?.points ?? 0,
        loyalty_points: user.points ?? profile?.points ?? 0,
        reward_points: user.points ?? profile?.points ?? 0,
        streak_count: user.streak_count ?? 0,
        role: user.role || (String(telegramId) === '6594079594' ? 'admin' : 'customer'),
        last_daily_claim_at: user.last_daily_claim_at || profile?.last_daily_claim_at || null,
        gacha_tickets: profile?.gacha_tickets ?? (user.extra as any)?.gacha_tickets ?? 0,
        created_at: user.created_at,
        server_now: new Date().toISOString(),
      },
    });
  } catch (err: any) {
    console.error('[User Routes] /profile error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'PROFILE_ERROR', message: err.message || 'Internal server error' },
    });
  }
});

/**
 * POST /api/user/daily-claim
 * Atomic daily claim persisting to Supabase users table and points_ledger.
 */
userRouter.post(['/daily-claim', '/claim-daily'], async (req: Request, res: Response) => {
  try {
    const telegramId = extractTelegramId(req);
    if (!telegramId) {
      res.status(400).json({
        success: false,
        error: { code: 'MISSING_TELEGRAM_ID', message: 'Telegram ID is required for daily claim' },
      });
      return;
    }

    const numId = Number(telegramId);
    const result = DataStore.claimDailyReward(numId);
    if (!result.success) {
      res.status(400).json({
        ...result,
        success: false,
        error: { code: result.error || 'ALREADY_CLAIMED', message: result.message },
      });
      return;
    }

    res.json({
      ...result,
      success: true,
      data: result,
    });
  } catch (err: any) {
    console.error('[User Routes] /daily-claim error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'CLAIM_ERROR', message: err.message || 'Internal server error' },
    });
  }
});

/**
 * POST /api/user/deduct-points
 * Validate balance against Supabase users.points and decrement directly.
 */
userRouter.post('/deduct-points', async (req: Request, res: Response) => {
  try {
    const telegramId = extractTelegramId(req);
    const amount = Number(req.body?.amount);

    if (!telegramId || !amount || amount <= 0) {
      res.status(400).json({
        success: false,
        error: { code: 'INVALID_INPUT', message: 'Valid telegramId and positive amount required' },
      });
      return;
    }

    const result = await DataStore.deductPoints(telegramId, amount);
    if (!result.success) {
      res.status(400).json({
        success: false,
        error: { code: result.error || 'INSUFFICIENT_POINTS', message: 'Insufficient points balance' },
        points: result.points,
      });
      return;
    }

    res.json({
      success: true,
      data: result,
      points: result.points,
    });
  } catch (err: any) {
    console.error('[User Routes] /deduct-points error:', err);
    res.status(500).json({
      success: false,
      error: { code: 'DEDUCT_ERROR', message: err.message || 'Internal server error' },
    });
  }
});
