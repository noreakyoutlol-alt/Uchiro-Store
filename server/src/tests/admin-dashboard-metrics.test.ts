import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import axios from 'axios';
import app from '../server';
import { DataStore } from '../database/data-store';
import { AdminService } from '../services/admin.service';
import { OrderService } from '../services/order.service';
import { NotificationService } from '../services/notification.service';
import { FulfillmentService } from '../services/fulfillment.service';

describe('Admin Dashboard Real Data & Metrics Integrity (Task 6)', () => {
  const adminTelegramId = 123456789;

  beforeEach(() => {
    vi.spyOn(NotificationService, 'sendAdminBotAlert').mockResolvedValue();
    vi.spyOn(NotificationService, 'sendStoreBotMessage').mockResolvedValue(true);
    vi.spyOn(NotificationService, 'alertAdminRealOrderPaid').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyOrderDelivered').mockResolvedValue();
    vi.spyOn(NotificationService, 'alertAdminManualFulfillmentRequired').mockResolvedValue();
    vi.spyOn(NotificationService, 'notifyManualProcessing').mockResolvedValue();
    vi.spyOn(FulfillmentService, 'fulfillTelegramAccountOrder').mockResolvedValue({ pdfSent: false, messageSent: false });

    // Clear orders array for clean test isolation
    const allOrders = DataStore.getAllOrdersAdmin();
    allOrders.length = 0;
  });

  it('aggregates honest zero state if there are no orders or sales', () => {
    const stats = AdminService.getDashboardStats();

    expect(stats.revenue).toBe(0.0);
    expect(stats.totalRevenue).toBe(0.0);
    expect(stats.total_orders).toBe(0);
    expect(stats.totalOrders).toBe(0);
    expect(stats.paid_orders).toBe(0);
    expect(stats.pending_fulfillment).toBe(0);
    expect(stats.pendingFulfillment).toBe(0);
    expect(stats.recent_orders).toEqual([]);
    expect(stats.active_products).toBeGreaterThanOrEqual(0);
    expect(stats.inventory_status.available).toBeGreaterThanOrEqual(0);
  });

  it('calculates metrics strictly from real database records (revenue, orders, pending fulfillment, inventory)', async () => {
    const categories = DataStore.getCategories();
    const cat = categories[0];

    // 1. Create a manual service product (gift)
    const giftProduct = AdminService.saveProduct(adminTelegramId, {
      category_id: cat.id,
      title: 'Admin Stats Test Perm Fruit',
      price: 25.0,
      stock: 10,
      delivery_mode: 'manual_service',
      product_type: 'gift',
      requires_roblox_username: true,
      warranty_days: 14,
    });

    // 2. Create an auto account product
    const accountProduct = AdminService.saveProduct(adminTelegramId, {
      category_id: cat.id,
      title: 'Admin Stats Test Account',
      price: 40.0,
      stock: 0,
      delivery_mode: 'auto_account',
      product_type: 'account',
      warranty_days: 14,
    });

    DataStore.depositInventoryItem({
      product_id: accountProduct.id,
      item_type: 'account',
      account_username: 'StatsUser99',
      encrypted_account_password: 'PassWord123!',
      status: 'available',
    });

    // Initial stats before any orders
    const initialStats = AdminService.getDashboardStats();
    expect(initialStats.total_orders).toBe(0);
    expect(initialStats.revenue).toBe(0.0);
    expect(initialStats.pending_fulfillment).toBe(0);

    // 3. Create Order 1: Gift product ($25.00)
    const { order: order1 } = await OrderService.createOrder(
      88990011,
      giftProduct.id,
      undefined,
      'RobloxTester1',
      `stat-ord-1-${Date.now()}`
    );

    // Before payment: order is pending_payment, revenue is still 0
    let currentStats = AdminService.getDashboardStats();
    expect(currentStats.total_orders).toBe(1);
    expect(currentStats.revenue).toBe(0.0);
    expect(currentStats.pending_fulfillment).toBe(0);

    // Pay Order 1 -> moves to fulfillment/paid for manual service
    await OrderService.processPaymentSuccess(order1.id, 'Bakong KHQR', 'TX-STAT-1');

    currentStats = AdminService.getDashboardStats();
    expect(currentStats.total_orders).toBe(1);
    expect(currentStats.revenue).toBe(25.0);
    expect(currentStats.paid_orders).toBe(1);
    expect(currentStats.pending_fulfillment).toBe(1); // manual_service paid awaiting delivery

    // 4. Create Order 2: Account product ($40.00)
    const { order: order2 } = await OrderService.createOrder(
      88990022,
      accountProduct.id,
      undefined,
      undefined,
      `stat-ord-2-${Date.now()}`
    );

    // Pay Order 2 -> auto_account is immediately delivered
    await OrderService.processPaymentSuccess(order2.id, 'Bakong KHQR', 'TX-STAT-2');

    currentStats = AdminService.getDashboardStats();
    expect(currentStats.total_orders).toBe(2);
    expect(currentStats.revenue).toBe(65.0); // 25 + 40
    expect(currentStats.paid_orders).toBe(2);
    expect(currentStats.pending_fulfillment).toBe(1); // Only Order 1 is pending manual fulfillment

    // 5. Admin manually fulfills Order 1
    AdminService.manualFulfillOrder(
      adminTelegramId,
      order1.id,
      'Delivered in-game by admin'
    );

    currentStats = AdminService.getDashboardStats();
    expect(currentStats.total_orders).toBe(2);
    expect(currentStats.revenue).toBe(65.0);
    expect(currentStats.paid_orders).toBe(2);
    expect(currentStats.pending_fulfillment).toBe(0); // Fulfilled!

    // Verify recent orders array
    expect(currentStats.recent_orders.length).toBe(2);
  });

  it('serves GET /api/admin/stats with authentic payload and authorization', async () => {
    // Authenticate as Admin
    const authRes = await request(app).post('/api/auth/admin').send({});
    expect(authRes.status).toBe(200);
    const token = authRes.body.data.token;

    const statsRes = await request(app)
      .get('/api/admin/stats')
      .set('Authorization', `Bearer ${token}`);

    expect(statsRes.status).toBe(200);
    expect(statsRes.body.success).toBe(true);

    const stats = statsRes.body.data;
    expect(typeof stats.revenue).toBe('number');
    expect(typeof stats.totalRevenue).toBe('number');
    expect(typeof stats.total_orders).toBe('number');
    expect(typeof stats.totalOrders).toBe('number');
    expect(typeof stats.paid_orders).toBe('number');
    expect(typeof stats.pending_fulfillment).toBe('number');
    expect(typeof stats.pendingFulfillment).toBe('number');
    expect(typeof stats.active_products).toBe('number');
    expect(typeof stats.available_inventory).toBe('number');
    expect(typeof stats.inventory_status).toBe('object');
    expect(typeof stats.inventory_status.available).toBe('number');
    expect(typeof stats.inventory_status.consumed).toBe('number');
    expect(Array.isArray(stats.recent_orders)).toBe(true);
  });
});
