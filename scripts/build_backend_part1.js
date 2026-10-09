const fs = require('fs');
const path = require('path');

function writeFile(relativePath, content) {
    const fullPath = path.resolve(process.cwd(), relativePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content.trim() + '\n', 'utf8');
    console.log(`Created: ${relativePath}`);
}

// 1. server/src/types/index.ts
writeFile('server/src/types/index.ts', `
export interface TelegramUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  language_code: string;
  is_bot: boolean;
  is_blocked?: boolean;
  created_at: string;
  updated_at: string;
}

export interface Profile {
  id: string;
  telegram_id: number;
  points: number;
  total_spent: number;
  total_orders: number;
  gacha_spins_count: number;
  referral_code: string | null;
  referred_by: number | null;
  created_at: string;
  updated_at: string;
}

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type DeliveryMode = 'auto_account' | 'digital_code' | 'manual_service';

export interface Product {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  price: number;
  compare_at_price: number | null;
  stock: number;
  is_active: boolean;
  is_draft: boolean;
  is_featured: boolean;
  delivery_mode: DeliveryMode;
  warranty_days: number;
  requires_roblox_username: boolean;
  badge: string | null;
  specifications: Record<string, any>;
  views_count: number;
  sales_count: number;
  created_at: string;
  updated_at: string;
  media?: ProductMedia[];
  category?: Category;
}

export interface ProductMedia {
  id: string;
  product_id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProductVariant {
  id: string;
  product_id: string;
  name: string;
  price: number;
  stock: number;
  sku: string | null;
  created_at: string;
}

export type InventoryItemType = 'account' | 'code';
export type InventoryItemStatus = 'available' | 'reserved' | 'consumed';

export interface InventoryItem {
  id: string;
  product_id: string;
  item_type: InventoryItemType;
  account_username: string | null;
  encrypted_account_password: string | null;
  encrypted_account_2fa: string | null;
  digital_code: string | null;
  notes: string | null;
  status: InventoryItemStatus;
  reserved_until: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export type OrderStatus =
  | 'draft'
  | 'pending_payment'
  | 'payment_processing'
  | 'paid'
  | 'fulfillment'
  | 'delivered'
  | 'completed'
  | 'cancelled'
  | 'expired'
  | 'failed';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  telegram_id: number;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  coupon_id: string | null;
  roblox_username: string | null;
  delivery_mode: DeliveryMode;
  delivery_credentials: Record<string, any>[] | null;
  fulfillment_notes: string | null;
  delivered_at: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  items?: OrderItem[];
  payment?: Payment;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  price: number;
  quantity: number;
  delivery_data: Record<string, any> | null;
  created_at: string;
}

export type PaymentStatus = 'pending' | 'paid' | 'expired' | 'failed';

export interface Payment {
  id: string;
  order_id: string;
  customer_id: string;
  provider: string;
  currency: string;
  amount: number;
  qr_payload: string | null;
  qr_image_url: string | null;
  md5_hash: string | null;
  bakong_deep_link: string | null;
  aba_deep_link: string | null;
  status: PaymentStatus;
  transaction_reference: string | null;
  expires_at: string;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount: number | null;
  usage_limit: number | null;
  times_used: number;
  per_user_limit: number;
  expires_at: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type GachaRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHICAL';
export type GachaDeliveryMode = 'instant_code' | 'manual_review';

export interface GachaPool {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  spin_price: number;
  is_active: boolean;
  banner_url: string | null;
  total_spins: number;
  created_at: string;
  updated_at: string;
  prizes?: GachaPrize[];
}

export interface GachaPrize {
  id: string;
  pool_id: string;
  title: string;
  description: string | null;
  rarity: GachaRarity;
  probability_percent: number;
  delivery_mode: GachaDeliveryMode;
  reward_type: 'code' | 'points' | 'item';
  reward_data: Record<string, any>;
  icon_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export interface GachaSpin {
  id: string;
  customer_id: string;
  telegram_id: number;
  pool_id: string;
  prize_id: string;
  rarity: GachaRarity;
  cost: number;
  idempotency_key: string | null;
  created_at: string;
  prize?: GachaPrize;
}

export type GachaClaimStatus = 'claimed' | 'pending_review' | 'fulfilled' | 'rejected';

export interface GachaClaim {
  id: string;
  spin_id: string;
  customer_id: string;
  prize_id: string;
  status: GachaClaimStatus;
  delivery_data: Record<string, any> | null;
  admin_notes: string | null;
  claimed_at: string;
  resolved_at: string | null;
  prize?: GachaPrize;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  referral_code: string;
  converted_at: string | null;
  reward_status: 'pending' | 'rewarded';
  created_at: string;
}

export interface NotificationItem {
  id: string;
  recipient_telegram_id: number;
  type: string;
  title: string;
  message: string;
  metadata: Record<string, any>;
  is_read: boolean;
  sent_via_bot: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  telegram_id: number;
  username: string | null;
  display_name: string;
  role: 'superadmin' | 'admin' | 'moderator';
  is_active: boolean;
  last_login_at: string | null;
  created_at: string;
}

export interface SupportTicket {
  id: string;
  ticket_number: string;
  customer_id: string;
  telegram_id: number;
  order_id: string | null;
  category: 'order' | 'payment' | 'delivery' | 'general';
  subject: string;
  message: string;
  status: 'open' | 'in_progress' | 'resolved' | 'closed';
  admin_reply: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface RobloxProfile {
  id: number;
  name: string;
  displayName: string;
  avatarUrl: string | null;
  isVerified: boolean;
}

export interface TelegramAuthSession {
  user: TelegramUser;
  profile: Profile;
  token: string;
}

export interface AdminAuthSession {
  admin: AdminUser;
  token: string;
}
`);

// 2. server/src/config/env.ts
writeFile('server/src/config/env.ts', `
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('5000').transform(Number),
  APP_URL: z.string().default('http://localhost:5000'),
  CLIENT_STORE_URL: z.string().default('http://localhost:3000'),
  CLIENT_ADMIN_URL: z.string().default('http://localhost:3001'),
  
  JWT_SECRET: z.string().default('uchiro_v3_super_secret_jwt_key_2025_secure'),
  ENCRYPTION_KEY: z.string().default('uchiro_v3_encryption_key_32_bytes_len!'),
  
  SUPABASE_URL: z.string().default('https://your-project.supabase.co'),
  SUPABASE_SERVICE_ROLE_KEY: z.string().default('your-service-role-key'),
  SUPABASE_ANON_KEY: z.string().default('your-anon-key'),
  
  TELEGRAM_STORE_BOT_TOKEN: z.string().default(''),
  TELEGRAM_ADMIN_BOT_TOKEN: z.string().default(''),
  TELEGRAM_CHANNEL_USERNAME: z.string().default('@UchiroStore'),
  ADMIN_TELEGRAM_USER_IDS: z.string().default('123456789').transform((val) => 
    val.split(',').map((id) => Number(id.trim())).filter((id) => !isNaN(id))
  ),
  
  KHPAY_API_URL: z.string().default('https://api.khpay.io'),
  KHPAY_API_KEY: z.string().default('demo_khpay_api_key'),
  KHPAY_MERCHANT_ID: z.string().default('uchiro_store'),
  KHPAY_SECRET: z.string().default('khpay_secret_key_demo'),
  
  ROBLOX_COOKIE: z.string().optional(),
});

export const env = envSchema.parse(process.env);
`);

// 3. server/src/security/encryption.ts
writeFile('server/src/security/encryption.ts', `
import crypto from 'crypto';
import { env } from '../config/env';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getKey(): Buffer {
  return crypto.createHash('sha256').update(env.ENCRYPTION_KEY).digest();
}

export function encrypt(text: string): string {
  if (!text) return '';
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

export function decrypt(ciphertextBase64: string): string {
  if (!ciphertextBase64) return '';
  try {
    const data = Buffer.from(ciphertextBase64, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const text = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, getKey(), iv);
    decipher.setAuthTag(tag);
    return decipher.update(text) + decipher.final('utf8');
  } catch (err) {
    console.error('Decryption failed:', err);
    return '[Encrypted Data]';
  }
}
`);

// 4. server/src/security/telegram-validator.ts
writeFile('server/src/security/telegram-validator.ts', `
import crypto from 'crypto';

export interface TelegramParsedInitData {
  query_id?: string;
  user?: {
    id: number;
    first_name: string;
    last_name?: string;
    username?: string;
    language_code?: string;
    is_premium?: boolean;
    photo_url?: string;
  };
  auth_date: number;
  hash: string;
  start_param?: string;
  [key: string]: any;
}

export function validateTelegramInitData(
  initDataRaw: string,
  botToken: string,
  maxAgeSeconds: number = 86400
): { isValid: boolean; data?: TelegramParsedInitData; error?: string } {
  if (!initDataRaw) {
    return { isValid: false, error: 'INIT_DATA_MISSING' };
  }

  // Development bypass helper if token is demo
  if (botToken === '' || botToken.startsWith('mock_')) {
    try {
      const params = new URLSearchParams(initDataRaw);
      const userStr = params.get('user');
      const user = userStr ? JSON.parse(userStr) : { id: 123456789, first_name: 'Dev User' };
      return {
        isValid: true,
        data: {
          user,
          auth_date: Math.floor(Date.now() / 1000),
          hash: 'mock_hash',
          start_param: params.get('start_param') || undefined,
        },
      };
    } catch {
      return { isValid: true, data: { user: { id: 123456789, first_name: 'Dev User' }, auth_date: 0, hash: '' } };
    }
  }

  try {
    const params = new URLSearchParams(initDataRaw);
    const hash = params.get('hash');
    if (!hash) {
      return { isValid: false, error: 'HASH_MISSING' };
    }

    params.delete('hash');

    // Sort parameters alphabetically
    const entries = Array.from(params.entries()).sort(([a], [b]) => a.localeCompare(b));
    const dataCheckString = entries.map(([key, value]) => \`\${key}=\${value}\`).join('\\n');

    // Telegram HMAC calculation:
    // secret_key = HMAC_SHA256("WebAppData", botToken)
    // calculated_hash = HMAC_SHA256(secret_key, dataCheckString)
    const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
    const calculatedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

    if (calculatedHash !== hash) {
      return { isValid: false, error: 'HASH_MISMATCH' };
    }

    const authDateStr = params.get('auth_date');
    const authDate = authDateStr ? parseInt(authDateStr, 10) : 0;
    const now = Math.floor(Date.now() / 1000);

    if (maxAgeSeconds > 0 && now - authDate > maxAgeSeconds) {
      return { isValid: false, error: 'AUTH_DATE_EXPIRED' };
    }

    const userRaw = params.get('user');
    const user = userRaw ? JSON.parse(userRaw) : undefined;

    return {
      isValid: true,
      data: {
        query_id: params.get('query_id') || undefined,
        user,
        auth_date: authDate,
        hash,
        start_param: params.get('start_param') || undefined,
      },
    };
  } catch (err: any) {
    return { isValid: false, error: err.message || 'VALIDATION_EXCEPTION' };
  }
}
`);

// 5. server/src/middleware/error-handler.ts
writeFile('server/src/middleware/error-handler.ts', `
import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  statusCode: number;
  code: string;

  constructor(message: string, statusCode: number = 400, code: string = 'BAD_REQUEST') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export function errorHandler(
  err: any,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_SERVER_ERROR';
  const message = err.message || 'An unexpected error occurred.';

  if (statusCode === 500) {
    console.error('Unhandled Server Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message,
    },
  });
}
`);

// 6. server/src/middleware/rate-limiter.ts
writeFile('server/src/middleware/rate-limiter.ts', `
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
`);

// 7. server/src/middleware/auth.ts
writeFile('server/src/middleware/auth.ts', `
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env';
import { AppError } from './error-handler';

export interface AuthenticatedUserPayload {
  telegram_id: number;
  user_id: string;
  username: string | null;
  role?: string;
}

export interface RequestWithAuth extends Request {
  user?: AuthenticatedUserPayload;
  admin?: AuthenticatedUserPayload;
}

export function requireTelegramAuth(req: RequestWithAuth, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Authorization token required', 401, 'UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUserPayload;
    req.user = decoded;
    next();
  } catch {
    throw new AppError('Invalid or expired authentication token', 401, 'INVALID_TOKEN');
  }
}

export function requireAdminAuth(req: RequestWithAuth, _res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new AppError('Admin authorization token required', 401, 'ADMIN_UNAUTHORIZED');
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUserPayload;
    
    // Check role or authorized admin list
    const isApprovedAdmin = 
      decoded.role === 'admin' || 
      decoded.role === 'superadmin' || 
      env.ADMIN_TELEGRAM_USER_IDS.includes(decoded.telegram_id);

    if (!isApprovedAdmin) {
      throw new AppError('Forbidden: Access denied to admin portal', 403, 'FORBIDDEN_NOT_ADMIN');
    }

    req.admin = decoded;
    next();
  } catch (err: any) {
    if (err instanceof AppError) throw err;
    throw new AppError('Invalid or expired admin authentication token', 401, 'INVALID_ADMIN_TOKEN');
  }
}
`);

console.log("Core backend modules generated.");
