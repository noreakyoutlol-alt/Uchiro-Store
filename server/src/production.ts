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
import { botsRouter, webhookRouter } from './routes/bots.routes';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';
import { PaymentWorker } from './workers/payment.worker';
import { KHPayService } from './services/khpay.service';
import { checkSupabaseHealth } from './database/supabase';
import { adminStaticGuard, ADMIN_404_HTML } from './middleware/admin-guard';

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
app.use('/api/admin', adminRouter);

// 2. Store API (/api/*)
app.use('/api/webhook', webhookRouter);
app.use('/api/auth', authRouter);
app.use('/api/store', storeRouter);
app.use('/api', storeRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/gacha', gachaRouter);
app.use('/api/support', supportRouter);
app.use('/api/bots', botsRouter);

// Resolve frontend paths dynamically to guarantee Railway production reliability
const adminDistCandidates = [
  path.resolve(process.cwd(), 'client-admin/dist'),
  path.resolve(process.cwd(), '../client-admin/dist'),
  path.resolve(__dirname, '../../client-admin/dist'),
  path.resolve(__dirname, '../../../client-admin/dist'),
];
const adminDist = adminDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html'))) || adminDistCandidates[0];

const storeDistCandidates = [
  path.resolve(process.cwd(), 'client-store/dist'),
  path.resolve(process.cwd(), '../client-store/dist'),
  path.resolve(__dirname, '../../client-store/dist'),
  path.resolve(__dirname, '../../../client-store/dist'),
];
const storeDist = storeDistCandidates.find(p => fs.existsSync(path.join(p, 'index.html'))) || storeDistCandidates[0];

console.log(`[Railway Verify] Admin dist index.html exists: ${fs.existsSync(path.join(adminDist, 'index.html'))} at ${adminDist}`);
console.log(`[Railway Verify] Store dist index.html exists: ${fs.existsSync(path.join(storeDist, 'index.html'))} at ${storeDist}`);

// Helper: Detect Telegram Mini App Context
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

// Mount static emojis
const storeEmojiCandidates = [
  path.resolve(process.cwd(), 'client-store/public/emojis'),
  path.resolve(process.cwd(), '../client-store/public/emojis'),
  path.resolve(__dirname, '../../client-store/public/emojis'),
  path.resolve(__dirname, '../../../client-store/public/emojis'),
];
const storeEmojiDir = storeEmojiCandidates.find(p => fs.existsSync(p)) || storeEmojiCandidates[0];
if (fs.existsSync(storeEmojiDir)) {
  app.use('/emojis', express.static(storeEmojiDir, { maxAge: '7d', immutable: true }));
  app.use('/admin/emojis', express.static(storeEmojiDir, { maxAge: '7d', immutable: true }));
}

// Cloaked Admin Portal Middleware
app.use('/admin', (req, res, next) => {
  if (req.path.startsWith('/emojis')) return next();
  // 1. If public browser: Return hard 404
  if (!isTelegramMiniApp(req)) {
    res.status(404);
    const storeIndex = path.join(storeDist, 'index.html');
    if (fs.existsSync(storeIndex)) return res.sendFile(storeIndex);
    return res.send('Cannot GET ' + req.originalUrl);
  }
  next();
});

// Serve Admin static assets (JS/CSS) under /admin when allowed
app.use(
  '/admin',
  express.static(adminDist, {
    index: false,
    redirect: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// Cloaked Admin SPA route
app.all(['/admin', '/admin/*'], (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path.startsWith('/admin/emojis')) {
    return next();
  }

  // 1. PUBLIC WEB ACCESS: Cloak with 404
  if (!isTelegramMiniApp(req)) {
    res.status(404);
    const storeIndex = path.join(storeDist, 'index.html');
    if (fs.existsSync(storeIndex)) {
      return res.sendFile(storeIndex);
    }
    return res.send('Cannot GET ' + req.path);
  }

  // 2. TELEGRAM MINI APP ACCESS: Serve Admin Portal
  const adminIndex = path.join(adminDist, 'index.html');
  if (fs.existsSync(adminIndex)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(adminIndex);
  }
  return res.status(404).send('Admin build not found');
});

// Mount Store static assets
app.use(
  express.static(storeDist, {
    index: false,
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, filePath) => {
      if (filePath.endsWith('.html')) {
        res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      }
    },
  })
);

// Store SPA Fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api') || req.path.startsWith('/webhook') || req.path.startsWith('/admin')) {
    return next();
  }
  const storeIndex = path.join(storeDist, 'index.html');
  if (fs.existsSync(storeIndex)) {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    return res.sendFile(storeIndex);
  }
  return res.status(404).send('Store SPA build not found');
});

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
