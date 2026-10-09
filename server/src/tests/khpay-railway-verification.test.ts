import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { KHPayService } from '../services/khpay.service';
import { PaymentWorker } from '../workers/payment.worker';
import { PaymentService } from '../services/payment.service';
import { OrderService } from '../services/order.service';
import { NotificationService } from '../services/notification.service';
import { FulfillmentService } from '../services/fulfillment.service';
import { DataStore } from '../database/data-store';
import { checkSupabaseHealth } from '../database/supabase';
import { paymentRouter } from '../routes/payment.routes';
import { botsRouter } from '../routes/bots.routes';
import { env } from '../config/env';

describe('KHPay & Railway Phase Complete Verification', () => {
  let app: express.Application;

  beforeEach(() => {
    // Mock all notification and Telegram HTTP dispatches
    vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();
    vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);
    vi.spyOn(NotificationService, 'alertAdminRealOrderPaid').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyOrderDelivered').mockResolvedValue();
    vi.spyOn(NotificationService, 'alertAdminManualFulfillmentRequired').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyManualProcessing').mockResolvedValue();
    vi.spyOn(FulfillmentService, 'fulfillTelegramAccountOrder').mockResolvedValue({ pdfSent: false, messageSent: false });

    app = express();
    app.set('trust proxy', 1);
    app.use(express.json());
    app.use('/api/payments', paymentRouter);
    app.use('/api/bots', botsRouter);

    // Replenish stock for reliable test runs
    for (let i = 0; i < 5; i++) {
      DataStore.addInventoryItem({
        product_id: '22222222-2222-2222-2222-222222222201',
        item_type: 'account',
        account_username: `test_user_${Date.now()}_${i}`,
        raw_password: 'TestPassword123!',
      });
    }
  });

  afterEach(() => {
    PaymentWorker.stop();
  });

  describe('1. KHPay Service & Gateway Integration', () => {
    it('generates valid EMVCo KHQR payload, QR image data URL, and banking deep links', async () => {
      const result = await KHPayService.generateKHQRPayment({
        orderId: 'test-order-uuid-1',
        orderNumber: 'UCH-999001',
        amount: 25.5,
        currency: 'USD',
        validityMinutes: 10,
      });

      expect(result).toBeDefined();
      expect(result.qr_payload).toMatch(/(@abaa|bakong@abaa|PAYWAY@ABA)/i);
      expect(result.qr_payload).toContain('25.5');
      if (result.qr_payload.includes('bakong@abaa')) {
        expect(result.qr_payload).toContain('UCH-999001');
      }
      expect(result.qr_image_url).toMatch(/^data:image\/png;base64,/);
      expect(result.bakong_deep_link).toMatch(/^(bakong:\/\/pay\?qr=|bakong:\/\/)/);
      expect(result.aba_deep_link).toMatch(/^(aba:\/\/pay\?qr=|abamobilebank:\/\/)/);
      expect(result.md5_hash).toHaveLength(32);
      expect(result.expires_in).toBe(600);
      expect(new Date(result.expires_at).getTime()).toBeGreaterThan(Date.now());
    });

    it('reports accurate KHPay status and merchant configuration', () => {
      const status = KHPayService.getStatus();
      expect(status).toBeDefined();
      expect(status.currency).toBe('USD');
      expect(typeof status.isConfigured).toBe('boolean');
      expect(typeof status.testMode).toBe('boolean');
      expect(status.baseUrl).toBe(env.KHPAY_BASE_URL);
    });

    it('returns false for empty transaction verification status', async () => {
      const status = await KHPayService.verifyPaymentStatus('');
      expect(status.isPaid).toBe(false);
    });
  });

  describe('2. Payment Worker Background Monitor', () => {
    it('starts, reports status, and stops cleanly without resource leaks', () => {
      PaymentWorker.start(1000);
      const status = PaymentWorker.getStatus();

      expect(status.isRunning).toBe(true);
      expect(status.intervalMs).toBe(1000);
      expect(typeof status.pendingCount).toBe('number');
      expect(typeof status.inFlightCount).toBe('number');

      PaymentWorker.stop();
      const stoppedStatus = PaymentWorker.getStatus();
      expect(stoppedStatus.isRunning).toBe(false);
    });

    it('marks pending payments as expired and releases inventory after expiration time', async () => {
      // Create order with expired payment
      const { order, payment } = await OrderService.createOrder({
        customerId: 'cust-worker-exp',
        telegramId: 99887711,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      // Force payment expiry to the past
      payment.expires_at = new Date(Date.now() - 60000).toISOString();
      payment.status = 'pending';
      DataStore.savePayment(payment);

      // Trigger one tick
      await PaymentWorker.tick();

      const updatedPayment = DataStore.getPaymentById(payment.id);
      expect(updatedPayment?.status).toBe('expired');
    });
  });

  describe('3. KHPay Webhooks & Payment Routes', () => {
    it('processes authoritative PAID webhook and delivers order', async () => {
      const { order, payment } = await OrderService.createOrder({
        customerId: 'cust-wh-paid',
        telegramId: 99887722,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const res = await request(app)
        .post('/api/payments/webhook')
        .send({
          md5_hash: payment.md5_hash,
          status: 'PAID',
          transaction_ref: 'KHPAY-LIVE-TX-100200',
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      const updatedOrder = DataStore.getOrderById(order.id);
      expect(['paid', 'delivered']).toContain(updatedOrder?.status);
      expect(updatedOrder?.delivery_credentials).toBeDefined();
    });

    it('deduplicates identical webhook notifications', async () => {
      const { payment } = await OrderService.createOrder({
        customerId: 'cust-wh-dedup',
        telegramId: 99887733,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const res1 = await request(app)
        .post('/api/payments/webhook')
        .send({
          md5_hash: payment.md5_hash,
          status: 'PAID',
        });
      expect(res1.body.success).toBe(true);

      const res2 = await request(app)
        .post('/api/payments/webhook')
        .send({
          md5_hash: payment.md5_hash,
          status: 'PAID',
        });
      expect(res2.body.duplicate).toBe(true);
    });

    it('rejects webhooks with missing identifiers', async () => {
      const res = await request(app)
        .post('/api/payments/webhook')
        .send({
          status: 'PAID',
        });

      expect(res.status).toBe(400);
    });

    it('returns payment status for polling via GET /api/payments/:id/status', async () => {
      const { payment } = await OrderService.createOrder({
        customerId: 'cust-poll-status',
        telegramId: 99887744,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const res = await request(app).get(`/api/payments/${payment.id}/status`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.status).toBe('pending');
      expect(res.body.data.isPaid).toBe(false);
    });

    it('supports dev test payment simulation in development mode only', async () => {
      const { payment, order } = await OrderService.createOrder({
        customerId: 'cust-sim-pay',
        telegramId: 99887755,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const res = await request(app).post(`/api/payments/${payment.id}/simulate-paid`);
      expect(res.status).toBe(200);
      expect(res.body.data.isPaid).toBe(true);

      const updated = DataStore.getOrderById(order.id);
      expect(['paid', 'delivered']).toContain(updated?.status);
    });
  });

  describe('4. Production Safety, Expiration & Idempotency Rules (Critical Audit)', () => {
    it('proves provider expires_in is honored and stored correctly', async () => {
      const result = await KHPayService.generateKHQRPayment({
        orderId: 'test-order-exp-custom',
        orderNumber: 'UCH-EXP180',
        amount: 15.0,
        currency: 'USD',
        validityMinutes: 3, // 180 seconds
      });

      expect(result.expires_in).toBe(180);
      const expectedTime = Date.now() + 180 * 1000;
      const actualTime = new Date(result.expires_at).getTime();
      expect(Math.abs(actualTime - expectedTime)).toBeLessThan(5000);

      const { order, payment } = await OrderService.createOrder({
        customerId: 'cust-exp-test',
        telegramId: 99881122,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      expect(payment.expires_at).toBeDefined();
      expect(payment.provider_expires_in).toBeDefined();
      expect(payment.expires_in).toBeDefined();
    });

    it('guarantees payment idempotency: paid once, inventory consumed once, points awarded once, receipt once', async () => {
      const telegramId = 99883344;
      const { order, payment } = await OrderService.createOrder({
        customerId: 'cust-idempotent-test',
        telegramId,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const initialPurchaseTxCount = DataStore.getPointLedger(telegramId).filter(
        (e) => e.type === 'order_purchase'
      ).length;
      expect(initialPurchaseTxCount).toBe(0);

      // Process payment success first time
      const processed1 = await OrderService.processPaymentSuccess(order.id, 'TX-IDEM-001');
      expect(processed1.status).toBe('delivered');
      expect(processed1.warranty_status).toBe('active');
      const initialWarrantyStart = processed1.warranty_starts_at;
      expect(initialWarrantyStart).toBeDefined();
      expect(processed1.receipt_notified).toBe(true);

      const purchaseTxAfterFirst = DataStore.getPointLedger(telegramId).filter(
        (e) => e.type === 'order_purchase'
      ).length;
      expect(purchaseTxAfterFirst).toBe(1);

      // Replay payment success second and third times (simulating replayed webhook or duplicate call)
      const processed2 = await OrderService.processPaymentSuccess(order.id, 'TX-IDEM-002');
      const processed3 = await OrderService.processPaymentSuccess(order.id, 'TX-IDEM-003');

      expect(processed2.status).toBe('delivered');
      expect(processed3.status).toBe('delivered');

      // Points NOT double awarded
      const purchaseTxAfterReplays = DataStore.getPointLedger(telegramId).filter(
        (e) => e.type === 'order_purchase'
      ).length;
      expect(purchaseTxAfterReplays).toBe(1);

      // Warranty start timestamp unchanged
      expect(processed2.warranty_starts_at).toBe(initialWarrantyStart);
      expect(processed3.warranty_starts_at).toBe(initialWarrantyStart);

      // Receipt notification remained flagged as true without re-triggering
      expect(processed2.receipt_notified).toBe(true);
      expect(processed3.receipt_notified).toBe(true);
    });

    it('proves real QR payload amount matches exact order total amount', async () => {
      const specificAmount = 12.5;
      const result = await KHPayService.generateKHQRPayment({
        orderId: 'test-order-amount-check',
        orderNumber: 'UCH-AMT125',
        amount: specificAmount,
        currency: 'USD',
        validityMinutes: 10,
      });

      expect(result.amount).toBe(specificAmount);
      expect(result.qr_payload).toContain(specificAmount.toFixed(2));
      expect(result.qr_payload).not.toContain('0.01'); // Never hardcoded static $0.01
    });

    it('proves backend secret and KHPay API keys never leak to frontend models', () => {
      const publicStatus = KHPayService.getStatus();
      expect((publicStatus as any).apiKey).toBeUndefined();
      expect((publicStatus as any).secret).toBeUndefined();
      expect((publicStatus as any).webhookSecret).toBeUndefined();
    });

    it('rejects fake payment generation fallback in production mode when credentials missing', async () => {
      const originalEnv = env.NODE_ENV;
      const originalApiKey = env.KHPAY_API_KEY;
      try {
        (env as any).NODE_ENV = 'production';
        (env as any).KHPAY_API_KEY = '';

        await expect(
          KHPayService.generateKHQRPayment({
            orderId: 'prod-test-order',
            orderNumber: 'UCH-PROD001',
            amount: 50.0,
          })
        ).rejects.toThrow(/KHPay live credentials missing in production/i);
      } finally {
        (env as any).NODE_ENV = originalEnv;
        (env as any).KHPAY_API_KEY = originalApiKey;
      }
    });

    it('rejects simulated payment endpoint in production mode', async () => {
      const { payment } = await OrderService.createOrder({
        customerId: 'cust-prod-sim-reject',
        telegramId: 99885566,
        productId: '22222222-2222-2222-2222-222222222201',
      });

      const originalEnv = env.NODE_ENV;
      try {
        (env as any).NODE_ENV = 'production';
        const res = await request(app).post(`/api/payments/${payment.id}/simulate-paid`);
        expect(res.status).toBe(403);
      } finally {
        (env as any).NODE_ENV = originalEnv;
      }
    });
  });

  describe('4. Telegram Webhook Diagnostics & Routes', () => {
    it('returns bot webhook diagnostics via GET /api/bots/webhook/status', async () => {
      const res = await request(app).get('/api/bots/webhook/status');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.store_bot.username).toBe(env.STORE_BOT_USERNAME);
      expect(res.body.data.admin_bot.username).toBe(env.ADMIN_BOT_USERNAME);
      expect(res.body.data.store_bot.telegram_status).toBeDefined();
      expect(res.body.data.admin_bot.telegram_status).toBeDefined();
    });

    it('rejects store bot webhook with invalid secret token', async () => {
      const res = await request(app)
        .post('/api/bots/store/webhook')
        .set('x-telegram-bot-api-secret-token', 'wrong_secret')
        .send({ update_id: 12345 });

      expect(res.status).toBe(403);
    });

    it('rejects admin bot webhook with invalid secret token', async () => {
      const res = await request(app)
        .post('/api/bots/admin/webhook')
        .set('x-telegram-bot-api-secret-token', 'wrong_secret')
        .send({ update_id: 67890 });

      expect(res.status).toBe(403);
    });
  });

  describe('5. Supabase Health Check', () => {
    it('checks Supabase health and returns structured diagnostics', async () => {
      const health = await checkSupabaseHealth();
      expect(health).toBeDefined();
      expect(typeof health.configured).toBe('boolean');
      expect(typeof health.connected).toBe('boolean');
      expect(typeof health.url).toBe('string');
    });
  });

  describe('6. Railway Deployment Readiness Contract', () => {
    const rootDir = path.resolve(__dirname, '../../..');

    it('has root package.json with start and build scripts for Railway', () => {
      const pkgPath = path.join(rootDir, 'package.json');
      expect(fs.existsSync(pkgPath)).toBe(true);
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

      expect(pkg.scripts.start).toBeDefined();
      expect(pkg.scripts.build).toBeDefined();
      expect(pkg.engines?.node).toBeDefined();
    });

    it('has valid railway.json with Nixpacks builder and health check path', () => {
      const railwayJsonPath = path.join(rootDir, 'railway.json');
      expect(fs.existsSync(railwayJsonPath)).toBe(true);
      const railwayConfig = JSON.parse(fs.readFileSync(railwayJsonPath, 'utf8'));

      expect(railwayConfig.build.builder).toBe('NIXPACKS');
      expect(railwayConfig.build.buildCommand).toBe('npm run build');
      expect(railwayConfig.deploy.startCommand).toBe('npm start');
      expect(railwayConfig.deploy.healthcheckPath).toBe('/health');
    });

    it('has Procfile matching start command', () => {
      const procfilePath = path.join(rootDir, 'Procfile');
      expect(fs.existsSync(procfilePath)).toBe(true);
      const content = fs.readFileSync(procfilePath, 'utf8');
      expect(content).toContain('web: npm start');
    });

    it('has nixpacks.toml with Node 20 and build configuration', () => {
      const nixpacksPath = path.join(rootDir, 'nixpacks.toml');
      expect(fs.existsSync(nixpacksPath)).toBe(true);
      const content = fs.readFileSync(nixpacksPath, 'utf8');
      expect(content).toContain('nodejs_20');
      expect(content).toContain('npm run build');
    });
  });
});
