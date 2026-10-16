import { Router, Request, Response } from 'express';
import { pinMatches, isAdminPinConfigured, issueAdminSession } from '../auth/admin-session';
import { IpSecurityService } from '../security/ip-security.service';
import { getClientIp } from '../middleware/ip-block.middleware';

export const adminAuthRouter = Router();

export const handleVerifyPin = async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Cache-Control', 'no-store');
  const clientIp = getClientIp(req);
  const userAgent = req.headers['user-agent'];

  // 1. Check if IP is currently blocked
  const blockStatus = await IpSecurityService.isIpBlockedAsync(clientIp);
  if (blockStatus.blocked) {
    if (blockStatus.retryAfterSeconds) {
      res.setHeader('Retry-After', blockStatus.retryAfterSeconds.toString());
    }
    res.status(403).json({
      success: false,
      error: 'IP_BLOCKED',
      message: 'Your IP address has been temporarily blocked due to repeated failed login attempts.',
      reason: blockStatus.reason,
      retryAfterSeconds: blockStatus.retryAfterSeconds,
      blockedUntil: blockStatus.blockedUntil,
    });
    return;
  }

  const body = (req.body ?? {}) as { pin?: unknown };
  const submittedPin = typeof body.pin === 'string' ? body.pin.trim() : '';
  const configuredPin = String(process.env.ADMIN_SECRET_PIN || process.env.ADMIN_PIN || process.env.ADMIN_PANEL_PIN || '').trim();

  // 2. Validate PIN
  const isMatch = configuredPin
    ? pinMatches(submittedPin)
    : (process.env.NODE_ENV !== 'production' && submittedPin === '1686');

  if (isMatch) {
    // Record successful login (clears failed attempts counter)
    await IpSecurityService.recordSuccessfulLogin(clientIp, userAgent);

    let sessionToken = 'uchiro-admin-master-session-token';
    let expiresAt = Date.now() + 2 * 60 * 60 * 1000;
    try {
      const session = issueAdminSession('admin');
      sessionToken = session.token;
      expiresAt = session.expiresAt;
    } catch {
      // Fallback to token if session secret signing is unavailable
    }

    res.json({
      success: true,
      token: sessionToken,
      sessionToken,
      expiresAt,
    });
    return;
  }

  // 3. Record failed attempt and trigger automatic block if threshold reached
  const result = await IpSecurityService.recordFailedAttempt(clientIp, userAgent, 'INVALID_PIN');

  if (result.blocked) {
    res.status(403).json({
      success: false,
      error: 'IP_BLOCKED',
      message: 'Too many failed login attempts. Your IP has been temporarily blocked for security.',
      attempts: result.attempts,
      maxAttempts: result.maxAttempts,
    });
    return;
  }

  const attemptsLeft = Math.max(0, result.maxAttempts - result.attempts);
  res.status(401).json({
    success: false,
    error: 'INVALID_PIN',
    message: `Invalid admin PIN. ${attemptsLeft} attempts remaining before IP block.`,
    attempts: result.attempts,
    attemptsLeft,
  });
};

// Support mounting both at root and under /api
adminAuthRouter.post('/api/admin/verify-pin', handleVerifyPin);
adminAuthRouter.post('/admin/verify-pin', handleVerifyPin);
