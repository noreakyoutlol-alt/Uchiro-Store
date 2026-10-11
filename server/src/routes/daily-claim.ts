import { Router } from 'express';
import { getTelegramUserId, requireTelegramUser } from '../auth/telegram';
import { claimDailyReward } from '../services/user.service';

export const dailyClaimRouter = Router();

dailyClaimRouter.post('/user/daily-claim', requireTelegramUser, async (_req, res) => {
  try {
    const result = await claimDailyReward(getTelegramUserId(res));
    res.status(result.success ? 200 : 409).json(result);
  } catch (err) {
    console.error('[daily-claim] failed:', err instanceof Error ? err.message : 'unknown error');
    res.status(500).json({ success: false, error: 'SERVER_ERROR' });
  }
});
