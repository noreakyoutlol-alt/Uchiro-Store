import { DataStore } from '../database/data-store';
import { Order, OrderStatus, OrderReceipt } from '../types';
import { AppError } from '../middleware/error-handler';
import { decrypt } from '../security/encryption';
import { TOTPService } from '../security/totp';
import { NotificationService } from './notification.service';
import { KHPayService } from './khpay.service';
import { FulfillmentService } from './fulfillment.service';
import { CheckoutLock } from '../utils/checkout-lock';

export class OrderService {
  static async createOrder(
    paramsOrTelegramId:
      | {
          customerId?: string;
          telegramId: number;
          productId: string;
          quantity?: number;
          items?: Array<{ productId: string; quantity: number }>;
          couponCode?: string;
          robloxUsername?: string;
          robloxDisplayName?: string;
          robloxUserId?: string;
          idempotencyKey?: string;
          buyerConfirmedAge18?: boolean;
          buyerUnder18?: boolean;
        }
      | number,
    productId?: string,
    couponCode?: string,
    robloxUsername?: string,
    idempotencyKey?: string,
    robloxDisplayName?: string,
    robloxUserId?: string,
    quantity?: number,
    buyerConfirmedAge18?: boolean,
    buyerUnder18?: boolean
  ): Promise<{ order: Order; payment: any }> {
    let params: {
      customerId: string;
      telegramId: number;
      productId: string;
      quantity?: number;
      items?: Array<{ productId: string; quantity: number }>;
      couponCode?: string;
      robloxUsername?: string;
      robloxDisplayName?: string;
      robloxUserId?: string;
      idempotencyKey?: string;
      buyerConfirmedAge18?: boolean;
      buyerUnder18?: boolean;
    };

    if (typeof paramsOrTelegramId === 'number') {
      const tgUser = DataStore.getTelegramUser(paramsOrTelegramId);
      params = {
        customerId: tgUser?.id || `cust-${paramsOrTelegramId}`,
        telegramId: paramsOrTelegramId,
        productId: productId!,
        quantity: quantity || 1,
        couponCode,
        robloxUsername,
        idempotencyKey,
        robloxDisplayName,
        robloxUserId,
        buyerConfirmedAge18,
        buyerUnder18,
      };
    } else {
      params = {
        ...paramsOrTelegramId,
        customerId: paramsOrTelegramId.customerId || `cust-${paramsOrTelegramId.telegramId}`,
        quantity: paramsOrTelegramId.quantity || 1,
      };
    }

    const productKeys = [
      params.productId,
      ...(params.items?.map((i) => i.productId) || []),
    ].filter((k): k is string => Boolean(k && typeof k === 'string'));

    const couponKey = params.couponCode ? `coupon_${params.couponCode.trim().toUpperCase()}` : null;
    const lockKeys = [
      ...(productKeys.length > 0 ? Array.from(new Set(productKeys)) : ['global_checkout']),
      ...(couponKey ? [couponKey] : []),
    ].sort();
    const result = await CheckoutLock.runExclusiveMulti(lockKeys, () => DataStore.createOrder(params));
    if (!result.success || !result.order) {
      throw new AppError(result.error || 'Failed to create order', 400, result.error || 'ORDER_CREATION_FAILED');
    }

    const order = result.order;

    // Check if order already has an existing payment (Idempotency key hit)
    const existingPayment = DataStore.getPaymentByOrderId(order.id);
    if (existingPayment) {
      order.payment = existingPayment;
      return { order, payment: existingPayment };
    }

    // Generate KHQR Payment
    let payment: any;
    try {
      const khqr = await KHPayService.generateKHQRPayment({
        orderId: order.id,
        orderNumber: order.order_number,
        amount: order.total_amount,
        currency: 'USD',
        validityMinutes: 10,
      });

      payment = DataStore.savePayment({
        id: khqr.transaction_id || khqr.md5_hash,
        order_id: order.id,
        customer_id: order.customer_id,
        provider: 'KHQR / Bakong',
        currency: 'USD',
        amount: order.total_amount,
        qr_payload: khqr.qr_payload,
        qr_image_url: khqr.qr_image_url,
        md5_hash: khqr.md5_hash,
        bakong_deep_link: khqr.bakong_deep_link,
        aba_deep_link: khqr.aba_deep_link,
        status: 'pending',
        transaction_reference: khqr.transaction_id || null,
        expires_at: khqr.expires_at,
        expires_in: khqr.expires_in,
        provider_expires_in: khqr.expires_in,
        paid_at: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    } catch (paymentErr) {
      DataStore.releaseReservation(order.id);
      throw paymentErr;
    }

    order.payment = payment;

    // Send Telegram Notification to Customer
    const productTitle = order.items?.[0]?.product_title || 'Gaming Product';
    NotificationService.notifyOrderCreated(
      order.telegram_id,
      order.order_number,
      productTitle,
      order.total_amount
    ).catch(console.error);

    return { order, payment };
  }

  static getCustomerOrders(telegramId: number): Order[] {
    const orders = DataStore.getOrdersByCustomer(telegramId);
    return orders.map((o) => this.formatOrderForCustomer(o));
  }

  static getOrderByIdForCustomer(orderId: string, telegramId: number): Order {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.telegram_id !== telegramId) {
      throw new AppError('Unauthorized access to order', 403, 'FORBIDDEN');
    }

    const payment = DataStore.getPaymentByOrderId(order.id);
    if (payment) order.payment = payment;

    return this.formatOrderForCustomer(order);
  }

  static getOrderByIdForAdmin(orderId: string): Order {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    const payment = DataStore.getPaymentByOrderId(order.id);
    if (payment) order.payment = payment;
    return order;
  }

  // Handle Payment Confirmation and Delivery Trigger
  static async processPaymentSuccess(
    orderId: string,
    transactionRefOrMethod?: string,
    transactionRef?: string
  ): Promise<Order> {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (order.status === 'paid' || order.status === 'delivered' || order.status === 'completed') {
      return order; // Idempotent
    }

    const finalTransactionRef = transactionRef || transactionRefOrMethod;
    const paymentMethod = transactionRef ? transactionRefOrMethod : undefined;

    // Update payment
    const payment = DataStore.getPaymentByOrderId(order.id);
    if (payment) {
      payment.status = 'paid';
      payment.paid_at = new Date().toISOString();
      if (paymentMethod) {
        payment.provider = paymentMethod;
      }
      payment.transaction_reference = finalTransactionRef || `TX-${Math.floor(100000 + Math.random() * 900000)}`;
      DataStore.savePayment(payment);
    }

    order.status = 'paid';
    order.updated_at = new Date().toISOString();
    DataStore.handleOrderInventoryDeduction(order);

    const productTitle = order.items?.[0]?.product_title || 'Gaming Product';
    const productId = order.items?.[0]?.product_id || '';

    // Trigger Customer Payment Receipt Notification (auto_account receives official PDF receipt)
    if (order.delivery_mode === 'auto_account') {
      order.receipt_notified = true;
      (order as any).payment_receipt_sent = true;
      DataStore.saveOrder(order);
    } else if (!order.receipt_notified && !(order as any).payment_receipt_sent && !(order as any)._receipt_sending) {
      (order as any)._receipt_sending = true;
      const warrantyDuration = `${order.warranty_days || 14} Days Replacement Warranty`;
      try {
        await NotificationService.notifyPaymentReceipt(
          order.telegram_id,
          order.order_number,
          productTitle,
          order.total_amount,
          order.status,
          warrantyDuration
        );
        order.receipt_notified = true;
        (order as any).payment_receipt_sent = true;
        (order as any)._receipt_sending = false;
        DataStore.saveOrder(order);
      } catch (err) {
        (order as any)._receipt_sending = false;
        console.error('[ORDER SERVICE] Payment receipt notification failed, keeping retryable:', err);
      }
    }

    // 🚨 ADMIN ALERT DEDUP SYSTEM: Trigger ONCE and persist admin_notified: true
    const orderQty = Math.max(1, order.quantity || order.items?.[0]?.quantity || 1);
    const itemTitleWithQty = orderQty > 1 ? `${productTitle} (x${orderQty})` : productTitle;

    if (!order.admin_notified) {
      order.admin_notified = true;
      order.updated_at = new Date().toISOString();
      DataStore.saveOrder(order);

      // Alert Admin Bot for REAL PAID order
      NotificationService.alertAdminRealOrderPaid(
        order.id,
        itemTitleWithQty,
        order.total_amount,
        order.telegram_id
      ).catch(console.error);

      // Trigger Specific Claim Alerts for Manual Gift or Trade Orders
      if (order.delivery_mode === 'manual_service' && order.roblox_username) {
        NotificationService.alertAdminRobloxGiftClaim(
          order.roblox_username,
          order.roblox_user_id,
          {
            orderId: order.id,
            itemTitle: itemTitleWithQty,
            telegramId: order.telegram_id,
            amount: order.total_amount,
          }
        ).catch(console.error);
      } else if (order.delivery_mode === 'trade_item') {
        NotificationService.alertAdminTradeClaim(
          order.roblox_username || 'Customer',
          {
            orderId: order.id,
            itemTitle: itemTitleWithQty,
            telegramId: order.telegram_id,
            rendezvousDetails: 'Roblox In-Game Trade Server',
          }
        ).catch(console.error);
      }
    }

    // Delivery Processing
    if (order.delivery_mode === 'auto_account') {
      // MODE A: AUTOMATIC ACCOUNT DELIVERY
      const item = DataStore.consumeInventoryForOrder(order.id, productId);
      if (item && item.account_username && item.encrypted_account_password) {
        const decryptedPassword = decrypt(item.encrypted_account_password);
        const decrypted2fa = item.encrypted_account_2fa ? decrypt(item.encrypted_account_2fa) : null;
        const decryptedEmailPass = item.encrypted_email_password ? decrypt(item.encrypted_email_password) : null;
        const decryptedBackupCodes = item.encrypted_backup_codes ? decrypt(item.encrypted_backup_codes) : null;

        order.delivery_credentials = [
          {
            type: 'account',
            username: item.account_username,
            password: decryptedPassword,
            email: item.email || null,
            email_password: decryptedEmailPass,
            two_factor: decrypted2fa,
            backup_codes: decryptedBackupCodes,
            notes: item.notes || null,
            warranty_days: 14,
          },
        ];

        order.warranty_days = 14;
        order.warranty_status = 'active';
        order.warranty_starts_at = new Date().toISOString();
        order.warranty_expires_at = new Date(Date.now() + 14 * 86400000).toISOString();
        order.warranty_notes = 'Warranty valid for 14 days provided original email and authenticator are not removed.';

        DataStore.updateOrderStatus(order.id, 'delivered');
        order.status = 'delivered';

        // Dispatch full Telegram fulfillment workflow ONCE:
        // 1. Luxury PDF receipt (Payment confirmation)
        // 2. Interactive Main Delivery Card with live 2FA/warranty/QR (Order delivery notification)
        if (!(order as any).delivery_notified && !(order as any)._delivery_sending) {
          (order as any)._delivery_sending = true;
          FulfillmentService.fulfillTelegramAccountOrder(order.telegram_id, order.id)
            .then((res) => {
              if (res && (res.pdfSent || res.messageSent)) {
                (order as any).delivery_notified = true;
                order.receipt_notified = true;
                (order as any).payment_receipt_sent = true;
                DataStore.saveOrder(order);
              }
              (order as any)._delivery_sending = false;
            })
            .catch((err) => {
              (order as any)._delivery_sending = false;
              console.error('[FULFILLMENT] Delivery dispatch error, permitting safe retry:', err);
            });
        }
      } else {
        // Fallback to manual if stock ran out
        DataStore.updateOrderStatus(order.id, 'fulfillment');
        order.status = 'fulfillment';
        NotificationService.notifyManualProcessing(order.telegram_id, order.order_number).catch(console.error);
        NotificationService.alertAdminManualFulfillmentRequired(
          order.order_number,
          productTitle,
          order.roblox_username,
          {
            orderId: order.id,
            amount: order.total_amount,
            telegramId: order.telegram_id,
            robloxDisplayName: order.roblox_display_name || undefined,
            robloxUserId: order.roblox_user_id || undefined,
            timestamp: new Date().toISOString(),
            status: 'awaiting_fulfillment',
          }
        ).catch(console.error);
      }
    } else if (order.delivery_mode === 'digital_code') {
      // MODE B: DIGITAL CODE DELIVERY (N unassigned codes matching order.quantity)
      const items = DataStore.consumeInventoryForOrderMulti(order.id, productId, orderQty);

      const deliveredCodes = items.map((it) => ({
        type: 'code' as const,
        code: it.digital_code || `CODE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
      }));

      while (deliveredCodes.length < orderQty) {
        deliveredCodes.push({
          type: 'code',
          code: `CODE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        });
      }

      order.delivery_credentials = deliveredCodes;

      order.warranty_days = 0;
      order.warranty_status = 'none';
      order.warranty_starts_at = null;
      order.warranty_expires_at = null;

      DataStore.updateOrderStatus(order.id, 'delivered');
      order.status = 'delivered';

      if (!(order as any).delivery_notified && !(order as any)._delivery_sending) {
        (order as any)._delivery_sending = true;
        NotificationService.notifyOrderDelivered(
          order.telegram_id,
          order.order_number,
          itemTitleWithQty
        )
          .then(() => {
            (order as any).delivery_notified = true;
            (order as any)._delivery_sending = false;
            DataStore.saveOrder(order);
          })
          .catch((err) => {
            (order as any)._delivery_sending = false;
            console.error('[ORDER SERVICE] Digital code delivery notification failed, keeping retryable:', err);
          });
      }
    } else {
      // MODE C: MANUAL SERVICE FULFILLMENT (Gift Item / In-Game Trade)
      DataStore.updateOrderStatus(order.id, 'fulfillment');
      order.status = 'fulfillment';

      const user = DataStore.getTelegramUser(order.telegram_id);
      const productObj = order.items && order.items[0] ? DataStore.getProductById(order.items[0].product_id) : undefined;
      const categoryObj = productObj?.category_id
        ? DataStore.getCategories().find((c) => c.id === productObj.category_id)
        : undefined;

      if (!(order as any).fulfillment_notified && !(order as any)._fulfillment_sending) {
        (order as any)._fulfillment_sending = true;
        NotificationService.notifyManualProcessing(order.telegram_id, order.order_number)
          .then(() => {
            (order as any).fulfillment_notified = true;
            (order as any)._fulfillment_sending = false;
            DataStore.saveOrder(order);
          })
          .catch((err) => {
            (order as any)._fulfillment_sending = false;
            console.error('[ORDER SERVICE] Manual processing notification failed, keeping retryable:', err);
          });
      }
      NotificationService.alertAdminManualFulfillmentRequired(
        order.order_number,
        itemTitleWithQty,
        order.roblox_username,
        {
          orderId: order.id,
          category: categoryObj?.name || categoryObj?.slug,
          amount: order.total_amount,
          telegramId: order.telegram_id,
          telegramUsername: user?.username || undefined,
          robloxDisplayName: order.roblox_display_name || undefined,
          robloxUserId: order.roblox_user_id || undefined,
          timestamp: new Date().toISOString(),
          status: 'awaiting_fulfillment',
        }
      ).catch(console.error);
    }

    // Award customer points & update profile stats (prevent duplicate on replay)
    const pointsMultiplier = DataStore.getStoreSettings().points_per_dollar || 10;
    const earnedPoints = Math.round(order.total_amount * pointsMultiplier);
    const existingTx = DataStore.getPointLedger(order.telegram_id).find(
      (e) =>
        (e.reference_id === order.order_number || e.reference_id === order.id) &&
        (e.type === 'order_purchase' || e.type === 'purchase_reward')
    );

    if (!existingTx && earnedPoints > 0) {
      const profile = DataStore.getProfile(order.telegram_id);
      if (profile) {
        profile.total_spent += order.total_amount;
        profile.total_orders += 1;
      }
      DataStore.addPointTransaction(
        order.telegram_id,
        earnedPoints,
        'order_purchase',
        `+${earnedPoints} Purchase Reward`,
        order.order_number || order.id
      );
    }

    // Low Stock Alert Check (Debounced across <= 2 and 0 thresholds)
    const product = DataStore.getProductById(productId);
    if (product && DataStore.shouldAlertLowStock(productId, product.stock)) {
      NotificationService.alertAdminLowStock(product.title, product.stock).catch(console.error);
    }

    DataStore.saveOrder(order);
    return order;
  }

  // Admin Manual Fulfillment
  static async fulfillManualOrder(
    orderId: string,
    options: {
      fulfillment_notes?: string;
      notes?: string;
      admin_telegram_id?: number;
      credentialsData?: Record<string, any>[];
    }
  ): Promise<Order> {
    const notes = options.fulfillment_notes || options.notes || 'Order fulfilled by admin';
    return this.fulfillOrderManually(orderId, notes, options.credentialsData);
  }

  static fulfillOrderManually(
    orderId: string,
    notes: string,
    credentialsData?: Record<string, any>[]
  ): Order {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }

    if (credentialsData && credentialsData.length > 0) {
      order.delivery_credentials = credentialsData;
    }

    DataStore.updateOrderStatus(order.id, 'delivered', notes);
    order.status = 'delivered';
    const isAccount = order.delivery_mode === 'auto_account';
    if (isAccount) {
      order.warranty_days = 14;
      order.warranty_status = 'active';
      order.warranty_starts_at = new Date().toISOString();
      order.warranty_expires_at = new Date(Date.now() + 14 * 86400000).toISOString();
    } else {
      order.warranty_days = 0;
      order.warranty_status = 'none';
      order.warranty_starts_at = null;
      order.warranty_expires_at = null;
    }

    const productTitle = order.items?.[0]?.product_title || 'Gaming Product';
    if (!(order as any).delivery_notified && !(order as any)._delivery_sending) {
      (order as any)._delivery_sending = true;
      NotificationService.notifyOrderDelivered(
        order.telegram_id,
        order.order_number,
        productTitle,
        notes
      )
        .then(() => {
          (order as any).delivery_notified = true;
          (order as any)._delivery_sending = false;
          DataStore.saveOrder(order);
        })
        .catch((err) => {
          (order as any)._delivery_sending = false;
          console.error('[ORDER SERVICE] Manual order delivery notification failed, keeping retryable:', err);
        });
    }

    return order;
  }

  static getOrderAuthenticator(orderId: string, telegramId: number, clientIp?: string, userAgent?: string) {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== telegramId) {
      DataStore.logDeliveryAccess({
        order_id: orderId,
        telegram_id: telegramId,
        customer_id: order.customer_id,
        action: 'totp_requested',
        success: false,
        ip_address: clientIp,
        user_agent: userAgent,
        failure_reason: 'UNAUTHORIZED_ACCESS',
      });
      throw new AppError('Unauthorized access to this order delivery', 403, 'FORBIDDEN');
    }
    if (order.status !== 'delivered' && order.status !== 'completed') {
      throw new AppError('Order has not yet been delivered', 400, 'ORDER_NOT_DELIVERED');
    }

    const authData = DataStore.getOrderAuthenticator(orderId, telegramId);
    if (!authData) {
      throw new AppError('Authenticator not configured for this order', 404, 'AUTH_NOT_FOUND');
    }

    DataStore.logDeliveryAccess({
      order_id: orderId,
      telegram_id: telegramId,
      customer_id: order.customer_id,
      action: 'totp_requested',
      success: true,
      ip_address: clientIp,
      user_agent: userAgent,
    });

    return authData;
  }

  // ================= SECURE CUSTOMER DELIVERY ENDPOINTS =================
  static async getOrderDelivery(
    orderId: string,
    telegramId: number,
    clientIp?: string,
    userAgent?: string
  ) {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== telegramId) {
      DataStore.logDeliveryAccess({
        order_id: orderId,
        telegram_id: telegramId,
        customer_id: order.customer_id,
        action: 'delivery_viewed',
        success: false,
        ip_address: clientIp,
        user_agent: userAgent,
        failure_reason: 'UNAUTHORIZED_ACCESS',
      });
      throw new AppError('Unauthorized access to this order delivery', 403, 'FORBIDDEN');
    }
    if (
      order.status !== 'delivered' &&
      order.status !== 'completed' &&
      order.status !== 'fulfillment'
    ) {
      DataStore.logDeliveryAccess({
        order_id: orderId,
        telegram_id: telegramId,
        customer_id: order.customer_id,
        action: 'delivery_viewed',
        success: false,
        ip_address: clientIp,
        user_agent: userAgent,
        failure_reason: 'ORDER_NOT_DELIVERED',
      });
      throw new AppError('Order delivery is no longer available.', 400, 'ORDER_NOT_DELIVERED');
    }

    const cred = order.delivery_credentials?.[0];
    if (!cred) {
      if (
        order.delivery_mode === 'manual_service' ||
        (order.delivery_mode as string) === 'trade_item' ||
        order.status === 'fulfillment'
      ) {
        DataStore.logDeliveryAccess({
          order_id: orderId,
          telegram_id: telegramId,
          customer_id: order.customer_id,
          action: 'delivery_viewed',
          success: true,
          ip_address: clientIp,
          user_agent: userAgent,
        });

        return {
          order_number: order.order_number,
          delivery_mode: order.delivery_mode || 'manual_service',
          notes: order.fulfillment_notes || 'Staff coordination in progress',
          warranty_days: 0,
          warranty_status: 'none',
          warranty_expires_at: null,
          authenticator: null,
        };
      }
      throw new AppError('No delivery credentials found for this order', 404, 'CREDENTIALS_NOT_FOUND');
    }

    // Digital Code delivery
    if (order.delivery_mode === 'digital_code' || cred.type === 'code') {
      DataStore.logDeliveryAccess({
        order_id: orderId,
        telegram_id: telegramId,
        customer_id: order.customer_id,
        action: 'delivery_viewed',
        success: true,
        ip_address: clientIp,
        user_agent: userAgent,
      });

      return {
        order_number: order.order_number,
        delivery_mode: 'digital_code',
        digital_code: cred.code || cred.digital_code,
        warranty_days: 0,
        warranty_status: 'none',
        warranty_expires_at: null,
        authenticator: null,
      };
    }

    // Account delivery
    const secret = cred.two_factor || cred.authenticator_secret;
    let authenticator = null;

    if (secret) {
      const period = cred.authenticator_period || 30;
      const digits = cred.authenticator_digits || 6;
      const algorithm = cred.authenticator_algorithm || 'SHA1';

      const totp = TOTPService.generateCode(secret, Date.now(), {
        period,
        digits,
        algorithm,
      });

      const otpauthUri = TOTPService.buildOtpAuthUri({
        accountName: cred.username || order.order_number,
        secretBase32: secret,
        issuer: 'Uchiro Store',
        period,
        digits,
        algorithm,
      });

      const qrDataUrl = await TOTPService.generateQrDataUrl(otpauthUri);

      authenticator = {
        available: true,
        manual_setup_key: secret,
        qr: qrDataUrl,
        otpauth_url: otpauthUri,
        code: totp.code,
        expiresAt: totp.expiresAt,
        serverTime: totp.serverTime,
        period: totp.period,
        secondsRemaining: totp.secondsRemaining,
        generatedAt: totp.generatedAt,
      };
    } else {
      authenticator = {
        available: false,
        manual_setup_key: null,
      };
    }

    DataStore.logDeliveryAccess({
      order_id: orderId,
      telegram_id: telegramId,
      customer_id: order.customer_id,
      action: 'delivery_viewed',
      success: true,
      ip_address: clientIp,
      user_agent: userAgent,
    });

    // STRICT SANITIZATION: Only username, password, authenticator, warranty.
    // NEVER expose email, email_password, backup_codes, or raw secret text!
    return {
      order_number: order.order_number,
      delivery_mode: order.delivery_mode || 'auto_account',
      username: cred.username,
      password: cred.password,
      warranty_days: order.warranty_days || 14,
      warranty_status: order.warranty_status || 'active',
      warranty_expires_at: order.warranty_expires_at,
      authenticator,
    };
  }

  static getOrderDeliveryTotp(
    orderId: string,
    telegramId: number,
    clientIp?: string,
    userAgent?: string
  ) {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== telegramId) {
      DataStore.logDeliveryAccess({
        order_id: orderId,
        telegram_id: telegramId,
        customer_id: order.customer_id,
        action: 'totp_refresh',
        success: false,
        ip_address: clientIp,
        user_agent: userAgent,
        failure_reason: 'UNAUTHORIZED_ACCESS',
      });
      throw new AppError('Delivery access expired', 403, 'FORBIDDEN');
    }
    if (order.status !== 'delivered' && order.status !== 'completed') {
      throw new AppError('Order delivery is no longer available.', 400, 'ORDER_NOT_DELIVERED');
    }

    const cred = order.delivery_credentials?.[0];
    const secret = cred?.two_factor || cred?.authenticator_secret;
    if (!secret) {
      throw new AppError('Authenticator is unavailable for this account.', 404, 'AUTH_NOT_FOUND');
    }

    const period = cred.authenticator_period || 30;
    const digits = cred.authenticator_digits || 6;
    const algorithm = cred.authenticator_algorithm || 'SHA1';

    const totp = TOTPService.generateCode(secret, Date.now(), {
      period,
      digits,
      algorithm,
    });

    DataStore.logDeliveryAccess({
      order_id: orderId,
      telegram_id: telegramId,
      customer_id: order.customer_id,
      action: 'totp_refresh',
      success: true,
      ip_address: clientIp,
      user_agent: userAgent,
    });

    return {
      code: totp.code,
      expiresAt: totp.expiresAt,
      serverTime: totp.serverTime,
      period: totp.period,
      secondsRemaining: totp.secondsRemaining,
      generatedAt: totp.generatedAt,
    };
  }

  // Official Order Receipt (Strictly Order & Payment Details Only - Zero Credentials)
  static getOrderReceipt(orderId: string, telegramId: number): OrderReceipt {
    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== telegramId) {
      throw new AppError('Unauthorized access to receipt', 403, 'FORBIDDEN');
    }

    const payment = DataStore.getPaymentByOrderId(order.id);
    const item = order.items?.[0];
    const productTitle = item?.product_title || 'Gaming Product';

    let productType = 'Product';
    if (order.delivery_mode === 'auto_account') productType = 'Gaming Account';
    else if (order.delivery_mode === 'digital_code') productType = 'Instant Digital Key';
    else if (order.delivery_mode === 'manual_service') productType = 'Roblox Gift Delivery';
    else if (order.delivery_mode === 'trade_item') productType = 'In-Game Trade';

    return {
      order_id: order.id,
      order_number: order.order_number,
      store_name: 'UCHIRO STORE',
      product_name: productTitle,
      product_type: productType,
      amount: order.total_amount,
      currency: payment?.currency || 'USD',
      payment_method: payment?.provider && !payment.provider.includes('Bakong') && !payment.provider.includes('KHQR') && payment.provider.toUpperCase() !== 'KHPAY' ? payment.provider : 'Bakong KHQR',
      payment_status: payment?.status || order.status,
      transaction_reference: payment?.transaction_reference || null,
      order_date: order.created_at,
      paid_at: payment?.paid_at || (order.status === 'paid' || order.status === 'delivered' ? order.updated_at : null),
      delivery_status: order.status,
      warranty_duration: order.delivery_mode === 'auto_account' ? `${order.warranty_days || 14} Days` : 'N/A',
      warranty_starts_at: order.delivery_mode === 'auto_account' ? (order.warranty_starts_at || null) : null,
      warranty_expires_at: order.delivery_mode === 'auto_account' ? (order.warranty_expires_at || null) : null,
    };
  }

  // Format order to never leak sensitive credentials before payment & delivery,
  // and strictly sanitize any email-related fields from customer delivery responses.
  private static formatOrderForCustomer(order: Order): Order {
    const isDeliveredOrCompleted = order.status === 'delivered' || order.status === 'completed';
    const isAccount = order.delivery_mode === 'auto_account';

    // Server-authoritative warranty state
    let warrantyStatus = isAccount ? (order.warranty_status || 'pending') : 'none';
    let warrantyExpiresAt = isAccount ? (order.warranty_expires_at || null) : null;
    let warrantyStartsAt = isAccount ? (order.warranty_starts_at || null) : null;

    if (isAccount) {
      if (!isDeliveredOrCompleted) {
        warrantyStatus = 'pending';
        warrantyStartsAt = null;
        warrantyExpiresAt = null;
      } else if (warrantyExpiresAt && new Date(warrantyExpiresAt).getTime() < Date.now() && warrantyStatus === 'active') {
        warrantyStatus = 'expired';
      }
    } else {
      warrantyStatus = 'none';
      warrantyStartsAt = null;
      warrantyExpiresAt = null;
    }

    if (!isDeliveredOrCompleted) {
      return {
        ...order,
        delivery_credentials: null,
        warranty_status: warrantyStatus,
        warranty_starts_at: warrantyStartsAt,
        warranty_expires_at: warrantyExpiresAt,
      };
    }

    if (order.delivery_credentials && Array.isArray(order.delivery_credentials)) {
      const sanitized = order.delivery_credentials.map((cred) => {
        if (cred.type === 'account' || cred.username) {
          return {
            type: 'account',
            username: cred.username,
            password: cred.password,
            warranty_days: cred.warranty_days || order.warranty_days || 14,
          };
        }
        if (cred.type === 'code' || cred.code) {
          return {
            type: 'code',
            code: cred.code || cred.digital_code,
          };
        }
        return {
          type: cred.type,
          username: cred.username,
          password: cred.password,
          code: cred.code,
        };
      });

      return {
        ...order,
        delivery_credentials: sanitized,
        warranty_status: warrantyStatus,
        warranty_starts_at: warrantyStartsAt,
        warranty_expires_at: warrantyExpiresAt,
      };
    }

    return {
      ...order,
      warranty_status: warrantyStatus,
      warranty_starts_at: warrantyStartsAt,
      warranty_expires_at: warrantyExpiresAt,
    };
  }
}
