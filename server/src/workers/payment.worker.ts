import { DataStore } from '../database/data-store';
import { KHPayService } from '../services/khpay.service';
import { OrderService } from '../services/order.service';

export class PaymentWorker {
  private static timer: NodeJS.Timeout | null = null;
  private static isRunning = false;
  private static currentIntervalMs = 3000;
  private static inFlightPayments = new Set<string>();

  static start(intervalMs: number = 3000): void {
    if (this.timer) return;
    this.currentIntervalMs = intervalMs;

    this.timer = setInterval(() => {
      this.tick().catch((err) => {
        console.error('Payment worker tick error:', err);
      });
    }, intervalMs);

    console.log(`⏱️ [PAYMENT WORKER] Background payment monitor started (Interval: ${intervalMs}ms)`);
  }

  static stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('⏹️ [PAYMENT WORKER] Background payment monitor stopped');
    }
  }

  static getStatus(): {
    isRunning: boolean;
    intervalMs: number;
    pendingCount: number;
    inFlightCount: number;
  } {
    return {
      isRunning: this.timer !== null,
      intervalMs: this.currentIntervalMs,
      pendingCount: DataStore.getPendingPayments().length,
      inFlightCount: this.inFlightPayments.size,
    };
  }

  static async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const pendingPayments = DataStore.getPendingPayments();
      const now = Date.now();

      for (const payment of pendingPayments) {
        // Skip payments currently being verified to avoid race conditions
        if (this.inFlightPayments.has(payment.id)) continue;

        const expiryTime = new Date(payment.expires_at).getTime();

        // Check if expired
        if (now > expiryTime) {
          payment.status = 'expired';
          payment.updated_at = new Date().toISOString();
          DataStore.savePayment(payment);
          DataStore.releaseReservation(payment.order_id);
          continue;
        }

        // Authoritative server-side check with KHPay
        this.inFlightPayments.add(payment.id);

        try {
          const checkTarget = payment.id || payment.md5_hash;
          if (checkTarget) {
            const result = await KHPayService.verifyPaymentStatus(checkTarget);
            if (result.isPaid) {
              const currentOrder = DataStore.getOrderById(payment.order_id);
              if (currentOrder?.admin_notified && (currentOrder.status === 'paid' || currentOrder.status === 'delivered' || currentOrder.status === 'completed')) {
                payment.status = 'paid';
                payment.updated_at = new Date().toISOString();
                DataStore.savePayment(payment);
                continue;
              }
              console.log(`💰 [PAYMENT WORKER] Payment confirmed for Order ${payment.order_id} (Ref: ${result.transactionRef})`);
              await OrderService.processPaymentSuccess(
                payment.order_id,
                result.transactionRef || `KHPAY-AUTO-${payment.id.slice(0, 8)}`
              );
            }
          }
        } catch (checkErr: any) {
          // Non-fatal, retry next tick
        } finally {
          this.inFlightPayments.delete(payment.id);
        }
      }
    } finally {
      this.isRunning = false;
    }
  }
}
