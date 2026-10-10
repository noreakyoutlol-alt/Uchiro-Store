export type DeliveryMode = 'auto_account' | 'manual_service' | 'trade_item' | 'digital_code';
export type ProductType = 'account' | 'gift' | 'trade' | 'digital_code';

export interface Category {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductMedia {
  id: string;
  url: string;
  alt_text: string | null;
  is_primary: boolean;
  sort_order: number;
}

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
  is_active: boolean;
  is_draft: boolean;
  is_featured: boolean;
  delivery_mode: DeliveryMode;
  warranty_days: number;
  warranty_notes?: string | null;
  requires_roblox_username: boolean;
  requires_roblox_verification?: boolean;
  badge: string | null;
  specifications: Record<string, any>;
  video_url?: string | null;
  views_count: number;
  sales_count: number;
  media?: ProductMedia[];
  category?: Category;
}

export interface InventoryItem {
  id: string;
  product_id: string;
  item_type?: 'account' | 'code';
  account_username?: string | null;
  encrypted_account_password?: string | null;
  encrypted_account_2fa?: string | null;
  digital_code?: string | null;
  notes?: string | null;
  payload?: Record<string, any>;
  status: 'available' | 'reserved' | 'consumed' | 'sold';
  is_sold?: boolean;
  batch_id: string | null;
  order_id: string | null;
  reserved_until?: string | null;
  created_at: string;
  updated_at?: string;
}

export interface Order {
  id: string;
  order_number: string;
  customer_id: string;
  telegram_id: number;
  status: string;
  subtotal: number;
  discount_amount: number;
  total_amount: number;
  coupon_id: string | null;
  roblox_username: string | null;
  roblox_display_name?: string | null;
  roblox_user_id?: string | null;
  delivery_mode: DeliveryMode;
  delivery_credentials: Record<string, any>[] | null;
  fulfillment_notes: string | null;
  admin_notified?: boolean;
  delivered_at: string | null;
  created_at: string;
  items?: any[];
  payment?: any;
}

export interface GachaClaim {
  id: string;
  spin_id: string;
  customer_id: string;
  prize_id: string;
  status: 'claimed' | 'pending_review' | 'pending' | 'fulfilled' | 'rejected';
  delivery_data: Record<string, any> | null;
  admin_notes: string | null;
  claimed_at: string;
  resolved_at: string | null;
  prize?: {
    id: string;
    title: string;
    rarity: string;
    description: string;
  };
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
  per_user_limit?: number;
  is_active: boolean;
  expires_at: string | null;
  created_at?: string;
  updated_at?: string;
  customer_telegram_id?: number | null;
  status?: 'AVAILABLE' | 'USED' | 'EXPIRED' | 'REVOKED';
  used_in_order_id?: string | null;
  used_in_order_number?: string | null;
  used_at?: string | null;
}

export interface CustomerUser {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string;
  last_name: string | null;
  created_at: string;
  points?: number;
  reward_points?: number;
  last_daily_claim_at?: string | null;
}

export interface AuditLog {
  id: string;
  actor_telegram_id: number;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}

export interface DashboardStats {
  revenue: number;
  totalRevenue?: number;
  total_orders: number;
  totalOrders?: number;
  paid_orders: number;
  pending_fulfillment: number;
  pendingFulfillment?: number;
  total_customers: number;
  active_products: number;
  activeProducts?: number;
  available_inventory: number;
  consumed_inventory?: number;
  inventory_status?: {
    available: number;
    consumed: number;
    total: number;
    accounts_available: number;
    codes_available: number;
  };
  inventoryStatus?: {
    available: number;
    consumed: number;
    total: number;
    accounts_available: number;
    codes_available: number;
  };
  low_stock_count: number;
  out_of_stock_count?: number;
  pending_claims_count: number;
  low_stock_items: { id: string; title: string; stock: number }[];
  recent_orders?: Order[];
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
  created_at: string;
  updated_at: string;
  prizes?: GachaPrize[];
}

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
  description: string | null;
  rarity: 'COMMON' | 'RARE' | 'EPIC' | 'LEGENDARY' | 'MYTHICAL';
  probability_percent: number;
  delivery_mode: GachaDeliveryMode;
  reward_type: 'code' | 'points' | 'item';
  reward_data: Record<string, any>;
  icon_url: string | null;
  stock: number;
  is_active: boolean;
  created_at: string;
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

export interface BackupBundle {
  version: string;
  exported_at: string;
  store_brand: string;
  categories: any[];
  products: any[];
  inventory_count: number;
  gacha_pools: any[];
  gacha_prizes: any[];
  coupons: any[];
  settings: StoreSettings;
}
