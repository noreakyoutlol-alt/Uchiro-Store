import rateLimit from 'express-rate-limit';

export const generalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 120, // 120 requests per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again in a minute.',
    },
  },
});

export const apiRateLimiter = generalLimiter;

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
