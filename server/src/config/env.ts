import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';
import { z } from 'zod';

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

// Load .env from multiple candidate paths (project root, server root, cwd)
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

// Ensure test environment is never overridden by .env files
if (process.env.VITEST) {
  process.env.NODE_ENV = 'test';
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),

  // App URLs
  APP_URL: z.string().default('http://localhost:5000'),
  API_URL: z.string().default('http://localhost:5000'),
  PUBLIC_URL: z.string().default('http://localhost:5000'),
  WEBHOOK_URL: z.string().default('http://localhost:5000'),
  CLIENT_STORE_URL: z.string().default('http://localhost:3000'),
  CLIENT_ADMIN_URL: z.string().default('http://localhost:3001'),
  STORE_WEBAPP_URL: z.string().default('http://localhost:3000'),
  ADMIN_WEBAPP_URL: z.string().default('http://localhost:3001'),

  // CORS
  CORS_ORIGINS: z.string().default('http://localhost:3000,http://localhost:3001,https://web.telegram.org'),

  // Security & JWT
  JWT_SECRET: z.string().default('super_secure_uchiro_v3_jwt_secret_min_32_chars_long_key'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  ADMIN_JWT_SECRET: z.string().default('super_secure_uchiro_v3_admin_jwt_secret_min_32_chars_long'),
  ADMIN_JWT_EXPIRES_IN: z.string().default('24h'),
  ENCRYPTION_KEY: z.string().default('0123456780abcdef0123456780abcdef0123456780abcdef0123456780abcdef'),
  CREDENTIALS_ENCRYPTION_KEY: z.string().default('0123456780abcdef0123456780abcdef0123456780abcdef0123456780abcdef'),

  // Supabase (SUPABASE_SECRET_KEY / SUPABASE_SERVICE_ROLE_KEY for backend only; SUPABASE_PUBLISHABLE_KEY / SUPABASE_ANON_KEY for frontend)
  SUPABASE_URL: z.string().default('https://your-project-id.supabase.co'),
  SUPABASE_SECRET_KEY: z.string().default('your-secret-key'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('your-service-role-key'),
  SUPABASE_PUBLISHABLE_KEY: z.string().default('your-publishable-key'),
  SUPABASE_ANON_KEY: z.string().default('your-anon-key'),
  DATABASE_URL: z.string().optional(),

  // Store Bot (@UchiroStore_BOT - CUSTOMERS ONLY)
  STORE_BOT_TOKEN: z.string().default('').transform((val) => val.trim()),
  STORE_BOT_USERNAME: z
    .string()
    .default('UchiroStore_BOT')
    .transform((val) => val.replace(/^@/, '').trim()),
  TELEGRAM_CHANNEL_USERNAME: z.string().default('UchiroStore'),
  TELEGRAM_SUPPORT_USERNAME: z.string().default('UchiroSupport'),
  STORE_BOT_WEBHOOK_URL: z.string().default('http://localhost:5000/api/webhook/store-bot'),
  STORE_BOT_WEBHOOK_SECRET: z.string().default('uchiro_store_webhook_secret_key_v3'),

  // Admin Bot (@uchiro_v2_admin_bot - INTERNAL ADMINISTRATION ONLY)
  ADMIN_BOT_TOKEN: z.string().default('').transform((val) => val.trim()),
  ADMIN_BOT_USERNAME: z
    .string()
    .default('uchiro_v2_admin_bot')
    .transform((val) => val.replace(/^@/, '').trim()),
  ADMIN_BOT_WEBHOOK_URL: z.string().default('http://localhost:5000/api/webhook/admin-bot'),
  ADMIN_BOT_WEBHOOK_SECRET: z.string().default('uchiro_admin_webhook_secret_key_v3'),
  ADMIN_TELEGRAM_USER_IDS: z.string().default('').transform((val) =>
    val.split(',').map((id) => Number(id.trim())).filter((id) => !isNaN(id) && id > 0)
  ),
  ADMIN_TELEGRAM_IDS: z.string().default('').transform((val) =>
    val.split(',').map((id) => Number(id.trim())).filter((id) => !isNaN(id) && id > 0)
  ),

  // KHPay Payment Gateway (Streamlined: URL + API Key with Bearer Auth)
  KHPAY_BASE_URL: z.string().default('https://khpay.site/api/v1'),
  KHPAY_API_KEY: z.string().default('khpay_test_api_key_xxxxxxxxxxxxx'),
  KHPAY_API_URL: z.string().default('https://khpay.site/api/v1'),
  KHPAY_WEBHOOK_SECRET: z.string().default('khpay_webhook_signature_secret_v3'),
  KHPAY_CURRENCY: z.string().default('USD'),
  KHPAY_EXPIRY_MINUTES: z.string().default('10').transform(Number),
  KHPAY_TEST_MODE: z
    .string()
    .default(process.env.NODE_ENV === 'production' ? 'false' : 'true')
    .transform((val) => (process.env.NODE_ENV === 'production' ? false : val === 'true')),

  // Roblox Integration
  ROBLOX_COOKIE: z.string().optional(),
  ROBLOX_API_BASE: z.string().default('https://users.roblox.com'),
  ROBLOX_THUMBNAILS_API: z.string().default('https://thumbnails.roblox.com'),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().default('60000').transform(Number),
  RATE_LIMIT_MAX_REQUESTS: z.string().default('120').transform(Number),
  STRICT_TELEGRAM_AUTH: z.string().default('false').transform((val) => val === 'true'),
});

const defaultSupabaseSecret =
  process.env.SUPABASE_SECRET_KEY ||
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  'your-service-role-key';

const defaultSupabasePublishable =
  process.env.SUPABASE_PUBLISHABLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  'your-anon-key';

const adminIds =
  process.env.ADMIN_TELEGRAM_IDS ||
  process.env.ADMIN_TELEGRAM_USER_IDS ||
  '';

const publicUrl =
  process.env.PUBLIC_URL ||
  process.env.WEBHOOK_URL ||
  process.env.APP_URL ||
  process.env.API_URL ||
  'http://localhost:5000';

const webhookUrl =
  process.env.WEBHOOK_URL ||
  process.env.PUBLIC_URL ||
  process.env.APP_URL ||
  process.env.API_URL ||
  'http://localhost:5000';

const khpayBaseUrl =
  process.env.KHPAY_BASE_URL ||
  process.env.KHPAY_API_URL ||
  'https://khpay.site/api/v1';

// Automatically prefer process.env.PUBLIC_URL when configured with HTTPS for Telegram WebApp compatibility
const rawPublicUrl = (process.env.PUBLIC_URL || publicUrl || '').trim().replace(/\/+$/, '');
const isPublicHttps = (process.env.PUBLIC_URL || '').trim().startsWith('https://') || rawPublicUrl.startsWith('https://');

const resolvedStoreWebappUrl =
  (process.env.STORE_WEBAPP_URL && process.env.STORE_WEBAPP_URL.trim().startsWith('https://'))
    ? process.env.STORE_WEBAPP_URL.trim()
    : (process.env.CLIENT_STORE_URL && process.env.CLIENT_STORE_URL.trim().startsWith('https://'))
      ? process.env.CLIENT_STORE_URL.trim()
      : (isPublicHttps
          ? rawPublicUrl
          : (process.env.STORE_WEBAPP_URL || process.env.CLIENT_STORE_URL || 'http://localhost:3000'));

const resolvedAdminWebappUrl =
  (process.env.ADMIN_WEBAPP_URL && process.env.ADMIN_WEBAPP_URL.trim().startsWith('https://'))
    ? process.env.ADMIN_WEBAPP_URL.trim()
    : (process.env.CLIENT_ADMIN_URL && process.env.CLIENT_ADMIN_URL.trim().startsWith('https://'))
      ? process.env.CLIENT_ADMIN_URL.trim()
      : (isPublicHttps
          ? rawPublicUrl
          : (process.env.ADMIN_WEBAPP_URL || process.env.CLIENT_ADMIN_URL || 'http://localhost:3001'));

const parsed = envSchema.safeParse({
  ...process.env,
  // Alias mappings
  SUPABASE_SECRET_KEY: defaultSupabaseSecret,
  SUPABASE_SERVICE_ROLE_KEY: defaultSupabaseSecret,
  SUPABASE_PUBLISHABLE_KEY: defaultSupabasePublishable,
  SUPABASE_ANON_KEY: defaultSupabasePublishable,
  ADMIN_TELEGRAM_IDS: adminIds,
  ADMIN_TELEGRAM_USER_IDS: adminIds,
  STORE_BOT_TOKEN: process.env.STORE_BOT_TOKEN || process.env.TELEGRAM_STORE_BOT_TOKEN || '',
  ADMIN_BOT_TOKEN: process.env.ADMIN_BOT_TOKEN || process.env.TELEGRAM_ADMIN_BOT_TOKEN || '',
  PUBLIC_URL: publicUrl,
  WEBHOOK_URL: webhookUrl,
  APP_URL: publicUrl,
  API_URL: publicUrl,
  STORE_WEBAPP_URL: resolvedStoreWebappUrl,
  CLIENT_STORE_URL: resolvedStoreWebappUrl,
  ADMIN_WEBAPP_URL: resolvedAdminWebappUrl,
  CLIENT_ADMIN_URL: resolvedAdminWebappUrl,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY || process.env.CREDENTIALS_ENCRYPTION_KEY || '0123456780abcdef0123456780abcdef0123456780abcdef0123456780abcdef',
  CREDENTIALS_ENCRYPTION_KEY: process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.ENCRYPTION_KEY || '0123456780abcdef0123456780abcdef0123456780abcdef0123456780abcdef',
  KHPAY_BASE_URL: khpayBaseUrl,
  KHPAY_API_URL: khpayBaseUrl,
});

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.format());
  throw new Error('Invalid environment configuration');
}

export const env = parsed.data;
