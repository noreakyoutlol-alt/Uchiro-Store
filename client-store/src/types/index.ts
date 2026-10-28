export type DeliveryMode = 'auto_account' | 'manual_service' | 'trade_item' | 'digital_code' | 'robux';

export const DELIVERY_MODE_LABELS: Record<DeliveryMode, string> = {
  auto_account: 'Instant Account Delivery',
  manual_service: 'Roblox Gift Delivery',
  trade_item: 'In-Game Trade',
  digital_code: 'Instant Digital Key',
  robux: 'Robux Top-Up Delivery',
};

export function formatDeliveryMode(mode?: string | DeliveryMode | null): string {
  if (!mode) return 'Instant Account Delivery';
  switch (mode) {
    case 'auto_account':
      return 'Instant Account Delivery';
    case 'manual_service':
      return 'Roblox Gift Delivery';
    case 'trade_item':
      return 'In-Game Trade';
    case 'digital_code':
      return 'Instant Digital Key';
    case 'robux':
      return 'Robux Top-Up Delivery';
    default:
      return mode.replace(/_/g, ' ');
  }
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
}

export interface ProductMedia {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

export interface ProductGame {
  id?: string;
  name: string;
  platform?: string | null;
  description?: string | null;
  image_url?: string | null;
  sort_order?: number;
}

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
  stock_count?: number;
  is_available?: boolean;
  is_active: boolean;
  is_draft: boolean;
  is_featured: boolean;
  delivery_mode: DeliveryMode;
  warranty_days: number;
  requires_roblox_username: boolean;
  requires_roblox_verification?: boolean;
  badge: string | null;
  specifications: Record<string, any>;
  views_count: number;
  sales_count: number;
  video_url?: string;
  product_type?: 'account' | 'gift' | 'trade' | 'digital_code';
  media?: ProductMedia[];
  games?: ProductGame[];
  policy_blocked?: boolean;
  compliance_notice?: {
    policy: string;
    official_url: string;
    reason: string;
  } | null;
  category?: Category;
}

export interface TelegramUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  photo_url: string | null;
  language_code: string;
  points?: number;
  reward_points?: number;
  streak_count?: number;
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

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string;
  product_title: string;
  price: number;
  quantity: number;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  telegram_id: number;
  status: OrderStatus;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  total_price?: number;
  quantity?: number;
  coupon_id: string | null;
  roblox_username: string | null;
  roblox_display_name: string | null;
  roblox_user_id: string | null;
  delivery_mode: DeliveryMode;
  delivery_credentials: Record<string, any>[] | null;
  fulfillment_notes: string | null;
  warranty_days?: number;
  warranty_status?: 'none' | 'active' | 'warning' | 'expired' | 'invalidated' | 'replaced';
  warranty_starts_at?: string | null;
  warranty_expires_at?: string | null;
  warranty_notes?: string | null;
  admin_notified?: boolean;
  delivered_at: string | null;
  created_at: string;
  updated_at?: string;
  items?: OrderItem[];
  payment?: Payment;
}

export interface Payment {
  id: string;
  order_id: string;
  provider: string;
  currency: string;
  amount: number;
  qr_payload: string | null;
  qr_image_url: string | null;
  md5_hash: string | null;
  bakong_deep_link: string | null;
  aba_deep_link: string | null;
  status: 'pending' | 'paid' | 'expired' | 'failed';
  transaction_reference: string | null;
  expires_at: string;
  expires_in?: number;
  provider_expires_in?: number;
  paid_at: string | null;
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
  is_active?: boolean;
}

export interface GachaPool {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  spin_price: number;
  is_active: boolean;
  banner_url: string | null;
  total_spins: number;
  prizes?: GachaPrize[];
  currentPrize?: GachaPrize | null;
  nextPrize?: GachaPrize | null;
}

export interface GachaClaim {
  id: string;
  spin_id: string;
  customer_id: string;
  prize_id: string;
  status: 'claimed' | 'pending_review' | 'fulfilled' | 'rejected';
  delivery_data: Record<string, any> | null;
  admin_notes: string | null;
  claimed_at: string;
  resolved_at: string | null;
  prize?: GachaPrize;
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

export interface Coupon {
  id: string;
  code: string;
  discount_type: 'percentage' | 'fixed';
  discount_value: number;
  min_order_amount: number;
  max_discount_amount?: number | null;
  usage_limit?: number | null;
  times_used: number;
  per_user_limit: number;
  expires_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at?: string;
  customer_telegram_id?: number | null;
  status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'REVOKED';
  used_in_order_id?: string | null;
  used_in_order_number?: string | null;
  used_at?: string | null;
}

export interface CouponValidationResult {
  isValid: boolean;
  coupon?: {
    id: string;
    code: string;
    discount_type: 'percentage' | 'fixed';
    discount_value: number;
  };
  discountAmount: number;
  error?: string;
}

export type RobloxAccountType = 'standard' | 'kids' | 'select' | 'unverified';

export interface RobloxProfile {
  id: number;
  name: string;
  displayName: string;
  avatarUrl: string;
  isVerified: boolean;
  accountType?: RobloxAccountType;
  isAgeVerified?: boolean;
  isEligible?: boolean;
  ineligibilityReason?: string;
}

export interface CustomerDeliveryResult {
  order_number: string;
  delivery_mode: string;
  username?: string;
  password?: string;
  digital_code?: string;
  warranty_days?: number;
  warranty_status?: string;
  warranty_expires_at?: string | null;
  authenticator?: {
    available: boolean;
    manual_setup_key?: string | null;
    qr?: string | null;
    otpauth_url?: string | null;
    code?: string | null;
    expiresAt?: string | null;
    serverTime?: string | null;
    period?: number;
    secondsRemaining?: number;
  } | null;
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

export interface CustomerTotpResult {
  code: string;
  expiresAt: string;
  serverTime: string;
  period: number;
  secondsRemaining: number;
}

export type PointTransactionType =
  | 'order_purchase'
  | 'purchase_reward'
  | 'gacha_spin'
  | 'gacha_ticket'
  | 'gacha_win'
  | 'coupon_redemption'
  | 'redeem_code'
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

export type RedeemRewardType = 'points' | 'gacha_tickets' | 'discount_coupon';

export interface RedeemCodeResult {
  code: string;
  reward_type: RedeemRewardType;
  reward_amount: number;
  reward_title: string;
  reward_description: string;
  points_balance?: number;
  tickets_balance?: number;
  coupon?: Coupon;
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData?: string;
        initDataUnsafe?: any;
        ready?: () => void;
        expand?: () => void;
        close?: () => void;
        BackButton?: any;
        setHeaderColor?: (color: string) => void;
        setBackgroundColor?: (color: string) => void;
      };
    };
  }
}

export type SeasonalThemeId = 'gaming' | 'halloween' | 'christmas' | 'angkor-khmer';

export interface SeasonalThemeConfig {
  active_theme: SeasonalThemeId;
  updated_at?: string;
  updated_by?: string | number;
  available_themes?: SeasonalThemeId[];
}
