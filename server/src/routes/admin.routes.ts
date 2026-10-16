import { Router } from 'express';
import { AdminService } from '../services/admin.service';
import { OrderService } from '../services/order.service';
import { BroadcastService } from '../services/broadcast.service';
import { RequestWithAuth } from '../middleware/auth';
import { TOTPService } from '../security/totp';
import { AppError } from '../middleware/error-handler';

import { handleVerifyPin } from './admin-auth.routes';
import { IpSecurityService } from '../security/ip-security.service';

export const adminRouter = Router();

// Set req.admin from telegramUser for backwards-compatible route handlers
adminRouter.use((req: RequestWithAuth, res, next) => {
  const user = res.locals.telegramUser as { id: string; username: string | null } | undefined;
  if (user) {
    req.admin = {
      telegram_id: Number(user.id),
      user_id: user.id,
      username: user.username,
      role: 'admin',
    };
  }
  next();
});

// Admin PIN Verification (Protected with IP Brute-Force Tracking)
adminRouter.post(['/verify-pin', '/api/admin/verify-pin'], handleVerifyPin);

// Categories
adminRouter.get('/categories', (_req, res) => {
  const categories = AdminService.listCategories();
  res.json({
    success: true,
    data: categories,
  });
});

// 1. Dashboard Stats & Analytics
adminRouter.get('/stats', (_req, res) => {
  const stats = AdminService.getDashboardStats();
  res.json({
    success: true,
    data: stats,
  });
});

// 2. Orders Management
adminRouter.get('/orders', (_req, res) => {
  const orders = AdminService.listOrders();
  res.json({
    success: true,
    data: orders,
  });
});

adminRouter.get('/orders/:id', (req, res, next) => {
  try {
    const order = OrderService.getOrderByIdForAdmin(req.params.id);
    res.json({
      success: true,
      data: order,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/orders/:id/fulfill', (req: RequestWithAuth, res, next) => {
  try {
    const { notes, credentials } = req.body;
    const fulfilled = AdminService.manualFulfillOrder(
      req.admin!.telegram_id,
      req.params.id,
      notes || 'Manually fulfilled by Admin',
      credentials
    );
    res.json({
      success: true,
      data: fulfilled,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/orders/:id/warranty-replace', (req: RequestWithAuth, res, next) => {
  try {
    const { replacement_notes, credentials } = req.body;
    const replaced = AdminService.replaceWarrantyOrder(
      req.admin!.telegram_id,
      req.params.id,
      replacement_notes || 'Warranty replacement',
      credentials
    );
    res.json({
      success: true,
      data: replaced,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/orders/:id/warranty-invalidate', (req: RequestWithAuth, res, next) => {
  try {
    const { reason } = req.body;
    const invalidated = AdminService.invalidateWarranty(
      req.admin!.telegram_id,
      req.params.id,
      reason || 'Warranty invalidated'
    );
    res.json({
      success: true,
      data: invalidated,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/orders/:id/redeliver', async (req: RequestWithAuth, res, next) => {
  try {
    const redelivered = await AdminService.reDeliverOrder(
      req.admin!.telegram_id,
      req.params.id
    );
    res.json({
      success: true,
      data: redelivered,
    });
  } catch (err) {
    next(err);
  }
});

const VALID_DELIVERY_MODES = ['auto_account', 'manual_service', 'trade_item', 'digital_code'];

// 3. Products Management
adminRouter.get('/products', (_req, res) => {
  const products = AdminService.listProducts();
  res.json({
    success: true,
    data: products,
  });
});

adminRouter.post('/products', (req: RequestWithAuth, res, next) => {
  try {
    const { delivery_mode } = req.body;
    if (delivery_mode !== undefined && !VALID_DELIVERY_MODES.includes(delivery_mode)) {
      throw new AppError(
        `Invalid delivery_mode. Must be one of: ${VALID_DELIVERY_MODES.join(', ')}`,
        400,
        'INVALID_DELIVERY_MODE'
      );
    }

    const payload = { ...req.body };
    if (payload.delivery_mode === 'manual_service') {
      payload.requires_roblox_verification = true;
      payload.requires_roblox_username = true;
      payload.specifications = {
        ...(payload.specifications || {}),
        requires_roblox_verification: true,
      };
    }

    const product = AdminService.saveProduct(req.admin!.telegram_id, payload);
    res.status(201).json({
      success: true,
      data: product,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.put('/products/:id', (req: RequestWithAuth, res, next) => {
  try {
    const { delivery_mode } = req.body;
    if (delivery_mode !== undefined && !VALID_DELIVERY_MODES.includes(delivery_mode)) {
      throw new AppError(
        `Invalid delivery_mode. Must be one of: ${VALID_DELIVERY_MODES.join(', ')}`,
        400,
        'INVALID_DELIVERY_MODE'
      );
    }

    const payload = { ...req.body };
    if (payload.delivery_mode === 'manual_service') {
      payload.requires_roblox_verification = true;
      payload.requires_roblox_username = true;
      payload.specifications = {
        ...(payload.specifications || {}),
        requires_roblox_verification: true,
      };
    }

    const updated = AdminService.updateProduct(req.admin!.telegram_id, req.params.id, payload);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.patch('/products/:id', (req: RequestWithAuth, res, next) => {
  try {
    const { delivery_mode } = req.body;
    if (delivery_mode !== undefined && !VALID_DELIVERY_MODES.includes(delivery_mode)) {
      throw new AppError(
        `Invalid delivery_mode. Must be one of: ${VALID_DELIVERY_MODES.join(', ')}`,
        400,
        'INVALID_DELIVERY_MODE'
      );
    }

    const payload = { ...req.body };
    if (payload.delivery_mode === 'manual_service') {
      payload.requires_roblox_verification = true;
      payload.requires_roblox_username = true;
      payload.specifications = {
        ...(payload.specifications || {}),
        requires_roblox_verification: true,
      };
    }

    const updated = AdminService.updateProduct(req.admin!.telegram_id, req.params.id, payload);
    res.json({
      success: true,
      data: updated,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/products/:id', (req: RequestWithAuth, res) => {
  const success = AdminService.deleteProduct(req.admin!.telegram_id, req.params.id);
  res.json({
    success,
  });
});

// 4. Inventory Management
adminRouter.get('/inventory', (_req, res) => {
  const items = AdminService.listInventory();
  res.json({
    success: true,
    data: items,
  });
});

adminRouter.post('/inventory', (req: RequestWithAuth, res) => {
  const item = AdminService.addInventoryItem(req.admin!.telegram_id, req.body);
  res.json({
    success: true,
    data: item,
  });
});

adminRouter.put('/inventory/:id', (req: RequestWithAuth, res, next) => {
  try {
    const item = AdminService.updateInventoryItem(req.admin!.telegram_id, req.params.id, req.body);
    res.json({
      success: true,
      data: item,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/inventory/:id', (req: RequestWithAuth, res) => {
  const success = AdminService.deleteInventoryItem(req.admin!.telegram_id, req.params.id);
  res.json({
    success,
  });
});

adminRouter.post('/inventory/bulk', (req: RequestWithAuth, res, next) => {
  try {
    const { productId, items } = req.body;
    const result = AdminService.bulkAddInventory(req.admin!.telegram_id, productId, items || []);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/inventory/verify-totp', (req: RequestWithAuth, res) => {
  try {
    let secret = req.body.secret;
    const username = req.body.username || 'UchiroAccount';
    if (!secret || secret === 'generate') {
      secret = TOTPService.generateSecret(16);
    }
    const totp = TOTPService.generateCode(secret);
    const otpauthUri = TOTPService.buildOtpAuthUri({
      accountName: username,
      secretBase32: secret,
      issuer: 'Uchiro Store',
    });
    res.json({
      success: true,
      data: {
        secret,
        code: totp.code,
        secondsRemaining: totp.secondsRemaining,
        period: totp.period,
        otpauthUri,
      },
    });
  } catch (err: any) {
    res.status(400).json({
      success: false,
      error: { message: err.message || 'Invalid TOTP secret' },
    });
  }
});

// 5. Gacha Claims
adminRouter.get('/claims', (_req, res) => {
  const claims = AdminService.listPendingClaims();
  res.json({
    success: true,
    data: claims,
  });
});

adminRouter.post('/claims/:id/resolve', (req: RequestWithAuth, res, next) => {
  try {
    const { status, notes, deliveryData } = req.body;
    const claim = AdminService.resolveGachaClaim(
      req.admin!.telegram_id,
      req.params.id,
      status || 'fulfilled',
      notes,
      deliveryData
    );
    res.json({
      success: true,
      data: claim,
    });
  } catch (err) {
    next(err);
  }
});

// 6. Coupons Management
adminRouter.get('/coupons', (_req, res) => {
  const coupons = AdminService.listCoupons();
  res.json({
    success: true,
    data: coupons,
  });
});

adminRouter.post('/coupons', (req: RequestWithAuth, res) => {
  const coupon = AdminService.createCoupon(req.admin!.telegram_id, req.body);
  res.status(201).json({
    success: true,
    data: coupon,
  });
});

adminRouter.put('/coupons/:id', (req: RequestWithAuth, res) => {
  const updated = AdminService.updateCoupon(req.admin!.telegram_id, req.params.id, req.body);
  res.json({
    success: !!updated,
    data: updated,
  });
});

adminRouter.delete('/coupons/:id', (req: RequestWithAuth, res) => {
  const deleted = AdminService.deleteCoupon(req.admin!.telegram_id, req.params.id);
  res.json({
    success: deleted,
  });
});

// 7. Customers / Users
adminRouter.get('/users', (_req, res) => {
  const users = AdminService.listUsers();
  res.json({
    success: true,
    data: users,
  });
});

adminRouter.get('/users/:telegramId', (req, res) => {
  const detail = AdminService.getUserDetail(Number(req.params.telegramId));
  if (!detail.user) {
    res.status(404).json({
      success: false,
      error: 'User not found',
    });
    return;
  }
  res.json({
    success: true,
    data: detail,
  });
});

// 8. Support Tickets
adminRouter.get('/support', (_req, res) => {
  const tickets = AdminService.listSupportTickets();
  res.json({
    success: true,
    data: tickets,
  });
});

adminRouter.post('/support/:id/reply', (req: RequestWithAuth, res, next) => {
  try {
    const { reply, status } = req.body;
    const ticket = AdminService.replySupportTicket(
      req.admin!.telegram_id,
      req.params.id,
      reply,
      status
    );
    res.json({
      success: true,
      data: ticket,
    });
  } catch (err) {
    next(err);
  }
});

// 9. Audit Logs
adminRouter.get('/audit-logs', (_req, res) => {
  const logs = AdminService.getAuditLogs();
  res.json({
    success: true,
    data: logs,
  });
});

// 10. Broadcast & Notification Drafts (Requirement 45, 48)
adminRouter.get('/broadcast/drafts', (_req, res) => {
  const drafts = AdminService.getOrderDrafts();
  res.json({
    success: true,
    data: drafts,
  });
});

adminRouter.post('/broadcast/send', async (req: RequestWithAuth, res, next) => {
  try {
    const { title, stockCount, price, productId, messageText } = req.body;
    if (!title || price === undefined || !productId) {
      throw new AppError('title, price, and productId are required for stock broadcast', 400);
    }
    const result = await BroadcastService.broadcastStockArrival({
      title,
      stockCount: Number(stockCount) || 0,
      price: Number(price) || 0,
      productId,
      messageText,
    });
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/broadcast/drafts/:id/send', async (req: RequestWithAuth, res, next) => {
  try {
    const result = await AdminService.broadcastOrderDraft(req.admin!.telegram_id, req.params.id);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/broadcast/drafts/:id/dismiss', (req: RequestWithAuth, res) => {
  const dismissed = AdminService.dismissOrderDraft(req.admin!.telegram_id, req.params.id);
  res.json({
    success: true,
    data: dismissed,
  });
});

adminRouter.post('/broadcast', async (req: RequestWithAuth, res, next) => {
  try {
    const { message } = req.body;
    const result = await AdminService.broadcastMessage(req.admin!.telegram_id, message);
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 11. Gacha Management (Requirement 31: Enforce 100% total probability)
adminRouter.get('/gacha/pools', (_req, res) => {
  const pools = AdminService.listGachaPools();
  res.json({
    success: true,
    data: pools,
  });
});

adminRouter.post('/gacha/pools', (req: RequestWithAuth, res) => {
  const pool = AdminService.saveGachaPool(req.admin!.telegram_id, req.body);
  res.json({
    success: true,
    data: pool,
  });
});

adminRouter.post('/gacha/prizes', (req: RequestWithAuth, res, next) => {
  try {
    const prize = AdminService.saveGachaPrize(req.admin!.telegram_id, req.body);
    res.json({
      success: true,
      data: prize,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.delete('/gacha/prizes/:id', (req: RequestWithAuth, res) => {
  const deleted = AdminService.deleteGachaPrize(req.admin!.telegram_id, req.params.id);
  res.json({
    success: deleted,
  });
});

adminRouter.post('/gacha/prizes/:id/promote', (req: RequestWithAuth, res, next) => {
  try {
    const promoted = AdminService.promoteDraftPrize(req.admin!.telegram_id, req.params.id);
    res.json({
      success: true,
      data: promoted,
    });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/gacha/pools/:id/validate-probabilities', (req, res) => {
  const result = AdminService.validatePoolProbabilities(req.params.id);
  res.json({
    success: result.isValid,
    data: result,
  });
});

adminRouter.put('/gacha/pools/:id/probabilities', (req: RequestWithAuth, res, next) => {
  try {
    const { probabilities } = req.body;
    const result = AdminService.updatePoolProbabilities(
      req.admin!.telegram_id,
      req.params.id,
      probabilities || []
    );
    res.json({
      success: true,
      data: result,
    });
  } catch (err) {
    next(err);
  }
});

// 12. Store Settings (Requirement 29, 30, 46, 52)
adminRouter.get('/settings', (_req, res) => {
  const settings = AdminService.getStoreSettings();
  res.json({
    success: true,
    data: settings,
  });
});

adminRouter.put('/settings', (req: RequestWithAuth, res) => {
  const updated = AdminService.updateStoreSettings(req.admin!.telegram_id, req.body);
  res.json({
    success: true,
    data: updated,
  });
});

// 13. System Backup & Restore
adminRouter.get('/backup', (_req, res) => {
  const bundle = AdminService.exportBackupBundle();
  res.json({
    success: true,
    data: bundle,
  });
});

adminRouter.post('/restore', (req: RequestWithAuth, res, next) => {
  try {
    const result = AdminService.restoreBackupBundle(req.admin!.telegram_id, req.body);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 14. Demo Data Reset (Section 58)
adminRouter.post('/reset-demo', (req: RequestWithAuth, res, next) => {
  try {
    const result = AdminService.resetDemoData();
    AdminService.logAdminAction(req.admin!.telegram_id, 'RESET_DEMO_DATA', {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// 15. Security & IP Firewall Management (Phase 3C & Phase 6)
adminRouter.get('/security/stats', async (_req, res, next) => {
  try {
    const stats = await IpSecurityService.getStats();
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/security/blocked-ips', async (req, res, next) => {
  try {
    const status = req.query.status as any;
    const search = req.query.search as string;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;

    const data = await IpSecurityService.listBans({ status, search, limit, offset });
    res.json({ success: true, data: data.blocks, total: data.total });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/security/block-ip', async (req: RequestWithAuth, res, next) => {
  try {
    const { ip, reason, durationMinutes, permanent } = req.body;
    if (!ip || typeof ip !== 'string' || ip.trim().length === 0) {
      return res.status(400).json({ success: false, error: 'INVALID_IP_ADDRESS' });
    }

    const cleanIp = ip.trim();
    // Validate IPv4 or IPv6 format
    const ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$|^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    if (!ipPattern.test(cleanIp) && cleanIp !== '127.0.0.1' && cleanIp !== '::1') {
      return res.status(400).json({ success: false, error: 'INVALID_IP_FORMAT', message: 'Must be a valid IPv4 or IPv6 address' });
    }
    const duration = Math.min(Math.max(1, Number(durationMinutes) || 60), 525600); // 1 min to 1 year
    const blockedUntil = permanent ? null : new Date(Date.now() + duration * 60 * 1000).toISOString();

    const record = await IpSecurityService.applyBlock({
      ip: cleanIp,
      reason: reason || 'Manually blocked by administrator',
      blockedUntil,
      isPermanent: Boolean(permanent),
      adminUser: String(req.admin?.username || req.admin?.telegram_id || 'admin'),
    });

    AdminService.logAdminAction(req.admin!.telegram_id, 'MANUAL_IP_BLOCK', {
      ip: cleanIp,
      reason: record.reason,
      permanent: record.is_permanent,
    });

    res.json({ success: true, data: record });
  } catch (err) {
    next(err);
  }
});

adminRouter.post('/security/unban-ip', async (req: RequestWithAuth, res, next) => {
  try {
    const { ip } = req.body;
    if (!ip || typeof ip !== 'string') {
      return res.status(400).json({ success: false, error: 'INVALID_IP_ADDRESS' });
    }

    const cleanIp = ip.trim();
    await IpSecurityService.unbanIp(cleanIp, String(req.admin?.username || req.admin?.telegram_id || 'admin'));

    AdminService.logAdminAction(req.admin!.telegram_id, 'MANUAL_IP_UNBAN', { ip: cleanIp });

    res.json({ success: true, message: `IP ${cleanIp} has been unbanned successfully` });
  } catch (err) {
    next(err);
  }
});

adminRouter.get('/security/audit-logs', async (req, res, next) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const offset = req.query.offset ? Number(req.query.offset) : 0;
    const data = await IpSecurityService.getAuditLogs({ limit, offset });
    res.json({ success: true, data: data.logs, total: data.total });
  } catch (err) {
    next(err);
  }
});
