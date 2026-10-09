import { Router } from 'express';
import { OrderService } from '../services/order.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { buildReceiptPdfBuffer } from '../services/receipt-pdf.service';

export const orderRouter = Router();

// Create Order (Idempotency Key supported)
orderRouter.post('/', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const { productId, quantity, couponCode, robloxUsername, robloxDisplayName, robloxUserId } = req.body;
    const idempotencyKey = (req.headers['idempotency-key'] as string) || req.body.idempotencyKey;

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
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// List Customer Orders
orderRouter.get('/', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const orders = OrderService.getCustomerOrders(req.user!.telegram_id);
  res.json({
    success: true,
    data: orders,
  });
});

// Get Order Details (Decrypted credentials returned only if delivered and customer authorized)
orderRouter.get('/:id', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const order = OrderService.getOrderByIdForCustomer(req.params.id, req.user!.telegram_id);
    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

// Official Order Receipt (Strictly Order & Payment Details Only - Zero Sensitive Credentials)
orderRouter.get('/:id/receipt', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const receipt = OrderService.getOrderReceipt(req.params.id, req.user!.telegram_id);
    res.json({
      success: true,
      data: receipt,
    });
  } catch (err) {
    next(err);
  }
});

// Download Official PDF Receipt
orderRouter.get('/:id/receipt/download', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const receipt = OrderService.getOrderReceipt(req.params.id, req.user!.telegram_id);
    const pdfBuffer = buildReceiptPdfBuffer(receipt);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="UCHIRO-Receipt-${receipt.order_number}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    next(err);
  }
});

// Secure Customer Delivery Result (Strictly Username, Password, Authenticator Setup & Live Code ONLY)
orderRouter.get('/:id/delivery', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const delivery = await OrderService.getOrderDelivery(
      req.params.id,
      req.user!.telegram_id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({
      success: true,
      data: delivery,
    });
  } catch (err) {
    next(err);
  }
});

// Secure Live Authenticator (TOTP) Refresh Endpoint
orderRouter.get('/:id/delivery/totp', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const totpData = OrderService.getOrderDeliveryTotp(
      req.params.id,
      req.user!.telegram_id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({
      success: true,
      data: totpData,
    });
  } catch (err) {
    next(err);
  }
});

// Live Authenticator (TOTP) backward-compatible endpoint (strictly sanitized)
orderRouter.get('/:id/totp', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const authData = OrderService.getOrderDeliveryTotp(
      req.params.id,
      req.user!.telegram_id,
      req.ip,
      req.headers['user-agent']
    );
    res.json({
      success: true,
      data: authData,
    });
  } catch (err) {
    next(err);
  }
});
