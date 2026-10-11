import { Router } from 'express';
import { requireTelegramAuth, RequestWithAuth } from '../middleware/auth';
import {
  getCustomerDeliveredAccounts,
  getCustomerDeliveredAccountById,
} from '../bots/store-bot/handlers/orders';

export const vaultRouter = Router();

// List all delivered accounts for the authenticated customer
vaultRouter.get('/accounts', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const telegramId = req.user!.telegram_id;
    const accounts = await getCustomerDeliveredAccounts(telegramId);
    res.json({
      success: true,
      data: accounts,
      accounts,
    });
  } catch (err) {
    next(err);
  }
});

// Get a single delivered account by its ID
vaultRouter.get('/accounts/:id', requireTelegramAuth, async (req: RequestWithAuth, res, next) => {
  try {
    const telegramId = req.user!.telegram_id;
    const account = await getCustomerDeliveredAccountById(telegramId, req.params.id);
    if (!account) {
      return res.status(404).json({
        success: false,
        error: 'Account not found or access denied',
      });
    }
    res.json({
      success: true,
      data: account,
      account,
    });
  } catch (err) {
    next(err);
  }
});
