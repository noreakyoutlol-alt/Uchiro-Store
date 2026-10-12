import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

// Startup check: Verify root .env vs .env.example
function ensureRootEnv(): void {
  const candidateRoots = [
    process.cwd(),
    path.resolve(process.cwd(), '..'),
    path.resolve(__dirname, '../../'),
    path.resolve(__dirname, '../'),
  ];

  let rootDir: string | null = null;
  for (const dir of candidateRoots) {
    if (fs.existsSync(path.resolve(dir, '.env.example'))) {
      rootDir = dir;
      break;
    }
  }

  if (rootDir) {
    const rootEnvPath = path.resolve(rootDir, '.env');
    const rootEnvExamplePath = path.resolve(rootDir, '.env.example');

    if (!fs.existsSync(rootEnvPath)) {
      if (fs.existsSync(rootEnvExamplePath)) {
        try {
          const exampleContent = fs.readFileSync(rootEnvExamplePath, 'utf8');
          const hasActiveSecrets = /JWT_SECRET|SUPABASE_URL|STORE_BOT_TOKEN/i.test(exampleContent);
          if (hasActiveSecrets) {
            console.warn('[CONFIG] CRITICAL: .env file missing! Please ensure variables are copied from .env.example into .env.');
            try {
              fs.copyFileSync(rootEnvExamplePath, rootEnvPath);
              console.log('[CONFIG] Automatically copied .env.example into .env');
            } catch {
              // Read-only filesystem fallback
            }
          }
        } catch {
          // Ignore read error
        }
      }
    }
  }
}

ensureRootEnv();

// Resolve .env from multiple candidate paths (project root, server directory, cwd)
const envCandidatePaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../.env'),
  path.resolve(__dirname, '../../.env'),
];

for (const candidate of envCandidatePaths) {
  if (fs.existsSync(candidate)) {
    dotenv.config({ path: candidate });
  }
}
dotenv.config();

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
import { requireAdminSession } from './auth/admin-session';
import { adminAuthRouter } from './routes/admin-auth.routes';
import { webhookSecretGuard, registerBotWebhooks } from './bots/webhook-security';
import { vaultRouter } from './routes/vault.routes';
import { dailyClaimRouter } from './routes/daily-claim';
import { botsRouter, webhookRouter } from './routes/bots.routes';
import { userRouter } from './routes/user.routes';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';
import { PaymentWorker } from './workers/payment.worker';
import { registerStaticRoutes } from './static-routes';

function formatMaskedToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '(none)';
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 6)}...***`;
}

const app = express();
app.set('trust proxy', 1);

// Security Headers & CORS
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
  })
);

const allowedOrigins = env.CORS_ORIGINS.split(',').map((o) => o.trim());
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || allowedOrigins.includes(origin) || allowedOrigins.includes('*') || origin.endsWith('.telegram.org')) {
        callback(null, true);
      } else {
        callback(null, true); // Permissive in dev to allow Telegram Mini App webview
      }
    },
    credentials: true,
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Global Rate Limiter
app.use('/api', apiRateLimiter);

// Health Checks
app.get('/health', (_req, res) => {
  res.status(200).json({
    status: 'ok',
    ok: true,
    service: 'uchiro-store-v3',
    timestamp: new Date().toISOString(),
  });
});

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    version: '3.0.0',
    service: 'Uchiro Store Backend',
    timestamp: new Date().toISOString(),
    environment: env.NODE_ENV,
    bots: {
      store_bot: env.STORE_BOT_USERNAME,
      admin_bot: env.ADMIN_BOT_USERNAME,
    },
  });
});

// 1. Admin API (/api/admin/*)
app.use('/api', adminAuthRouter);
app.use('/api/admin', requireAdminSession);
app.use('/api/admin', adminRouter);

// 2. Store API (/api/*) & Bot Webhooks
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
app.use('/api/user', userRouter);
app.use('/api/auth', authRouter);
app.use('/api', dailyClaimRouter);
app.use('/api/store', storeRouter);
app.use('/api', storeRouter); // Allow root store routes like /api/products, /api/categories
app.use('/api/orders', orderRouter);
app.use('/api/vault', vaultRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/gacha', gachaRouter);
app.use('/api/support', supportRouter);
app.use('/api/bots', botsRouter);

// 3. Static & SPA Routes (including stealth 404 trap and secret admin slug)
registerStaticRoutes(app);

// Central Error Handler
app.use(errorHandler);

// Start Server (only when not in test mode to allow parallel supertest runs)
let server: any = null;
const PORT = Number(process.env.PORT || env.PORT || 5000);
const HOST = '0.0.0.0';

const isTestEnv = env.NODE_ENV === 'test' || Boolean(process.env.VITEST) || process.env.NODE_ENV === 'test';

if (!isTestEnv) {
  server = app.listen(PORT, HOST, () => {
    console.log(`[API] Uchiro Store Backend running on http://0.0.0.0:${PORT}`);
    console.log(`====================================================`);
    console.log(`⚡ UCHIRO STORE API SERVER ONLINE`);
    console.log(`📡 URL: http://${HOST}:${PORT}`);
    console.log(`🛒 Store WebApp: ${env.CLIENT_STORE_URL}`);
    console.log(`🛡️ Admin WebApp: ${env.CLIENT_ADMIN_URL}`);
    console.log(`🤖 Store Bot: @${(env.STORE_BOT_USERNAME || 'UchiroStore_BOT').replace(/^@/, '')}`);
    console.log(`🤖 Admin Bot: @${(env.ADMIN_BOT_USERNAME || 'uchiro_v2_admin_bot').replace(/^@/, '')}`);
    console.log(`====================================================`);

    // Start polling in development if bots are configured
    if (env.NODE_ENV !== 'production') {
      const storeToken = (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim();
      const adminToken = (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();

      if (storeToken && !storeToken.startsWith('mock_')) {
        console.log(`🛒 [STORE BOT] Loaded token: ${formatMaskedToken(storeToken)}`);
      } else {
        console.log('ℹ️ [STORE BOT] No valid STORE_BOT_TOKEN found in environment. Bot is in standby mode.');
      }

      if (adminToken && !adminToken.startsWith('mock_')) {
        console.log(`🛡️ [ADMIN BOT] Loaded token: ${formatMaskedToken(adminToken)}`);
      } else {
        console.log('ℹ️ [ADMIN BOT] No valid ADMIN_BOT_TOKEN found in environment. Bot is in standby mode.');
      }

      storeBot.startPolling().catch(console.error);
      adminBot.startPolling().catch(console.error);
    } else {
      if (process.env.NODE_ENV === 'production') {
        registerBotWebhooks().catch((err: unknown) =>
          console.error('[webhook] registration failed:', err instanceof Error ? err.message : 'unknown error'),
        );
      }
    }

    // Start production background payment worker
    PaymentWorker.start(3000);
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

  // Graceful Shutdown
  process.on('SIGTERM', () => {
    console.log('SIGTERM received. Shutting down gracefully...');
    PaymentWorker.stop();
    server?.close(() => {
      process.exit(0);
    });
  });
}

export default app;
