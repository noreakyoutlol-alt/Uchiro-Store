import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../server';
import { DataStore } from '../database/data-store';

describe('Uchiro Store Backend Test Suite', () => {
  it('GET /api/health returns 200 and system status', async () => {
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(200);
    expect(res.body.success !== false).toBe(true);
    expect(res.body.version).toBe('3.0.0');
    expect(res.body.bots.store_bot).toBeDefined();
    expect(res.body.bots.admin_bot).toBeDefined();
  });

  it('GET /api/categories returns active categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
  });

  it('GET /api/products/in-stock returns ALL in-stock active products for Home page', async () => {
    const res = await request(app).get('/api/products/in-stock');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.length).toBeGreaterThan(0);
    // Every product on home must have stock > 0
    res.body.data.forEach((p: any) => {
      expect(p.stock).toBeGreaterThan(0);
      expect(p.is_active).toBe(true);
      expect(p.is_draft).toBe(false);
    });
  });

  it('POST /api/auth/telegram generates customer token', async () => {
    const res = await request(app).post('/api/auth/telegram').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.user.telegram_id).toBeDefined();
  });

  it('POST /api/auth/admin authenticates admin', async () => {
    const res = await request(app).post('/api/auth/admin').send({});
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.token).toBeDefined();
    expect(res.body.data.admin.role).toBeDefined();
  });

  it('POST /api/coupons/validate verifies coupon discount', async () => {
    const res = await request(app)
      .post('/api/coupons/validate')
      .send({ code: 'UCHIRO10', subtotal: 20 });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.discountAmount).toBe(2.0); // 10% of 20 = 2.0
  });

  it('Full Order Lifecycle: Create Order -> Check KHQR -> Simulate Payment -> Order Delivered', async () => {
    // 1. Auth customer
    const authRes = await request(app).post('/api/auth/telegram').send({});
    const token = authRes.body.data.token;

    // 2. Fetch products
    const prodRes = await request(app).get('/api/products/in-stock');
    const product = prodRes.body.data.find((p: any) => p.delivery_mode === 'auto_account');
    expect(product).toBeDefined();

    // 3. Create Order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        productId: product.id,
        quantity: 1,
        couponCode: 'UCHIRO10',
      });

    expect(orderRes.status).toBe(201);
    expect(orderRes.body.success).toBe(true);
    const order = orderRes.body.data.order;
    const payment = orderRes.body.data.payment;
    expect(order.status).toBe('pending_payment');
    expect(payment.qr_payload).toBeDefined();
    expect(payment.bakong_deep_link).toBeDefined();

    // 4. Verify payment status is pending
    const statusRes = await request(app).get(`/api/payments/${payment.id}/status`);
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.data.isPaid).toBe(false);

    // 5. Simulate customer paying KHQR
    const paySimRes = await request(app).post(`/api/payments/${payment.id}/simulate-paid`);
    expect(paySimRes.status).toBe(200);
    expect(paySimRes.body.data.isPaid).toBe(true);

    // 6. Check order delivery: Account credentials must now be present
    const checkOrderRes = await request(app)
      .get(`/api/orders/${order.id}`)
      .set('Authorization', `Bearer ${token}`);

    expect(checkOrderRes.status).toBe(200);
    expect(checkOrderRes.body.data.status).toBe('delivered');
    expect(checkOrderRes.body.data.delivery_credentials).toBeDefined();
    expect(checkOrderRes.body.data.delivery_credentials.length).toBeGreaterThan(0);
    expect(checkOrderRes.body.data.delivery_credentials[0].username).toBeDefined();
    expect(checkOrderRes.body.data.delivery_credentials[0].password).toBeDefined();
  });

  it('GET /api/gacha/pools & POST /api/gacha/:id/spin runs server-authoritative roll', async () => {
    const authRes = await request(app).post('/api/auth/telegram').send({});
    const token = authRes.body.data.token;
    const profile = DataStore.getProfile(authRes.body.data.user.telegram_id);
    if (profile) {
      profile.gacha_tickets = 2;
    }

    const poolsRes = await request(app).get('/api/gacha/pools');
    expect(poolsRes.status).toBe(200);
    const pool = poolsRes.body.data[0];
    expect(pool).toBeDefined();

    const spinRes = await request(app)
      .post(`/api/gacha/${pool.id}/spin`)
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(spinRes.status).toBe(200);
    expect(spinRes.body.success).toBe(true);
    expect(spinRes.body.data.prize).toBeDefined();
    expect(spinRes.body.data.prize.rarity).toBeDefined();
    expect(spinRes.body.data.claim).toBeDefined();
  });

  it('Admin API: Stats and Orders management', async () => {
    const authRes = await request(app).post('/api/auth/admin').send({});
    const token = authRes.body.data.token;

    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);
    expect(statsRes.body.data.revenue).toBeDefined();
    expect(statsRes.body.data.total_orders).toBeDefined();

    const ordersRes = await request(app)
      .get('/api/admin/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(ordersRes.status).toBe(200);
    expect(ordersRes.body.success).toBe(true);
    expect(Array.isArray(ordersRes.body.data)).toBe(true);
  });
});
