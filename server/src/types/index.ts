export interface TelegramUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  language_code: string;
  language_preference?: 'km' | 'en' | string | null;
  is_bot: boolean;
  is_blocked?: boolean;
  created_at: string;
  updated_at: string;
  points?: number;
  reward_points?: number;
  last_daily_claim_at?: string | null;
}

export interface Profile {
  id: string;
  telegram_id: number;
  points: number;
  loyalty_points?: number;
  reward_points?: number;
  last_daily_claim_at?: string | null;
  gacha_tickets: number;
  total_spent: number;
  total_orders: number;
  gacha_spins_count: number;
  last_gacha_roll_at?: string | null;
  next_gacha_roll_at?: string | null;
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
  stock_count?: number;
  products_count?: number;
  created_at: string;
  updated_at: string;
}

export type DeliveryMode = 'auto_account' | 'manual_service' | 'trade_item' | 'digital_code';
export type ProductType = 'account' | 'gift' | 'trade' | 'digital_code';

export interface Product {
  id: string;
  category_id: string;
  title: string;
  slug: string;
  description: string | null;
  short_description: string | null;
  product_type?: ProductType;
  price: number;
  compare_at_price: number | null;
  stock: number;
  stock_count?: number;
  is_available?: boolean;
  is_active: boolean;
  is_draft: boolean;
  is_featured: boolean;
  delivery_mode: DeliveryMode;
  warranty_days: number;
  warranty_notes?: string | null;
  require_email_protection?: boolean;
  require_authenticator_protection?: boolean;
  authenticator_enabled?: boolean;
  requires_roblox_username: boolean;
  requires_roblox_verification?: boolean;
  badge: string | null;
  specifications: Record<string, any>;
  video_url?: string | null;
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
export type InventoryItemStatus = 'available' | 'reserved' | 'consumed' | 'sold';

export interface InventoryItem {
  id: string;
  product_id: string;
  item_type: InventoryItemType;
  account_username: string | null;
  encrypted_account_password: string | null;
  encrypted_account_2fa: string | null;
  authenticator_enabled?: boolean;
  authenticator_secret_ciphertext?: string | null;
  authenticator_algorithm?: string;
  authenticator_digits?: number;
  authenticator_period?: number;
  email?: string | null;
  encrypted_email_password?: string | null;
  encrypted_backup_codes?: string | null;
  digital_code: string | null;
  notes: string | null;
  status: InventoryItemStatus;
  is_sold?: boolean;
  reserved_until: string | null;
  order_id: string | null;
  created_at: string;
  updated_at: string;
}

export type DeliveryAccessAction =
  | 'delivery_viewed'
  | 'totp_requested'
  | 'totp_refresh'
  | 'authenticator_qr_requested';

export interface DeliveryAccessLog {
  id: string;
  order_id: string;
  telegram_id: number;
  customer_id?: string | null;
  action: DeliveryAccessAction;
  success: boolean;
  ip_address?: string | null;
  user_agent?: string | null;
  failure_reason?: string | null;
  created_at: string;
}

export interface CustomerDeliveryResponse {
  username: string;
  password: string;
  authenticator: {
    available: boolean;
    manual_setup_key?: string | null;
    qr?: string | null;
    otpauth_url?: string | null;
    code?: string | null;
    expiresAt?: string | null;
    serverTime?: string | null;
    period?: number;
    secondsRemaining?: number;
  };
  warranty_days?: number;
  warranty_status?: string;
  warranty_expires_at?: string | null;
}

export interface OrderReceipt {
  order_id: string;
  order_number: string;
  store_name: string;
  product_name: string;
  product_type: string;
  amount: number;
  currency: string;
  payment_method: string;
  payment_status: string;
  transaction_reference?: string | null;
  order_date: string;
  paid_at?: string | null;
  delivery_status: string;
  warranty_duration: string;
  warranty_starts_at?: string | null;
  warranty_expires_at?: string | null;
}

export interface CustomerTotpResponse {
  code: string;
  expiresAt: string;
  serverTime: string;
  period: number;
  secondsRemaining: number;
}

export interface DeliveredAccount {
  account_id: string;
  order_code: string;
  game_title: string;          // e.g. "Blox Fruits Max Level + Kitsune"
  username: string;
  password: string;
  two_factor_secret?: string;   // e.g. "JBSWY3DPEHPK3PXP"
  backup_codes?: string[];      // e.g. ["ABCD-1234", "EFGH-5678"]
  notes?: string;               // Warranty & safety notes
  delivered_at: string;
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

export type WarrantyStatus = 'pending' | 'active' | 'warning' | 'expired' | 'invalidated';

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  telegram_id: number;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  quantity?: number;
  coupon_id: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_user_id: string | null;
  delivery_mode: DeliveryMode;
  delivery_credentials: Record<string, any>[] | null;
  fulfillment_notes: string | null;
  warranty_days?: number;
  warranty_status?: WarrantyStatus;
  warranty_starts_at?: string | null;
  warranty_expires_at?: string | null;
  warranty_notes?: string | null;
  warranty_invalidation_reason?: string | null;
  delivered_at: string | null;
  idempotency_key: string | null;
  receipt_notified?: boolean;
  admin_notified?: boolean;
  product_title?: string;
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
  expires_in?: number;
  provider_expires_in?: number;
  paid_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface CouponTier {
  points: number;
  discount: number;
  min_order: number;
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
  customer_telegram_id?: number | null;
  status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'REVOKED';
  used_in_order_id?: string | null;
  used_in_order_number?: string | null;
  used_at?: string | null;
}

export type GachaRarity = 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHICAL';
export type GachaDeliveryMode =
  | 'auto_account'
  | 'manual_service'
  | 'trade_item'
  | 'digital_code'
  | 'points'
  | 'discount_coupon'
  | 'instant_code'
  | 'manual_review';

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
  currentPrize?: GachaPrize | null;
  nextPrize?: GachaPrize | null;
}

export interface GachaPrize {
  id: string;
  pool_id: string;
  reward_number?: number;
  slot_number?: number;
  slot_status?: 'current' | 'draft' | 'archived';
  title: string;
  name?: string;
  description: string | null;
  rarity: GachaRarity;
  probability_percent: number;
  delivery_mode: GachaDeliveryMode;
  reward_type: 'code' | 'points' | 'item';
  reward_data: Record<string, any>;
  icon_url: string | null;
  image?: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
}

export interface UserGachaState {
  points: number;
  tickets: number;
  cooldownUntil: string | null;
}

export interface GachaStatus {
  points: number;
  tickets: number;
  ticketCost: number;
  canRoll: boolean;
  cooldownSecondsRemaining: number;
  nextRollAt: string | null;
  lastRollAt: string | null;
  userState: UserGachaState;
  currentPrize: GachaPrize | null;
  nextPrize: GachaPrize | null;
  nextDraftPrize?: GachaPrize | null;
}

export interface RecentGachaWinner {
  id: string;
  username?: string;
  first_name: string;
  prize_name: string;
  prize_title: string;
  rarity: GachaRarity;
  won_at: string;
  image?: string | null;
  icon_url?: string | null;
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
  telegram_id?: number;
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

export type PointTransactionType =
  | 'order_purchase'
  | 'purchase_reward'
  | 'gacha_spin'
  | 'gacha_ticket'
  | 'gacha_win'
  | 'coupon_redemption'
  | 'daily_reward'
  | 'streak_bonus'
  | 'refund_reversal'
  | 'admin_adjustment';

export interface PointLedgerEntry {
  id: string;
  telegram_id: number;
  amount: number;
  type: PointTransactionType;
  description: string;
  reference_id?: string | null;
  balance_after: number;
  created_at: string;
}

export interface DailyStreakDay {
  day: number;
  points: number;
  isClaimed: boolean;
  isToday: boolean;
  isBonus: boolean;
}

export interface DailyRewardStatus {
  can_claim: boolean;
  current_streak: number;
  last_claimed_at: string | null;
  next_claim_at: string | null;
  seconds_remaining?: number;
  reward_points: number;
  total_check_ins?: number;
  streak_days?: DailyStreakDay[];
}

export interface OrderNotificationDraft {
  id: string;
  batch_number: number;
  order_count: number;
  title: string;
  message: string;
  status: 'draft' | 'broadcasted' | 'dismissed';
  created_at: string;
  broadcasted_at?: string | null;
}

export interface StoreSettings {
  points_per_dollar: number;
  gacha_spin_cost: number;
  coupon_points_cost: number;
  coupon_redemption_enabled: boolean;
  daily_reward_points: number;
  streak_bonus_points: number;
  streak_interval_days: number;
  gacha_ticket_points_cost: number;
  gacha_cooldown_seconds: number;
  coupon_tier_50_value: number;
  coupon_tier_50_min_order: number;
  coupon_tier_100_value: number;
  coupon_tier_100_min_order: number;
  coupon_tier_200_value: number;
  coupon_tier_200_min_order: number;
  low_stock_threshold: number;
  default_warranty_days: number;
}

