import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';
import { FulfillmentService } from '../services/fulfillment.service';

describe('Uchiro Store Product Types & Stock Management Verification', () => {
  let adminToken: string;
  let customerToken: string;
  const testCustomerTgId = 99887766;

  beforeAll(async () => {
    vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();
    vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);
    vi.spyOn(NotificationService, 'alertAdminRealOrderPaid').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyOrderDelivered').mockResolvedValue();
    vi.spyOn(NotificationService, 'alertAdminManualFulfillmentRequired').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyManualProcessing').mockResolvedValue();
    vi.spyOn(FulfillmentService, 'fulfillTelegramAccountOrder').mockResolvedValue({ pdfSent: false, messageSent: false });

    adminToken = jwt.sign(
      {
        id: 'admin-super-1',
        username: 'uchiro_admin',
        role: 'superadmin',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const user = DataStore.findOrCreateTelegramUser({
      telegram_id: testCustomerTgId,
      username: 'testcustomer',
      first_name: 'Test Customer',
    });

    customerToken = jwt.sign(
      {
        user_id: user.user.id,
        telegram_id: user.user.telegram_id,
        username: user.user.username,
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  });

  it('Requirement 1: supports all 8 primary categories in database', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    const slugs = res.body.data.map((c: any) => c.slug);
    expect(slugs).toContain('blox-fruits');
    expect(slugs).toContain('mm2');
    expect(slugs).toContain('rivals');
    expect(slugs).toContain('blade-ball');
    expect(slugs).toContain('evade');
    expect(slugs).toContain('steal-egg');
    expect(slugs).toContain('gamepasses');
    expect(slugs).toContain('other');
  });

  it('Requirement 2: creates Account product, and deposits stock with Authenticator = Yes vs No', async () => {
    // 1. Create Account product
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Blox Fruits Mythic Kitsune Account #1',
        category_id: '11111111-1111-1111-1111-111111111103',
        price: 15.0,
        product_type: 'account',
        delivery_mode: 'auto_account',
        warranty_days: 14,
        is_active: true,
        is_draft: false,
        specifications: { Level: '2550', Fruit: 'Kitsune' },
      });

    expect(createRes.status).toBe(201);
    const product = createRes.body.data;
    expect(product.product_type).toBe('account');
    expect(product.delivery_mode).toBe('auto_account');

    // 2. Deposit Stock Item with Authenticator = Yes (RFC 6238 secret)
    const base32Secret = 'JBSWY3DPEHPK3PXP';
    const depositWithAuthRes = await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        account_username: 'PlayerKitsune01',
        raw_password: 'SecurePassword123!',
        raw_2fa: base32Secret,
        status: 'available',
      });

    expect(depositWithAuthRes.status).toBe(200);
    expect(depositWithAuthRes.body.success).toBe(true);

    // 3. Deposit Stock Item with Authenticator = No (null 2FA)
    const depositNoAuthRes = await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        account_username: 'PlayerKitsune02',
        raw_password: 'SecurePassword456!',
        raw_2fa: null,
        status: 'available',
      });

    expect(depositNoAuthRes.status).toBe(200);

    // 4. Check product stock is accurately calculated from available inventory (should be 2)
    const updatedProd = DataStore.getProductById(product.id);
    expect(updatedProd?.stock).toBe(2);
  });

  it('Requirement 4: verifies Roblox username for Gift products', async () => {
    // Valid roblox check
    const validRes = await request(app)
      .get('/api/roblox/profile/Roblox')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(validRes.status).toBe(200);
    expect(validRes.body.success).toBe(true);
    expect(validRes.body.data.name).toBe('Roblox');

    // Invalid non-existent user check returns 404
    const invalidRes = await request(app)
      .get('/api/roblox/profile/ThisUserDoesNotExistXYZ999999999')
      .set('Authorization', `Bearer ${customerToken}`);

    expect(invalidRes.status).toBe(404);
    expect(invalidRes.body.success).toBe(false);
  });

  it('Requirement 7: single stock account drops to 0, shows SOLD OUT, product remains visible', async () => {
    // 1. Create Account product with single stock
    const createRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Rare Blox Fruits Godhuman Account Exclusive',
        category_id: '11111111-1111-1111-1111-111111111103',
        price: 25.0,
        product_type: 'account',
        delivery_mode: 'auto_account',
        warranty_days: 14,
        is_active: true,
        is_draft: false,
      });

    expect(createRes.status).toBe(201);
    const product = createRes.body.data;

    // Deposit exactly 1 item
    await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: product.id,
        account_username: 'GodhumanHero',
        raw_password: 'HeroPassword999!',
        status: 'available',
      });

    let prodInStore = DataStore.getProductById(product.id);
    expect(prodInStore?.stock).toBe(1);

    // 2. Customer buys the product
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: product.id,
      });

    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    // Fulfill the order via payment simulation
    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Verify stock is now 0
    prodInStore = DataStore.getProductById(product.id);
    expect(prodInStore?.stock).toBe(0);

    // Verify product is STILL in store catalog and NOT deleted or hidden
    const publicProductsRes = await request(app).get('/api/products');
    const catalogItem = publicProductsRes.body.data.find((p: any) => p.id === product.id);
    expect(catalogItem).toBeDefined();
    expect(catalogItem.stock).toBe(0);
    expect(catalogItem.is_active).toBe(true);
  });

  it('Requirement 8: post-purchase delivery shows credentials and respects Authenticator Yes/No', async () => {
    // Create product
    const pRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Blox Fruits No 2FA Account',
        category_id: '11111111-1111-1111-1111-111111111103',
        price: 8.0,
        product_type: 'account',
        delivery_mode: 'auto_account',
        is_active: true,
      });
    expect(pRes.status).toBe(201);
    const prod = pRes.body.data;

    // Deposit item without 2FA
    await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: prod.id,
        account_username: 'DirectLoginUser',
        raw_password: 'DirectPassword!',
        raw_2fa: null, // Authenticator = No
        status: 'available',
      });

    // Buy & fulfill
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Fetch delivery
    const deliveryRes = await request(app)
      .get(`/api/orders/${order.id}/delivery`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(deliveryRes.status).toBe(200);
    const del = deliveryRes.body.data;
    expect(del.username).toBe('DirectLoginUser');
    expect(del.password).toBe('DirectPassword!');
    // If Authenticator = No, authenticator.available is false and secret is null
    expect(del.authenticator.available).toBe(false);
    expect(del.authenticator.manual_setup_key).toBeNull();
  });
});
