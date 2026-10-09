import { Router } from 'express';
import { DataStore } from '../database/data-store';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';

export const supportRouter = Router();

// Create Ticket
supportRouter.post('/tickets', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const { subject, message, category, orderId } = req.body;
  const ticket = DataStore.createSupportTicket({
    customerId: req.user!.user_id,
    telegramId: req.user!.telegram_id,
    subject,
    message,
    category,
    orderId,
  });

  res.status(201).json({
    success: true,
    data: ticket,
  });
});

// My Tickets
supportRouter.get('/my-tickets', requireTelegramAuth, (req: RequestWithAuth, res) => {
  const all = DataStore.getSupportTickets();
  const mine = all.filter((t) => t.telegram_id === req.user!.telegram_id);
  res.json({
    success: true,
    data: mine,
  });
});
