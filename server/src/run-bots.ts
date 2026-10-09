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

// Import env and bots after resolving .env
import { env } from './config/env';
import { storeBot } from './bots/store-bot';
import { adminBot } from './bots/admin-bot';

function formatMaskedToken(token: string): string {
  const trimmed = token.trim();
  if (!trimmed) return '(none)';
  if (trimmed.length <= 8) return '***';
  return `${trimmed.slice(0, 6)}...***`;
}

async function main() {
  console.log('====================================================');
  console.log('🤖 UCHIRO STORE — TELEGRAM BOT SERVICE RUNNER');
  console.log(`🛒 Store Bot: @${env.STORE_BOT_USERNAME}`);
  console.log(`🛡️ Admin Bot: @${env.ADMIN_BOT_USERNAME}`);
  console.log(`🌐 Store WebApp URL: ${env.CLIENT_STORE_URL}`);
  console.log(`🌐 Admin WebApp URL: ${env.CLIENT_ADMIN_URL}`);
  console.log('====================================================');

  const storeToken = (process.env.STORE_BOT_TOKEN || env.STORE_BOT_TOKEN || '').trim();
  const adminToken = (process.env.ADMIN_BOT_TOKEN || env.ADMIN_BOT_TOKEN || '').trim();

  const hasStoreToken = Boolean(storeToken && !storeToken.startsWith('mock_'));
  const hasAdminToken = Boolean(adminToken && !adminToken.startsWith('mock_'));

  if (hasStoreToken) {
    console.log(`🛒 [STORE BOT] Loaded token: ${formatMaskedToken(storeToken)}`);
  } else {
    console.log('ℹ️ [STORE BOT] No valid STORE_BOT_TOKEN found in environment. Bot is in standby mode.');
  }

  if (hasAdminToken) {
    console.log(`🛡️ [ADMIN BOT] Loaded token: ${formatMaskedToken(adminToken)}`);
  } else {
    console.log('ℹ️ [ADMIN BOT] No valid ADMIN_BOT_TOKEN found in environment. Bot is in standby mode.');
  }

  try {
    await Promise.all([
      storeBot.startPolling(),
      adminBot.startPolling(),
    ]);

    console.log('🚀 Uchiro Store Bot Runner is active and listening for events.');
  } catch (error: any) {
    console.error('❌ Error initializing Telegram Bots:', error.message);
  }

  // Graceful shutdown handling
  const shutdown = (signal: string) => {
    console.log(`\n🛑 Received ${signal}. Stopping bots gracefully...`);
    try {
      storeBot.getBot()?.stop(signal);
      adminBot.getBot()?.stop(signal);
    } catch (err: any) {
      console.warn('Warning during bot stop:', err.message);
    }
    process.exit(0);
  };

  process.once('SIGINT', () => shutdown('SIGINT'));
  process.once('SIGTERM', () => shutdown('SIGTERM'));

  // Keep process alive if bots are in standby mode without active polling promises
  setInterval(() => {}, 60000);
}

main().catch((err) => {
  console.error('Fatal error in bot runner:', err);
  process.exit(1);
});
