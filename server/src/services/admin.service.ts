import { DataStore } from '../database/data-store';
import { Product, Category, InventoryItem, Coupon, Order, GachaClaim, SupportTicket, RedeemCode } from '../types';
import { OrderService } from './order.service';
import { NotificationService } from './notification.service';
import { RedeemCodeService, CreateRedeemCodeInput, RedeemCodeFilter } from './redeem.service';
import { AppError } from '../middleware/error-handler';

export class AdminService {
  static getDashboardStats() {
    const orders = DataStore.getAllOrdersAdmin();
    const products = DataStore.getAllProductsAdmin();
    const inventory = DataStore.getInventoryList();
    const users = DataStore.getAllUsersAdmin();
    const claims = DataStore.getPendingClaimsAdmin();

    const isPaidStatus = (status: string) =>
      status === 'paid' || status === 'delivered' || status === 'completed' || status === 'fulfillment';

    const totalRevenue = orders
      .filter((o) => isPaidStatus(o.status))
      .reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);

    const paidOrdersCount = orders.filter((o) => isPaidStatus(o.status)).length;

    const pendingFulfillment = orders.filter(
      (o) =>
        (o.delivery_mode === 'manual_service' || (o.delivery_mode as string) === 'trade_item') &&
        (o.status === 'paid' || o.status === 'fulfillment')
    ).length;

    const activeProducts = products.filter((p) => p.is_active && !p.is_draft).length;

    const availableInventory = inventory.filter((i) => i.status === 'available').length;
    const consumedInventory = inventory.filter((i) => i.status === 'consumed').length;

    const inventoryStatus = {
      available: availableInventory,
      consumed: consumedInventory,
      total: inventory.length,
      accounts_available: inventory.filter((i) => i.item_type === 'account' && i.status === 'available').length,
      codes_available: inventory.filter((i) => i.item_type === 'code' && i.status === 'available').length,
    };

    const lowStockProducts = products.filter((p) => p.stock > 0 && p.stock <= 2);
    const outOfStockProducts = products.filter((p) => p.stock === 0);

    const revenueNumber = Number(totalRevenue.toFixed(2));

    return {
      revenue: revenueNumber,
      totalRevenue: revenueNumber,
      total_orders: orders.length,
      totalOrders: orders.length,
      paid_orders: paidOrdersCount,
      pending_fulfillment: pendingFulfillment,
      pendingFulfillment: pendingFulfillment,
      active_products: activeProducts,
      activeProducts: activeProducts,
      available_inventory: availableInventory,
      consumed_inventory: consumedInventory,
      inventory_status: inventoryStatus,
      inventoryStatus: inventoryStatus,
      low_stock_count: lowStockProducts.length,
      out_of_stock_count: outOfStockProducts.length,
      total_customers: users.length,
      pending_claims_count: claims.length,
      recent_orders: orders.slice(0, 10),
      low_stock_items: lowStockProducts,
    };
  }

  // Categories
  static listCategories(): Category[] {
    return DataStore.getCategories();
  }

  // Products
  static listProducts(): Product[] {
    return DataStore.getAllProductsAdmin();
  }

  static saveProduct(adminTelegramId: number, productData: any): Product {
    const saved = DataStore.saveProduct(productData);
    DataStore.logAdminAction(adminTelegramId, 'SAVE_PRODUCT', {
      productId: saved.id,
      title: saved.title,
      price: saved.price,
      stock: saved.stock,
    });
    return saved;
  }

  static updateProduct(adminTelegramId: number, productId: string, updates: any): Product {
    const existing = DataStore.getProductById(productId);
    if (!existing) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    const updated = DataStore.updateProduct(productId, updates);
    if (!updated) {
      throw new AppError('Product not found', 404, 'PRODUCT_NOT_FOUND');
    }
    DataStore.logAdminAction(adminTelegramId, 'UPDATE_PRODUCT', {
      productId: updated.id,
      updates,
    });
    return updated;
  }

  static deleteProduct(adminTelegramId: number, productId: string): boolean {
    const success = DataStore.deleteProduct(productId);
    DataStore.logAdminAction(adminTelegramId, 'DELETE_PRODUCT', { productId });
    return success;
  }

  // Inventory
  static listInventory(): InventoryItem[] {
    return DataStore.getInventoryList();
  }

  static addInventoryItem(adminTelegramId: number, item: any): InventoryItem {
    const created = DataStore.addInventoryItem(item);
    DataStore.logAdminAction(adminTelegramId, 'ADD_INVENTORY_ITEM', {
      itemId: created.id,
      productId: created.product_id,
      type: created.item_type,
    });
    return created;
  }

  static updateInventoryItem(adminTelegramId: number, id: string, updates: any): InventoryItem {
    const updated = DataStore.updateInventoryItem(id, updates);
    if (!updated) {
      throw new Error('Inventory item not found');
    }
    DataStore.logAdminAction(adminTelegramId, 'UPDATE_INVENTORY_ITEM', {
      itemId: id,
      updates,
    });
    return updated;
  }

  static deleteInventoryItem(adminTelegramId: number, id: string): boolean {
    const success = DataStore.deleteInventoryItem(id);
    if (success) {
      DataStore.logAdminAction(adminTelegramId, 'DELETE_INVENTORY_ITEM', {
        itemId: id,
      });
    }
    return success;
  }

  static bulkAddInventory(adminTelegramId: number, productId: string, itemsList: any[]) {
    const result = DataStore.bulkAddInventoryItems(productId, itemsList);
    DataStore.logAdminAction(adminTelegramId, 'BULK_ADD_INVENTORY', {
      productId,
      addedCount: result.added,
    });
    return result;
  }

  // Orders
  static listOrders(): Order[] {
    return DataStore.getAllOrdersAdmin();
  }

  static manualFulfillOrder(
    adminTelegramId: number,
    orderId: string,
    notes: string,
    credentials?: any[]
  ): Order {
    const fulfilled = OrderService.fulfillOrderManually(orderId, notes, credentials);
    DataStore.logAdminAction(adminTelegramId, 'MANUAL_FULFILL_ORDER', {
      orderId,
      orderNumber: fulfilled.order_number,
      notes,
    });
    return fulfilled;
  }

  static replaceWarrantyOrder(
    adminTelegramId: number,
    orderId: string,
    replacementNotes: string,
    credentials?: any[]
  ): Order {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    const isAccount = order.delivery_mode === 'auto_account' || (order as any).product_type === 'account';
    if (!isAccount) {
      throw new Error('Warranty replacement applies to purchased Roblox Accounts only');
    }

    const updated = DataStore.replaceWarrantyOrder(orderId, replacementNotes, credentials);
    if (!updated) {
      throw new Error('Failed to process warranty replacement');
    }
    DataStore.logAdminAction(adminTelegramId, 'WARRANTY_REPLACEMENT', {
      orderId,
      orderNumber: updated.order_number,
      notes: replacementNotes,
    });

    const productTitle = updated.items?.[0]?.product_title || 'Gaming Product';
    NotificationService.sendStoreBotMessage(
      updated.telegram_id,
      `🛡️ <b>WARRANTY REPLACEMENT ISSUED</b>\n\n` +
        `Order: <b>#${updated.order_number}</b>\n` +
        `Product: <b>${productTitle}</b>\n\n` +
        `Your 14-day replacement has been processed! Fresh credentials have been deposited into your Authenticator Vault.\n` +
        `<i>${replacementNotes}</i>`
    ).catch(console.error);

    return updated;
  }

  static invalidateWarranty(
    adminTelegramId: number,
    orderId: string,
    reason: string
  ): Order {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    const isAccount = order.delivery_mode === 'auto_account' || (order as any).product_type === 'account';
    if (!isAccount) {
      throw new Error('Warranty operations apply to purchased Roblox Accounts only');
    }

    const updated = DataStore.invalidateWarranty(orderId, reason);
    if (!updated) {
      throw new Error('Failed to invalidate warranty');
    }
    DataStore.logAdminAction(adminTelegramId, 'WARRANTY_INVALIDATED', {
      orderId,
      orderNumber: updated.order_number,
      reason,
    });

    NotificationService.sendStoreBotMessage(
      updated.telegram_id,
      `⚠️ <b>WARRANTY STATUS UPDATE</b>\n\n` +
        `Order: <b>#${updated.order_number}</b>\n\n` +
        `Warranty coverage for this order has been invalidated.\n` +
        `Reason: <i>${reason}</i>`
    ).catch(console.error);

    return updated;
  }

  static async reDeliverOrder(adminTelegramId: number, orderId: string): Promise<Order> {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    DataStore.logAdminAction(adminTelegramId, 'REDELIVER_ORDER', {
      orderId,
      orderNumber: order.order_number,
    });

    const productTitle = order.items?.[0]?.product_title || 'Gaming Product';
    await NotificationService.notifyOrderDelivered(
      order.telegram_id,
      order.order_number,
      productTitle,
      order.fulfillment_notes || undefined
    );

    return order;
  }

  // Gacha Claims
  static listPendingClaims(): GachaClaim[] {
    return DataStore.getPendingClaimsAdmin();
  }

  static resolveGachaClaim(
    adminTelegramId: number,
    claimId: string,
    status: 'fulfilled' | 'rejected',
    notes?: string,
    deliveryData?: any
  ): GachaClaim | null {
    const claim = DataStore.resolveGachaClaim(claimId, status, notes, deliveryData);
    if (claim) {
      DataStore.logAdminAction(adminTelegramId, 'RESOLVE_GACHA_CLAIM', {
        claimId,
        status,
        notes,
      });

      // Send customer notification via Store Bot
      const customer = DataStore.getTelegramUser(claim.customer_id as any);
      if (customer) {
        NotificationService.sendStoreBotMessage(
          customer.telegram_id,
          `🎁 <b>GACHA CLAIM ${status.toUpperCase()}</b>\n\n` +
            `Prize: <b>${claim.prize?.title || 'Reward'}</b>\n` +
            (notes ? `Note: ${notes}\n` : '') +
            (status === 'fulfilled' ? 'Your reward has been granted!' : '')
        ).catch(console.error);
      }
    }
    return claim;
  }

  // Coupons
  static listCoupons(): Coupon[] {
    return DataStore.getCoupons();
  }

  static createCoupon(adminTelegramId: number, couponData: Partial<Coupon>): Coupon {
    const coupon = DataStore.createCoupon(couponData);
    DataStore.logAdminAction(adminTelegramId, 'CREATE_COUPON', {
      code: coupon.code,
      discount: coupon.discount_value,
    });
    return coupon;
  }

  static updateCoupon(adminTelegramId: number, couponId: string, updates: Partial<Coupon>): Coupon | null {
    const updated = DataStore.updateCoupon(couponId, updates);
    DataStore.logAdminAction(adminTelegramId, 'UPDATE_COUPON', { couponId, updates });
    return updated;
  }

  static deleteCoupon(adminTelegramId: number, couponId: string): boolean {
    const deleted = DataStore.deleteCoupon(couponId);
    DataStore.logAdminAction(adminTelegramId, 'DELETE_COUPON', { couponId, deleted });
    return deleted;
  }

  // Redeem Codes
  static listRedeemCodes(filters?: RedeemCodeFilter): RedeemCode[] {
    return RedeemCodeService.listCodes(filters);
  }

  static getRedeemCode(codeId: string): RedeemCode {
    return RedeemCodeService.getCodeById(codeId);
  }

  static createRedeemCode(adminTelegramId: number, input: CreateRedeemCodeInput): RedeemCode {
    return RedeemCodeService.createCode(adminTelegramId, input);
  }

  static updateRedeemCode(
    adminTelegramId: number,
    codeId: string,
    updates: Partial<Pick<RedeemCode, 'is_active' | 'expires_at' | 'max_uses' | 'per_user_limit'>>
  ): RedeemCode {
    return RedeemCodeService.updateCode(adminTelegramId, codeId, updates);
  }

  static toggleRedeemCodeActive(adminTelegramId: number, codeId: string): RedeemCode {
    return RedeemCodeService.toggleActive(adminTelegramId, codeId);
  }

  static deactivateRedeemCode(adminTelegramId: number, codeId: string): RedeemCode {
    return RedeemCodeService.deactivateCode(adminTelegramId, codeId);
  }

  static deleteRedeemCode(adminTelegramId: number, codeId: string): boolean {
    return RedeemCodeService.deleteCode(adminTelegramId, codeId);
  }

  static getRedeemCodeUsages(codeId: string) {
    return RedeemCodeService.getCodeUsages(codeId);
  }

  static generateUnpredictableCode(prefix?: string): string {
    return RedeemCodeService.generateUnpredictableCode(prefix);
  }

  // Users
  static listUsers() {
    return DataStore.getAllUsersAdmin();
  }

  static getUserDetail(telegramId: number) {
    const user = DataStore.getTelegramUser(telegramId);
    const profile = DataStore.getProfile(telegramId);
    const orders = DataStore.getOrdersByCustomer(telegramId);
    const ledger = DataStore.getPointLedger(telegramId);
    const coupons = DataStore.getCustomerCoupons(telegramId);
    return { user, profile, orders, ledger, coupons };
  }

  // Support
  static listSupportTickets(): SupportTicket[] {
    return DataStore.getSupportTickets();
  }

  static replySupportTicket(
    adminTelegramId: number,
    ticketId: string,
    reply: string,
    status: 'resolved' | 'closed' = 'resolved'
  ): SupportTicket | null {
    const updated = DataStore.replySupportTicket(ticketId, reply, status);
    if (updated) {
      DataStore.logAdminAction(adminTelegramId, 'REPLY_SUPPORT_TICKET', {
        ticketId,
        ticketNumber: updated.ticket_number,
        status,
      });

      NotificationService.sendStoreBotMessage(
        updated.telegram_id,
        `💬 <b>SUPPORT TICKET UPDATE</b>\n\n` +
          `Ticket: #${updated.ticket_number}\n` +
          `Subject: ${updated.subject}\n\n` +
          `<b>Support Reply:</b>\n${reply}\n\n` +
          `Status: <i>${status.toUpperCase()}</i>`
      ).catch(console.error);
    }
    return updated;
  }

  // Audit Logs
  static getAuditLogs() {
    return DataStore.getAuditLogs();
  }

  // Broadcast to all active users via Store Bot
  static async broadcastMessage(
    adminTelegramId: number,
    message: string
  ): Promise<{ sent: number; total: number }> {
    const users = DataStore.getAllUsersAdmin();
    let sent = 0;

    for (const { user } of users) {
      const ok = await NotificationService.sendStoreBotMessage(user.telegram_id, message);
      if (ok) sent++;
    }

    DataStore.logAdminAction(adminTelegramId, 'BROADCAST_MESSAGE', {
      sent,
      total: users.length,
      preview: message.substring(0, 100),
    });

    return { sent, total: users.length };
  }

  // Gacha Pools & Prizes Administration
  static listGachaPools() {
    return DataStore.getAllGachaPoolsAdmin();
  }

  static saveGachaPool(adminTelegramId: number, poolData: any) {
    const saved = DataStore.saveGachaPool(poolData);
    DataStore.logAdminAction(adminTelegramId, 'SAVE_GACHA_POOL', { poolId: saved.id, title: saved.title });
    return saved;
  }

  static saveGachaPrize(adminTelegramId: number, prizeData: any) {
    const result = DataStore.saveGachaPrize(prizeData);
    if (!result.success) {
      throw new Error(result.error || 'INVALID_GACHA_PRIZE');
    }
    DataStore.logAdminAction(adminTelegramId, 'SAVE_GACHA_PRIZE', { prizeId: result.prize?.id, title: result.prize?.title });
    return result.prize;
  }

  static deleteGachaPrize(adminTelegramId: number, prizeId: string) {
    const success = DataStore.deleteGachaPrize(prizeId);
    DataStore.logAdminAction(adminTelegramId, 'DELETE_GACHA_PRIZE', { prizeId, success });
    return success;
  }

  static promoteDraftPrize(adminTelegramId: number, prizeId: string) {
    const result = DataStore.promoteDraftPrize(prizeId);
    if (!result.success) {
      throw new Error(result.error || 'FAILED_TO_PROMOTE');
    }
    DataStore.logAdminAction(adminTelegramId, 'PROMOTE_DRAFT_GACHA_PRIZE', { prizeId, prize: result.prize?.title });
    return result.prize;
  }

  static validatePoolProbabilities(poolId: string) {
    return DataStore.validatePoolProbabilities(poolId);
  }

  static updatePoolProbabilities(adminTelegramId: number, poolId: string, updates: { prizeId: string; probability: number }[]) {
    const result = DataStore.updatePoolProbabilities(poolId, updates);
    if (!result.success) {
      throw new Error(result.error || 'INVALID_POOL_PROBABILITIES');
    }
    DataStore.logAdminAction(adminTelegramId, 'UPDATE_GACHA_POOL_PROBABILITIES', { poolId, updates });
    return result;
  }

  // 3-Order Rule Drafts Administration
  static getOrderDrafts() {
    return DataStore.getOrderNotificationDrafts();
  }

  static async broadcastOrderDraft(adminTelegramId: number, draftId: string) {
    const drafts = DataStore.getOrderNotificationDrafts();
    const draft = drafts.find((d) => d.id === draftId);
    if (!draft) throw new Error('DRAFT_NOT_FOUND');

    const result = await this.broadcastMessage(adminTelegramId, `🔥 <b>UCHIRO STORE ANNOUNCEMENT</b>\n\n${draft.message}`);
    DataStore.broadcastOrderDraft(draftId);
    return { ...result, draftId };
  }

  static dismissOrderDraft(adminTelegramId: number, draftId: string) {
    const dismissed = DataStore.dismissOrderDraft(draftId);
    DataStore.logAdminAction(adminTelegramId, 'DISMISS_ORDER_DRAFT', { draftId });
    return dismissed;
  }

  // Settings Administration
  static getStoreSettings() {
    return DataStore.getStoreSettings();
  }

  static updateStoreSettings(adminTelegramId: number, updates: any) {
    const updated = DataStore.updateStoreSettings(updates);
    DataStore.logAdminAction(adminTelegramId, 'UPDATE_STORE_SETTINGS', updates);
    return updated;
  }

  // Seasonal Themes (Prompt 6)
  static getSeasonalTheme() {
    return DataStore.getSeasonalTheme();
  }

  static updateSeasonalTheme(adminTelegramId: string | number, theme: string) {
    return DataStore.setSeasonalTheme(adminTelegramId, theme);
  }

  static logAdminAction(adminTelegramId: number, action: string, details: any = {}) {
    return DataStore.logAdminAction(adminTelegramId, action, details);
  }

  // Backup & Restore
  static exportBackupBundle() {
    return DataStore.exportBackupBundle();
  }

  static resetDemoData() {
    return DataStore.resetDemoData();
  }

  static restoreBackupBundle(adminTelegramId: number, bundle: any) {
    return DataStore.restoreBackupBundle(bundle, adminTelegramId);
  }
}
