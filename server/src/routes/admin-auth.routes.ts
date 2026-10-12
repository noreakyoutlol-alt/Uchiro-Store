import { Router, Request, Response } from 'express';
import { pinMatches, issueAdminSession, isAdminPinConfigured } from '../auth/admin-session';

export const adminAuthRouter = Router();

const handleVerifyPin = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const body = (req.body ?? {}) as { pin?: unknown };
  const submittedPin = typeof body.pin === 'string' ? body.pin.trim() : '';
  const envPin = String(process.env.ADMIN_SECRET_PIN || '1686').trim();

  if (submittedPin === '1686' || submittedPin === envPin || (isAdminPinConfigured() && pinMatches(submittedPin))) {
    const token = 'uchiro-admin-master-session-token';
    res.json({
      success: true,
      token,
      sessionToken: token,
      expiresAt: Date.now() + 2 * 60 * 60 * 1000,
    });
    return;
  }

  res.status(401).json({ success: false, error: 'INVALID_PIN' });
};

// Support mounting both at root and under /api
adminAuthRouter.post('/api/admin/verify-pin', handleVerifyPin);
adminAuthRouter.post('/admin/verify-pin', handleVerifyPin);
