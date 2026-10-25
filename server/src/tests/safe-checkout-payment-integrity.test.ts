import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';
import { FulfillmentService } from '../services/fulfillment.service';
import { PaymentService } from '../services/payment.service';

describe('Safe Checkout and Payment Integrity Tests', () => {
  let customerToken: string;
  let customer2Token: string;
  const customer1TgId = 11223344;
  const customer2TgId = 55667788;
  const webhookSecret = 'test_webhook_secret_key_12345';
  const originalWebhookSecret = env.KHPAY_WEBHOOK_SECRET;

  beforeAll(async () => {
    // Mock notifications and fulfillment
    vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();
    vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);
    vi.spyOn(NotificationService, 'alertAdminRealOrderPaid').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyOrderDelivered').mockResolvedValue();
    vi.spyOn(NotificationService, 'alertAdminManualFulfillmentRequired').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyManualProcessing').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyOrderCreated').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyPaymentSuccess').mockResolvedValue();
    vi.spyOn(FulfillmentService, 'fulfillTelegramAccountOrder').mockResolvedValue({ pdfSent: false, messageSent: false });

    (env as any).KHPAY_WEBHOOK_SECRET = webhookSecret;

    const user1 = DataStore.findOrCreateTelegramUser({
      telegram_id: customer1TgId,
      username: 'checkout_buyer_1',
      first_name: 'BuyerOne',
    });

    customerToken = jwt.sign(
      {
        user_id: user1.user.id,
        telegram_id: customer1TgId,
        username: 'checkout_buyer_1',
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user2 = DataStore.findOrCreateTelegramUser({
      telegram_id: customer2TgId,
      username: 'checkout_buyer_2',
      first_name: 'BuyerTwo',
    });

    customer2Token = jwt.sign(
      {
        user_id: user2.user.id,
        telegram_id: customer2TgId,
        username: 'checkout_buyer_2',
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // =========================================================================
  // 1. Server-side price/total wins over tampered client values
  // =========================================================================
  it('1. Server-side price/total wins over tampered client values', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Tamper Resistant Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      price: 25.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'ValidBuyerRoblox',
        buyerConfirmedAge18: true,
        // Attacker attempts to tamper with prices and totals
        price: 0.01,
        subtotal: 0.01,
        total_amount: 0.01,
        amount: 0.01,
        currency: 'KHR',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    const { order, payment } = res.body.data;

    // Server-computed price and total must strictly prevail
    expect(order.subtotal).toBe(25.0);
    expect(order.total_amount).toBe(25.0);
    expect(payment.amount).toBe(25.0);
    expect(payment.currency).toBe('USD');
  });

  // =========================================================================
  // 2. Zero, negative, fractional, missing, or excessive quantities are rejected
  // =========================================================================
  it('2. Zero, negative, fractional, missing, or excessive quantities are rejected', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Quantity Check Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 10,
      price: 5.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    // Zero quantity
    const zeroRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 0, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(zeroRes.status).toBe(400);
    expect(zeroRes.body.error.code).toBe('INVALID_QUANTITY');

    // Negative quantity
    const negRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: -3, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(negRes.status).toBe(400);
    expect(negRes.body.error.code).toBe('INVALID_QUANTITY');

    // Fractional quantity
    const fracRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1.5, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(fracRes.status).toBe(400);
    expect(fracRes.body.error.code).toBe('INVALID_QUANTITY');

    // Missing quantity (undefined)
    const missingRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(missingRes.status).toBe(400);
    expect(missingRes.body.error.code).toBe('INVALID_QUANTITY');

    // Excessive quantity (> 100)
    const excessRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 999, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(excessRes.status).toBe(400);
    expect(excessRes.body.error.code).toBe('EXCESSIVE_QUANTITY');
  });

  // =========================================================================
  // 3. Inactive and sold-out products cannot be checked out
  // =========================================================================
  it('3. Inactive and sold-out products cannot be checked out', async () => {
    const category = DataStore.getCategories()[0];

    // Inactive product
    const inactiveProd = DataStore.saveProduct({
      category_id: category.id,
      title: 'Inactive Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      price: 10.0,
      is_active: false,
      is_draft: false,
    });

    const inactRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: inactiveProd.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(inactRes.status).toBe(400);
    expect(inactRes.body.error.code).toBe('PRODUCT_NOT_AVAILABLE');

    // Draft product
    const draftProd = DataStore.saveProduct({
      category_id: category.id,
      title: 'Draft Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      price: 10.0,
      is_active: true,
      is_draft: true,
    });

    const draftRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: draftProd.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(draftRes.status).toBe(400);
    expect(draftRes.body.error.code).toBe('PRODUCT_NOT_AVAILABLE');

    // Sold out product
    const soldOutProd = DataStore.saveProduct({
      category_id: category.id,
      title: 'Sold Out Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 0,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    const soldRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: soldOutProd.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });
    expect(soldRes.status).toBe(400);
    expect(soldRes.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  // =========================================================================
  // 4. Two concurrent purchases cannot oversell the last stock unit
  // =========================================================================
  it('4. Two concurrent purchases cannot oversell the last stock unit', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Last Unit Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 1,
      price: 12.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Fire two checkout requests simultaneously for the only 1 unit
    const [res1, res2] = await Promise.all([
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser1', buyerConfirmedAge18: true }),
      request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${customer2Token}`)
        .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser2', buyerConfirmedAge18: true }),
    ]);

    const statuses = [res1.status, res2.status].sort();
    // Exactly one must succeed (201) and the other must be rejected (400)
    expect(statuses).toEqual([201, 400]);

    const failedRes = res1.status === 400 ? res1 : res2;
    expect(['INSUFFICIENT_STOCK', 'PRODUCT_OUT_OF_STOCK']).toContain(failedRes.body.error?.code);

    // Stock must be 0, never negative
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(0);
  });

  // =========================================================================
  // 5. Repeated idempotency key does not create a second order/payment/QR or deduct stock twice
  // =========================================================================
  it('5. Repeated idempotency key does not create a second order/payment/QR or deduct stock twice', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Idempotency Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      price: 15.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const key = `idemp-key-repeat-test-${Date.now()}`;

    // First attempt
    const res1 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'ValidUser',
        buyerConfirmedAge18: true,
        idempotencyKey: key,
      });

    expect(res1.status).toBe(201);
    const order1 = res1.body.data.order;
    const payment1 = res1.body.data.payment;
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(4);

    // Second attempt with same idempotency key
    const res2 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'ValidUser',
        buyerConfirmedAge18: true,
        idempotencyKey: key,
      });

    expect(res2.status).toBe(201);
    const order2 = res2.body.data.order;
    const payment2 = res2.body.data.payment;

    // Must return the exact same order and payment without duplicate deduction
    expect(order2.id).toBe(order1.id);
    expect(payment2.id).toBe(payment1.id);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(4);

    // Cross-customer idempotency conflict: customer 2 using customer 1's key must be rejected
    const resConflict = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customer2Token}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'ValidUser2',
        buyerConfirmedAge18: true,
        idempotencyKey: key,
      });

    expect(resConflict.status).toBe(400);
    expect(resConflict.body.error.code).toBe('IDEMPOTENCY_KEY_CONFLICT');
  });

  // =========================================================================
  // 6. Multi-item orders affect every correct product line, not just the first item
  // =========================================================================
  it('6. Multi-item orders affect every correct product line, not just the first item', () => {
    const category = DataStore.getCategories()[0];
    const prodA = DataStore.saveProduct({
      category_id: category.id,
      title: 'Multi Line Item A',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 4,
      price: 10.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const prodB = DataStore.saveProduct({
      category_id: category.id,
      title: 'Multi Line Item B',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 3,
      price: 20.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prodA.id)).toBe(4);
    expect(DataStore.getProductAvailableStock(prodB.id)).toBe(3);

    const orderRes = DataStore.createOrder({
      customerId: 'cust-multi',
      telegramId: customer1TgId,
      productId: prodA.id,
      robloxUsername: 'MultiLineBuyer',
      buyerConfirmedAge18: true,
      items: [
        { productId: prodA.id, quantity: 2 },
        { productId: prodB.id, quantity: 1 },
      ],
    });

    expect(orderRes.success).toBe(true);
    const order = orderRes.order!;
    expect(order.items?.length).toBe(2);

    // Both lines must have stock reserved
    expect(DataStore.getProductAvailableStock(prodA.id)).toBe(2);
    expect(DataStore.getProductAvailableStock(prodB.id)).toBe(2);

    // Releasing reservation must restore both lines independently
    DataStore.releaseReservation(order.id);
    expect(DataStore.getProductAvailableStock(prodA.id)).toBe(4);
    expect(DataStore.getProductAvailableStock(prodB.id)).toBe(3);
  });

  // =========================================================================
  // 7. A forged client-side paid state cannot mark an order as paid
  // =========================================================================
  it('7. A forged client-side paid state cannot mark an order as paid', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Tamper Status Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 2,
      price: 8.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });

    const order = orderRes.body.data.order;
    expect(order.status).toBe('pending_payment');

    // Attempt to spoof payment status via PUT/POST to order endpoint
    const patchAttempt = await request(app)
      .patch(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ status: 'paid', isPaid: true });
    // No route allows client to forge status
    expect([404, 405]).toContain(patchAttempt.status);

    // Fetch order directly: status must remain pending_payment
    const checkRes = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(checkRes.body.data.status).toBe('pending_payment');
  });

  // =========================================================================
  // 8. Invalid signature, wrong amount, wrong currency, or mismatched order reference is rejected
  // =========================================================================
  it('8. Invalid signature, wrong amount, wrong currency, or mismatched order reference is rejected', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Webhook Verification Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 3,
      price: 15.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });

    const { order, payment } = orderRes.body.data;

    // Helper to sign payloads
    const sign = (body: any) =>
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body)).digest('hex');

    // A. Invalid signature
    const validPayload = {
      id: payment.id,
      status: 'PAID',
      amount: 15.0,
      currency: 'USD',
      order_id: order.id,
    };

    const badSigRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', 'invalid_bogus_signature')
      .send(validPayload);
    expect(badSigRes.status).toBe(401);
    expect(badSigRes.body.error.code).toBe('INVALID_SIGNATURE');

    // B. Wrong amount
    const wrongAmountPayload = {
      ...validPayload,
      amount: 1.0, // Order was $15.00
    };
    const wrongAmtRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', sign(wrongAmountPayload))
      .send(wrongAmountPayload);
    expect(wrongAmtRes.status).toBe(400);
    expect(wrongAmtRes.body.error.code).toBe('PAYMENT_AMOUNT_MISMATCH');

    // C. Wrong currency
    const wrongCurrPayload = {
      ...validPayload,
      currency: 'KHR',
    };
    const wrongCurrRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', sign(wrongCurrPayload))
      .send(wrongCurrPayload);
    expect(wrongCurrRes.status).toBe(400);
    expect(wrongCurrRes.body.error.code).toBe('PAYMENT_CURRENCY_MISMATCH');

    // D. Mismatched order reference
    const wrongOrderPayload = {
      ...validPayload,
      order_id: 'UCH-WRONG-ORDER-ID',
    };
    const wrongOrderRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', sign(wrongOrderPayload))
      .send(wrongOrderPayload);
    expect(wrongOrderRes.status).toBe(400);
    expect(wrongOrderRes.body.error.code).toBe('ORDER_ID_MISMATCH');

    // Order must remain pending_payment after all rejected attempts
    const orderCheck = DataStore.getOrderById(order.id);
    expect(orderCheck?.status).toBe('pending_payment');
  });

  // =========================================================================
  // 9. Duplicate valid payment callbacks do not duplicate fulfillment, deductions, or notifications
  // =========================================================================
  it('9. Duplicate valid payment callbacks do not duplicate fulfillment, deductions, or notifications', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Callback Dedup Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 4,
      price: 10.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });

    const { order, payment } = orderRes.body.data;
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(3);

    const sign = (body: any) =>
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(body)).digest('hex');

    const validPayload = {
      id: payment.id,
      status: 'PAID',
      amount: 10.0,
      currency: 'USD',
      order_id: order.id,
      transaction_id: `TX-DEDUP-${Date.now()}`,
    };

    // First webhook callback: succeeds and processes order
    const firstRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', sign(validPayload))
      .send(validPayload);
    expect(firstRes.status).toBe(200);
    expect(firstRes.body.success).toBe(true);

    const updatedOrder = DataStore.getOrderById(order.id);
    expect(['paid', 'fulfillment', 'delivered']).toContain(updatedOrder?.status);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(3);

    // Second webhook callback with same event: deduplicated, no duplicate deduction
    const secondRes = await request(app)
      .post('/api/payments/webhook')
      .set('x-signature', sign(validPayload))
      .send(validPayload);
    expect(secondRes.status).toBe(200);
    expect(secondRes.body.duplicate).toBe(true);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(3);
  });

  // =========================================================================
  // 10. Pending cancellation/expiration releases reserved stock once
  // =========================================================================
  it('10. Pending cancellation/expiration releases reserved stock once', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Expiration Release Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 3,
      price: 10.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });

    const order = orderRes.body.data.order;
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(2);

    // Cancel / expire order
    order.status = 'expired';
    DataStore.releaseReservation(order.id);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(3);

    // Calling releaseReservation again must be idempotent and not increment stock a second time
    DataStore.releaseReservation(order.id);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(3);
  });

  // =========================================================================
  // 11. Paid/fulfilled orders cannot be restored by cleanup
  // =========================================================================
  it('11. Paid/fulfilled orders cannot be restored by cleanup', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Cleanup Immune Item',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 2,
      price: 14.0,
      requires_roblox_username: true,
      is_active: true,
      is_draft: false,
    });

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ValidUser', buyerConfirmedAge18: true });

    const { order, payment } = orderRes.body.data;
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Mark paid via processPaymentSuccess
    const cleanupPayload = {
      id: payment.id,
      status: 'PAID',
      amount: 14.0,
      currency: 'USD',
      order_id: order.id,
      transaction_id: `TX-CLEANUP-IMMUNE-${Date.now()}`,
    };
    await PaymentService.handleWebhook(
      cleanupPayload,
      crypto.createHmac('sha256', webhookSecret).update(JSON.stringify(cleanupPayload)).digest('hex')
    );

    const checkOrder = DataStore.getOrderById(order.id);
    expect(['paid', 'fulfillment', 'delivered']).toContain(checkOrder?.status);

    // Run expiration cleanup
    DataStore.cleanupExpiredReservations();

    // Stock must remain 1 (paid order stock cannot be restored!)
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Attempting releaseReservation on paid order directly must also do nothing
    DataStore.releaseReservation(order.id);
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);
  });

  // =========================================================================
  // 12. Payment webhook strictly fails closed in production when secret or signature is missing
  // =========================================================================
  it('12. Payment webhook strictly fails closed in production when secret or signature is missing', async () => {
    const originalEnv = env.NODE_ENV;
    const originalSecret = env.KHPAY_WEBHOOK_SECRET;
    try {
      (env as any).NODE_ENV = 'production';
      (env as any).KHPAY_WEBHOOK_SECRET = '';

      // Missing secret in production -> 500 WEBHOOK_SECRET_NOT_CONFIGURED
      const noSecretRes = await request(app)
        .post('/api/payments/webhook')
        .send({ id: 'dummy-payment-id', status: 'PAID' });
      expect(noSecretRes.status).toBe(500);
      expect(noSecretRes.body.error.code).toBe('WEBHOOK_SECRET_NOT_CONFIGURED');

      // Secret present but missing signature in production -> 401 MISSING_SIGNATURE
      (env as any).KHPAY_WEBHOOK_SECRET = 'prod_secret_123';
      const noSigRes = await request(app)
        .post('/api/payments/webhook')
        .send({ id: 'dummy-payment-id', status: 'PAID' });
      expect(noSigRes.status).toBe(401);
      expect(noSigRes.body.error.code).toBe('MISSING_SIGNATURE');
    } finally {
      (env as any).NODE_ENV = originalEnv;
      (env as any).KHPAY_WEBHOOK_SECRET = originalSecret;
    }
  });

  // =========================================================================
  // 13. Admin session rejects non-admin tokens with admin prefix in user_id or id
  // =========================================================================
  it('13. Admin session rejects non-admin tokens with admin prefix in user_id or id', async () => {
    const impersonatorToken = jwt.sign(
      {
        user_id: 'admin_impersonator_999',
        id: 'admin_fake_id',
        username: 'fake_admin',
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '1h' }
    );

    const res = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${impersonatorToken}`);

    expect(res.status).toBe(401);
    expect(res.body.error).toBe('UNAUTHORIZED');
  });

  // =========================================================================
  // 14. Product games metadata is preserved, normalized, and protected from credentials
  // =========================================================================
  it('14. Product games metadata is preserved, normalized, and protected from credentials', () => {
    const category = DataStore.getCategories()[0];
    const gamesPayload = [
      { name: '  Blox Fruits  ', platform: 'Roblox', description: 'Sea 3 unlocked' },
      { name: 'Pet Simulator 99', platform: 'Roblox' },
    ];

    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Multi Game Bundle Item',
      product_type: 'account',
      delivery_mode: 'manual_service',
      stock: 2,
      price: 30.0,
      games: gamesPayload,
      is_active: true,
      is_draft: false,
    });

    expect(prod.games).toBeDefined();
    expect(prod.games?.length).toBe(2);
    expect(prod.games?.[0].name).toBe('Blox Fruits');
    expect(prod.games?.[1].name).toBe('Pet Simulator 99');

    // getProductById returns normalized games
    const fetched = DataStore.getProductById(prod.id);
    expect(fetched?.games?.length).toBe(2);
    expect(fetched?.games?.[0].name).toBe('Blox Fruits');

    // getAllProductsAdmin returns normalized games
    const adminList = DataStore.getAllProductsAdmin();
    const adminProd = adminList.find((p) => p.id === prod.id);
    expect(adminProd?.games?.length).toBe(2);

    // updateProduct preserves or updates games
    DataStore.updateProduct(prod.id, {
      games: [{ name: 'Blade Ball', platform: 'Roblox' }],
    });
    const updated = DataStore.getProductById(prod.id);
    expect(updated?.games?.length).toBe(1);
    expect(updated?.games?.[0].name).toBe('Blade Ball');

    // Rejects credentials in games metadata
    expect(() => {
      DataStore.normalizeProductGames([
        { name: 'Game With Leak', raw_password: 'super_secret_password' },
      ]);
    }).toThrow(/credentials/i);
  });

  // =========================================================================
  // 15. Telegram bot webhooks reject requests in production if secret is missing or not configured
  // =========================================================================
  it('15. Telegram bot webhooks reject requests in production if secret is missing or not configured', async () => {
    const originalEnv = env.NODE_ENV;
    try {
      (env as any).NODE_ENV = 'production';

      // No secret token header passed -> 401
      const res = await request(app)
        .post('/api/bots/store/webhook')
        .send({ update_id: 99999 });

      expect(res.status).toBe(401);
    } finally {
      (env as any).NODE_ENV = originalEnv;
    }
  });

  afterAll(() => {
    (env as any).KHPAY_WEBHOOK_SECRET = originalWebhookSecret;
  });
});
