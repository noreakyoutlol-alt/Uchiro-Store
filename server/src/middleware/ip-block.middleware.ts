import { Request, Response, NextFunction } from 'express';
import { IpSecurityService } from '../security/ip-security.service';

/**
 * Safely extracts client IP address behind trusted reverse proxies (e.g., Railway).
 * Prioritizes Express's validated `req.ip` computed under `trust proxy 1`.
 * Never trusts arbitrary unvalidated client-supplied forwarding headers when `req.ip` is present.
 */
export function getClientIp(req: Request): string {
  // 1. Primary: Use Express-validated IP from trusted proxy
  if (req.ip) {
    return IpSecurityService.normalizeIp(req.ip);
  }

  // 2. Secondary: Direct socket remote address
  if (req.socket?.remoteAddress) {
    return IpSecurityService.normalizeIp(req.socket.remoteAddress);
  }

  // 3. Fallback for test harness mocks where req.ip and socket are not set
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim() !== '') {
    return IpSecurityService.normalizeIp(forwarded);
  }

  return '127.0.0.1';
}

/**
 * Express middleware to reject requests from blocked IP addresses.
 * Uses async checking for instant cross-instance consistency across Railway replicas.
 * Safely passes through health checks to maintain uptime monitoring.
 */
export async function ipBlockGuard(req: Request, res: Response, next: NextFunction): Promise<void> {
  // Always permit health checks
  if (req.path === '/health' || req.path === '/api/health') {
    return next();
  }

  const clientIp = getClientIp(req);
  const status = await IpSecurityService.isIpBlockedAsync(clientIp);

  if (status.blocked) {
    res.setHeader('Cache-Control', 'no-store');
    if (status.retryAfterSeconds) {
      res.setHeader('Retry-After', status.retryAfterSeconds.toString());
    }

    res.status(403).json({
      success: false,
      error: 'IP_BLOCKED',
      message: 'Your IP address has been temporarily blocked due to repeated failed authentication attempts.',
      reason: status.reason,
      blockedUntil: status.blockedUntil,
      isPermanent: status.isPermanent,
      retryAfterSeconds: status.retryAfterSeconds,
    });
    return;
  }

  next();
}
