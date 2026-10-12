import path from 'path';
import fs from 'fs';
import express from 'express';
import compression from 'compression';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { errorHandler } from './middleware/error-handler';
import { apiRateLimiter } from './middleware/rate-limiter';
import { authRouter } from './routes/auth.routes';
import { storeRouter } from './routes/store.routes';
import { orderRouter } from './routes/order.routes';
import { paymentRouter } from './routes/payment.routes';
import { gachaRouter } from './routes/gacha.routes';
import { supportRouter } from './routes/support.routes';
import { adminRouter } from './routes/admin.routes';
import { requireAdminSession } from './auth/admin-session';
import { adminAuthRouter } from './routes/admin-auth.routes';
import { webhookSecretGuard, registerBotWebhooks } from './bots/webhook-security';
import { dailyClaimRouter } from './routes/daily-claim';
import { botsRouter, webhookRouter } from './routes/bots.routes';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';
import { PaymentWorker } from './workers/payment.worker';
import { KHPayService } from './services/khpay.service';
import { checkSupabaseHealth } from './database/supabase';
import { registerStaticRoutes } from './static-routes';

const app = express();
app.set('trust proxy', 1);
app.use(compression());
const PORT = Number(process.env.PORT || env.PORT || 5000);
const HOST = '0.0.0.0';

// Security Headers (configured to allow Telegram WebApp, Tailwind, Lucide, QR codes & images)
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  })
);

// Flexible CORS for WebApp inside Telegram
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);

app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true, limit: '20mb' }));

// Health Check Endpoints (Requirement Section 4 & 7)
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    ok: true,
    service: 'uchiro-store',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', async (_req, res) => {
  const supabaseStatus = await checkSupabaseHealth();
  const paymentWorkerStatus = PaymentWorker.getStatus();
  const khpayStatus = KHPayService.getStatus();

  res.status(200).json({
    status: 'ok',
    ok: true,
    version: '3.0.0',
    service: 'uchiro-store',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    khpay: khpayStatus,
    payment_worker: paymentWorkerStatus,
    supabase: supabaseStatus,
    bots: {
      store_bot: env.STORE_BOT_USERNAME,
      admin_bot: env.ADMIN_BOT_USERNAME,
      store_webhook_configured: Boolean(env.STORE_BOT_WEBHOOK_URL),
      admin_webhook_configured: Boolean(env.ADMIN_BOT_WEBHOOK_URL),
    },
  });
});

// Rate limiter for API
app.use('/api', apiRateLimiter);

// 1. Admin API (/api/admin/*)
app.use('/api', adminAuthRouter);
app.use('/api/admin', requireAdminSession);
app.use('/api/admin', adminRouter);

// 2. Store API (/api/*)
app.post(
  '/api/webhook/store-bot',
  webhookSecretGuard('STORE_WEBHOOK_SECRET'),
  (req, res, next) => {
    if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
      res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
      return;
    }
    next();
  },
  storeBot.webhookCallback('/api/webhook/store-bot')
);
if (process.env.ADMIN_BOT_TOKEN && process.env.ADMIN_BOT_TOKEN.trim()) {
  app.post(
    '/api/webhook/admin-bot',
    webhookSecretGuard('ADMIN_WEBHOOK_SECRET'),
    (req, res, next) => {
      if (!req.body || typeof req.body !== 'object' || Object.keys(req.body).length === 0) {
        res.status(200).json({ ok: true, message: 'Empty or invalid update body ignored' });
        return;
      }
      next();
    },
    adminBot.webhookCallback('/api/webhook/admin-bot')
  );
} else {
  console.error('[webhook] ADMIN_BOT_TOKEN is missing, admin webhook not mounted');
}
app.use('/api/webhook', webhookRouter);
app.use('/api/auth', authRouter);
app.use('/api', dailyClaimRouter);
app.use('/api/store', storeRouter);
app.use('/api', storeRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/gacha', gachaRouter);
app.use('/api/support', supportRouter);
app.use('/api/bots', botsRouter);

// Static & SPA Routes (including stealth 404 trap and secret admin slug)
registerStaticRoutes(app);

// Helper: Detect Telegram Mini App Context (re-exported for backwards compatibility)
export function isTelegramMiniApp(req: express.Request): boolean {
  const rawUrl = req.originalUrl || req.url || '';
  const query = (req.query || {}) as Record<string, any>;
  const hasTgQuery =
    Boolean(query.tgWebAppData) ||
    Boolean(query.tgWebAppVersion) ||
    Boolean(query.tgWebAppPlatform) ||
    Boolean(query.initData) ||
    rawUrl.includes('tgWebAppData') ||
    rawUrl.includes('tgWebAppVersion') ||
    rawUrl.includes('tgWebAppPlatform') ||
    rawUrl.includes('initData');

  const userAgent = (req.headers['user-agent'] || '').toLowerCase();
  const hasTgUA = userAgent.includes('telegram');
  const hasTgHeader = Boolean(
    req.headers['x-telegram-init-data'] ||
    req.headers['x-telegram-bot-api-secret-token']
  );

  const referer = ((req.headers['referer'] || req.headers['referrer'] || '') as string).toLowerCase();
  const hasTgReferer =
    referer.includes('tgwebappdata') ||
    referer.includes('tgwebappversion') ||
    referer.includes('tgwebappplatform') ||
    referer.includes('telegram.org');

  const hasAdminSession = Boolean(
    req.headers.cookie?.includes('uchiro_admin_token') ||
    req.headers.authorization?.startsWith('Bearer ') ||
    query.admin_secret ||
    query.adminKey ||
    req.headers['x-admin-key']
  );

  return hasTgQuery || hasTgUA || hasTgHeader || hasTgReferer || hasAdminSession;
}

// Central Error Handler
app.use(errorHandler);

// Start Single Unified Production Server
let server: any = null;
if (process.env.NODE_ENV !== 'test') {
  server = app.listen(PORT, HOST, () => {
    console.log(`[API] Uchiro Store Backend running on http://0.0.0.0:${PORT}`);
    console.log('====================================================');
    console.log(`🚀 UCHIRO STORE — PRODUCTION UNIFIED RUNNER`);
    console.log(`📡 URL: http://${HOST}:${PORT}`);
    console.log(`🛒 Store Mini App: http://${HOST}:${PORT}/`);
    console.log(`🛡️ Admin Portal: http://${HOST}:${PORT}/admin/`);
    console.log(`❤️ Health Check: http://${HOST}:${PORT}/health`);
    console.log(`🤖 Store Bot: @${(env.STORE_BOT_USERNAME || 'UchiroStore_BOT').replace(/^@/, '')}`);
    console.log(`🤖 Admin Bot: @${(env.ADMIN_BOT_USERNAME || 'uchiro_v2_admin_bot').replace(/^@/, '')}`);
    console.log('====================================================');

    // Start background payment worker
    PaymentWorker.start(3000);

    // Initialize Telegram Bots
    if (env.NODE_ENV !== 'production') {
      storeBot.startPolling().catch((err: any) => {
        console.warn('Store bot polling notice:', err.message);
      });
      adminBot.startPolling().catch((err: any) => {
        console.warn('Admin bot polling notice:', err.message);
      });
    } else {
      if (process.env.NODE_ENV === 'production') {
        registerBotWebhooks().catch((err: unknown) =>
          console.error('[webhook] registration failed:', err instanceof Error ? err.message : 'unknown error'),
        );
      }
    }
  });

  server.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[API] CRITICAL: Port ${PORT} is already in use by another process.`);
      console.error(`[API] Please terminate the existing process or set PORT=5001 in your .env`);
      process.exit(1);
    } else {
      console.error('[API] Unexpected server error:', err);
    }
  });
}

// Graceful Shutdown
const shutdown = () => {
  console.log('🛑 [PRODUCTION] Shutting down service gracefully...');
  PaymentWorker.stop();
  if (server) {
    server.close(() => {
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export default app;
