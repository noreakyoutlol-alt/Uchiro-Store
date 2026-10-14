import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { getUserForClient } from '../services/user.service';
import { getCustomerStatsHandler } from './store.routes';
import { getUserSnapshot } from '../database/data-store';

export const authRouter = Router();

// Customer Telegram Mini App Authentication
authRouter.post('/telegram', async (req, res, next) => {
  try {
    const { initData } = req.body;
    const session = await AuthService.authenticateCustomer(initData || '');
    if (session?.user?.telegram_id) {
      const snap = await getUserSnapshot(session.user.telegram_id);
      session.user.points = snap.points;
      session.user.reward_points = snap.points;
      session.user.streak_count = snap.streak;
      session.user.last_daily_claim_at = snap.lastDailyClaimAt;
      if (session.profile) {
        session.profile.points = snap.points;
        session.profile.reward_points = snap.points;
        session.profile.loyalty_points = snap.points;
        session.profile.streak_count = snap.streak;
        session.profile.gacha_tickets = snap.gachaTickets;
        session.profile.last_daily_claim_at = snap.lastDailyClaimAt;
      }
    }
    res.json({
      success: true,
      data: session,
    });
  } catch (err) {
    next(err);
  }
});

// Admin Mini App Authentication
authRouter.post('/admin', async (req, res, next) => {
  try {
    const { initData, adminKey } = req.body;
    const session = await AuthService.authenticateAdmin(initData, adminKey);
    res.json({
      success: true,
      data: session,
    });
  } catch (err) {
    next(err);
  }
});

// Customer Profile
authRouter.get('/me', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const tgId = req.user!.telegram_id;
    const snap = await getUserSnapshot(tgId);
    const me = await AuthService.getMe(tgId);
    res.json({
      success: true,
      data: {
        ...me,
        points: snap.points,
        reward_points: snap.points,
        loyalty_points: snap.points,
        gacha_tickets: snap.gachaTickets,
        streak_count: snap.streak,
        last_daily_claim_at: snap.lastDailyClaimAt,
        next_claim_at: snap.nextClaimAt,
        total_orders: snap.ordersCount,
        total_spent: snap.totalSpent,
        server_now: new Date().toISOString(),
        user: {
          ...me.user,
          points: snap.points,
          reward_points: snap.points,
          streak_count: snap.streak,
          last_daily_claim_at: snap.lastDailyClaimAt,
          server_now: new Date().toISOString(),
        },
        profile: {
          ...me.profile,
          points: snap.points,
          reward_points: snap.points,
          loyalty_points: snap.points,
          gacha_tickets: snap.gachaTickets,
          streak_count: snap.streak,
          last_daily_claim_at: snap.lastDailyClaimAt,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

// Dedicated Stats Endpoint for Customer Mini App TopBar & Profile
authRouter.get(['/me/stats', '/stats'], requireTelegramAuth, getCustomerStatsHandler);
