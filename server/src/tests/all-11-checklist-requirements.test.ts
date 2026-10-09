import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import app from '../server';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';

describe('Comprehensive Verification Suite: All 11 Product Flow & Stock Checklist Requirements', () => {
  let adminToken: string;
  let customerToken: string;
  const testCustomerTgId = 44556677;

  beforeAll(async () => {
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

  // =========================================================================
  // Requirement 1: Game / Category Selection (8 Primary Categories)
  // =========================================================================
  it('1. Game/Category Selection: supports all 8 primary categories', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const categories = res.body.data;
    const slugs = categories.map((c: any) => c.slug);

    const expectedSlugs = [
      'blox-fruits',
      'mm2',
      'rivals',
      'blade-ball',
      'evade',
      'steal-egg',
      'gamepasses',
      'other',
    ];

    expectedSlugs.forEach((slug) => {
      expect(slugs).toContain(slug);
    });
  });

  // =========================================================================
  // Requirement 2: Product Type Selection (Account, Gift Item, Trade Item)
  // =========================================================================
  it('2. Product Type Selection: creates Account, Gift Item, and Trade Item products', async () => {
    // 2.1 Account Product
    const accRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Checklist Blox Fruits Godhuman Account',
        category_id: '11111111-1111-1111-1111-111111111103',
        price: 35.0,
        product_type: 'account',
        delivery_mode: 'auto_account',
        warranty_days: 14,
        is_active: true,
        is_draft: false,
      });
    expect(accRes.status).toBe(201);
    expect(accRes.body.data.product_type).toBe('account');
    expect(accRes.body.data.delivery_mode).toBe('auto_account');

    // 2.2 Gift Item Product
    const giftRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Checklist Blox Fruits Dark Blade Gamepass Gift',
        category_id: '11111111-1111-1111-1111-111111111103',
        price: 15.0,
        product_type: 'gift',
        delivery_mode: 'manual_service',
        stock: 10,
        requires_roblox_username: true,
        is_active: true,
        is_draft: false,
      });
    expect(giftRes.status).toBe(201);
    expect(giftRes.body.data.product_type).toBe('gift');
    expect(giftRes.body.data.stock).toBe(10);

    // 2.3 Trade Item Product
    const tradeRes = await request(app)
      .post('/api/admin/products')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        title: 'Checklist MM2 Harvester Trade Item',
        category_id: '11111111-1111-1111-1111-111111111104',
        price: 20.0,
        product_type: 'trade',
        delivery_mode: 'manual_service',
        stock: 3,
        requires_roblox_username: true,
        is_active: true,
        is_draft: false,
      });
    expect(tradeRes.status).toBe(201);
    expect(tradeRes.body.data.product_type).toBe('trade');
    expect(tradeRes.body.data.stock).toBe(3);
  });

  // =========================================================================
  // Requirement 3: Type-specific fields
  // =========================================================================
  it('3. Type-specific fields: Account has warrantyDays; Gift & Trade mandate Roblox username', async () => {
    const categories = DataStore.getCategories();
    const bloxCat = categories.find((c) => c.slug === 'blox-fruits')!;

    // Account product has warranty_days (14 days)
    const acc = DataStore.saveProduct({
      category_id: bloxCat.id,
      title: 'TypeSpecific Account Check',
      product_type: 'account',
      delivery_mode: 'auto_account',
      warranty_days: 14,
      price: 29.99,
      is_active: true,
      is_draft: false,
    });
    expect(acc.warranty_days).toBe(14);
    expect(acc.requires_roblox_username).toBeFalsy();

    // Gift product has requires_roblox_username = true
    const gift = DataStore.saveProduct({
      category_id: bloxCat.id,
      title: 'TypeSpecific Gift Check',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      requires_roblox_username: true,
      price: 9.99,
      is_active: true,
      is_draft: false,
    });
    expect(gift.requires_roblox_username).toBe(true);

    // Trade product has requires_roblox_username = true
    const trade = DataStore.saveProduct({
      category_id: bloxCat.id,
      title: 'TypeSpecific Trade Check',
      product_type: 'trade',
      delivery_mode: 'manual_service',
      stock: 2,
      requires_roblox_username: true,
      price: 18.0,
      is_active: true,
      is_draft: false,
    });
    expect(trade.requires_roblox_username).toBe(true);
  });

  // =========================================================================
  // Requirement 4: Account inventory (username, password, optional authenticator)
  // =========================================================================
  it('4. Account inventory: deposits username, password, with and without authenticator', async () => {
    const accProd = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Inventory Test Account Suite',
      product_type: 'account',
      delivery_mode: 'auto_account',
      price: 40.0,
      is_active: true,
      is_draft: false,
    });

    const rfcSecret = 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ';

    // Verify TOTP calculation endpoint
    const verifyTotpRes = await request(app)
      .post('/api/admin/inventory/verify-totp')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ secret: rfcSecret, username: 'PlayerTest01' });
    expect(verifyTotpRes.status).toBe(200);
    expect(verifyTotpRes.body.success).toBe(true);
    expect(verifyTotpRes.body.data.code).toHaveLength(6);

    // Deposit 1: WITH Authenticator
    const dep1Res = await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: accProd.id,
        account_username: 'AccWithAuth',
        raw_password: 'PassWithAuth123!',
        raw_2fa: rfcSecret,
        status: 'available',
      });
    expect(dep1Res.status).toBe(200);
    expect(dep1Res.body.success).toBe(true);
    expect(dep1Res.body.data.encrypted_account_2fa).toBeTruthy();

    // Deposit 2: WITHOUT Authenticator
    const dep2Res = await request(app)
      .post('/api/admin/inventory')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        productId: accProd.id,
        account_username: 'AccNoAuth',
        raw_password: 'PassNoAuth123!',
        raw_2fa: null,
        status: 'available',
      });
    expect(dep2Res.status).toBe(200);
    expect(dep2Res.body.success).toBe(true);
    expect(dep2Res.body.data.encrypted_account_2fa).toBeNull();

    // Check product stock equals number of available inventory items
    const updated = DataStore.getProductById(accProd.id);
    expect(updated?.stock).toBe(2);
  });

  // =========================================================================
  // Requirement 5 & 6: Gift stock and Trade stock
  // =========================================================================
  it('5 & 6. Gift & Trade stock: independent stock values, decremented when purchased', async () => {
    const gift = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Gift Stock Check Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 5,
      requires_roblox_username: true,
      price: 12.0,
      is_active: true,
      is_draft: false,
    });

    const trade = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111104',
      title: 'Trade Stock Check Product',
      product_type: 'trade',
      delivery_mode: 'manual_service',
      stock: 3,
      requires_roblox_username: true,
      price: 25.0,
      is_active: true,
      is_draft: false,
    });

    expect(DataStore.getProductAvailableStock(gift.id)).toBe(5);
    expect(DataStore.getProductAvailableStock(trade.id)).toBe(3);

    // Buying gift decrements its stock
    const orderGiftRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: gift.id,
        robloxUsername: 'RobloxVIP',
      });
    expect(orderGiftRes.status).toBe(201);
    expect(DataStore.getProductAvailableStock(gift.id)).toBe(4);
    expect(DataStore.getProductAvailableStock(trade.id)).toBe(3); // trade unaffected

    // Buying trade decrements its stock
    const orderTradeRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({
        productId: trade.id,
        robloxUsername: 'RobloxVIP',
      });
    expect(orderTradeRes.status).toBe(201);
    expect(DataStore.getProductAvailableStock(trade.id)).toBe(2);
  });

  // =========================================================================
  // Requirement 7 & 8: Product publish/draft and Customer availability
  // =========================================================================
  it('7 & 8. Publish/Draft & Customer Availability: drafts hidden from customers', async () => {
    // 1. Create a draft product
    const draft = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Secret Unreleased Draft Product',
      product_type: 'account',
      delivery_mode: 'auto_account',
      price: 99.0,
      is_draft: true,
      is_active: false,
    });

    // 2. Create a published in-stock product
    const published = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Public Available Product',
      product_type: 'gift',
      delivery_mode: 'manual_service',
      stock: 10,
      requires_roblox_username: true,
      price: 10.0,
      is_draft: false,
      is_active: true,
    });

    // Check Home in-stock products
    const homeRes = await request(app).get('/api/products/in-stock');
    expect(homeRes.status).toBe(200);
    const homeProductIds = homeRes.body.data.map((p: any) => p.id);
    expect(homeProductIds).not.toContain(draft.id);
    expect(homeProductIds).toContain(published.id);

    // Check Shop catalog
    const shopRes = await request(app).get('/api/products');
    expect(shopRes.status).toBe(200);
    const shopProductIds = shopRes.body.data.map((p: any) => p.id);
    expect(shopProductIds).not.toContain(draft.id);
    expect(shopProductIds).toContain(published.id);
  });

  // =========================================================================
  // Requirement 9: Account: stock > 0 vs stock = 0 ("SOLD OUT")
  // =========================================================================
  it('9. Account Stock: drops to 0 when last account bought, marked SOLD OUT', async () => {
    const accProd = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Single Stock Vault Account',
      product_type: 'account',
      delivery_mode: 'auto_account',
      price: 22.0,
      is_active: true,
      is_draft: false,
    });

    // Deposit exactly 1 item
    DataStore.addInventoryItem({
      product_id: accProd.id,
      account_username: 'SoloAccount',
      raw_password: 'Pass123!',
      status: 'available',
    });

    expect(DataStore.getProductAvailableStock(accProd.id)).toBe(1);

    // Customer purchases the single account
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: accProd.id });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    // Available stock immediately drops to 0
    expect(DataStore.getProductAvailableStock(accProd.id)).toBe(0);

    // Simulate payment completion
    const simRes = await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(simRes.status).toBe(200);

    // Product remains visible in Shop with stock = 0 (SOLD OUT)
    const shopProd = DataStore.getProductById(accProd.id);
    expect(shopProd).toBeDefined();
    expect(DataStore.getProductAvailableStock(accProd.id)).toBe(0);

    // Customer viewing delivery gets credentials
    const delRes = await request(app)
      .get(`/api/orders/${order.id}/delivery`)
      .set('Authorization', `Bearer ${customerToken}`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.username).toBe('SoloAccount');
    expect(delRes.body.data.password).toBe('Pass123!');
  });

  // =========================================================================
  // Requirement 10: Trade stock = 0 = "SOLD OUT" and Buy disabled
  // =========================================================================
  it('10. Trade Stock = 0: marked SOLD OUT and API refuses new orders', async () => {
    const tradeProd = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111104',
      title: 'Rare Vintage Trade Item',
      product_type: 'trade',
      delivery_mode: 'manual_service',
      stock: 1,
      requires_roblox_username: true,
      price: 50.0,
      is_active: true,
      is_draft: false,
    });

    // Buy the 1 item
    const buy1 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: tradeProd.id, robloxUsername: 'RobloxVIP' });
    expect(buy1.status).toBe(201);

    // Stock is now 0
    expect(DataStore.getProductAvailableStock(tradeProd.id)).toBe(0);

    // Second buy attempt MUST be rejected with 400 PRODUCT_OUT_OF_STOCK
    const buy2 = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: tradeProd.id, robloxUsername: 'RobloxVIP' });
    expect(buy2.status).toBe(400);
    expect(buy2.body.success).toBe(false);
  });

  // =========================================================================
  // Requirement 11: Inventory consumption after successful fulfillment
  // =========================================================================
  it('11. Inventory consumption: inventory status transitions available -> reserved -> consumed', async () => {
    const accProd = DataStore.saveProduct({
      category_id: '11111111-1111-1111-1111-111111111103',
      title: 'Lifecycle Verification Account',
      product_type: 'account',
      delivery_mode: 'auto_account',
      price: 15.0,
      is_active: true,
      is_draft: false,
    });

    const inv = DataStore.addInventoryItem({
      product_id: accProd.id,
      account_username: 'LifecycleUser',
      raw_password: 'LifecyclePass123!',
      status: 'available',
    });
    expect(inv.status).toBe('available');

    // 1. Order created: item becomes reserved
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${customerToken}`)
      .send({ productId: accProd.id });
    expect(orderRes.status).toBe(201);
    const { order, payment } = orderRes.body.data;

    const inventoryAfterOrder = DataStore.getInventoryList();
    const reservedItem = inventoryAfterOrder.find((i) => i.id === inv.id);
    expect(reservedItem?.status).toBe('reserved');
    expect(reservedItem?.order_id).toBe(order.id);

    // 2. Payment succeeds: item becomes consumed
    await request(app)
      .post(`/api/payments/${payment.id}/simulate-paid`)
      .set('Authorization', `Bearer ${customerToken}`);

    const inventoryAfterPayment = DataStore.getInventoryList();
    const consumedItem = inventoryAfterPayment.find((i) => i.id === inv.id);
    expect(['consumed', 'sold']).toContain(consumedItem?.status);

    // 3. Stock remains 0
    expect(DataStore.getProductAvailableStock(accProd.id)).toBe(0);
  });
});
