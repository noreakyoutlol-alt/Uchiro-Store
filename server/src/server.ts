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
import { vaultRouter } from './routes/vault.routes';
import { dailyClaimRouter } from './routes/daily-claim';
import { botsRouter, webhookRouter } from './routes/bots.routes';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';
import { PaymentWorker } from './workers/payment.worker';
import { adminStaticGuard, ADMIN_404_HTML } from './middleware/admin-guard';

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

// Resolve frontend static paths safely
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

// ============================================================================
// ROUTE REGISTRATION ORDER (PREVENT SPA WILDCARD ROUTE COLLISION)
// 1. Admin API (/api/admin/*)
// 2. Admin Static & SPA (/admin/* guarded by strict 404 check)
// 3. Store API (/api/*)
// 4. Store Static & SPA (/* serving client-store/dist)
// ============================================================================

// 1. Admin API (/api/admin/*)
app.use('/api/admin', adminRouter);

// Explicit Static Route for Telegram Premium Emojis
const emojiCandidateDirs = [
  path.join(clientStoreDist, 'emojis'),
  path.join(clientAdminDist, 'emojis'),
  path.resolve(process.cwd(), 'client-store', 'public', 'emojis'),
  path.resolve(process.cwd(), 'client-admin', 'public', 'emojis'),
  path.resolve(__dirname, '..', '..', 'client-store', 'public', 'emojis'),
];
for (const dir of emojiCandidateDirs) {
  if (fs.existsSync(dir)) {
    console.log(`📁 [STATIC] Serving Emojis from: ${dir}`);
    app.use('/emojis', express.static(dir, { maxAge: '7d', immutable: true }));
    app.use('/admin/emojis', express.static(dir, { maxAge: '7d', immutable: true }));
    break;
  }
}

// 2. Admin Static & SPA (/admin/* guarded by strict 404 check)
app.use('/admin', adminStaticGuard);
if (fs.existsSync(clientAdminDist)) {
  console.log(`📁 [STATIC] Serving Admin frontend from: ${clientAdminDist}`);
  app.use('/admin', express.static(clientAdminDist, { index: false, redirect: false }));
  app.get(['/admin', '/admin/*'], (req, res, next) => {
    if (req.path.startsWith('/admin/emojis/')) return next();
    res.sendFile(path.join(clientAdminDist, 'index.html'));
  });
} else {
  app.get(['/admin', '/admin/*'], (_req, res) => {
    res.status(404).send(ADMIN_404_HTML);
  });
}

// 3. Store API (/api/*)
app.use('/api/webhook', webhookRouter);
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

// 4. Store Static & SPA (/* serving client-store/dist)
if (fs.existsSync(clientStoreDist)) {
  console.log(`📁 [STATIC] Serving Store frontend from: ${clientStoreDist}`);
  app.use(express.static(clientStoreDist, { index: false }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/') || req.path.startsWith('/emojis/') || req.path === '/health' || req.path === '/api/health') {
      return next();
    }
    res.sendFile(path.join(clientStoreDist, 'index.html'));
  });
}

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
      // In production: safely mount and register webhooks if PUBLIC_URL starts with https://
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
