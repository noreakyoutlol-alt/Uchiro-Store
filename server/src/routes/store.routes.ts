import { Router } from 'express';
import { StoreService } from '../services/store.service';
import { ProductController } from '../controllers/product.controller';
import { DataStore, claimDailyReward, getUserSnapshot } from '../database/data-store';
import { RobloxService } from '../services/roblox.service';
import { RobuxService } from '../services/robux.service';
import { RedeemCodeService } from '../services/redeem.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { CheckoutLock } from '../utils/checkout-lock';

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

// Member Redeem Code (Points, Gacha Tickets, Coupons)
storeRouter.post(['/redeem-code', '/redeem', '/codes/redeem'], requireTelegramAuth, async (req: RequestWithAuth, res) => {
  const code = (req.body?.code || '').trim();
  if (!code) {
    res.status(400).json({
      success: false,
      error: { code: 'INVALID_CODE', message: 'Redeem code is required' },
    });
    return;
  }

  const telegramId = req.user!.telegram_id;
  const idempotencyKey = (req.headers['x-idempotency-key'] as string) || req.body?.idempotencyKey;

  const result = await RedeemCodeService.redeem(telegramId, code, idempotencyKey);

  if (!result.success) {
    const statusCode =
      result.error_code === 'UNAUTHORIZED' ? 401 :
      result.error_code === 'INVALID_CODE' ? 400 :
      result.error_code === 'CODE_EXPIRED' ||
      result.error_code === 'CODE_DISABLED' ||
      result.error_code === 'CODE_EXHAUSTED' ||
      result.error_code === 'MEMBER_LIMIT_REACHED'
        ? 400
        : 500;

    res.status(statusCode).json({
      success: false,
      error: {
        code: result.error_code || 'REDEMPTION_FAILED',
        message: result.error || 'Failed to redeem code',
      },
    });
    return;
  }

  res.json({
    success: true,
    data: result,
    message: `Successfully redeemed ${result.reward_title}!`,
  });
});

// Real Customer Profile Statistics (Verified paid orders & ledger balance)
export const getCustomerStatsHandler = async (req: RequestWithAuth, res: any) => {
  const tgId = req.user!.telegram_id;
  const snapshot = await getUserSnapshot(tgId);
  const realProfile = DataStore.getProfile(tgId);

  return res.json({
    success: true,
    data: {
      total_orders: snapshot.ordersCount,
      total_spent: snapshot.totalSpent,
      profile: {
        ...(realProfile || {}),
        points: snapshot.points,
        reward_points: snapshot.points,
        loyalty_points: snapshot.points,
        gacha_tickets: snapshot.gachaTickets,
        streak_count: snapshot.streak,
        last_daily_claim_at: snapshot.lastDailyClaimAt,
      },
      points: snapshot.points,
      reward_points: snapshot.points,
      loyalty_points: snapshot.points,
      gacha_tickets: snapshot.gachaTickets,
      streak_count: snapshot.streak,
      last_daily_claim_at: snapshot.lastDailyClaimAt,
      next_claim_at: snapshot.nextClaimAt,
    },
  });
};

storeRouter.get('/me', requireTelegramAuth, getCustomerStatsHandler);
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

// Seasonal Theme (Public read-only for customer Store Mini App - Prompt 6)
storeRouter.get('/theme', (_req, res) => {
  const themeConfig = DataStore.getSeasonalTheme();
  res.json({
    success: true,
    data: {
      active_theme: themeConfig.active_theme,
      updated_at: themeConfig.updated_at,
    },
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

// Robux Stock Availability & Policy Status (Prompt 11: Authoritative Consistency)
storeRouter.get(['/robux/stock', '/store/robux/stock'], async (_req, res, next) => {
  try {
    const stock = await RobuxService.getStockConfig();
    const available = Math.max(0, stock.total_balance - stock.reserved_balance);
    const tiers = RobuxService.calculateTiers(stock);

    res.json({
      success: true,
      data: {
        total_balance: stock.total_balance,
        reserved_balance: stock.reserved_balance,
        available_balance: available,
        rate_per_1000: stock.rate_per_1000,
        is_active: stock.is_active,
        policy_gated: !stock.is_active,
        compliance_notice: !stock.is_active
          ? {
              policy: 'Roblox Terms of Use (May 19, 2026)',
              official_url: 'https://www.roblox.com/upgrades/robux',
              message:
                'Direct automated third-party Robux purchase/fulfillment is safely held disabled pending documented platform authorization. Please purchase directly via official Roblox channels.',
            }
          : null,
        tiers,
      },
    });
  } catch (err) {
    next(err);
  }
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
  if (process.env.NODE_ENV === 'test') {
    const rawId =
      req.body?.telegramId ||
      req.body?.telegram_id ||
      req.query?.telegramId ||
      req.query?.telegram_id ||
      req.headers['x-telegram-id'];
    if (rawId && !isNaN(Number(rawId)) && Number(rawId) > 0) {
      return Number(rawId);
    }
  }
  return null;
}

export const handleDailyRewardStatus = async (req: RequestWithAuth, res: any) => {
  const tgId = req.user?.telegram_id
    ? Number(req.user.telegram_id)
    : resolveTelegramIdFromReq(req);
  if (!tgId) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const snap = await getUserSnapshot(tgId);
  const settings = DataStore.getStoreSettings();
  const now = Date.now();
  const lastClaimMs = snap.lastDailyClaimAt ? new Date(snap.lastDailyClaimAt).getTime() : 0;
  const cooldownMs = 24 * 60 * 60 * 1000;
  const elapsedMs = lastClaimMs > 0 ? now - lastClaimMs : cooldownMs;
  const canClaim = elapsedMs >= cooldownMs;
  const remainingMs = canClaim ? 0 : cooldownMs - elapsedMs;
  const secondsRemaining = Math.ceil(remainingMs / 1000);
  const nextClaimAt = lastClaimMs > 0 ? new Date(lastClaimMs + cooldownMs).toISOString() : null;

  return res.json({
    success: true,
    data: {
      can_claim: canClaim,
      current_streak: snap.streak || 1,
      reward_points: snap.streak % settings.streak_interval_days === 0 ? settings.streak_bonus_points + settings.daily_reward_points : settings.daily_reward_points,
      last_claimed_at: snap.lastDailyClaimAt,
      next_claim_at: nextClaimAt,
      seconds_remaining: secondsRemaining,
      points: snap.points,
      streak_days: [...Array(settings.streak_interval_days).keys()].map((d) => {
        const dayNum = d + 1;
        const points = dayNum % settings.streak_interval_days === 0 ? settings.streak_bonus_points + settings.daily_reward_points : settings.daily_reward_points;
        return {
          day: dayNum,
          points,
          isClaimed: snap.streak >= dayNum,
          isToday: ((snap.streak % settings.streak_interval_days) || settings.streak_interval_days) === dayNum,
          isBonus: dayNum % settings.streak_interval_days === 0,
        };
      }),
    },
  });
};

export const handleDailyRewardClaim = async (req: RequestWithAuth, res: any) => {
  const tgId = req.user?.telegram_id
    ? Number(req.user.telegram_id)
    : (process.env.NODE_ENV === 'test' ? resolveTelegramIdFromReq(req) : null);

  if (!tgId) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
  }

  const claimRes = await claimDailyReward(tgId);

  if (!claimRes.success) {
    const secondsRemaining = (claimRes as any).seconds_remaining ?? Math.ceil(((claimRes as any).remainingMs ?? 0) / 1000);
    const nextClaimAt = new Date(Date.now() + secondsRemaining * 1000).toISOString();
    return res.status(200).json({
      success: false,
      error: claimRes.error || 'ALREADY_CLAIMED_TODAY',
      pointsAwarded: 0,
      seconds_remaining: secondsRemaining,
      next_claim_at: nextClaimAt,
    });
  }

  const pointsAwarded = (claimRes as any).pointsAwarded ?? 5;
  const newBalance = Number(claimRes.points);

  return res.json({
    success: true,
    points: newBalance,
    streak: Number(claimRes.streak),
    pointsAwarded,
    newBalance,
    message: '🎉 ទទួលបាន +5 ពិន្ទុជោគជ័យ!',
    seconds_remaining: claimRes.seconds_remaining ?? 86400,
    next_claim_at: claimRes.nextClaimAt,
    data: {
      success: true,
      points: newBalance,
      streak: Number(claimRes.streak),
      pointsAwarded,
      newBalance,
      seconds_remaining: claimRes.seconds_remaining ?? 86400,
      next_claim_at: claimRes.nextClaimAt,
    },
  });
};

// Daily Reward Status
storeRouter.get('/daily-reward', requireTelegramAuth, handleDailyRewardStatus);
storeRouter.get('/daily-reward/status', requireTelegramAuth, handleDailyRewardStatus);
storeRouter.get('/daily-status', requireTelegramAuth, handleDailyRewardStatus);
storeRouter.get('/gacha/daily-status', requireTelegramAuth, handleDailyRewardStatus);
storeRouter.get('/user/daily-status', requireTelegramAuth, handleDailyRewardStatus);

// Claim Daily Reward
storeRouter.post('/daily-reward/claim', requireTelegramAuth, handleDailyRewardClaim);
storeRouter.post('/daily-claim', requireTelegramAuth, handleDailyRewardClaim);
storeRouter.post('/claim-points', requireTelegramAuth, handleDailyRewardClaim);
storeRouter.post('/gacha/daily-claim', requireTelegramAuth, handleDailyRewardClaim);
storeRouter.post('/user/claim-daily', requireTelegramAuth, handleDailyRewardClaim);
storeRouter.post('/claim-daily', requireTelegramAuth, handleDailyRewardClaim);

// Point Ledger (Requirement 67)
storeRouter.get('/points/ledger', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const ledger = DataStore.getPointLedger(req.user!.telegram_id);
  res.json({
    success: true,
    data: ledger,
  });
});

// Redeem Points for Store Coupon (50, 100, or 200 points tier)
storeRouter.post('/points/redeem-coupon', requireTelegramAuth, async (req: RequestWithAuth, res) => {
  const rawTierPoints = req.body?.tierPoints !== undefined ? req.body.tierPoints : req.body?.points;
  if (rawTierPoints === undefined || rawTierPoints === null || isNaN(Number(rawTierPoints))) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_COUPON_TIER', message: 'tierPoints is required (50, 100, or 200)' },
    });
  }
  const tierPoints = Number(rawTierPoints);
  const telegramId = req.user!.telegram_id;

  const result = await CheckoutLock.runExclusive(`coupon_redeem_${telegramId}`, () =>
    DataStore.redeemPointsForCoupon(telegramId, tierPoints)
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
    data: {
      ...result.coupon,
      newBalance: result.newBalance,
    },
  });
});

