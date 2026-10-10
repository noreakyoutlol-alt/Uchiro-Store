import { Router } from 'express';
import { GachaService } from '../services/gacha.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { handleDailyRewardStatus, handleDailyRewardClaim } from './store.routes';

export const gachaRouter = Router();

// Daily Reward Support in Gacha Router
gachaRouter.get('/daily-status', handleDailyRewardStatus);
gachaRouter.post('/daily-claim', handleDailyRewardClaim);

// List Active Gacha Pools & Prizes
gachaRouter.get('/pools', (_req, res) => {
  const pools = GachaService.getPools();
  res.json({
    success: true,
    data: pools,
  });
});

// Single Pool
gachaRouter.get('/pools/:id', (req, res, next) => {
  try {
    const pool = GachaService.getPoolById(req.params.id);
    res.json({
      success: true,
      data: pool,
    });
  } catch (err) {
    next(err);
  }
});

// Recent Gacha Winners
gachaRouter.get('/recent-winners', (_req, res) => {
  const winners = GachaService.getRecentWinners();
  res.json({
    success: true,
    data: winners,
  });
});

// Execute Gacha Spin (Server-Authoritative)
gachaRouter.get('/status', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const status = GachaService.getStatus(req.user!.telegram_id);
  res.json({
    success: true,
    data: status,
  });
});

// Buy Gacha Tickets with Points (100 pts per ticket)
gachaRouter.post('/buy-tickets', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const quantity = Number(req.body.quantity) || 1;
    const result = GachaService.buyTickets(req.user!.telegram_id, quantity);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

gachaRouter.post('/:poolId/spin', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;
    const result = await GachaService.spin({
      poolId: req.params.poolId,
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      idempotencyKey,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// Customer Gacha Claims and Prizes
gachaRouter.get('/my-prizes', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const prizes = GachaService.getCustomerPrizes(req.user!.telegram_id);
  res.json({
    success: true,
    data: prizes,
  });
});

// Submit Claim Delivery Info (for manual review prizes)
gachaRouter.post('/claims/:id/submit', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const claim = GachaService.submitClaimData(req.params.id, req.user!.telegram_id, req.body.deliveryData);
    res.json({
      success: true,
      data: claim,
    });
  } catch (err) {
    next(err);
  }
});
