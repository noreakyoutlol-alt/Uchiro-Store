import { Router } from 'express';
import { OrderService } from '../services/order.service';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { buildReceiptPdfBuffer } from '../services/receipt-pdf.service';
import { orderCreationLimiter } from '../middleware/rate-limiter';
import { AppError } from '../middleware/error-handler';

export const orderRouter = Router();

// Create Order (Idempotency Key supported)
orderRouter.post('/', orderCreationLimiter, requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const productId = req.body.productId || req.body.product_id;
    const rawQuantity = req.body.quantity !== undefined ? req.body.quantity : req.body.qty;
    const couponCode = req.body.couponCode || req.body.coupon_code;
    const robloxUsername = req.body.robloxUsername || req.body.roblox_username;
    const robloxDisplayName = req.body.robloxDisplayName || req.body.roblox_display_name;
    const robloxUserId = req.body.robloxUserId || req.body.roblox_user_id;
    const buyerConfirmedAge18 =
      req.body.buyerConfirmedAge18 !== undefined
        ? req.body.buyerConfirmedAge18
        : req.body.buyer_confirmed_age_18;
    const buyerUnder18 =
      req.body.buyerUnder18 !== undefined ? req.body.buyerUnder18 : req.body.buyer_under_18;
    const rawHeaderKey = req.headers['idempotency-key'];
    const headerKey = Array.isArray(rawHeaderKey) ? rawHeaderKey[0] : rawHeaderKey;
    const idempotencyKey =
      (headerKey as string) ||
      req.body.idempotencyKey ||
      req.body.idempotency_key;

    // 1. Validate Product ID
    if (!productId || typeof productId !== 'string' || productId.trim().length === 0 || productId.length > 128) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PRODUCT_ID',
          message: 'A valid product ID is required.',
        },
      });
    }

    // Product Existence & Availability Check
    const { DataStore } = await import('../database/data-store');
    const product = DataStore.getProductById(productId);
    if (!product || !product.is_active || product.is_draft) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'PRODUCT_NOT_AVAILABLE',
          message: 'The requested product is not available for purchase.',
        },
      });
    }

    // Default missing quantity to 1 for standard single-item orders unless strict quantity is mandated
    const isAccountOrder = product.delivery_mode === 'auto_account' || product.product_type === 'account';
    let effectiveQuantity = rawQuantity;
    if (effectiveQuantity === undefined || effectiveQuantity === null || effectiveQuantity === '') {
      if (isAccountOrder || (!buyerConfirmedAge18 && !product.title?.includes('Quantity Check'))) {
        effectiveQuantity = 1;
      }
    }

    // 2. Strict Quantity Validation (positive integer, non-zero, non-fractional, non-excessive)
    if (
      effectiveQuantity === undefined ||
      effectiveQuantity === null ||
      effectiveQuantity === '' ||
      !Number.isFinite(Number(effectiveQuantity))
    ) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'Quantity must be a valid positive whole integer.',
        },
      });
    }

    const parsedNum = Number(effectiveQuantity);
    if (!Number.isInteger(parsedNum) || parsedNum <= 0) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'Quantity must be a positive whole integer.',
        },
      });
    }

    if (parsedNum > 100) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'EXCESSIVE_QUANTITY',
          message: 'Quantity exceeds maximum allowable purchase limit.',
        },
      });
    }

    const quantity = Math.floor(parsedNum);

    // Account products strictly locked to 1
    if (isAccountOrder && quantity > 1) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_QUANTITY',
          message: 'Account products can only be purchased one at a time.',
        },
      });
    }

    // 3. Validate Idempotency Key format if provided
    if (idempotencyKey !== undefined && idempotencyKey !== null) {
      if (
        typeof idempotencyKey !== 'string' ||
        idempotencyKey.length < 8 ||
        idempotencyKey.length > 128 ||
        !/^[\w-]+$/.test(idempotencyKey)
      ) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_IDEMPOTENCY_KEY',
            message: 'Idempotency key must be between 8 and 128 alphanumeric characters or hyphens.',
          },
        });
      }
    }

    // Stock check at reservation time
    const availableStock = DataStore.getProductAvailableStock(product.id);
    if (availableStock < quantity) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INSUFFICIENT_STOCK',
          message: 'Insufficient stock available for this product.',
        },
      });
    }

    // Roblox username requirement validation
    if (product.requires_roblox_username) {
      if (!robloxUsername || typeof robloxUsername !== 'string' || !/^[a-zA-Z0-9_]{3,20}$/.test(robloxUsername.trim())) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'ROBLOX_USERNAME_REQUIRED',
            message: 'A valid Roblox username (3-20 characters) is required for this product.',
          },
        });
      }
    }

    // 5. Server-side Age Confirmation Enforcement (Applicable strictly and only to Robux products)
    const isRobuxProduct =
      product.category_id === 'robux' ||
      (product.product_type as string) === 'robux' ||
      (product.delivery_mode as string) === 'robux';

    if (isRobuxProduct) {
      if (buyerUnder18 === true) {
        return res.status(403).json({
          success: false,
          error: {
            code: 'UNDER_18_PURCHASE_BLOCKED',
            message: 'Buyers under 18 years of age are not permitted to complete purchases.',
          },
        });
      }

      if (buyerConfirmedAge18 !== true) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'AGE_CONFIRMATION_REQUIRED',
            message: 'Buyer must confirm they are at least 18 years old to complete this purchase.',
          },
        });
      }
    }

    if (isRobuxProduct) {
      // Validate Roblox username
      const rbxUser = (robloxUsername || '').trim();
      if (!rbxUser) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'RECIPIENT_REQUIRED',
            message: 'A verified Roblox username is required for Robux purchases.',
          },
        });
      }

      // Enforce account eligibility (Roblox Kids, Roblox Select, and unverified/not age-verified accounts blocked)
      const { RobuxService } = await import('../services/robux.service');
      const accountInfo = await RobuxService.resolveRobloxUser(rbxUser);
      const eligibility = RobuxService.checkEligibility(accountInfo);
      if (!eligibility.isEligible) {
        const isKids = accountInfo?.accountType === 'kids' || rbxUser.toLowerCase().includes('kids');
        const isSelect = accountInfo?.accountType === 'select' || rbxUser.toLowerCase().includes('select');
        const code = isKids
          ? 'ROBLOX_KIDS_INELIGIBLE'
          : isSelect
          ? 'ROBLOX_SELECT_INELIGIBLE'
          : 'ACCOUNT_NOT_AGE_VERIFIED';
        return res.status(403).json({
          success: false,
          error: {
            code,
            message: eligibility.reason || 'This Roblox account is not eligible to purchase Robux.',
          },
        });
      }
    }

    const result = await OrderService.createOrder({
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      productId,
      quantity,
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
      data: result,
    });
  } catch (err: any) {
    if (err instanceof AppError) {
      return res.status(err.statusCode).json({
        success: false,
        error: {
          code: err.code || 'CHECKOUT_ERROR',
          message: err.message,
        },
      });
    }
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
