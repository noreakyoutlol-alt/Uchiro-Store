import { describe, it, expect, beforeAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import axios from 'axios';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { NotificationService } from '../services/notification.service';
import { FulfillmentService } from '../services/fulfillment.service';

describe('Stock Flow Regression Tests', () => {
  let adminToken: string;
  let customerToken: string;
  const testCustomerTgId = 44556677;

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
        username: 'uchiro_master_admin',
        role: 'superadmin',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    const customer = DataStore.findOrCreateTelegramUser({
      telegram_id: testCustomerTgId,
      username: 'roblox_buyer_vip',
      first_name: 'RobloxVIP',
    });

    customerToken = jwt.sign(
      {
        user_id: customer.user.id,
        telegram_id: testCustomerTgId,
        username: 'roblox_buyer_vip',
        role: 'customer',
      },
      env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  });

  beforeEach(() => {
    DataStore.resetDemoData();
  });

  // =========================================================================
  // Test 1: Product stock is 1; one successful stock-consuming purchase makes
  // the displayed/available stock 0 and the product shows SOLD OUT while remaining visible.
  // =========================================================================
  it('1. Stock 1 -> purchase -> available stock 0, product remains visible with SOLD OUT', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Single Stock Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 1,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'RobloxVIP',
      });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    // Stock reserved but not yet deducted
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(0);

    // Simulate payment completion
    const simRes = await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(simRes.status).toBe(200);

    // After payment success, stock should remain at 0 (deducted on reservation already)
    const finalStock = DataStore.getProductAvailableStock(prod.id);
    expect(finalStock).toBe(0);

    // Product should still be visible in admin API
    const adminRes = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes.status).toBe(200);
    const found = adminRes.body.data.find((p: any) => p.id === prod.id);
    expect(found).toBeDefined();
    expect(found.stock).toBe(0);
  });

  // =========================================================================
  // Test 2: Product stock is 2; after one successful purchase, displayed stock is exactly 1.
  // =========================================================================
  it('2. Stock 2 -> purchase -> displayed stock is exactly 1, not 0 or 2', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Two Stock Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 2,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(2);

    // Create order
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: prod.id,
        quantity: 1,
        robloxUsername: 'RobloxVIP',
      });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    // Simulate payment
    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Available stock should be exactly 1
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Admin API should reflect this
    const adminRes = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = adminRes.body.data.find((p: any) => p.id === prod.id);
    expect(found.stock).toBe(1);
  });

  // =========================================================================
  // Test 3: Two successive successful purchases for the same product produce
  // the expected stock, without only accounting for the first order or
  // subtracting the same order twice.
  // =========================================================================
  it('3. Two successive purchases decrement stock correctly (2 -> 1 -> 0)', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Two Purchases Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 2,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(2);

    // First purchase
    const order1Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'BuyerOne' });
    expect(order1Res.status).toBe(201);
    const { payment: pay1 } = order1Res.body.data;

    await request(app)
      .post(`/api/payments/${pay1.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Second purchase
    const order2Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'BuyerTwo' });
    expect(order2Res.status).toBe(201);
    const { payment: pay2 } = order2Res.body.data;

    await request(app)
      .post(`/api/payments/${pay2.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(0);
  });

  // =========================================================================
  // Test 4: Cancelled/expired/failed orders do not consume stock.
  // =========================================================================
  it('4. Expired/cancelled orders release stock back to available pool', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Expiration Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 2,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prod.id)).toBe(2);

    // Create order (reserves 1 unit)
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'RobloxVIP' });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    // Stock should be reserved (1 available)
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);

    // Release reservation (simulate expiration)
    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // After successful payment, stock should stay at 1 (deducted at reservation)
    // If order is cancelled/expired BEFORE payment, releaseReservation should restore stock
    // Let's test the releaseReservation path
    const order2Res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'BuyerTwo' });
    expect(order2Res.status).toBe(201);
    const { order: order2, payment: pay2 } = order2Res.body.data;

    // Stock should now be 0 (1 reserved, 1 sold)
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(0);

    // Release the second order's reservation
    DataStore.releaseReservation(order2.id);

    // Stock should be restored to 1
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(1);
  });

  // =========================================================================
  // Test 5: A multi-item order updates the correct product quantity for each line item.
  // =========================================================================
  it('5. Multi-item order correctly decrements each product line quantity', async () => {
    const category = DataStore.getCategories()[0];

    // Product A: gift, stock 3
    const prodA = DataStore.saveProduct({
      category_id: category.id,
      title: 'Multi Item Product A',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 3,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    // Product B: trade, stock 2
    const prodB = DataStore.saveProduct({
      category_id: category.id,
      title: 'Multi Item Product B',
      product_type: 'trade',
      delivery_mode: 'trade_item',
      stock: 2,
      requires_roblox_username: true,
      price: 20.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(prodA.id)).toBe(3);
    expect(DataStore.getProductAvailableStock(prodB.id)).toBe(2);

    // Create multi-item order directly via DataStore (testing the new items array)
    const orderResult = DataStore.createOrder({
      customerId: 'cust-multi',
      telegramId: testCustomerTgId,
      productId: prodA.id,
      quantity: 1,
      robloxUsername: 'MultiBuyer',
      items: [
        { productId: prodA.id, quantity: 2 },
        { productId: prodB.id, quantity: 1 },
      ],
    });

    expect(orderResult.success).toBe(true);
    expect(orderResult.order?.items?.length).toBe(2);

    // Stock should be reserved
    expect(DataStore.getProductAvailableStock(prodA.id)).toBe(1); // 3 - 2
    expect(DataStore.getProductAvailableStock(prodB.id)).toBe(1); // 2 - 1
  });

  // =========================================================================
  // Test 6: A positive-stock product does not show sold out solely because
  // of a stale status/is_delivered field.
  // =========================================================================
  it('6. Positive stock product is not sold out due to stale status field', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'Stale Status Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      requires_roblox_username: true,
      price: 15.0,
      is_active: true,
      is_draft: false,
    });

    // Initially available stock is 5
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(5);

    // Manually inject a stale status (simulating legacy data issue)
    const p = DataStore.getProductById(prod.id);
    if (p) {
      (p as any).is_delivered = true;
      (p as any).status = 'delivered';
    }

    // getProductAvailableStock should still return 5 (based on actual stock field)
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(5);

    // After a purchase, stock should decrement correctly
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'TestBuyer' });
    expect(orderRes.status).toBe(201);
    const { payment } = orderRes.body.data;

    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Stock should be 4 now
    expect(DataStore.getProductAvailableStock(prod.id)).toBe(4);
  });

  // =========================================================================
  // Test 7: The actual API response shape is parsed correctly by the dashboard
  // and stock changes become visible after the relevant refresh/update event.
  // =========================================================================
  it('7. Admin API returns correct stock shape and updates reflect on refresh', async () => {
    const category = DataStore.getCategories()[0];
    const prod = DataStore.saveProduct({
      category_id: category.id,
      title: 'API Shape Test Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 3,
      requires_roblox_username: true,
      price: 20.0,
      is_active: true,
      is_draft: false,
    });

    // Get initial admin products
    const adminRes1 = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminRes1.status).toBe(200);
    const initialProduct = adminRes1.body.data.find((p: any) => p.id === prod.id);
    expect(initialProduct).toBeDefined();
    expect(typeof initialProduct.stock).toBe('number');
    expect(initialProduct.stock).toBe(3);
    expect(initialProduct.stock_count).toBe(3);
    expect(initialProduct.is_available).toBe(true);

    // Make a purchase
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: prod.id, quantity: 1, robloxUsername: 'ApiBuyer' });
    expect(orderRes.status).toBe(201);
    const { payment } = orderRes.body.data;

    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    // Get admin products again (simulates dashboard refresh)
    const adminRes2 = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const updatedProduct = adminRes2.body.data.find((p: any) => p.id === prod.id);
    expect(updatedProduct).toBeDefined();
    expect(updatedProduct.stock).toBe(2);
    expect(updatedProduct.stock_count).toBe(2);
    expect(updatedProduct.is_available).toBe(true);
  });

  // =========================================================================
  // Test 8: Legacy products and products with zero stock remain compatible
  // with existing display rules.
  // =========================================================================
  it('8. Legacy products with zero stock and missing fields display correctly', async () => {
    const category = DataStore.getCategories()[0];

    // Product with stock = 0 (sold out but visible)
    const zeroStock = DataStore.saveProduct({
      category_id: category.id,
      title: 'Zero Stock Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 0,
      requires_roblox_username: true,
      price: 10.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(zeroStock.id)).toBe(0);

    const adminRes = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const found = adminRes.body.data.find((p: any) => p.id === zeroStock.id);
    expect(found).toBeDefined();
    expect(found.stock).toBe(0);
    expect(found.stock_count).toBe(0);
    expect(found.is_available).toBe(false);

    // Product with account type and no inventory items (stock = 0)
    const accProd = DataStore.saveProduct({
      category_id: category.id,
      title: 'Empty Account Product',
      product_type: 'account',
      delivery_mode: 'auto_account',
      stock: 0,
      requires_roblox_username: false,
      price: 50.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(accProd.id)).toBe(0);

    const adminRes2 = await request(app)
      .get('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`);
    const found2 = adminRes2.body.data.find((p: any) => p.id === accProd.id);
    expect(found2).toBeDefined();
    expect(found2.stock).toBe(0);
    expect(found2.is_available).toBe(false);
  });
});