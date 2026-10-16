import { Router, Request, Response } from 'express';
import { DataStore, getUserSnapshot, claimDailyReward } from '../database/data-store';
import { validateTelegramInitData } from '../security/telegram-validator';
import { env } from '../config/env';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';

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

    const numId = Number(telegramId) || 0;
    const snap = await getUserSnapshot(telegramId);
    const user = await DataStore.getUserByTelegramId(telegramId);
    const profile = DataStore.getProfile(numId);
    const isAdmin = numId > 0 && env.ADMIN_TELEGRAM_USER_IDS.includes(numId);

    res.json({
      success: true,
      data: {
        id: user?.id || profile?.id,
        telegram_id: String(user?.telegram_id || telegramId),
        username: user?.username || null,
        first_name: user?.first_name || 'Customer',
        points: snap.points,
        loyalty_points: snap.points,
        reward_points: snap.points,
        streak_count: snap.streak,
        role: user?.role || (isAdmin ? 'admin' : 'customer'),
        last_daily_claim_at: snap.lastDailyClaimAt,
        next_claim_at: snap.nextClaimAt,
        gacha_tickets: snap.gachaTickets,
        total_orders: snap.ordersCount,
        total_spent: snap.totalSpent,
        created_at: user?.created_at,
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
userRouter.post(['/daily-claim', '/claim-daily'], requireTelegramAuth, async (req: RequestWithAuth, res: Response) => {
  try {
    const telegramId = req.user?.telegram_id || extractTelegramId(req);
    if (!telegramId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Telegram authentication is required for daily claim' },
      });
      return;
    }

    const numId = Number(telegramId);
    const result = await claimDailyReward(numId);
    if (!result.success) {
      const secondsRemaining = (result as any).seconds_remaining ?? Math.ceil(((result as any).remainingMs ?? 0) / 1000);
      const nextClaimAt = new Date(Date.now() + secondsRemaining * 1000).toISOString();
      res.status(429).json({
        ...result,
        success: false,
        error: result.error || 'ALREADY_CLAIMED_TODAY',
        seconds_remaining: secondsRemaining,
        next_claim_at: nextClaimAt,
      });
      return;
    }

    res.json({
      ...result,
      success: true,
      points: Number(result.points),
      streak: Number(result.streak),
      seconds_remaining: result.seconds_remaining ?? 86400,
      next_claim_at: result.nextClaimAt,
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
