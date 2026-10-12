import { Router, Request, Response } from 'express';
import { pinMatches, issueAdminSession, isAdminPinConfigured } from '../auth/admin-session';

export const adminAuthRouter = Router();

const handleVerifyPin = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  if (!isAdminPinConfigured()) {
    console.error('[admin] ADMIN_SECRET_PIN (6 digits) or ADMIN_SESSION_SECRET (>= 32 chars) is not configured');
    res.status(503).json({ error: 'PIN_NOT_CONFIGURED' });
    return;
  }
  const body = (req.body ?? {}) as { pin?: unknown };
  const pin = typeof body.pin === 'string' ? body.pin : '';
  if (!pinMatches(pin)) {
    res.status(401).json({ error: 'INVALID_PIN' });
    return;
  }
  const session = issueAdminSession();
  res.json({ success: true, sessionToken: session.token, expiresAt: session.expiresAt });
};

// Support mounting both at root and under /api
adminAuthRouter.post('/api/admin/verify-pin', handleVerifyPin);
adminAuthRouter.post('/admin/verify-pin', handleVerifyPin);
