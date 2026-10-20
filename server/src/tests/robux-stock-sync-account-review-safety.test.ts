import { describe, it, expect, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { RobuxService } from '../services/robux.service';
import { storeRouter } from '../routes/store.routes';
import { adminRouter } from '../routes/admin.routes';
import {
  handleRobuxMenu,
  handleRobuxUsernameInput,
  handleConfirmAccountProfile,
  handleSelectPack,
  getRobuxSession,
  clearRobuxSession,
} from '../bots/store-bot/handlers/robux';

describe('PROMPT 11 — Robux Stock Sync, Account Review, and Payment Safety', () => {
  let app: express.Express;

  beforeEach(() => {
    // Reset test in-memory stock state
    RobuxService._resetForTesting(0, 3.50);

    app = express();
    app.use(express.json());
    // Attach mock admin for testing admin routes
    app.use('/api/admin', (req, _res, next) => {
      (req as any).admin = { telegram_id: 99999999, user_id: 'admin_test', username: 'admin', role: 'admin' };
      next();
    }, adminRouter);
    app.use('/api', storeRouter);
  });

  // =========================================================================
  // 1. ADMIN STOCK RANGE AND VALIDATION (10 through 1,000,000 inclusive)
  // =========================================================================
  describe('1. Admin Stock Range and Validation', () => {
    it('accepts boundary value: minimum 10 Robux', async () => {
      const updated = await RobuxService.setStock('admin1', 10, 'Set minimum bound');
      expect(updated.total_balance).toBe(10);
      expect(updated.reserved_balance).toBe(0);
    });

    it('accepts boundary value: maximum 1,000,000 Robux', async () => {
      const updated = await RobuxService.setStock('admin1', 1_000_000, 'Set maximum bound');
      expect(updated.total_balance).toBe(1_000_000);
      expect(updated.reserved_balance).toBe(0);
    });

    it('accepts standard inventory value: 100 Robux', async () => {
      const updated = await RobuxService.setStock('admin1', 100, 'Standard restock');
      expect(updated.total_balance).toBe(100);
    });

    it('rejects values below 10 (e.g. 9, 0, -1)', async () => {
      await expect(RobuxService.setStock('admin1', 9, 'Below minimum')).rejects.toThrow(
        /INVALID_STOCK_RANGE/
      );
      await expect(RobuxService.setStock('admin1', 0, 'Zero')).rejects.toThrow(
        /INVALID_STOCK_RANGE/
      );
      await expect(RobuxService.setStock('admin1', -50, 'Negative')).rejects.toThrow(
        /INVALID_STOCK_RANGE/
      );
    });

    it('rejects values above 1,000,000 (e.g. 1,000,001)', async () => {
      await expect(RobuxService.setStock('admin1', 1_000_001, 'Above max')).rejects.toThrow(
        /INVALID_STOCK_RANGE/
      );
    });

    it('rejects non-integer / decimal values (e.g. 100.5, 10.1)', async () => {
      await expect(RobuxService.setStock('admin1', 100.5, 'Decimal')).rejects.toThrow(
        /INVALID_STOCK_RANGE/
      );
    });

    it('validateStockAmount helper strictly catches blank, string, boolean, and malformed inputs', () => {
      expect(RobuxService.validateStockAmount(null).valid).toBe(false);
      expect(RobuxService.validateStockAmount(undefined).valid).toBe(false);
      expect(RobuxService.validateStockAmount('').valid).toBe(false);
      expect(RobuxService.validateStockAmount('   ').valid).toBe(false);
      expect(RobuxService.validateStockAmount(true).valid).toBe(false);
      expect(RobuxService.validateStockAmount('abc').valid).toBe(false);
      expect(RobuxService.validateStockAmount('5').valid).toBe(false); // below 10
      expect(RobuxService.validateStockAmount('1000001').valid).toBe(false); // above 1M
      expect(RobuxService.validateStockAmount('100.25').valid).toBe(false); // decimal
      expect(RobuxService.validateStockAmount('100').valid).toBe(true);
      expect(RobuxService.validateStockAmount(100).valid).toBe(true);
      expect(RobuxService.validateStockAmount(10).valid).toBe(true);
      expect(RobuxService.validateStockAmount(1_000_000).valid).toBe(true);
    });

    it('server PUT /api/admin/robux/stock rejects invalid inputs with HTTP 400', async () => {
      const resBelow = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: 9 });
      expect(resBelow.status).toBe(400);
      expect(resBelow.body.error).toBe('INVALID_STOCK_RANGE');

      const resAbove = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: 2_000_000 });
      expect(resAbove.status).toBe(400);
      expect(resAbove.body.error).toBe('INVALID_STOCK_RANGE');

      const resDecimal = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: 50.75 });
      expect(resDecimal.status).toBe(400);
      expect(resDecimal.body.error).toBe('INVALID_STOCK_RANGE');

      const resBlank = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: '' });
      expect(resBlank.status).toBe(400);
      expect(resBlank.body.error).toBe('INVALID_STOCK_RANGE');
    });

    it('rejects adjusting total stock below currently reserved stock', async () => {
      // Set pool to 500
      await RobuxService.setStock('admin1', 500, 'Initial pool');

      // Reserve 200 for an order
      const reserved = await RobuxService.reserveStock('ORDER_TEST_RES_1', 200);
      expect(reserved).toBe(true);

      const current = await RobuxService.getStockConfig();
      expect(current.reserved_balance).toBe(200);

      // Attempting to set total stock to 100 (below reserved 200) MUST be rejected
      await expect(RobuxService.setStock('admin1', 100, 'Shrink below reserved')).rejects.toThrow(
        /STOCK_BELOW_RESERVED/
      );

      // Also verify rejection via admin PUT endpoint
      const res = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: 150 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('STOCK_BELOW_RESERVED');
    });
  });

  // =========================================================================
  // 2. ADMIN-TO-STORE STOCK CONSISTENCY
  // =========================================================================
  describe('2. Admin-to-Store Stock Consistency', () => {
    it('shows 100 in Store when Admin sets total stock to 100 and no reservations exist', async () => {
      await RobuxService.setStock('admin1', 100, 'Admin restock to 100');

      const res = await request(app).get('/api/robux/stock');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.total_balance).toBe(100);
      expect(res.body.data.reserved_balance).toBe(0);
      expect(res.body.data.available_balance).toBe(100);

      // Tier check: 100 Robux pack shows 1 available pack, 200+ shows 0 (sold out)
      const t100 = res.body.data.tiers.find((t: any) => t.denomination === 100);
      const t200 = res.body.data.tiers.find((t: any) => t.denomination === 200);
      expect(t100?.available_packs).toBe(1);
      expect(t100?.is_sold_out).toBe(false);
      expect(t200?.available_packs).toBe(0);
      expect(t200?.is_sold_out).toBe(true);
    });

    it('clearly distinguishes Total Stock from Available Stock when reservations exist', async () => {
      await RobuxService.setStock('admin1', 1000, 'Pool 1000');
      await RobuxService.reserveStock('ORDER_RES_500', 500);

      const res = await request(app).get('/api/store/robux/stock');
      expect(res.status).toBe(200);
      expect(res.body.data.total_balance).toBe(1000);
      expect(res.body.data.reserved_balance).toBe(500);
      expect(res.body.data.available_balance).toBe(500); // 1000 - 500 = 500 available
    });

    it('reflects stock updates immediately across both Admin and Store endpoints', async () => {
      // Admin sets stock via API
      const putRes = await request(app)
        .put('/api/admin/robux/stock')
        .send({ total: 750, rate_per_1000: 4.00 });
      expect(putRes.status).toBe(200);
      expect(putRes.body.data.total_balance).toBe(750);
      expect(putRes.body.data.rate_per_1000).toBe(4.00);

      // Store endpoint reads the exact same authoritative source
      const storeRes = await request(app).get('/api/robux/stock');
      expect(storeRes.status).toBe(200);
      expect(storeRes.body.data.total_balance).toBe(750);
      expect(storeRes.body.data.available_balance).toBe(750);
      expect(storeRes.body.data.rate_per_1000).toBe(4.00);
    });
  });

  // =========================================================================
  // 3. RESERVATION, CONCURRENCY & RELEASE SAFETY
  // =========================================================================
  describe('3. Reservation, Concurrency & Release Safety', () => {
    it('prevents overselling during concurrent reservations', async () => {
      // Setup pool of exactly 100 Robux
      await RobuxService.setStock('admin1', 100, 'Exact single pack');

      // Attempt two reservations of 100 Robux concurrently
      const [resA, resB] = await Promise.all([
        RobuxService.reserveStock('CONCUR_ORDER_A', 100),
        RobuxService.reserveStock('CONCUR_ORDER_B', 100),
      ]);

      // Exactly one must succeed, the other must fail (insufficient stock)
      expect([resA, resB].filter(Boolean).length).toBe(1);

      const stock = await RobuxService.getStockConfig();
      expect(stock.reserved_balance).toBe(100);
      expect(stock.total_balance - stock.reserved_balance).toBe(0);
    });

    it('releases unpaid expired reservations exactly once without double deduction', async () => {
      await RobuxService.setStock('admin1', 300, 'Pool 300');
      await RobuxService.reserveStock('ORDER_RELEASE_TEST', 100);

      let stock = await RobuxService.getStockConfig();
      expect(stock.reserved_balance).toBe(100);

      // First release
      await RobuxService.releaseReservation('ORDER_RELEASE_TEST');
      stock = await RobuxService.getStockConfig();
      expect(stock.reserved_balance).toBe(0);

      // Second release on same order (idempotency check — must NOT deduct below 0)
      await RobuxService.releaseReservation('ORDER_RELEASE_TEST');
      stock = await RobuxService.getStockConfig();
      expect(stock.reserved_balance).toBe(0);
    });

    it('commits deduction upon fulfillment idempotently', async () => {
      await RobuxService.setStock('admin1', 1000, 'Pool 1000');
      const order = await RobuxService.createOrder({
        telegramId: '12345',
        robloxUsername: 'test_player',
        robuxAmount: 200,
      });

      expect(order.success).toBe(true);
      expect(order.order?.status).toBe('pending');

      // Commit fulfillment
      const fulfilled = await RobuxService.commitFulfillment(order.order!.order_code, 'admin1');
      expect(fulfilled).toBe(true);

      const stock = await RobuxService.getStockConfig();
      expect(stock.total_balance).toBe(800);
      expect(stock.reserved_balance).toBe(0);

      // Calling commitFulfillment again should be idempotent (return true without double deducting)
      const fulfilledAgain = await RobuxService.commitFulfillment(order.order!.order_code, 'admin1');
      expect(fulfilledAgain).toBe(true);

      const stockAfter = await RobuxService.getStockConfig();
      expect(stockAfter.total_balance).toBe(800);
    });
  });

  // =========================================================================
  // 4. BUYER ACCOUNT REVIEW BEFORE AMOUNT SELECTION (Prompt 11 Section 4)
  // =========================================================================
  describe('4. Buyer Account Review Before Amount Selection', () => {
    it('demands username first and transitions session to awaiting_username upon entering Robux menu', async () => {
      const mockCtx: any = {
        from: { id: 777001 },
        reply: async () => {},
        editMessageText: async () => {},
      };

      await handleRobuxMenu(mockCtx);

      const session = getRobuxSession(777001);
      expect(session.state).toBe('awaiting_username');
      expect(session.robloxInfo).toBeUndefined();
      expect(session.selectedAmount).toBeUndefined();
    });

    it('rejects invalid username formats (< 3 chars, > 20 chars, special characters)', async () => {
      const mockCtx: any = {
        from: { id: 777002 },
        reply: async () => {},
      };

      getRobuxSession(777002).state = 'awaiting_username';

      // Too short
      const handledShort = await handleRobuxUsernameInput(mockCtx, 'ab');
      expect(handledShort).toBe(true);
      expect(getRobuxSession(777002).state).toBe('awaiting_username'); // remains in input state

      // Invalid characters
      const handledInvalid = await handleRobuxUsernameInput(mockCtx, 'user@name!');
      expect(handledInvalid).toBe(true);
      expect(getRobuxSession(777002).state).toBe('awaiting_username');
    });

    it('handles not-found usernames gracefully without fabricating fake profiles', async () => {
      const mockCtx: any = {
        from: { id: 777003 },
        reply: async () => {},
      };

      getRobuxSession(777003).state = 'awaiting_username';

      const handled = await handleRobuxUsernameInput(mockCtx, 'definitely_nonexistent_xyz_9999');
      expect(handled).toBe(true);

      // Session must NOT advance to reviewing_account with fabricated data
      expect(getRobuxSession(777003).robloxInfo).toBeUndefined();
      expect(getRobuxSession(777003).state).toBe('awaiting_username');
    });

    it('advances to reviewing_account and displays public details for verified account', async () => {
      let repliedText = '';
      const mockCtx: any = {
        from: { id: 777004 },
        reply: async (text: string) => { repliedText = text; },
        replyWithPhoto: async (_photo: string, extra: any) => { repliedText = extra.caption; },
      };

      getRobuxSession(777004).state = 'awaiting_username';

      // 'builderman' is supported by mock test fixture
      const handled = await handleRobuxUsernameInput(mockCtx, 'builderman');
      expect(handled).toBe(true);

      const session = getRobuxSession(777004);
      expect(session.state).toBe('reviewing_account');
      expect(session.robloxInfo?.username).toBe('builderman');
      expect(session.robloxInfo?.userId).toBe(156);
      expect(repliedText).toContain('builderman');
      expect(repliedText).toContain('ROBLOX ACCOUNT PROFILE REVIEW');
    });

    it('requires profile confirmation before enabling amount selection', async () => {
      const mockCtx: any = {
        from: { id: 777005 },
        answerCbQuery: async () => {},
        reply: async () => {},
        editMessageText: async () => {},
      };

      // If user tries to select an amount before confirming account, it MUST be blocked
      getRobuxSession(777005).state = 'awaiting_username';
      await handleSelectPack(mockCtx, 100);
      expect(getRobuxSession(777005).state).toBe('awaiting_username'); // remains blocked

      // Now review account
      getRobuxSession(777005).state = 'reviewing_account';
      getRobuxSession(777005).robloxInfo = {
        userId: 156,
        username: 'builderman',
        displayName: 'builderman',
      };

      // Confirm account
      await handleConfirmAccountProfile(mockCtx);
      expect(getRobuxSession(777005).state).toBe('account_confirmed');
    });
  });

  // =========================================================================
  // 5. PAYMENT / QR SAFETY & POLICY GATE (Prompt 11 Section 5)
  // =========================================================================
  describe('5. Payment / QR Safety & Policy Gate', () => {
    it('safely disables real-money purchase and informs buyer of official Roblox acquisition routes', async () => {
      let messageContent = '';
      const mockCtx: any = {
        from: { id: 777006 },
        answerCbQuery: async () => {},
        reply: async (text: string) => { messageContent = text; },
        editMessageText: async (text: string) => { messageContent = text; },
      };

      // Setup confirmed account and stock
      await RobuxService.setStock('admin1', 1000, 'Pool 1000');
      const session = getRobuxSession(777006);
      session.state = 'account_confirmed';
      session.robloxInfo = {
        userId: 156,
        username: 'builderman',
        displayName: 'builderman',
      };

      await handleSelectPack(mockCtx, 100);

      // Verify that the policy gate is presented
      expect(messageContent).toContain('ROBUX PURCHASE POLICY & SAFETY NOTICE');
      expect(messageContent).toContain('May 19, 2026');
      expect(messageContent).toContain('roblox.com/upgrades/robux');
      expect(messageContent).toContain('safely disabled');
    });

    it('truthfully reports order status without falsifying paid or completing status', async () => {
      await RobuxService.setStock('admin1', 1000, 'Pool 1000');
      const order = await RobuxService.createOrder({
        telegramId: '777007',
        robloxUsername: 'test_player',
        robuxAmount: 100,
      });

      expect(order.success).toBe(true);
      const fetched = await RobuxService.getOrderByCode(order.order!.order_code);
      expect(fetched).not.toBeNull();
      expect(fetched?.status).toBe('pending'); // Truthful status, never fabricated 'paid'
    });
  });
});
