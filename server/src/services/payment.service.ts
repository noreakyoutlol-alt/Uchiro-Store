import crypto from 'crypto';
import { DataStore } from '../database/data-store';
import { Payment } from '../types';
import { AppError } from '../middleware/error-handler';
import { OrderService } from './order.service';
import { KHPayService } from './khpay.service';
import { NotificationService } from './notification.service';
import { env } from '../config/env';

export class PaymentService {
  private static processedWebhooks = new Set<string>();

  static async getPaymentStatus(paymentId: string): Promise<{
    status: Payment['status'];
    isPaid: boolean;
    expiresAt: string;
    isExpired: boolean;
    orderId: string;
  }> {
    const payment = DataStore.getPaymentById(paymentId);
    if (!payment) {
      throw new AppError('Payment record not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status === 'paid') {
      return {
        status: 'paid',
        isPaid: true,
        expiresAt: payment.expires_at,
        isExpired: false,
        orderId: payment.order_id,
      };
    }

    const now = Date.now();
    const expiry = new Date(payment.expires_at).getTime();
    const isExpired = now > expiry && payment.status === 'pending';

    if (isExpired && payment.status === 'pending') {
      payment.status = 'expired';
      DataStore.savePayment(payment);
      DataStore.releaseReservation(payment.order_id);
      return {
        status: 'expired',
        isPaid: false,
        expiresAt: payment.expires_at,
        isExpired: true,
        orderId: payment.order_id,
      };
    }

    // Check with KHPay if still pending
    if (payment.status === 'pending') {
      const checkTarget = payment.id || payment.md5_hash;
      if (checkTarget) {
        try {
          const check = await KHPayService.verifyPaymentStatus(checkTarget);
          if (check.isPaid) {
            await OrderService.processPaymentSuccess(
              payment.order_id,
              check.transactionRef || `KHPAY-LIVE-${payment.id.slice(0, 8)}`
            );
            return {
              status: 'paid',
              isPaid: true,
              expiresAt: payment.expires_at,
              isExpired: false,
              orderId: payment.order_id,
            };
          }
        } catch {
          // Non-fatal
        }
      }
    }

    return {
      status: payment.status,
      isPaid: false,
      expiresAt: payment.expires_at,
      isExpired: false,
      orderId: payment.order_id,
    };
  }

  // Verification endpoint
  static async verifyAndConfirmPayment(paymentId: string): Promise<{ success: boolean; isPaid: boolean }> {
    const payment = DataStore.getPaymentById(paymentId);
    if (!payment) {
      throw new AppError('Payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    if (payment.status === 'paid') {
      return { success: true, isPaid: true };
    }

    const now = Date.now();
    const expiry = new Date(payment.expires_at).getTime();
    if (now > expiry) {
      payment.status = 'expired';
      DataStore.savePayment(payment);
      DataStore.releaseReservation(payment.order_id);
      return { success: false, isPaid: false };
    }

    const isProduction = env.NODE_ENV === 'production';
    const isTestMode = !isProduction && env.KHPAY_TEST_MODE;

    // In production, payment verification MUST come from real KHPay API (Section 1)
    if (isProduction || !isTestMode) {
      const checkTarget = payment.id || payment.md5_hash;
      if (!checkTarget) {
        return { success: false, isPaid: false };
      }
      const check = await KHPayService.verifyPaymentStatus(checkTarget);
      if (check.isPaid) {
        await OrderService.processPaymentSuccess(
          payment.order_id,
          check.transactionRef || `KHPAY-LIVE-${payment.id.slice(0, 8)}`
        );
        return { success: true, isPaid: true };
      }
      return { success: false, isPaid: false };
    }

    // Local dev test mode simulation ONLY
    await OrderService.processPaymentSuccess(payment.order_id, `DEV-SIM-TX-${payment.md5_hash?.slice(0, 8)}`);
    return { success: true, isPaid: true };
  }

  // Webhook Receiver
  static async handleWebhook(
    payload: any,
    signatureHeader?: string
  ): Promise<{ success: boolean; duplicate?: boolean }> {
    const paymentTarget =
      payload.md5_hash ||
      payload.id ||
      payload.order_id ||
      payload.transaction_id ||
      payload.trx_id ||
      payload.data?.md5_hash ||
      payload.data?.id ||
      payload.data?.order_id ||
      payload.data?.transaction_id ||
      payload.data?.trx_id;

    if (!paymentTarget) {
      throw new AppError('Invalid webhook payload: missing payment identifier', 400, 'BAD_PAYLOAD');
    }

    const rawStatus = String(
      payload.status ||
      payload.action ||
      payload.data?.status ||
      payload.data?.action ||
      (payload.paid ? 'PAID' : '')
    ).toUpperCase();

    // Duplicate webhook protection
    const eventKey = `${paymentTarget}-${rawStatus}`;
    if (this.processedWebhooks.has(eventKey)) {
      return { success: true, duplicate: true };
    }

    const isProduction = env.NODE_ENV === 'production';
    const isTestMode = !isProduction && Boolean(env.KHPAY_TEST_MODE);
    const webhookSecret = (env.KHPAY_WEBHOOK_SECRET || '').trim();

    // Signature verification: fail closed in production, require signature when configured/required
    const requireSignature = isProduction || (!isTestMode && webhookSecret.length > 0) || Boolean(signatureHeader);

    if (requireSignature) {
      if (!webhookSecret) {
        throw new AppError('Payment webhook secret is not configured on server', 500, 'WEBHOOK_SECRET_NOT_CONFIGURED');
      }
      if (!signatureHeader || typeof signatureHeader !== 'string') {
        throw new AppError('Missing required webhook signature header', 401, 'MISSING_SIGNATURE');
      }
      const calculatedSig = crypto
        .createHmac('sha256', webhookSecret)
        .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
        .digest('hex');

      const calcBuf = Buffer.from(calculatedSig, 'utf8');
      const sigBuf = Buffer.from(signatureHeader.trim(), 'utf8');
      const isMatch = calcBuf.length === sigBuf.length && crypto.timingSafeEqual(calcBuf, sigBuf);

      if (!isMatch) {
        throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
      }
    }

    let payment = DataStore.getPaymentById(paymentTarget);
    if (!payment && (payload.order_id || payload.orderId || payload.data?.order_id || payload.data?.orderId)) {
      const orderRef = payload.order_id || payload.orderId || payload.data?.order_id || payload.data?.orderId;
      payment = DataStore.getPaymentByOrderId(orderRef);
    }
    if (!payment) {
      throw new AppError('Associated payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

    // Step 4 Integrity: Verify payment amount, currency, and order reference consistency
    const payloadAmount = payload.amount !== undefined ? payload.amount : payload.data?.amount;
    if (payloadAmount !== undefined && payloadAmount !== null) {
      const numAmount = Number(payloadAmount);
      if (isNaN(numAmount) || Math.abs(numAmount - payment.amount) > 0.01) {
        throw new AppError('Payment amount mismatch with order', 400, 'PAYMENT_AMOUNT_MISMATCH');
      }
    }

    const payloadCurrency = payload.currency || payload.data?.currency;
    if (payloadCurrency && String(payloadCurrency).toUpperCase() !== payment.currency.toUpperCase()) {
      throw new AppError('Payment currency mismatch with order', 400, 'PAYMENT_CURRENCY_MISMATCH');
    }

    const payloadOrderId = payload.order_id || payload.orderId || payload.data?.order_id || payload.data?.orderId;
    if (payloadOrderId) {
      const order = DataStore.getOrderById(payment.order_id);
      if (payloadOrderId !== payment.order_id && payloadOrderId !== order?.order_number && payloadOrderId !== order?.id) {
        throw new AppError('Payment order reference mismatch', 400, 'ORDER_ID_MISMATCH');
      }
    }

    const order = DataStore.getOrderById(payment.order_id);
    if (order && (order.status === 'paid' || order.status === 'delivered' || order.status === 'completed')) {
      return { success: true, duplicate: true };
    }

    if (this.processedWebhooks.size >= 2000) {
      const oldest = this.processedWebhooks.values().next().value;
      if (oldest) {
        this.processedWebhooks.delete(oldest);
      }
    }
    this.processedWebhooks.add(eventKey);

    const transactionRef =
      payload.transaction_ref ||
      payload.transaction_reference ||
      payload.transaction_id ||
      payload.data?.transaction_ref ||
      payload.data?.transaction_id ||
      `KHPAY-WH-${payment.id.slice(0, 8)}`;

    const isPaid =
      rawStatus === 'SUCCESS' ||
      rawStatus === 'PAID' ||
      rawStatus === 'APPROVED' ||
      rawStatus === 'COMPLETED' ||
      payload.paid === true ||
      payload.data?.paid === true;

    if (isPaid) {
      const now = Date.now();
      const expiry = payment.expires_at ? new Date(payment.expires_at).getTime() : 0;
      const order = DataStore.getOrderById(payment.order_id);
      const isExpiredOrTimedOut =
        payment.status === 'expired' ||
        (expiry > 0 && now > expiry) ||
        order?.status === 'expired' ||
        order?.status === 'cancelled' ||
        (order?.status as string) === 'pending_admin_review';

      if (isExpiredOrTimedOut) {
        await PaymentService.handleExpiredQrConfirmedPayment(payment, transactionRef);
      } else {
        await OrderService.processPaymentSuccess(payment.order_id, transactionRef);
      }
    } else if (rawStatus === 'EXPIRED' || rawStatus === 'CANCELLED' || rawStatus === 'FAILED') {
      payment.status = 'expired';
      payment.updated_at = new Date().toISOString();
      DataStore.savePayment(payment);
      DataStore.releaseReservation(payment.order_id);
    }

    return { success: true };
  }

  /**
   * ⚠️ Specification 6: EXPIRED QR WITH CONFIRMED PAYMENT FLOW
   * When KHQR payment arrives or is confirmed for an order that timed out / expired:
   * - DO NOT mark as failed or drop it.
   * - Set order status to pending_admin_review.
   * - Notify customer in English:
   *   "⚠️ Payment was received, but the QR code had expired. Our admin team is reviewing and will fulfill your delivery shortly."
   * - Alert Admin Bot (@uchiro_v2_admin_bot):
   *   "⚠️ Payment on Expired QR - Order #UCH-{ID} (${AMOUNT}). Please review and tap below to fulfill delivery."
   *   Include inline button: admin_fulfill_expired:{ORDER_ID} ("🚀 Confirm & Fulfill Delivery Now").
   */
  public static async handleExpiredQrConfirmedPayment(
    payment: Payment,
    transactionRef: string
  ): Promise<void> {
    payment.status = 'paid';
    payment.paid_at = new Date().toISOString();
    payment.transaction_reference = transactionRef;
    payment.updated_at = new Date().toISOString();
    DataStore.savePayment(payment);

    const order = DataStore.getOrderById(payment.order_id);
    if (order) {
      DataStore.updateOrderStatus(order.id, 'pending_admin_review' as any);
      order.status = 'pending_admin_review' as any;
      order.updated_at = new Date().toISOString();
      DataStore.saveOrder(order);

      // Notify customer in Khmer
      NotificationService.notifyCustomerExpiredQRPaymentReceived(
        order.telegram_id,
        order.order_number || order.id
      ).catch(console.error);

      // Alert Admin Bot with instant fulfill action button
      NotificationService.alertAdminExpiredQRPayment(
        order.id,
        order.order_number || order.id,
        order.total_amount
      ).catch(console.error);
    }
  }
}