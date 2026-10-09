import { describe, it, expect, beforeAll } from 'vitest';
import { DataStore } from '../database/data-store';
import { AdminService } from '../services/admin.service';
import { OrderService } from '../services/order.service';
import { NotificationService } from '../services/notification.service';
import { TOTPService } from '../security/totp';

describe('Uchiro Store - Delivery Modes End-to-End Audit', () => {
  const customerTelegramId = 88776655;
  const adminTelegramId = 123456789;

  beforeAll(() => {
    DataStore.findOrCreateTelegramUser({
      telegram_id: customerTelegramId,
      first_name: 'AuditCustomer',
      username: 'audit_customer',
    });
  });

  describe('1. ACCOUNT MODE (Instant Delivery & RFC6238 Authenticator)', () => {
    it('creates an account product with secret 2FA key, deposits stock, and fulfills with live RFC6238 TOTP', async () => {
      // 1. Create account product
      const category = DataStore.getCategories()[0];
      const product = AdminService.saveProduct(adminTelegramId, {
        category_id: category.id,
        title: 'Blox Fruits Level 2550 + Godhuman Account',
        description: 'Instant delivery Blox Fruits max level account',
        price: 35.0,
        compare_at_price: 50.0,
        stock: 0,
        delivery_mode: 'auto_account',
        product_type: 'account',
        authenticator_enabled: true,
        warranty_days: 14,
      });

      expect(product.delivery_mode).toBe('auto_account');
      expect(product.authenticator_enabled).toBe(true);

      // 2. Deposit inventory item with credentials & RFC3548 Base32 Secret
      const secret2fa = 'JBSWY3DPEHPK3PXP'; // Base32 test secret
      DataStore.depositInventoryItem({
        product_id: product.id,
        item_type: 'account',
        account_username: 'BloxMaster99',
        encrypted_account_password: 'SecurePassWord!123',
        encrypted_account_2fa: secret2fa,
        status: 'available',
      });

      // Product stock should increment internally, but UI presents "Available • Instant Delivery"
      const updatedProduct = DataStore.getProductById(product.id);
      expect(updatedProduct?.stock).toBe(1);

      // 3. Create and pay order
      const { order } = await OrderService.createOrder(
        customerTelegramId,
        product.id,
        undefined,
        undefined,
        `idemp-acc-${Date.now()}`
      );
      expect(order.delivery_mode).toBe('auto_account');

      await OrderService.processPaymentSuccess(order.id, 'Bakong KHQR', 'TX-ACC-101');

      // 4. Retrieve delivery credentials
      const delivery = await OrderService.getOrderDelivery(order.id, customerTelegramId);
      expect(delivery.delivery_mode).toBe('auto_account');
      expect(delivery.username).toBe('BloxMaster99');
      expect(delivery.password).toBe('SecurePassWord!123');
      expect(delivery.warranty_days).toBe(14);
      expect(delivery.warranty_status).toBe('active');

      // 5. Authenticator details must provide live RFC6238 TOTP
      expect(delivery.authenticator).toBeDefined();
      expect(delivery.authenticator?.available).toBe(true);
      expect(delivery.authenticator?.manual_setup_key).toBe(secret2fa);
      expect(delivery.authenticator?.code).toMatch(/^\d{6}$/);
      expect(delivery.authenticator?.period).toBe(30);
      expect(delivery.authenticator?.otpauth_url).toContain('otpauth://totp/');

      // Live verification using TOTPService
      const liveTotp = TOTPService.generateCode(secret2fa);
      expect(liveTotp.code).toMatch(/^\d{6}$/);
      expect(liveTotp.period).toBe(30);
      expect(liveTotp.secondsRemaining).toBeGreaterThanOrEqual(0);
      expect(liveTotp.secondsRemaining).toBeLessThanOrEqual(30);
    });
  });

  describe('2. GIFT ITEM (Roblox Manual Fulfillment)', () => {
    it('enforces Roblox recipient capture, triggers 9-point admin alert, and provides gift delivery lifecycle', async () => {
      // 1. Create gift product
      const category = DataStore.getCategories().find((c) => c.slug === 'bloxfruits') || DataStore.getCategories()[0];
      const product = AdminService.saveProduct(adminTelegramId, {
        category_id: category.id,
        title: 'Blox Fruits Perm Dragon Fruit (Roblox Gift)',
        description: 'Delivered as a Roblox gift in-game',
        price: 45.0,
        stock: 50,
        delivery_mode: 'manual_service',
        product_type: 'gift',
        requires_roblox_username: true,
        requires_roblox_verification: true,
        warranty_days: 14,
      });

      expect(product.delivery_mode).toBe('manual_service');
      expect(product.requires_roblox_username).toBe(true);

      // 2. Track admin alerts to verify 9-point payload
      let capturedPayload: any = null;
      const originalAlert = NotificationService.alertAdminManualFulfillmentRequired;
      NotificationService.alertAdminManualFulfillmentRequired = async (
        orderNumber: string,
        productTitle: string,
        robloxUsername?: string | null,
        extraInfo?: any
      ) => {
        capturedPayload = {
          orderNumber,
          productTitle,
          robloxUsername,
          ...extraInfo,
        };
      };

      try {
        // 3. Create order with Roblox recipient metadata
        const { order } = await OrderService.createOrder(
          customerTelegramId,
          product.id,
          undefined,
          'DragonMasterRoblox',
          `idemp-gift-${Date.now()}`,
          'DragonMaster_Display',
          '987654321'
        );

        expect(order.delivery_mode).toBe('manual_service');
        expect(order.roblox_username).toBe('DragonMasterRoblox');
        expect(order.roblox_display_name).toBe('DragonMaster_Display');
        expect(order.roblox_user_id).toBe('987654321');

        // 4. Pay order -> must trigger admin notification
        await OrderService.processPaymentSuccess(order.id, 'Bakong KHQR', 'TX-GIFT-202');

        expect(capturedPayload).not.toBeNull();
        expect(capturedPayload.orderId).toBe(order.id);
        expect(capturedPayload.productTitle).toBe(product.title);
        expect(capturedPayload.amount).toBe(45.0);
        expect(capturedPayload.telegramId).toBe(customerTelegramId);
        expect(capturedPayload.robloxUsername).toBe('DragonMasterRoblox');
        expect(capturedPayload.robloxDisplayName).toBe('DragonMaster_Display');
        expect(capturedPayload.robloxUserId).toBe('987654321');
        expect(capturedPayload.status).toBe('awaiting_fulfillment');
        expect(capturedPayload.timestamp).toBeDefined();

        // 5. Customer delivery view before fulfillment
        const deliveryPending = await OrderService.getOrderDelivery(order.id, customerTelegramId);
        expect(deliveryPending.delivery_mode).toBe('manual_service');
        expect(deliveryPending.warranty_days).toBe(14);

        // 6. Admin fulfills order in admin panel
        await OrderService.fulfillManualOrder(order.id, {
          fulfillment_notes: 'Gift delivered to DragonMasterRoblox on private server #12',
          admin_telegram_id: adminTelegramId,
        });

        const completedOrder = DataStore.getOrderById(order.id);
        expect(completedOrder?.status).toBe('delivered');
        expect(completedOrder?.fulfillment_notes).toContain('Gift delivered');
      } finally {
        NotificationService.alertAdminManualFulfillmentRequired = originalAlert;
      }
    });
  });

  describe('3. IN-GAME TRADE (Coordinated Fulfillment)', () => {
    it('handles In-Game Trade mode with Order ID, trade coordination, and receipt generation', async () => {
      // 1. Create trade product
      const category = DataStore.getCategories().find((c) => c.slug === 'murder-mystery-2') || DataStore.getCategories()[0];
      const product = AdminService.saveProduct(adminTelegramId, {
        category_id: category.id,
        title: 'MM2 Harvester + Corrupt Set (In-Game Trade)',
        description: 'Traded in-game directly to your avatar',
        price: 28.0,
        stock: 10,
        delivery_mode: 'trade_item',
        product_type: 'trade',
        requires_roblox_username: true,
        warranty_days: 14,
      });

      expect(product.delivery_mode).toBe('trade_item');

      // 2. Create order
      const { order } = await OrderService.createOrder(
        customerTelegramId,
        product.id,
        undefined,
        'MM2Trader99',
        `idemp-trade-${Date.now()}`,
        'MM2_Trader',
        '1122334455'
      );

      expect(order.delivery_mode).toBe('trade_item');

      // 3. Pay order
      await OrderService.processPaymentSuccess(order.id, 'Bakong KHQR', 'TX-TRADE-303');

      // 4. Delivery response
      const delivery = await OrderService.getOrderDelivery(order.id, customerTelegramId);
      expect(delivery.delivery_mode).toBe('trade_item');
      expect(delivery.order_number).toBe(order.order_number);
      expect(delivery.warranty_days).toBe(14);

      // 5. Receipt verification
      const receipt = await OrderService.getOrderReceipt(order.id, customerTelegramId);
      expect(receipt.product_type).toBe('In-Game Trade');
      expect(receipt.order_number).toBe(order.order_number);
      expect(receipt.amount).toBe(28.0);
    });
  });

  describe('4. DIGITAL CODE (Instant Voucher Key)', () => {
    it('consumes single-use digital code, immediately exposes key, and supports 14-day warranty', async () => {
      // 1. Create digital code product
      const category = DataStore.getCategories()[0];
      const product = AdminService.saveProduct(adminTelegramId, {
        category_id: category.id,
        title: 'Roblox 1,000 Robux Digital Gift Card Code',
        description: 'Official Roblox digital card key redeemable at roblox.com/redeem',
        price: 10.0,
        stock: 0,
        delivery_mode: 'digital_code',
        product_type: 'digital_code',
        warranty_days: 14,
      });

      expect(product.delivery_mode).toBe('digital_code');

      // 2. Deposit digital code inventory item
      const testCode = 'ROBLOX-RBX1K-ABC987-XYZ';
      DataStore.depositInventoryItem({
        product_id: product.id,
        item_type: 'code',
        digital_code: testCode,
        status: 'available',
      });

      const updatedProduct = DataStore.getProductById(product.id);
      expect(updatedProduct?.stock).toBe(1);

      // 3. Create and pay order
      const { order } = await OrderService.createOrder(
        customerTelegramId,
        product.id,
        undefined,
        undefined,
        `idemp-code-${Date.now()}`
      );
      expect(order.delivery_mode).toBe('digital_code');

      await OrderService.processPaymentSuccess(order.id, 'Bakong KHQR', 'TX-CODE-404');

      // 4. Verify inventory item was consumed
      const inventory = DataStore.getInventoryByProductId(product.id);
      const consumedItem = inventory.find((i) => i.digital_code === testCode);
      expect(consumedItem?.status).toBe('consumed');
      expect(consumedItem?.order_id).toBe(order.id);

      // 5. Retrieve delivery credentials
      const delivery = await OrderService.getOrderDelivery(order.id, customerTelegramId);
      expect(delivery.delivery_mode).toBe('digital_code');
      expect(delivery.digital_code).toBe(testCode);
      expect(delivery.warranty_days).toBe(14);
      expect(delivery.warranty_status).toBe('active');

      // 6. Receipt specifies Instant Digital Key
      const receipt = await OrderService.getOrderReceipt(order.id, customerTelegramId);
      expect(receipt.product_type).toBe('Instant Digital Key');
    });
  });
});
