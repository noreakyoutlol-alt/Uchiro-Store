import path from 'path';
import fs from 'fs';
import express from 'express';
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
import { botsRouter, webhookRouter } from './routes/bots.routes';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';
import { PaymentWorker } from './workers/payment.worker';
import { KHPayService } from './services/khpay.service';
import { checkSupabaseHealth } from './database/supabase';

const app = express();
app.set('trust proxy', 1);
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

// Mount API Routers
app.use('/api/webhook', webhookRouter);
app.use('/api/auth', authRouter);
app.use('/api/store', storeRouter);
app.use('/api', storeRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/gacha', gachaRouter);
app.use('/api/support', supportRouter);
app.use('/api/admin', adminRouter);
app.use('/api/bots', botsRouter);

// Resolve frontend paths safely
function findDistPath(subDir: string): string {
  const candidates = [
    path.resolve(process.cwd(), subDir, 'dist'),
    path.resolve(__dirname, '..', '..', subDir, 'dist'),
    path.resolve(__dirname, '..', subDir, 'dist'),
    path.resolve(process.cwd(), 'dist', subDir),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0];
}

const clientStoreDist = findDistPath('client-store');
const clientAdminDist = findDistPath('client-admin');

// 1. Admin SPA Routing (Requirement Section 4 & 5)
// Serves /admin and /admin/* returning Admin index.html
if (fs.existsSync(clientAdminDist)) {
  console.log(`📁 [PRODUCTION] Serving Admin frontend from: ${clientAdminDist}`);
  app.use('/admin', express.static(clientAdminDist, { index: false, redirect: false }));
  app.get(['/admin', '/admin/*'], (_req, res) => {
    res.sendFile(path.join(clientAdminDist, 'index.html'));
  });
} else {
  console.warn(`⚠️ [PRODUCTION] Admin dist folder not found at: ${clientAdminDist}. Build with: npm run build`);
}

// 2. Store SPA Routing (Requirement Section 4 & 5)
// Serves / and all remaining routes returning Store index.html
if (fs.existsSync(clientStoreDist)) {
  console.log(`📁 [PRODUCTION] Serving Store frontend from: ${clientStoreDist}`);
  app.use(express.static(clientStoreDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path === '/health') {
      return next();
    }
    res.sendFile(path.join(clientStoreDist, 'index.html'));
  });
} else {
  console.warn(`⚠️ [PRODUCTION] Store dist folder not found at: ${clientStoreDist}. Build with: npm run build`);
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
      storeBot.startPolling().catch((err) => {
        console.warn('Store bot polling notice:', err.message);
      });
      adminBot.startPolling().catch((err) => {
        console.warn('Admin bot polling notice:', err.message);
      });
    } else {
      const publicUrl = (process.env.PUBLIC_URL || env.PUBLIC_URL || '').trim();
      if (publicUrl.startsWith('https://')) {
        const cleanUrl = publicUrl.replace(/\/+$/, '');
        console.log(`🤖 [PRODUCTION] Registering bot webhooks via ${cleanUrl}...`);
        storeBot.setWebhook(
          `${cleanUrl}/api/webhook/store-bot`,
          env.STORE_BOT_WEBHOOK_SECRET
        ).then((res) => {
          if (res.success) {
            console.log(`✅ [STORE BOT] Webhook registered at ${cleanUrl}/api/webhook/store-bot`);
          } else {
            console.warn(`⚠️ [STORE BOT] Webhook registration notice:`, res.message);
          }
        }).catch((err) => {
          console.warn(`⚠️ [STORE BOT] Webhook registration error:`, err.message);
        });

        adminBot.setWebhook(
          `${cleanUrl}/api/webhook/admin-bot`,
          env.ADMIN_BOT_WEBHOOK_SECRET
        ).then((res) => {
          if (res.success) {
            console.log(`✅ [ADMIN BOT] Webhook registered at ${cleanUrl}/api/webhook/admin-bot`);
          } else {
            console.warn(`⚠️ [ADMIN BOT] Webhook registration notice:`, res.message);
          }
        }).catch((err) => {
          console.warn(`⚠️ [ADMIN BOT] Webhook registration error:`, err.message);
        });
      } else {
        console.log('🤖 [PRODUCTION] Bots ready for webhook updates at /api/webhook/store-bot and /api/webhook/admin-bot');
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
