import { describe, it, expect, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { DataStore } from '../database/data-store';
import { OrderService } from '../services/order.service';
import { RobuxService } from '../services/robux.service';
import { orderRouter } from '../routes/order.routes';
import { userRouter } from '../routes/user.routes';
import {
  getRobuxSession,
  clearRobuxSession,
  handleRobuxMenu,
  handleRobuxUsernameInput,
  handleConfirmAccountProfile,
  handleSelectPack,
  handleRobuxAgeConfirmed,
  handleRobuxAgeUnder18,
  handleRobuxPayNow,
} from '../bots/store-bot/handlers/robux';
import { cb } from '../bots/store-bot/keyboards';

describe('Robux Age Flow, Checkout Safety & Navigation Integrity', () => {
  let app: express.Express;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    // Attach user auth mock
    app.use((req, _res, next) => {
      (req as any).user = { user_id: 'cust-12345', telegram_id: 12345 };
      next();
    });
    app.use('/api/orders', orderRouter);
    app.use('/api/user', userRouter);
  });

  beforeEach(async () => {
    DataStore.resetDemoData();
    clearRobuxSession(12345);
    clearRobuxSession(99999);
    DataStore.saveProduct({
      id: 'prod-blox-1',
      category_id: 'robux',
      title: 'Robux Test Pack 100 R$',
      product_type: 'robux',
      delivery_mode: 'robux',
      stock: 10,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });
  });

  // =========================================================================
  // 1. SEQUENCE ENFORCEMENT: Username -> Confirmation -> Age Confirm -> Checkout
  // =========================================================================
  describe('1. Robux Sequence Enforcement', () => {
    it('enforces that Roblox username confirmation must occur before age confirmation', async () => {
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async () => {},
        editMessageText: async () => {},
      };

      await handleRobuxMenu(mockCtx);
      const session = getRobuxSession(12345);
      expect(session.state).toBe('awaiting_username');

      // Attempting to confirm age before username must be blocked / ignored
      await handleRobuxAgeConfirmed(mockCtx);
      expect(session.state).toBe('awaiting_username'); // Unchanged

      // Input verified username
      await handleRobuxUsernameInput(mockCtx, 'builderman');
      expect(session.state).toBe('reviewing_account');
      expect(session.robloxInfo?.username).toBe('builderman');

      // Confirm username profile
      await handleConfirmAccountProfile(mockCtx);
      expect(session.state).toBe('account_confirmed');
    });

    it('ensures age confirmation is unchecked and unconfirmed by default', async () => {
      const session = getRobuxSession(12345);
      expect(session.buyerAge18Confirmed).toBeUndefined();
      expect(session.buyerUnder18).toBeUndefined();
    });

    it('blocks buyers who indicate they are under 18 from proceeding to checkout', async () => {
      let repliedText = '';
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string) => { repliedText = text; },
        editMessageText: async (text: string) => { repliedText = text; },
      };

      const session = getRobuxSession(12345);
      session.state = 'account_confirmed';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };

      // User indicates they are under 18
      await handleRobuxAgeUnder18(mockCtx);

      expect(session.buyerUnder18).toBe(true);
      expect(session.buyerAge18Confirmed).toBe(false);
      expect(session.state).toBe('idle');
      expect(repliedText).toContain('UNDER-18 PURCHASE BLOCKED');
      expect(repliedText).toContain('Buyers under 18 years of age are not permitted to complete purchases');

      // Attempting to select pack after being blocked under 18 remains blocked
      await handleSelectPack(mockCtx, 100);
      expect(session.state).toBe('idle');
    });

    it('blocks proceeding to checkout if age-confirmation control is unchecked', async () => {
      let messageContent = '';
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string) => { messageContent = text; },
        editMessageText: async (text: string) => { messageContent = text; },
      };

      await RobuxService.setStock('admin1', 1000, 'Test pool');
      const session = getRobuxSession(12345);
      session.state = 'account_confirmed';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };
      // buyerAge18Confirmed is NOT set (unchecked by default)

      await handleSelectPack(mockCtx, 100);

      // Must show the age confirmation screen, NOT the final checkout/policy gate
      expect(session.state).toBe('awaiting_age_confirm');
      expect(messageContent).toContain('BUYER AGE CONFIRMATION');
      expect(messageContent).toContain('Account Tiers Overview');
      expect(messageContent).not.toContain('roblox.com/upgrades/robux'); // Final gate not reached
    });

    it('allows successful age confirmation to proceed to final checkout & preserves username', async () => {
      let messageContent = '';
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string) => { messageContent = text; },
        editMessageText: async (text: string) => { messageContent = text; },
      };

      await RobuxService.setStock('admin1', 1000, 'Test pool');
      const session = getRobuxSession(12345);
      session.state = 'awaiting_age_confirm';
      session.selectedAmount = 200;
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };

      // Buyer declares 18+
      await handleRobuxAgeConfirmed(mockCtx);

      expect(session.buyerAge18Confirmed).toBe(true);
      expect(session.buyerUnder18).toBe(false);
      expect(session.state).toBe('amount_selected');
      expect(session.robloxInfo.username).toBe('builderman');
      expect(messageContent).toContain('ROBUX PURCHASE POLICY & SAFETY NOTICE');
      expect(messageContent).toContain('builderman');
      expect(messageContent).toContain('200 Robux');
    });
  });

  // =========================================================================
  // 2. SERVER-SIDE AGE ENFORCEMENT & DIRECT API INTEGRITY
  // =========================================================================
  describe('2. Server-Side Age Requirement & Direct API Protection', () => {
    it('rejects direct API order creation if buyer declares under 18 with 403 Forbidden', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-blox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerUnder18: true,
          buyerConfirmedAge18: false,
        });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNDER_18_PURCHASE_BLOCKED');
    });

    it('rejects direct API order creation if age confirmation is missing or false with 400 Bad Request', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-blox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerConfirmedAge18: false,
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('AGE_CONFIRMATION_REQUIRED');
    });

    it('allows order creation when buyer explicitly confirms 18+ and stock is valid', async () => {
      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-blox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerConfirmedAge18: true,
          buyerUnder18: false,
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();
      expect(res.body.data.order.roblox_username).toBe('builderman');
    });

    it('prevents duplicate orders upon repeated clicks via idempotency key', async () => {
      const idempotencyKey = 'test-idemp-key-unique-999';

      const res1 = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-blox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerConfirmedAge18: true,
          idempotencyKey,
        });

      expect(res1.status).toBe(201);
      const firstOrderId = res1.body.data.order.id;

      // Second identical submission with same idempotency key
      const res2 = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-blox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerConfirmedAge18: true,
          idempotencyKey,
        });

      expect(res2.status).toBe(201);
      expect(res2.body.data.order.id).toBe(firstOrderId); // Exactly same order returned, no duplicate created
    });
  });

  // =========================================================================
  // 3. LANGUAGE CONSISTENCY & BUTTON LABELS (Khmer vs English)
  // =========================================================================
  describe('3. Language Consistency & English Button Rule', () => {
    it('produces Khmer message content with English button labels when Khmer is selected in bot', async () => {
      DataStore.setUserLanguagePreference(12345, 'km');

      let sentText = '';
      let sentExtra: any = null;
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
        editMessageText: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
      };

      const session = getRobuxSession(12345);
      session.state = 'account_confirmed';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };

      await handleSelectPack(mockCtx, 100);

      // Khmer message content
      expect(sentText).toContain('ការបញ្ជាក់អាយុរបស់អ្នកទិញ');
      expect(sentText).toContain('Account Tiers Overview');
      expect(sentText).toContain('Roblox Kids');
      expect(sentText).toContain('Roblox Select');
      expect(sentText).toContain('Roblox Standard');
      expect(sentText).toContain('Unchecked Accounts');
      expect(sentText).toContain('No Refund');

      // Button labels must remain English: Confirm and Back Home only
      const flatButtons = sentExtra?.reply_markup?.inline_keyboard?.flat() || [];
      const buttonLabels = flatButtons.map((b: any) => b.text);

      expect(buttonLabels.some((l: string) => l.includes('Confirm'))).toBe(true);
      expect(buttonLabels.some((l: string) => l.includes('Back Home'))).toBe(true);
      expect(buttonLabels.length).toBe(2);
    });

    it('produces English message content with English button labels when English is selected', async () => {
      DataStore.setUserLanguagePreference(12345, 'en');

      let sentText = '';
      let sentExtra: any = null;
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
        editMessageText: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
      };

      const session = getRobuxSession(12345);
      session.state = 'account_confirmed';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };

      await handleSelectPack(mockCtx, 100);

      // English message content
      expect(sentText).toContain('BUYER AGE CONFIRMATION');
      expect(sentText).toContain('Account Tiers Overview');
      expect(sentText).toContain('Roblox Kids');
      expect(sentText).toContain('Roblox Select');
      expect(sentText).toContain('Roblox Standard');
      expect(sentText).toContain('Unchecked Accounts');
      expect(sentText).toContain('No Refund');

      // Button labels must be English: Confirm and Back Home only
      const flatButtons = sentExtra?.reply_markup?.inline_keyboard?.flat() || [];
      const buttonLabels = flatButtons.map((b: any) => b.text);

      expect(buttonLabels.some((l: string) => l.includes('Confirm'))).toBe(true);
      expect(buttonLabels.some((l: string) => l.includes('Back Home'))).toBe(true);
      expect(buttonLabels.length).toBe(2);
    });

    it('persists language selection across multiple interactions and sessions', async () => {
      const res = await request(app)
        .post('/api/user/language')
        .set('x-telegram-user-id', '12345')
        .send({ language: 'km' });

      expect(res.status).toBe(200);
      expect(DataStore.getUserLanguagePreference(12345)).toBe('km');
    });
  });

  // =========================================================================
  // 4. NAVIGATION & BUTTON ACTION VERIFICATION
  // =========================================================================
  describe('4. Navigation & Button Action Verification', () => {
    it('creates callback buttons with correct callback_data and English labels', () => {
      const btnAge18 = cb('I am 18 or older (Self-Declaration)', 'cb_rbx_age_18_plus', 'CHECK');
      const btnUnder18 = cb('I am under 18', 'cb_rbx_age_under_18', 'CROSS');
      const btnBack = cb('Back to Packages', 'cb_rbx_back_packs', 'BACK');

      expect(btnAge18.callback_data).toBe('cb_rbx_age_18_plus');
      expect(btnAge18.text).toContain('I am 18 or older');

      expect(btnUnder18.callback_data).toBe('cb_rbx_age_under_18');
      expect(btnUnder18.text).toContain('I am under 18');

      expect(btnBack.callback_data).toBe('cb_rbx_back_packs');
      expect(btnBack.text).toContain('Back to Packages');
    });

    it('revalidates stock and price before completing checkout', async () => {
      const product = DataStore.getProductById('prod-blox-1');
      expect(product).toBeDefined();

      const initialStock = DataStore.getProductAvailableStock('prod-blox-1');
      expect(initialStock).toBeGreaterThan(0);

      // Verify order calculation correctly prices item
      const orderRes = DataStore.createOrder({
        customerId: 'cust-12345',
        telegramId: 12345,
        productId: 'prod-blox-1',
        quantity: 1,
        robloxUsername: 'builderman',
        buyerConfirmedAge18: true,
      });

      expect(orderRes.success).toBe(true);
      expect(orderRes.order?.total_amount).toBe(product?.price);
    });
  });

  // =========================================================================
  // 5. ISSUE 1 & ISSUE 3: PAY NOW, QR GENERATION & SCOPE VERIFICATION
  // =========================================================================
  describe('5. Pay Now, QR Generation & Age Scope Verification', () => {
    beforeEach(() => {
      DataStore.setUserLanguagePreference(12345, 'en');
      clearRobuxSession(12345);
    });

    it('displays Pay Now and Back Home buttons on final order review', async () => {
      let sentExtra: any = null;
      let sentText = '';
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
        editMessageText: async (text: string, extra?: any) => {
          sentText = text;
          sentExtra = extra;
        },
      };

      await RobuxService.setStock('admin1', 2000, 'Test pool');
      const session = getRobuxSession(12345);
      session.state = 'account_confirmed';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };
      session.buyerAge18Confirmed = true;

      await handleSelectPack(mockCtx, 500);

      const flatButtons = sentExtra?.reply_markup?.inline_keyboard?.flat() || [];
      const buttonLabels = flatButtons.map((b: any) => b.text);
      const buttonCallbacks = flatButtons.map((b: any) => b.callback_data);

      expect(buttonLabels.some((l: string) => l.includes('Pay Now'))).toBe(true);
      expect(buttonLabels.some((l: string) => l.includes('Back Home'))).toBe(true);
      expect(buttonCallbacks).toContain('cb_rbx_pay_now');
      expect(buttonCallbacks).toContain('cb_main_menu');

      // Wording describes buying and receiving Robux, NOT buying a Roblox account
      expect(sentText).toContain('builderman');
      expect(sentText).toContain('Robux');
      expect(sentText).toContain('NOT a Roblox account sale');

      // Step 9: Payable order and QR must NOT be created prematurely before Pay Now
      expect(session.orderCode).toBeUndefined();
    });

    it('generates payable order and payment QR only when Pay Now is pressed', async () => {
      let photoSent = false;
      let photoCaption = '';

      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async () => {},
        replyWithPhoto: async (_photo: any, extra?: any) => {
          photoSent = true;
          photoCaption = extra?.caption || '';
        },
      };

      await RobuxService.setStock('admin1', 2000, 'Test pool');
      const session = getRobuxSession(12345);
      session.state = 'amount_selected';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };
      session.selectedAmount = 500;
      session.buyerAge18Confirmed = true;

      await handleRobuxPayNow(mockCtx);

      expect(photoSent).toBe(true);
      expect(photoCaption).toContain('ROBUX PAYMENT');
      expect(photoCaption).toContain('builderman');
      expect(session.orderCode).toBeDefined();

      const createdOrder = await RobuxService.getOrderByCode(session.orderCode!);
      expect(createdOrder).toBeDefined();
      expect(createdOrder?.robux_amount).toBe(500);
      expect(createdOrder?.roblox_username).toBe('builderman');
    });

    it('prevents duplicate orders upon repeated Pay Now button clicks', async () => {
      let photosCount = 0;
      const mockCtx: any = {
        from: { id: 12345 },
        answerCbQuery: async () => {},
        reply: async () => {},
        replyWithPhoto: async () => {
          photosCount++;
        },
      };

      await RobuxService.setStock('admin1', 2000, 'Test pool');
      const session = getRobuxSession(12345);
      session.state = 'amount_selected';
      session.robloxInfo = { userId: 156, username: 'builderman', displayName: 'builderman' };
      session.selectedAmount = 500;
      session.buyerAge18Confirmed = true;

      // First click
      await handleRobuxPayNow(mockCtx);
      const originalOrderCode = session.orderCode;
      expect(originalOrderCode).toBeDefined();

      // Second click of Pay Now button
      await handleRobuxPayNow(mockCtx);

      // Must reuse existing orderCode, not create a duplicate order
      expect(session.orderCode).toBe(originalOrderCode);
    });

    it('Issue 3: Gamepass and Gift products do NOT require age confirmation', async () => {
      DataStore.saveProduct({
        id: 'prod-gamepass-1',
        category_id: '11111111-1111-1111-1111-111111111110',
        title: 'VIP Gamepass Service',
        product_type: 'gift',
        delivery_mode: 'manual_service',
        stock: 5,
        requires_roblox_username: false,
        price: 8.0,
        is_active: true,
        is_draft: false,
      });

      // Purchasing Gamepass with Roblox username but without age confirmation must succeed (201 Created)
      const res = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-gamepass-1',
          quantity: 1,
          robloxUsername: 'builderman',
        });
      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.order).toBeDefined();

      // Gift product requiring roblox username must also succeed even if buyerConfirmedAge18 is false
      DataStore.saveProduct({
        id: 'prod-gift-req-roblox-1',
        category_id: '11111111-1111-1111-1111-111111111110',
        title: 'Blox Fruits Fruit Notifier Gift',
        product_type: 'gift',
        delivery_mode: 'manual_service',
        stock: 5,
        requires_roblox_username: true,
        price: 25.0,
        is_active: true,
        is_draft: false,
      });

      const resGift = await request(app)
        .post('/api/orders')
        .send({
          productId: 'prod-gift-req-roblox-1',
          quantity: 1,
          robloxUsername: 'builderman',
          buyerConfirmedAge18: false,
        });
      expect(resGift.status).toBe(201);
      expect(resGift.body.success).toBe(true);
      expect(resGift.body.data.order).toBeDefined();
    });
  });
});
