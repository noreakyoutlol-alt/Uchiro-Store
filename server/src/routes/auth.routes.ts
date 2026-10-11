import { Router } from 'express';
import { AuthService } from '../services/auth.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { getUserForClient } from '../services/user.service';

export const authRouter = Router();

// Customer Telegram Mini App Authentication
authRouter.post('/telegram', async (req, res, next) => {
  try {
    const { initData } = req.body;
    const session = await AuthService.authenticateCustomer(initData || '');
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
    const me = await AuthService.getMe(req.user!.telegram_id);
    const clientUser = await getUserForClient(req.user!.telegram_id);
    res.json({
      success: true,
      data: {
        ...me,
        points: clientUser.points,
        streak_count: clientUser.streak_count,
        last_daily_claim_at: clientUser.last_daily_claim_at,
        server_now: clientUser.server_now,
        user: {
          ...me.user,
          points: clientUser.points,
          streak_count: clientUser.streak_count,
          last_daily_claim_at: clientUser.last_daily_claim_at,
          server_now: clientUser.server_now,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});
