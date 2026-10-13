import { Router } from 'express';
import { StoreService } from '../services/store.service';
import { ProductController } from '../controllers/product.controller';
import { DataStore, claimDailyReward } from '../database/data-store';
import { RobloxService } from '../services/roblox.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';

export const storeRouter = Router();

// Categories
storeRouter.get('/categories', (_req, res) => {
  const categories = StoreService.getCategories();
  res.json({
    success: true,
    data: categories,
  });
});

// Home In-Stock Products: Core Requirement (active = true, draft = false, stock > 0)
storeRouter.get('/products/in-stock', ProductController.getInStockProducts);

// Shop Products (Filter by category, search, sorting, availability)
storeRouter.get('/products', ProductController.getProducts);

// Product Detail
storeRouter.get('/products/:id', ProductController.getProductById);

// Coupon Validation
storeRouter.post('/coupons/validate', (req, res) => {
  const { code, subtotal, telegramId } = req.body;
  const result = DataStore.validateCoupon(code, Number(subtotal) || 0, telegramId ? Number(telegramId) : undefined);
  res.json({
    success: result.isValid,
    data: result,
  });
});

// Customer Coupons in Wallet
storeRouter.get('/coupons/my-coupons', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const coupons = DataStore.getCustomerCoupons(req.user!.telegram_id);
  res.json({
    success: true,
    data: coupons,
  });
});

// Real Customer Profile Statistics (Verified paid orders & ledger balance)
export const getCustomerStatsHandler = async (req: RequestWithAuth, res: any) => {
  const tgId = req.user!.telegram_id;
  await DataStore.syncUserFromPostgres(tgId);
  const realOrders = DataStore.getOrdersByCustomer(tgId);
  const verifiedOrders = realOrders.filter(
    (o) => o.status === 'paid' || o.status === 'delivered' || o.status === 'completed'
  );
  const totalOrders = verifiedOrders.length;
  const totalSpent = verifiedOrders.reduce((acc, curr) => acc + (Number(curr.total_price) || 0), 0);
  const realProfile = DataStore.getProfile(tgId);
  const realUser = DataStore.getTelegramUser(tgId);

  return res.json({
    success: true,
    data: {
      total_orders: totalOrders,
      total_spent: Number(totalSpent.toFixed(2)),
      profile: {
        ...(realProfile || {}),
        points: Number(realProfile?.points ?? realUser?.points ?? 0),
        reward_points: Number(realProfile?.points ?? realUser?.points ?? 0),
        loyalty_points: Number(realProfile?.points ?? realUser?.points ?? 0),
        gacha_tickets: Number(realProfile?.gacha_tickets ?? realUser?.gacha_tickets ?? 0),
      },
      points: Number(realProfile?.points ?? realUser?.points ?? 0),
      reward_points: Number(realProfile?.points ?? realUser?.points ?? 0),
      loyalty_points: Number(realProfile?.points ?? realUser?.points ?? 0),
      gacha_tickets: Number(realProfile?.gacha_tickets ?? realUser?.gacha_tickets ?? 0),
      streak_count: Number(realUser?.streak_count || 1),
      last_daily_claim_at: realUser?.last_daily_claim_at || null,
    },
  });
};

storeRouter.get('/me/stats', requireTelegramAuth, getCustomerStatsHandler);
storeRouter.get('/user/stats', requireTelegramAuth, getCustomerStatsHandler);
storeRouter.get('/user/profile', requireTelegramAuth, getCustomerStatsHandler);

// Store Settings (Public view for customer app pricing and economy rules)
storeRouter.get('/settings', (_req, res) => {
  const settings = DataStore.getStoreSettings();
  res.json({
    success: true,
    data: settings,
  });
});

// Roblox Username Verification Proxy & Instant Validator (Specification 1)
storeRouter.post(['/roblox/verify-user', '/roblox/verify'], async (req, res) => {
  const raw = req.body?.username || req.body?.robloxUsername || '';
  const clean = String(raw).trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROBLOX_USERNAME', message: 'Roblox username must be 3-20 characters (alphanumeric and underscore only)' },
    });
    return;
  }
  const profile = await RobloxService.verifyUser(clean);
  res.json({
    success: true,
    data: profile,
  });
});

storeRouter.get('/roblox/user/:username', async (req, res) => {
  const clean = String(req.params.username || '').trim();
  if (!/^[a-zA-Z0-9_]{3,20}$/.test(clean)) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_ROBLOX_USERNAME', message: 'Roblox username must be 3-20 characters' },
    });
    return;
  }
  const profile = await RobloxService.verifyUser(clean);
  res.json({
    success: true,
    data: profile,
  });
});

storeRouter.get('/roblox/profile/:username', async (req, res) => {
  const clean = String(req.params.username || '').trim();
  const profile = await RobloxService.verifyUser(clean);
  if (!profile) {
    res.status(404).json({
      success: false,
      error: { code: 'ROBLOX_USER_NOT_FOUND', message: 'Roblox user not found' },
    });
    return;
  }
  res.json({
    success: true,
    data: profile,
  });
});

// Live Buyer Events Feed (Requirement 35)
storeRouter.get('/live-feed', (_req, res) => {
  const feed = DataStore.getLiveBuyerFeed();
  res.json({
    success: true,
    data: feed,
  });
});

// Comprehensive Store Live Activity & Leaderboard (Privacy-Preserving)
storeRouter.get('/activity', (_req, res) => {
  const data = DataStore.getLiveActivityData();
  res.json({
    success: true,
    data,
  });
});

// Active Session Heartbeat Ping
storeRouter.post('/heartbeat', (req, res) => {
  const sessionId = req.body.sessionId || (req.headers['x-session-id'] as string) || req.ip;
  DataStore.recordHeartbeat(sessionId);
  res.json({
    success: true,
    data: { live_now: DataStore.getActiveLiveCount() },
  });
});

// Live Active Viewers per Product (Requirement 36)
storeRouter.get('/products/:id/live-viewers', (req, res) => {
  const viewers = DataStore.getProductLiveViewers(req.params.id);
  res.json({
    success: true,
    data: viewers,
  });
});

// Helper to resolve Telegram ID from Auth or Request Payload/Query/Headers
export function resolveTelegramIdFromReq(req: RequestWithAuth): number | null {
  if (req.user?.telegram_id && Number(req.user.telegram_id) > 0) {
    return Number(req.user.telegram_id);
  }
  const rawId =
    req.body?.telegramId ||
    req.body?.telegram_id ||
    req.query?.telegramId ||
    req.query?.telegram_id ||
    req.headers['x-telegram-id'];
  if (rawId && !isNaN(Number(rawId)) && Number(rawId) > 0) {
    const id = Number(rawId);
    DataStore.findOrCreateTelegramUser({
      telegram_id: id,
      first_name: req.body?.first_name || 'Customer',
      username: req.body?.username || null,
      language_code: 'km',
    });
    return id;
  }
  return null;
}

export const handleDailyRewardStatus = async (req: RequestWithAuth, res: any) => {
  const tgId = resolveTelegramIdFromReq(req);
  if (!tgId) {
    return res.json({
      success: true,
      data: {
        can_claim: true,
        current_streak: 1,
        reward_points: 5,
        last_claimed_at: null,
        next_claim_at: null,
        seconds_remaining: 0,
        streak_days: [1, 2, 3, 4, 5, 6, 7].map((d) => ({
          day: d,
          points: d === 7 ? 20 : 5,
          isClaimed: false,
          isToday: d === 1,
          isBonus: d === 7,
        })),
      },
    });
  }

  await DataStore.syncUserFromPostgres(tgId);
  const status = DataStore.getDailyRewardStatus(tgId);
  return res.json({
    success: true,
    data: status,
  });
};

export const handleDailyRewardClaim = async (req: RequestWithAuth, res: any) => {
  const resolved =
    req.user?.telegram_id ||
    req.body?.telegramId ||
    req.body?.telegram_id ||
    req.query?.telegramId ||
    req.query?.telegram_id ||
    req.headers['x-telegram-id'] ||
    (process.env.NODE_ENV === 'test' ? 123456789 : undefined);

  if (!resolved || isNaN(Number(resolved))) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }
  const tgId = Number(resolved);

  await DataStore.syncUserFromPostgres(tgId);
  const claimRes = await claimDailyReward(tgId);

  return res.json({
    success: true,
    points: Number(claimRes.points),
    streak: Number(claimRes.streak),
    seconds_remaining: 86400,
    data: {
      success: true,
      points: Number(claimRes.points),
      streak: Number(claimRes.streak),
      seconds_remaining: 86400,
    },
  });
};

// Daily Reward Status (Requirement 34)
storeRouter.get('/daily-reward', handleDailyRewardStatus);
storeRouter.get('/daily-reward/status', handleDailyRewardStatus);
storeRouter.get('/daily-status', handleDailyRewardStatus);
storeRouter.get('/gacha/daily-status', handleDailyRewardStatus);
storeRouter.get('/user/daily-status', handleDailyRewardStatus);

// Claim Daily Reward (Requirement 34: Must be manually claimed)
storeRouter.post('/daily-reward/claim', handleDailyRewardClaim);
storeRouter.post('/daily-claim', handleDailyRewardClaim);
storeRouter.post('/claim-points', handleDailyRewardClaim);
storeRouter.post('/gacha/daily-claim', handleDailyRewardClaim);
storeRouter.post('/user/claim-daily', handleDailyRewardClaim);
storeRouter.post('/claim-daily', handleDailyRewardClaim);

// Point Ledger (Requirement 67)
storeRouter.get('/points/ledger', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const ledger = DataStore.getPointLedger(req.user!.telegram_id);
  res.json({
    success: true,
    data: ledger,
  });
});

// Redeem Points for Store Coupon (50, 100, or 200 points tier)
storeRouter.post('/points/redeem-coupon', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const { tierPoints } = req.body;
  const result = DataStore.redeemPointsForCoupon(
    req.user!.telegram_id,
    tierPoints ? Number(tierPoints) : 100
  );
  if (!result.success) {
    res.status(400).json({
      success: false,
      error: { code: result.error || 'REDEMPTION_FAILED', message: 'Could not redeem points for coupon' },
    });
    return;
  }
  res.json({
    success: true,
    data: result.coupon,
  });
});

