import { Router } from 'express';
import { DataStore } from '../database/data-store';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import { NotificationService } from '../services/notification.service';
import { AppError } from '../middleware/error-handler';

export const supportRouter = Router();

// Create Ticket handler
const handleCreateTicket = async (req: RequestWithAuth, res: any, next: any) => {
  try {
    const { subject, message, category, orderId } = req.body;
    if (!subject || typeof subject !== 'string' || subject.trim().length === 0) {
      throw new AppError('Subject is required', 400, 'SUBJECT_REQUIRED');
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new AppError('Message is required', 400, 'MESSAGE_REQUIRED');
    }

    // Duplicate Prevention: Check for identical open ticket created within 60 seconds
    const existingTicket = DataStore.getSupportTickets().find(
      (t) =>
        t.telegram_id === req.user!.telegram_id &&
        t.status === 'open' &&
        t.subject === subject.trim() &&
        t.message === message.trim() &&
        Date.now() - new Date(t.created_at).getTime() < 60000
    );
    if (existingTicket) {
      return res.status(200).json({
        success: true,
        data: existingTicket,
        ticket: existingTicket,
        message: 'Ticket already submitted.',
      });
    }

    const ticket = DataStore.createSupportTicket({
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      subject: subject.trim(),
      message: message.trim(),
      category: category || 'general',
      orderId: orderId?.trim() || undefined,
    });

    // Notify Admin Bot immediately
    NotificationService.notifyAdminNewTicket(ticket).catch(console.error);

    res.status(201).json({
      success: true,
      data: ticket,
      ticket,
    });
  } catch (err) {
    next(err);
  }
};

// Create Ticket (Support both /tickets and /ticket)
supportRouter.post('/tickets', requireTelegramAuth, handleCreateTicket);
supportRouter.post('/ticket', requireTelegramAuth, handleCreateTicket);

// My Tickets (Support both /my-tickets and /tickets)
const handleGetTickets = (req: RequestWithAuth, res: any) => {
  const all = DataStore.getSupportTickets();
  const mine = all.filter((t) => t.telegram_id === req.user!.telegram_id);
  res.json({
    success: true,
    data: mine,
    tickets: mine,
  });
};
supportRouter.get('/my-tickets', requireTelegramAuth, handleGetTickets);
supportRouter.get('/tickets', requireTelegramAuth, handleGetTickets);

// Get Ticket by ID
supportRouter.get('/tickets/:id', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const ticket = DataStore.getSupportTicketById(req.params.id);
    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    if (ticket.telegram_id !== req.user!.telegram_id && String(ticket.telegram_id) !== String(req.user!.telegram_id)) {
      throw new AppError('Access denied: You do not own this ticket', 403, 'FORBIDDEN');
    }

    res.json({
      success: true,
      data: ticket,
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

// Reply to Ticket (Customer)
supportRouter.post('/tickets/:id/reply', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new AppError('Message is required', 400, 'MESSAGE_REQUIRED');
    }

    const ticket = DataStore.getSupportTicketById(req.params.id);
    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    if (ticket.telegram_id !== req.user!.telegram_id && String(ticket.telegram_id) !== String(req.user!.telegram_id)) {
      throw new AppError('Access denied: You do not own this ticket', 403, 'FORBIDDEN');
    }

    const updated = DataStore.addCustomerMessageToTicket(ticket.id, message.trim());

    // Alert Admin Bot about customer reply
    NotificationService.sendAdminBotAlert(
      `💬 <b>CUSTOMER REPLY — TICKET #${ticket.ticket_number}</b>\n\n` +
      `<b>Customer ID:</b> <code>${ticket.telegram_id}</code>\n` +
      `<b>Subject:</b> ${ticket.subject}\n\n` +
      `<b>Message:</b>\n<i>${message.trim()}</i>`,
      {
        inline_keyboard: [
          [
            { text: '✍️ Reply', callback_data: `ticket_reply:${ticket.id}` },
            { text: '🔒 Close', callback_data: `ticket_close:${ticket.id}` },
          ],
        ],
      }
    ).catch(console.error);

    res.json({
      success: true,
      data: updated,
      ticket: updated,
    });
  } catch (err) {
    next(err);
  }
});

// Close Ticket (Customer)
supportRouter.post('/tickets/:id/close', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const ticket = DataStore.getSupportTicketById(req.params.id);
    if (!ticket) {
      throw new AppError('Ticket not found', 404, 'TICKET_NOT_FOUND');
    }
    if (ticket.telegram_id !== req.user!.telegram_id && String(ticket.telegram_id) !== String(req.user!.telegram_id)) {
      throw new AppError('Access denied: You do not own this ticket', 403, 'FORBIDDEN');
    }

    ticket.status = 'closed';
    ticket.updated_at = new Date().toISOString();

    res.json({
      success: true,
      data: ticket,
      ticket,
    });
  } catch (err) {
    next(err);
  }
});

// 14-Day Warranty Status Check
supportRouter.get('/warranty-status/:orderId', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const order = DataStore.getOrderById(req.params.orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== req.user!.telegram_id && String(order.telegram_id) !== String(req.user!.telegram_id)) {
      throw new AppError('Access denied: You do not own this order', 403, 'FORBIDDEN');
    }

    const isDelivered = order.status === 'delivered' || order.status === 'completed';
    const warrantyDays = order.warranty_days || 14;
    const startIso = order.delivered_at || order.warranty_starts_at || order.created_at;
    const startTime = new Date(startIso).getTime();
    const expiryTime = startTime + warrantyDays * 86400000;
    const now = Date.now();
    const isExpired = now > expiryTime;
    const daysRemaining = Math.max(0, Math.ceil((expiryTime - now) / 86400000));

    res.json({
      success: true,
      data: {
        orderId: order.id,
        orderNumber: order.order_number,
        isDelivered,
        warrantyDays,
        startsAt: startIso,
        expiresAt: new Date(expiryTime).toISOString(),
        isExpired,
        daysRemaining,
        canClaim: isDelivered && !isExpired,
        status: isExpired ? 'expired' : isDelivered ? 'active' : 'pending_delivery',
      },
    });
  } catch (err) {
    next(err);
  }
});

// Submit 14-Day Warranty Claim
supportRouter.post('/warranty-claim', requireTelegramAuth, (req: RequestWithAuth, res, next) => {
  try {
    const { orderId, message, subject } = req.body;
    if (!orderId || typeof orderId !== 'string') {
      throw new AppError('orderId is required for warranty claim', 400, 'ORDER_ID_REQUIRED');
    }
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      throw new AppError('Detailed claim message is required', 400, 'MESSAGE_REQUIRED');
    }

    const order = DataStore.getOrderById(orderId);
    if (!order) {
      throw new AppError('Order not found', 404, 'ORDER_NOT_FOUND');
    }
    if (order.telegram_id !== req.user!.telegram_id && String(order.telegram_id) !== String(req.user!.telegram_id)) {
      throw new AppError('Access denied: You do not own this order', 403, 'FORBIDDEN');
    }

    if (order.status !== 'delivered' && order.status !== 'completed') {
      throw new AppError(
        'Warranty claims can only be submitted for delivered orders.',
        400,
        'ORDER_NOT_DELIVERED'
      );
    }

    const warrantyDays = order.warranty_days || 14;
    const startIso = order.delivered_at || order.warranty_starts_at || order.created_at;
    const startTime = new Date(startIso).getTime();
    const expiryTime = startTime + warrantyDays * 86400000;
    const now = Date.now();

    if (now > expiryTime) {
      throw new AppError(
        `The 14-day warranty period for order #${order.order_number || order.id} expired on ${new Date(expiryTime).toLocaleDateString()}. Claims cannot be processed after the warranty window.`,
        400,
        'WARRANTY_EXPIRED'
      );
    }

    // Check for duplicate open claims on this order
    const existingOpenClaim = DataStore.getSupportTickets().find(
      (t) =>
        t.order_id === order.id &&
        t.category === 'warranty' &&
        (t.status === 'open' || t.status === 'in_progress')
    );
    if (existingOpenClaim) {
      throw new AppError(
        `A warranty claim for order #${order.order_number || order.id} is already in progress (Ticket #${existingOpenClaim.ticket_number}).`,
        400,
        'DUPLICATE_WARRANTY_CLAIM'
      );
    }

    const claimSubject =
      subject?.trim() ||
      `Warranty Claim - Order #${order.order_number || order.id} (${order.product_title || 'Account'})`;

    const ticket = DataStore.createSupportTicket({
      customerId: req.user!.user_id,
      telegramId: req.user!.telegram_id,
      orderId: order.id,
      category: 'warranty',
      subject: claimSubject,
      message: message.trim(),
    });

    // Notify Admin Bot with priority alert
    NotificationService.notifyAdminNewTicket(ticket).catch(console.error);

    res.status(201).json({
      success: true,
      data: {
        ticket,
        orderId: order.id,
        orderNumber: order.order_number,
        warrantyExpiresAt: new Date(expiryTime).toISOString(),
        claimStatus: 'submitted',
      },
    });
  } catch (err) {
    next(err);
  }
});
