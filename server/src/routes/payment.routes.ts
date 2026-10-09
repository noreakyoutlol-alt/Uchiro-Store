import { Router } from 'express';
import { PaymentService } from '../services/payment.service';
import { OrderService } from '../services/order.service';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { AppError } from '../middleware/error-handler';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';

export const paymentRouter = Router();

// Create QR Code & Order (or fetch QR for existing order)
paymentRouter.post('/create-qr', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const { productId, quantity, couponCode, robloxUsername, robloxDisplayName, robloxUserId, orderId } = req.body;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    if (orderId) {
      const order = OrderService.getOrderByIdForCustomer(orderId, req.user!.telegram_id);
      const payment = DataStore.getPaymentByOrderId(order.id);
      return res.status(200).json({
        success: true,
        data: { order, payment, khqr: payment },
      });
    }

    if (!productId) {
      throw new AppError('productId is required to generate payment QR', 400);
    }

    const result = await OrderService.createOrder({
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      productId,
      quantity: quantity ? Number(quantity) : 1,
      couponCode,
      robloxUsername,
      robloxDisplayName,
      robloxUserId,
      idempotencyKey,
    });

    res.status(201).json({
      success: true,
      data: {
        order: result.order,
        payment: result.payment,
        khqr: result.payment,
      },
    });
  } catch (err) {
    next(err);
  }
});

// Payment Status Check / Polling
paymentRouter.get('/:id/status', async (req, res, next) => {
  try {
    const status = await PaymentService.getPaymentStatus(req.params.id);
    res.json({
      success: true,
      data: status,
    });
  } catch (err) {
    next(err);
  }
});

// KHPay Webhook Receiver
paymentRouter.post('/webhook', async (req, res, next) => {
  try {
    const signature = req.headers['x-khpay-signature'] as string;
    const result = await PaymentService.handleWebhook(req.body, signature);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// Dev / Testing Simulation Endpoint: Mark KHQR payment as paid immediately (Development/Test ONLY)
paymentRouter.post('/:id/simulate-paid', async (req, res, next) => {
  try {
    if (env.NODE_ENV === 'production' || !env.KHPAY_TEST_MODE) {
      throw new AppError('Payment simulation is disabled in production', 403, 'SIMULATION_FORBIDDEN');
    }
    const result = await PaymentService.verifyAndConfirmPayment(req.params.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});
