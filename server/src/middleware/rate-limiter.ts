import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 300, // 300 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    const path = req.path || req.originalUrl || '';
    if (path.includes('/health')) return true;
    if (path.includes('/webhook')) return true;
    if (path.includes('/payment/') && path.includes('/status')) return true;
    return false;
  },
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again in a minute.',
    },
  },
});

export const apiRateLimiter = generalLimiter;

export const paymentPollingLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // max 120 status checks per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'POLLING_RATE_LIMIT_EXCEEDED',
      message: 'Payment status checked too frequently. Please wait a moment.',
    },
  },
});

export const adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // max 15 attempts per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: 'TOO_MANY_LOGIN_ATTEMPTS',
    message: 'Too many admin PIN verification attempts from this IP. Please wait before retrying.',
  },
});

export const spinLimiter = rateLimit({
  windowMs: 10 * 1000, // 10 seconds
  max: 5, // max 5 spin attempts per 10s
  message: {
    success: false,
    error: {
      code: 'SPIN_RATE_LIMIT',
      message: 'Please wait before spinning again.',
    },
  },
});

export const orderCreationLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 30, // max 30 order creations per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',
  message: {
    success: false,
    error: {
      code: 'ORDER_RATE_LIMIT_EXCEEDED',
      message: 'Too many checkout attempts. Please wait a moment before trying again.',
    },
  },
});
