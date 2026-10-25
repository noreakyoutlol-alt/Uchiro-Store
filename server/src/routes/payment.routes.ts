import { Router } from 'express';
import { PaymentService } from '../services/payment.service';
import { OrderService } from '../services/order.service';
import { DataStore } from '../database/data-store';
import { env } from '../config/env';
import { AppError } from '../middleware/error-handler';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { paymentPollingLimiter, orderCreationLimiter } from '../middleware/rate-limiter';

export const paymentRouter = Router();

// Create QR Code & Order (or fetch QR for existing order)
paymentRouter.post('/create-qr', orderCreationLimiter, requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const { productId, quantity, couponCode, robloxUsername, robloxDisplayName, robloxUserId, orderId } = req.body;
    const buyerConfirmedAge18 =
      req.body.buyerConfirmedAge18 !== undefined
        ? req.body.buyerConfirmedAge18
        : req.body.buyer_confirmed_age_18;
    const buyerUnder18 =
      req.body.buyerUnder18 !== undefined ? req.body.buyerUnder18 : req.body.buyer_under_18;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

    if (orderId) {
      const order = OrderService.getOrderByIdForCustomer(orderId, req.user!.telegram_id);
      const payment = DataStore.getPaymentByOrderId(order.id);
      return res.status(200).json({
        success: true,
        data: { order, payment, khqr: payment },
      });
    }

    if (!productId || typeof productId !== 'string' || productId.trim().length === 0) {
      throw new AppError('productId is required to generate payment QR', 400, 'INVALID_PRODUCT_ID');
    }

    let parsedQuantity = 1;
    if (quantity !== undefined && quantity !== null) {
      const num = Number(quantity);
      if (!Number.isFinite(num) || !Number.isInteger(num) || num <= 0) {
        throw new AppError('Quantity must be a positive integer', 400, 'INVALID_QUANTITY');
      }
      if (num > 100) {
        throw new AppError('Quantity exceeds maximum allowable purchase limit', 400, 'EXCESSIVE_QUANTITY');
      }
      parsedQuantity = Math.floor(num);
    }

    if (buyerUnder18 === true) {
      throw new AppError('Buyers under 18 years of age are not permitted to complete purchases.', 403, 'UNDER_18_PURCHASE_BLOCKED');
    }

    const result = await OrderService.createOrder({
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      productId,
      quantity: parsedQuantity,
      couponCode,
      robloxUsername: robloxUsername?.trim(),
      robloxDisplayName: robloxDisplayName?.trim(),
      robloxUserId: robloxUserId?.trim(),
      buyerConfirmedAge18: buyerConfirmedAge18 !== undefined ? buyerConfirmedAge18 === true : undefined,
      buyerUnder18: buyerUnder18 !== undefined ? buyerUnder18 === true : undefined,
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

// Payment Status Check / Polling (Protected with specialized polling limiter)
paymentRouter.get('/:id/status', paymentPollingLimiter, async (req, res, next) => {
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
    const signature = (req.headers['x-khpay-signature'] || req.headers['x-signature']) as string;
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
