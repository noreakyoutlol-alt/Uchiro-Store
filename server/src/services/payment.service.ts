import crypto from 'crypto';
import { DataStore } from '../database/data-store';
import { Payment } from '../types';
import { AppError } from '../middleware/error-handler';
import { OrderService } from './order.service';
import { KHPayService } from './khpay.service';
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
      payload.transaction_id ||
      payload.trx_id ||
      payload.id ||
      payload.order_id ||
      payload.data?.md5_hash ||
      payload.data?.transaction_id ||
      payload.data?.trx_id ||
      payload.data?.id;

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
    const isTestMode = !isProduction && env.KHPAY_TEST_MODE;

    // Signature verification (if webhook secret provided)
    if (env.KHPAY_WEBHOOK_SECRET && (signatureHeader || isProduction)) {
      if (!signatureHeader) {
        throw new AppError('Missing required webhook signature header', 401, 'MISSING_SIGNATURE');
      }
      const calculatedSig = crypto
        .createHmac('sha256', env.KHPAY_WEBHOOK_SECRET)
        .update(typeof payload === 'string' ? payload : JSON.stringify(payload))
        .digest('hex');

      if (calculatedSig !== signatureHeader && !isTestMode) {
        throw new AppError('Invalid webhook signature', 401, 'INVALID_SIGNATURE');
      }
    }

    this.processedWebhooks.add(eventKey);

    const payment = DataStore.getPaymentById(paymentTarget);
    if (!payment) {
      throw new AppError('Associated payment not found', 404, 'PAYMENT_NOT_FOUND');
    }

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
      await OrderService.processPaymentSuccess(payment.order_id, transactionRef);
    } else if (rawStatus === 'EXPIRED' || rawStatus === 'CANCELLED' || rawStatus === 'FAILED') {
      payment.status = 'expired';
      payment.updated_at = new Date().toISOString();
      DataStore.savePayment(payment);
      DataStore.releaseReservation(payment.order_id);
    }

    return { success: true };
  }
}
