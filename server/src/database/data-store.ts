import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import pg from 'pg';
import {
  Category,
  Product,
  ProductMedia,
  ProductGame,
  DeliveryMode,
  InventoryItem,
  Order,
  OrderItem,
  Payment,
  Coupon,
  GachaPool,
  GachaPrize,
  GachaSpin,
  GachaClaim,
  TelegramUser,
  Profile,
  AdminUser,
  SupportTicket,
  NotificationItem,
  PointLedgerEntry,
  PointTransactionType,
  DailyRewardStatus,
  DailyStreakDay,
  OrderNotificationDraft,
  StoreSettings,
  DeliveryAccessLog,
  DeliveryAccessAction,
  DeliveredAccount,
  BroadcastCampaign,
  RedeemCode,
  RedeemCodeUsage,
  RedeemCodeResult,
  RedeemRewardType,
  RedeemCodeUseMode,
  CouponRewardData,
  RegisteredGroup,
  StockAnnouncementEvent,
  StockAnnouncementBatch,
  StockBatchDelivery,
  BatchProductSnapshot,
  SeasonalThemeId,
  SeasonalThemeConfig,
} from '../types';
import { encrypt, decrypt } from '../security/encryption';
import { TOTPService } from '../security/totp';
import { AppError } from '../middleware/error-handler';
import { env } from '../config/env';
import { pgPool, isPostgresConfigured } from './postgres';

export const ALLOWED_SEASONAL_THEMES: readonly SeasonalThemeId[] = [
  'gaming',
  'halloween',
  'christmas',
  'angkor-khmer',
] as const;

export type { DeliveredAccount };

// Seed Categories
const initialCategories: Category[] = [
  {
    id: '11111111-1111-1111-1111-111111111101',
    name: 'Accounts',
    slug: 'accounts',
    icon: 'UserCheck',
    description: 'High-tier verified gaming accounts with full warranty',
    sort_order: 1,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111102',
    name: 'Items & Codes',
    slug: 'items',
    icon: 'KeyRound',
    description: 'Instant digital vouchers, gamepasses & codes',
    sort_order: 2,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111103',
    name: 'Blox Fruits',
    slug: 'blox-fruits',
    icon: 'Flame',
    description: 'Permanent fruits, mythical weapons, max accounts',
    sort_order: 3,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111104',
    name: 'MM2',
    slug: 'mm2',
    icon: 'Sword',
    description: 'Murder Mystery 2 godlies, ancients, and vintage sets',
    sort_order: 4,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111105',
    name: 'Blade Ball',
    slug: 'blade-ball',
    icon: 'Shield',
    description: 'Exclusive abilities, swords, and explosion effects',
    sort_order: 5,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111109',
    name: 'Rivals',
    slug: 'rivals',
    icon: 'Crosshair',
    description: 'Competitive loadouts, wraps, snipers and passes',
    sort_order: 6,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111106',
    name: 'Evade',
    slug: 'evade',
    icon: 'Zap',
    description: 'VIP access, custom radios, and legendary emotes',
    sort_order: 6,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111107',
    name: 'Steal Egg',
    slug: 'steal-egg',
    icon: 'Egg',
    description: 'Rare dragon eggs, multipliers, and power-up packs',
    sort_order: 7,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111110',
    name: 'Gamepasses',
    slug: 'gamepasses',
    icon: 'Ticket',
    description: 'Roblox VIP gamepasses, special perks and item vouchers',
    sort_order: 8,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '11111111-1111-1111-1111-111111111108',
    name: 'Other',
    slug: 'other',
    icon: 'Gamepad2',
    description: 'Robux gift cards, discord perks, and miscellaneous rewards',
    sort_order: 9,
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

import { demoProducts, demoInventory } from './demo-seed-data';

// Seed Products (Purged in production - populated in tests or fallback)
const isTestEnv = process.env.NODE_ENV === 'test' || env.NODE_ENV === 'test';
const initialProducts: Product[] = isTestEnv ? JSON.parse(JSON.stringify(demoProducts)) : [];

// Seed Inventory Items (Purged in production - populated in tests or fallback)
const initialInventory: InventoryItem[] = isTestEnv ? JSON.parse(JSON.stringify(demoInventory)) : [];

// Seed Coupons
const initialCoupons: Coupon[] = [
  {
    id: '44444444-4444-4444-4444-444444444401',
    code: 'UCHIRO10',
    discount_type: 'percentage',
    discount_value: 10.0,
    min_order_amount: 5.0,
    max_discount_amount: 10.0,
    usage_limit: 1000,
    times_used: 0,
    per_user_limit: 1,
    expires_at: new Date(Date.now() + 90 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444402',
    code: 'GEAR5',
    discount_type: 'percentage',
    discount_value: 15.0,
    min_order_amount: 10.0,
    max_discount_amount: 15.0,
    usage_limit: 500,
    times_used: 0,
    per_user_limit: 1,
    expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '44444444-4444-4444-4444-444444444403',
    code: 'WELCOMEV3',
    discount_type: 'fixed',
    discount_value: 2.0,
    min_order_amount: 8.0,
    max_discount_amount: null,
    usage_limit: 2000,
    times_used: 0,
    per_user_limit: 1,
    expires_at: new Date(Date.now() + 120 * 86400000).toISOString(),
    is_active: true,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Seed Redeem Codes
const initialRedeemCodes: RedeemCode[] = [
  {
    id: '77777777-7777-7777-7777-777777777701',
    code: 'WELCOME100',
    reward_type: 'points',
    reward_amount: 100,
    reward_data: {},
    use_mode: 'one_per_member',
    max_uses: 1000,
    times_used: 0,
    per_user_limit: 1,
    is_active: true,
    expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777702',
    code: 'GACHATICKET',
    reward_type: 'gacha_tickets',
    reward_amount: 5,
    reward_data: {},
    use_mode: 'one_per_member',
    max_uses: 500,
    times_used: 0,
    per_user_limit: 1,
    is_active: true,
    expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '77777777-7777-7777-7777-777777777703',
    code: 'UCHIROCOUPON',
    reward_type: 'discount_coupon',
    reward_amount: 0,
    reward_data: {
      discount_type: 'fixed',
      discount_value: 2.0,
      min_order_amount: 5.0,
      max_discount_amount: null,
    },
    use_mode: 'one_per_member',
    max_uses: 500,
    times_used: 0,
    per_user_limit: 1,
    is_active: true,
    expires_at: new Date(Date.now() + 180 * 86400000).toISOString(),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Seed Gacha Pools & Prizes
const initialGachaPools: GachaPool[] = [
  {
    id: '55555555-5555-5555-5555-555555555501',
    title: 'Uchiro Premium Rewards Wheel',
    slug: 'uchiro-premium-wheel',
    description: 'Exclusive Uchiro reward rolls for premium gaming accounts, vouchers, store coupons, and wallet points!',
    spin_price: 1.5,
    is_active: true,
    banner_url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
    total_spins: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

const initialGachaPrizes: GachaPrize[] = [
  {
    id: '66666666-6666-6666-6666-666666666601',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 1,
    slot_number: 1,
    slot_status: 'current',
    title: '50 Uchiro Points',
    description: 'Instant credit of 50 Uchiro Reward Points directly to your wallet',
    rarity: 'COMMON',
    probability_percent: 70.0,
    delivery_mode: 'instant_code',
    reward_type: 'points',
    reward_data: { points: 50 },
    icon_url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=200&auto=format&fit=crop&q=80',
    stock: 9999,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666602',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 2,
    slot_number: 2,
    slot_status: 'current',
    title: '$1.00 Uchiro Store Coupon',
    description: 'Fixed $1.00 discount voucher for your next qualifying game or code order (min. order $3.00)',
    rarity: 'RARE',
    probability_percent: 20.0,
    delivery_mode: 'instant_code',
    reward_type: 'code',
    reward_data: { coupon_code: 'UCHIRO-GACHA-1USD' },
    icon_url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?w=200&auto=format&fit=crop&q=80',
    stock: 500,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666603',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 3,
    slot_number: 3,
    slot_status: 'current',
    title: 'Uchiro 2x EXP Booster Pass',
    description: 'Digital code voucher granting 24 hours of 2x experience multiplier in supported gaming modes',
    rarity: 'EPIC',
    probability_percent: 7.0,
    delivery_mode: 'instant_code',
    reward_type: 'code',
    reward_data: { code: 'UCH-2XBOOST-24H' },
    icon_url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=200&auto=format&fit=crop&q=80',
    stock: 100,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666604',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 4,
    slot_number: 4,
    slot_status: 'current',
    title: 'Shadow Katana V2 Game Voucher',
    description: 'Legendary digital equipment voucher redeemable for high-tier katana in gaming library',
    rarity: 'LEGENDARY',
    probability_percent: 2.5,
    delivery_mode: 'instant_code',
    reward_type: 'code',
    reward_data: { code: 'KATANA-LEGENDARY-8821' },
    icon_url: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=200&auto=format&fit=crop&q=80',
    stock: 20,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666605',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 5,
    slot_number: 5,
    slot_status: 'current',
    title: 'Mythic Uchiro Champion Account',
    description: 'Grand prize! Mythical max-tier gaming account transferred securely with 14-day warranty guarantee',
    rarity: 'MYTHICAL',
    probability_percent: 0.5,
    delivery_mode: 'manual_review',
    reward_type: 'item',
    reward_data: { item_name: 'Mythic Uchiro Champion Account' },
    icon_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
    stock: 5,
    is_active: true,
    created_at: new Date().toISOString(),
  },
  // STANDBY DRAFT PRIZE SLOTS (Auto-promote on stock exhaustion or admin activation)
  {
    id: '66666666-6666-6666-6666-666666666606',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 4,
    slot_number: 4,
    slot_status: 'draft',
    title: 'MM2 Darkbringer Gun Voucher (Standby)',
    description: 'Standby draft prize for Slot 4. Automatically promotes when Current prize hits 0 stock.',
    rarity: 'LEGENDARY',
    probability_percent: 2.5,
    delivery_mode: 'instant_code',
    reward_type: 'code',
    reward_data: { code: 'DARKBRINGER-VOUCHER-991' },
    icon_url: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=200&auto=format&fit=crop&q=80',
    stock: 15,
    is_active: false,
    created_at: new Date().toISOString(),
  },
  {
    id: '66666666-6666-6666-6666-666666666607',
    pool_id: '55555555-5555-5555-5555-555555555501',
    reward_number: 5,
    slot_number: 5,
    slot_status: 'draft',
    title: 'Blox Fruits Perm Dragon Fruit Gift (Standby)',
    description: 'Standby draft prize for Slot 5. Automatically promotes when Current prize hits 0 stock.',
    rarity: 'MYTHICAL',
    probability_percent: 0.5,
    delivery_mode: 'manual_review',
    reward_type: 'item',
    reward_data: { item_name: 'Blox Fruits Perm Dragon Fruit' },
    icon_url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=200&auto=format&fit=crop&q=80',
    stock: 3,
    is_active: false,
    created_at: new Date().toISOString(),
  },
];

// Unified Data Store Class
export class DataStore {
  private static categories: Category[] = [...initialCategories];
  private static products: Product[] = initialProducts.map((p) => ({
    ...p,
    stock_count: p.stock,
    is_available: p.stock > 0,
  }));
  private static inventory: InventoryItem[] = [...initialInventory];
  private static coupons: Coupon[] = [...initialCoupons];
  private static redeemCodes: RedeemCode[] = [...initialRedeemCodes];
  private static redeemCodeUsages: RedeemCodeUsage[] = [];
  private static codeLocks: Map<string, Promise<void>> = new Map();
  private static gachaPools: GachaPool[] = [...initialGachaPools];
  private static gachaPrizes: GachaPrize[] = [...initialGachaPrizes];
  private static gachaSpins: GachaSpin[] = [];
  private static gachaClaims: GachaClaim[] = [];
  private static orders: Order[] = [];
  private static payments: Payment[] = [];
  private static recordedDeliveredAccounts: any[] = [];
  private static alertedStockThresholds: Map<string, Set<number>> = new Map();
  private static users: Map<number, TelegramUser> = new Map();
  private static profiles: Map<number, Profile> = new Map();
  private static adminUsers: AdminUser[] = [
    {
      id: uuidv4(),
      telegram_id: env.ADMIN_TELEGRAM_USER_IDS[0] || 999999999,
      username: 'uchiro_founder',
      display_name: 'Uchiro Founder',
      role: 'superadmin',
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
    {
      id: uuidv4(),
      telegram_id: 987654321,
      username: 'uchiro_lead_admin',
      display_name: 'Lead Admin',
      role: 'admin',
      is_active: true,
      last_login_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
    },
  ];
  private static supportTickets: SupportTicket[] = [];
  private static auditLogs: any[] = [];
  private static deliveryAccessLogs: DeliveryAccessLog[] = [];
  private static notifications: NotificationItem[] = [];
  private static pointLedger: PointLedgerEntry[] = [];
  private static dailyRewards: Map<number, { lastClaimed: number; streak: number; totalPoints: number }> = new Map();
  private static orderNotificationDrafts: OrderNotificationDraft[] = [];
  private static broadcastCampaigns: Map<string, BroadcastCampaign> = new Map();
  private static registeredGroups: Map<string, RegisteredGroup> = new Map();
  private static stockAnnouncementEvents: Map<string, StockAnnouncementEvent> = new Map();
  private static stockAnnouncementBatches: Map<string, StockAnnouncementBatch> = new Map();
  private static stockBatchDeliveries: Map<string, StockBatchDelivery> = new Map();
  private static qualifyingOrderCounter: number = 0;
  private static activeHeartbeats: Map<string, number> = new Map();
  private static storeSettings: StoreSettings = {
    points_per_dollar: 10,
    gacha_spin_cost: 100,
    coupon_points_cost: 100,
    coupon_redemption_enabled: true,
    daily_reward_points: 5,
    streak_bonus_points: 15,
    streak_interval_days: 7,
    gacha_ticket_points_cost: 100,
    gacha_cooldown_seconds: 3600,
    coupon_tier_50_value: 0.5,
    coupon_tier_50_min_order: 1.5,
    coupon_tier_100_value: 1.0,
    coupon_tier_100_min_order: 3.0,
    coupon_tier_200_value: 2.0,
    coupon_tier_200_min_order: 5.0,
    low_stock_threshold: 2,
    default_warranty_days: 14,
    seasonal_theme: 'gaming',
    seasonal_theme_updated_at: new Date().toISOString(),
    seasonal_theme_updated_by: 'system',
  };

  // ================= INVENTORY CLEANUP & STOCK HELPER =================
  static cleanupExpiredReservations(): void {
    const now = Date.now();
    // 1. Concrete vault inventory reservations
    for (const item of this.inventory) {
      if (item.status === 'reserved' && item.reserved_until) {
        if (new Date(item.reserved_until).getTime() < now) {
          // Never release reserved items for paid, delivered, completed, or fulfillment orders
          const order = item.order_id ? this.orders.find((o) => o.id === item.order_id) : null;
          if (
            order &&
            (order.status === 'paid' ||
              order.status === 'delivered' ||
              order.status === 'completed' ||
              order.status === 'fulfillment')
          ) {
            continue;
          }

          item.status = 'available';
          item.reserved_until = null;
          item.order_id = null;
          item.updated_at = new Date().toISOString();

          const prod = this.products.find((p) => p.id === item.product_id);
          if (prod) {
            const unsoldStock = this.inventory.filter(
              (i) => i.product_id === prod.id && i.status === 'available' && !i.is_sold
            ).length;
            prod.stock = unsoldStock;
            prod.stock_count = prod.stock;
            prod.is_available = prod.stock > 0;
            prod.updated_at = new Date().toISOString();
          }
        }
      }
    }

    // 2. Pending non-vault orders whose reservation time window has expired
    for (const order of this.orders) {
      if (
        order.status === 'pending_payment' &&
        (order as any).stock_reserved &&
        !(order as any).reservation_released
      ) {
        const payment = this.payments.find((p) => p.order_id === order.id);
        const expiresAt = payment?.expires_at
          ? new Date(payment.expires_at).getTime()
          : new Date(order.created_at).getTime() + 10 * 60 * 1000;
        if (now > expiresAt) {
          order.status = 'expired';
          if (payment && payment.status === 'pending') {
            payment.status = 'expired';
            payment.updated_at = new Date().toISOString();
          }
          this.releaseReservation(order.id);
        }
      }
    }
  }

  static getProductAvailableStock(productId: string): number {
    this.cleanupExpiredReservations();
    const product = this.products.find((p) => p.id === productId);
    if (!product) return 0;

    // For account products, auto_account, and digital_code, concrete available inventory records are the source of truth
    if (
      product.delivery_mode === 'auto_account' ||
      product.delivery_mode === 'digital_code' ||
      product.product_type === 'account'
    ) {
      const items = this.inventory.filter(
        (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
      );
      product.stock = items.length;
      product.stock_count = items.length;
      product.is_available = items.length > 0;
      return items.length;
    }

    // For manual_service or general products, use recorded stock
    const stock = Math.max(0, Number(product.stock) || 0);
    product.stock_count = stock;
    product.is_available = stock > 0;
    return stock;
  }

  // ================= CATEGORIES =================
  // Legacy slugs excluded from customer-facing shop (Requirement 6)
  private static readonly LEGACY_CATEGORY_SLUGS = ['accounts', 'items', 'items-codes', 'items-and-codes'];

  static getCategories(): Category[] {
    return this.categories
      .filter((c) => c.is_active && !this.LEGACY_CATEGORY_SLUGS.includes(c.slug))
      .map((cat) => {
        const catProducts = this.products.filter(
          (p) => p.category_id === cat.id && p.is_active && !p.is_draft
        );
        const stockCount = catProducts.reduce(
          (sum, p) => sum + this.getProductAvailableStock(p.id),
          0
        );
        const inStockCount = catProducts.filter(
          (p) => this.getProductAvailableStock(p.id) > 0
        ).length;
        return {
          ...cat,
          stock_count: stockCount,
          products_count: inStockCount,
        };
      })
      .sort((a, b) => a.sort_order - b.sort_order);
  }

  // ================= PRODUCTS =================
  /**
   * Normalizes product media:
   * - Enforces at most 5 images
   * - Sets is_primary = true for slot 0, false for others
   * - Sets sort_order = index + 1
   * - Backwards compatibility: if product only has legacy image/image_url/imageUrl, presents it as a 1-image gallery
   */
  static normalizeProductMedia(product: Partial<Product> & { id?: string; title?: string }): ProductMedia[] {
    if (Array.isArray(product.media) && product.media.length > 0) {
      return product.media
        .filter((m) => m && typeof m === 'object' && typeof m.url === 'string' && m.url.trim().length > 0)
        .slice(0, 5)
        .map((m, idx) => ({
          id: m.id || `media-${product.id || 'p'}-${idx + 1}`,
          product_id: product.id || '',
          url: m.url.trim(),
          alt_text: m.alt_text || product.title || null,
          is_primary: idx === 0,
          sort_order: idx + 1,
          created_at: m.created_at || new Date().toISOString(),
        }));
    }
    const legacy = (product as any)?.image_url || (product as any)?.imageUrl || (product as any)?.image;
    if (legacy && typeof legacy === 'string' && legacy.trim().length > 0) {
      return [
        {
          id: `legacy-${product.id || 'single'}`,
          product_id: product.id || '',
          url: legacy.trim(),
          alt_text: product.title || 'Product Image',
          is_primary: true,
          sort_order: 1,
          created_at: new Date().toISOString(),
        },
      ];
    }
    return [];
  }

  /**
   * Normalizes and validates product games:
   * - Enforces 1 to 5 games max per product (rejects > 5 with TOO_MANY_GAMES)
   * - Strips and normalizes whitespace
   * - Rejects blank names with INVALID_GAME_NAME
   * - Rejects duplicate names with DUPLICATE_GAME_NAME
   * - Validates image_url (http/https only, no data:)
   * - Rejects credential fields with CREDENTIALS_IN_GAMES_METADATA
   * - Preserves deterministic ordering
   */
  static normalizeProductGames(games: unknown, validateStrict: boolean = false): ProductGame[] {
    if (games === undefined || games === null) {
      return [];
    }
    if (!Array.isArray(games)) {
      if (validateStrict) {
        throw new AppError('games must be an array', 400, 'INVALID_GAMES_PAYLOAD');
      }
      return [];
    }
    if (games.length > 5) {
      throw new AppError(
        `A product may have at most 5 games. Received ${games.length}.`,
        400,
        'TOO_MANY_GAMES'
      );
    }

    const seenNames = new Set<string>();
    const sanitized: ProductGame[] = [];

    for (let i = 0; i < games.length; i++) {
      const item = games[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) {
        if (validateStrict) {
          throw new AppError('Each game entry must be a valid object.', 400, 'INVALID_GAME_ENTRY');
        }
        continue;
      }

      // Security: never allow account credentials, keys, or secrets in public games metadata
      const credentialKeys = [
        'password',
        'raw_password',
        'encrypted_account_password',
        'two_factor',
        'raw_2fa',
        'encrypted_account_2fa',
        'authenticator_secret_ciphertext',
        'secret',
        'token',
        'credentials',
        'email_password',
        'recovery_codes',
        'backup_codes',
      ];
      for (const k of credentialKeys) {
        if ((item as any)[k] !== undefined && (item as any)[k] !== null) {
          throw new AppError(
            'Games metadata cannot contain account credentials or secrets.',
            400,
            'CREDENTIALS_IN_GAMES_METADATA'
          );
        }
      }

      const rawName = (item as any).name;
      if (typeof rawName !== 'string' || rawName.trim().length === 0) {
        if (validateStrict) {
          throw new AppError('Game name is required and cannot be empty.', 400, 'INVALID_GAME_NAME');
        }
        continue;
      }
      const name = rawName.trim();
      if (name.length > 100) {
        if (validateStrict) {
          throw new AppError('Game name cannot exceed 100 characters.', 400, 'INVALID_GAME_NAME');
        }
      }

      const lowerName = name.toLowerCase();
      if (seenNames.has(lowerName)) {
        if (validateStrict) {
          throw new AppError(
            `Duplicate game name: "${name}" is already included.`,
            400,
            'DUPLICATE_GAME_NAME'
          );
        }
        continue;
      }
      seenNames.add(lowerName);

      // Optional platform
      let platform: string | null = null;
      if ((item as any).platform !== undefined && (item as any).platform !== null) {
        if (typeof (item as any).platform !== 'string') {
          if (validateStrict) {
            throw new AppError('Game platform must be a string.', 400, 'INVALID_GAME_PLATFORM');
          }
        } else {
          platform = (item as any).platform.trim().slice(0, 50) || null;
        }
      }

      // Optional description
      let description: string | null = null;
      if ((item as any).description !== undefined && (item as any).description !== null) {
        if (typeof (item as any).description !== 'string') {
          if (validateStrict) {
            throw new AppError('Game description must be a string.', 400, 'INVALID_GAME_DESCRIPTION');
          }
        } else {
          description = (item as any).description.trim().slice(0, 250) || null;
        }
      }

      // Optional image_url
      let image_url: string | null = null;
      if ((item as any).image_url !== undefined && (item as any).image_url !== null) {
        const rawUrl = (item as any).image_url;
        if (typeof rawUrl !== 'string') {
          if (validateStrict) {
            throw new AppError('Game image URL must be a string.', 400, 'INVALID_GAME_IMAGE_URL');
          }
        } else {
          const trimmedUrl = rawUrl.trim();
          if (trimmedUrl.length > 0) {
            if (trimmedUrl.startsWith('data:')) {
              throw new AppError(
                'Base64 data URLs are not allowed as game image URLs.',
                400,
                'INVALID_GAME_IMAGE_URL'
              );
            }
            if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
              throw new AppError(
                'Game image URL must be a valid HTTP or HTTPS URL.',
                400,
                'INVALID_GAME_IMAGE_URL'
              );
            }
            image_url = trimmedUrl;
          }
        }
      }

      sanitized.push({
        id: (item as any).id || uuidv4(),
        name,
        platform,
        description,
        image_url,
        sort_order: typeof (item as any).sort_order === 'number' ? (item as any).sort_order : i + 1,
      });
    }

    return sanitized;
  }

  // Core Requirement: HOME shows ALL in-stock products
  static getInStockProducts(): Product[] {
    return this.products
      .filter((p) => p.is_active && !p.is_draft && this.getProductAvailableStock(p.id) > 0)
      .map((p) => {
        const stock = this.getProductAvailableStock(p.id);
        const media = this.normalizeProductMedia(p);
        const games = this.normalizeProductGames(p.games);
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
          media,
          games,
          image_url: media[0]?.url || (p as any).image_url || null,
          category: this.categories.find((c) => c.id === p.category_id),
        };
      });
  }

  static getShopProducts(query: {
    categorySlug?: string;
    search?: string;
    filter?: string;
    sort?: string;
  }): Product[] {
    let result = this.products
      .filter((p) => p.is_active && !p.is_draft)
      .map((p) => {
        const stock = this.getProductAvailableStock(p.id);
        const media = this.normalizeProductMedia(p);
        const games = this.normalizeProductGames(p.games);
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
          media,
          games,
          image_url: media[0]?.url || (p as any).image_url || null,
          category: this.categories.find((c) => c.id === p.category_id),
        };
      });

    // Category filter
    if (query.categorySlug && query.categorySlug.toLowerCase() !== 'all') {
      const category = this.categories.find(
        (c) => c.slug.toLowerCase() === query.categorySlug?.toLowerCase()
      );
      if (category) {
        result = result.filter((p) => p.category_id === category.id);
      }
    }

    // Search query
    if (query.search && query.search.trim().length > 0) {
      const s = query.search.toLowerCase().trim();
      result = result.filter(
        (p) =>
          p.title.toLowerCase().includes(s) ||
          p.short_description?.toLowerCase().includes(s) ||
          p.description?.toLowerCase().includes(s) ||
          p.badge?.toLowerCase().includes(s)
      );
    }

    // Availability filter
    if (query.filter === 'available') {
      result = result.filter((p) => p.stock > 0);
    } else if (query.filter === 'soldout') {
      result = result.filter((p) => p.stock === 0);
    } else if (query.filter === 'featured') {
      result = result.filter((p) => p.is_featured);
    }

    // Sorting
    if (query.sort === 'price_asc') {
      result = result.sort((a, b) => a.price - b.price);
    } else if (query.sort === 'price_desc') {
      result = result.sort((a, b) => b.price - a.price);
    } else if (query.sort === 'newest') {
      result = result.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } else if (query.sort === 'popular') {
      result = result.sort((a, b) => (b.views_count || 0) - (a.views_count || 0));
    } else if (query.sort === 'stock') {
      result = result.sort((a, b) => b.stock - a.stock);
    }

    return result;
  }

  static getProductById(id: string): Product | null {
    const p = this.products.find((prod) => prod.id === id);
    if (!p) return null;
    p.views_count = (p.views_count || 0) + 1;
    const stock = this.getProductAvailableStock(p.id);
    const media = this.normalizeProductMedia(p);
    const games = this.normalizeProductGames(p.games);
    return {
      ...p,
      stock,
      stock_count: stock,
      is_available: stock > 0,
      media,
      games,
      image_url: media[0]?.url || (p as any).image_url || null,
      category: this.categories.find((c) => c.id === p.category_id),
    };
  }

  static getAllProductsAdmin(): Product[] {
    this.cleanupExpiredReservations();
    return this.products.map((p) => {
      const stock = this.getProductAvailableStock(p.id);
      const media = this.normalizeProductMedia(p);
      const games = this.normalizeProductGames(p.games);
      return {
        ...p,
        stock,
        stock_count: stock,
        is_available: stock > 0,
        media,
        games,
        image_url: media[0]?.url || (p as any).image_url || null,
        category: this.categories.find((c) => c.id === p.category_id),
      };
    });
  }

  static saveProduct(product: Partial<Product> & { title: string; price: number; category_id: string }): Product {
    const productId = product.id || uuidv4();
    const index = this.products.findIndex((p) => p.id === productId);

    const deliveryMode: DeliveryMode = (product.delivery_mode || 'auto_account') as DeliveryMode;
    const isManualService = deliveryMode === 'manual_service';
    const isTradeItem = deliveryMode === 'trade_item';

    const requiresRobloxVerification = isManualService
      ? true
      : Boolean(product.requires_roblox_verification);

    const requiresRobloxUsername = (isManualService || isTradeItem)
      ? true
      : Boolean(product.requires_roblox_username);

    const isAccountOrCode =
      deliveryMode === 'auto_account' ||
      deliveryMode === 'digital_code' ||
      product.product_type === 'account';

    const calculatedStock = isAccountOrCode
      ? this.getProductAvailableStock(productId)
      : Number(product.stock) || 0;

    const specifications: Record<string, any> = { ...(product.specifications || {}) };
    if (isManualService) {
      specifications.requires_roblox_verification = true;
    }

    const baseProduct: Product = {
      id: productId,
      category_id: product.category_id,
      title: product.title,
      slug: product.slug || product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
      description: product.description || product.title,
      short_description: product.short_description || product.description || product.title,
      price: product.price,
      compare_at_price: product.compare_at_price || null,
      stock: calculatedStock,
      delivery_mode: deliveryMode,
      product_type: product.product_type || (deliveryMode === 'auto_account' ? 'account' : deliveryMode === 'manual_service' ? 'gift' : deliveryMode === 'trade_item' ? 'trade' : 'digital_code'),
      warranty_days: (deliveryMode === 'auto_account' || product.product_type === 'account')
        ? (product.warranty_days !== undefined ? product.warranty_days : 14)
        : 0,
      authenticator_enabled: product.authenticator_enabled !== undefined ? Boolean(product.authenticator_enabled) : Boolean(product.require_authenticator_protection),
      requires_roblox_username: requiresRobloxUsername,
      requires_roblox_verification: requiresRobloxVerification,
      is_active: product.is_active !== undefined ? product.is_active : true,
      is_featured: Boolean(product.is_featured),
      is_draft: Boolean(product.is_draft),
      badge: product.badge || null,
      views_count: product.views_count || 0,
      sales_count: product.sales_count || 0,
      specifications,
      media: this.normalizeProductMedia({ ...product, id: productId }),
      games: this.normalizeProductGames(product.games),
      video_url: product.video_url || null,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (index >= 0) {
      this.products[index] = { ...this.products[index], ...baseProduct, updated_at: new Date().toISOString() };
      return this.products[index];
    } else {
      this.products.unshift(baseProduct);
      const liveStock = this.getProductAvailableStock(baseProduct.id);
      if (baseProduct.is_active && !baseProduct.is_draft && liveStock > 0) {
        this.recordPendingStockEvent(baseProduct.id, 'new_product', liveStock);
      }
      return baseProduct;
    }
  }

  static updateProduct(id: string, updates: Partial<Product>): Product | null {
    const index = this.products.findIndex((p) => p.id === id);
    if (index === -1) return null;

    const existing = this.products[index];
    const deliveryMode: DeliveryMode = (updates.delivery_mode || existing.delivery_mode) as DeliveryMode;
    const isManualService = deliveryMode === 'manual_service';
    const isTradeItem = deliveryMode === 'trade_item';

    const requiresRobloxVerification = isManualService
      ? true
      : updates.requires_roblox_verification !== undefined
      ? Boolean(updates.requires_roblox_verification)
      : Boolean(existing.requires_roblox_verification);

    const requiresRobloxUsername = (isManualService || isTradeItem)
      ? true
      : updates.requires_roblox_username !== undefined
      ? Boolean(updates.requires_roblox_username)
      : Boolean(existing.requires_roblox_username);

    const specifications: Record<string, any> = {
      ...(existing.specifications || {}),
      ...(updates.specifications || {}),
    };
    if (isManualService) {
      specifications.requires_roblox_verification = true;
    }

    const isAccountOrCode =
      deliveryMode === 'auto_account' ||
      deliveryMode === 'digital_code' ||
      (updates.product_type || existing.product_type) === 'account';

    const updatedStock = updates.stock !== undefined
      ? (isAccountOrCode ? this.getProductAvailableStock(id) : Number(updates.stock) || 0)
      : existing.stock;

    const media = updates.media !== undefined
      ? this.normalizeProductMedia({ ...updates, id: existing.id, title: updates.title || existing.title })
      : existing.media;

    const games = updates.games !== undefined
      ? this.normalizeProductGames(updates.games)
      : existing.games;

    const updatedProduct: Product = {
      ...existing,
      ...updates,
      id: existing.id,
      delivery_mode: deliveryMode,
      authenticator_enabled: updates.authenticator_enabled !== undefined
        ? Boolean(updates.authenticator_enabled)
        : existing.authenticator_enabled,
      stock: updatedStock,
      requires_roblox_username: requiresRobloxUsername,
      requires_roblox_verification: requiresRobloxVerification,
      specifications,
      media,
      games,
      updated_at: new Date().toISOString(),
    };

    const oldStock = Number(existing.stock) || 0;
    this.products[index] = updatedProduct;

    // Prompt 5: Restock detection on manual products when stock increases
    if (updates.stock !== undefined && !isAccountOrCode) {
      const newStock = Number(updates.stock) || 0;
      if (newStock > oldStock && newStock > 0 && updatedProduct.is_active && !updatedProduct.is_draft) {
        this.recordPendingStockEvent(id, 'restock', newStock);
      }
    }

    return this.getProductById(existing.id);
  }

  static deleteProduct(id: string): boolean {
    const idx = this.products.findIndex((p) => p.id === id);
    if (idx >= 0) {
      this.products.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ================= INVENTORY & RESERVATIONS =================
  static reserveInventoryAtomic(
    productId: string,
    orderId: string,
    quantity: number = 1,
    durationMinutes: number = 10
  ): { success: boolean; item?: InventoryItem; items?: InventoryItem[]; error?: string } {
    const product = this.products.find((p) => p.id === productId);
    if (!product || !product.is_active || product.is_draft) {
      return { success: false, error: 'PRODUCT_NOT_FOUND_OR_INACTIVE' };
    }

    const availableStock = this.getProductAvailableStock(productId);
    if (availableStock < quantity) {
      return { success: false, error: 'PRODUCT_OUT_OF_STOCK' };
    }

    const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

    // If auto_account, digital_code, or account product, reserve concrete inventory items
    if (
      product.delivery_mode === 'auto_account' ||
      product.delivery_mode === 'digital_code' ||
      product.product_type === 'account'
    ) {
      const availableItems = this.inventory
        .filter((i) => i.product_id === productId && i.status === 'available' && !i.is_sold)
        .slice(0, quantity);

      if (availableItems.length < quantity) {
        return { success: false, error: 'NO_SPECIFIC_INVENTORY_ITEM_AVAILABLE' };
      }

      for (const item of availableItems) {
        item.status = 'reserved';
        item.reserved_until = expiresAt;
        item.order_id = orderId;
        item.updated_at = new Date().toISOString();
      }

      // Sync product stock
      product.stock = this.getProductAvailableStock(productId);
      product.updated_at = new Date().toISOString();

      return { success: true, item: availableItems[0], items: availableItems };
    }

    // For manual_service or trade_item, decrement stock reservation by quantity
    product.stock = Math.max(0, product.stock - quantity);
    product.stock_count = product.stock;
    product.is_available = product.stock > 0;
    product.updated_at = new Date().toISOString();
    return { success: true };
  }

  static releaseReservation(orderId: string): void {
    const order = this.orders.find((o) => o.id === orderId);
    if (order) {
      // Never release reservation on orders that were successfully paid or fulfilled
      if (
        order.status === 'paid' ||
        order.status === 'delivered' ||
        order.status === 'completed' ||
        order.status === 'fulfillment'
      ) {
        return;
      }
      // Idempotency: avoid releasing the same order reservation multiple times
      if ((order as any).reservation_released) {
        return;
      }
    }

    const reservedItems = this.inventory.filter(
      (i) => i.order_id === orderId && i.status === 'reserved'
    );

    for (const item of reservedItems) {
      item.status = 'available';
      item.reserved_until = null;
      item.order_id = null;
      item.updated_at = new Date().toISOString();

      // Restore product stock
      const product = this.products.find((p) => p.id === item.product_id);
      if (product) {
        const unsoldStock = this.inventory.filter(
          (i) => i.product_id === product.id && i.status === 'available' && !i.is_sold
        ).length;
        product.stock = unsoldStock;
        product.stock_count = product.stock;
        product.is_available = product.stock > 0;
        product.updated_at = new Date().toISOString();
      }
    }

    // For manual_service or non-vault orders that held stock reservation
    if (
      order &&
      ((order as any).stock_reserved ||
        order.delivery_mode === 'manual_service' ||
        order.delivery_mode === 'trade_item')
    ) {
      const items =
        order.items && order.items.length > 0
          ? order.items
          : [{ product_id: (order as any).product_id, quantity: order.quantity || 1 }];

      for (const lineItem of items) {
        const prodId = lineItem.product_id || (lineItem as any).productId;
        const prod = this.products.find((p) => p.id === prodId);
        if (
          prod &&
          prod.delivery_mode !== 'auto_account' &&
          prod.delivery_mode !== 'digital_code' &&
          prod.product_type !== 'account'
        ) {
          const qty = Math.max(1, Number(lineItem.quantity) || 1);
          prod.stock = (prod.stock || 0) + qty;
          prod.stock_count = prod.stock;
          prod.is_available = prod.stock > 0;
          prod.updated_at = new Date().toISOString();
        }
      }
    }

    // If order had a coupon, restore it
    if (order && order.coupon_id) {
      const coupon = this.coupons.find((c) => c.id === order.coupon_id);
      if (coupon && coupon.used_in_order_id === orderId) {
        coupon.times_used = Math.max(0, coupon.times_used - 1);
        coupon.status = 'AVAILABLE';
        coupon.used_in_order_id = undefined;
        coupon.used_in_order_number = undefined;
        coupon.used_at = undefined;
      }
    }

    if (order) {
      (order as any).reservation_released = true;
      (order as any).stock_reserved = false;
    }
  }

  static consumeInventoryForOrder(orderId: string, productId: string): InventoryItem | null {
    let item = this.inventory.find(
      (i) => i.order_id === orderId && i.product_id === productId
    );

    if (!item) {
      // If it wasn't pre-reserved by item, find available and consume
      item = this.inventory.find(
        (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
      );
      if (item) {
        item.order_id = orderId;
      }
    }

    if (item) {
      const prod = this.products.find((p) => p.id === productId);
      if (prod?.delivery_mode === 'auto_account' || prod?.product_type === 'account') {
        item.status = 'sold';
      } else {
        item.status = 'consumed';
      }
      item.is_sold = true;
      item.reserved_until = null;
      item.updated_at = new Date().toISOString();

      if (prod) {
        const liveStock = this.inventory.filter(
          (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
        ).length;
        prod.stock = liveStock;
        prod.stock_count = liveStock;
        prod.is_available = liveStock > 0;
        prod.updated_at = new Date().toISOString();
      }

      this.persistToDisk();
      return item;
    }

    return null;
  }

  static consumeInventoryForOrderMulti(orderId: string, productId: string, quantity: number = 1): InventoryItem[] {
    const qty = Math.max(1, Number(quantity) || 1);
    let assigned = this.inventory.filter(
      (i) => i.order_id === orderId && i.product_id === productId
    );

    if (assigned.length < qty) {
      const needed = qty - assigned.length;
      const unassigned = this.inventory
        .filter((i) => i.product_id === productId && i.status === 'available' && !i.is_sold && !assigned.includes(i))
        .slice(0, needed);
      for (const item of unassigned) {
        item.order_id = orderId;
      }
      assigned = [...assigned, ...unassigned];
    }

    const prod = this.products.find((p) => p.id === productId);
    const consumed: InventoryItem[] = [];

    for (const item of assigned.slice(0, qty)) {
      if (prod?.delivery_mode === 'auto_account' || prod?.product_type === 'account') {
        item.status = 'sold';
      } else {
        item.status = 'consumed';
      }
      item.is_sold = true;
      item.reserved_until = null;
      item.updated_at = new Date().toISOString();
      consumed.push(item);
    }

    if (prod) {
      const liveStock = this.inventory.filter(
        (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
      ).length;
      prod.stock = liveStock;
      prod.stock_count = liveStock;
      prod.is_available = liveStock > 0;
      prod.updated_at = new Date().toISOString();
    }

    this.persistToDisk();
    return consumed;
  }

  static addInventoryItem(item: any): InventoryItem {
    const productId = item.product_id || item.productId;
    const prod = this.products.find((p) => p.id === productId);
    const itemType =
      item.item_type ||
      (prod?.delivery_mode === 'digital_code' ? 'code' : 'account');

    const payload = item.payload || {};
    const username = item.account_username || payload.username || null;
    const rawPass =
      item.raw_password ||
      payload.password ||
      (username ? 'Pass_' + Math.random().toString(36).substring(7) : null);
    const raw2fa = item.raw_2fa || payload.twoFactor || payload.two_factor || null;
    const rawEmailPass =
      item.raw_email_password || payload.emailPassword || payload.email_password || null;
    const email = item.email || payload.email || null;
    const backupCodes =
      item.raw_backup_codes || payload.backupCodes || payload.backup_codes || null;
    const code = item.digital_code || payload.code || null;
    const notes = item.notes || payload.notes || null;

    let encPass =
      item.encrypted_account_password || (rawPass ? encrypt(rawPass) : null);
    if (encPass && decrypt(encPass) === '[Encrypted Data]') {
      encPass = encrypt(encPass);
    }
    const encEmailPass =
      item.encrypted_email_password || (rawEmailPass ? encrypt(rawEmailPass) : null);
    let enc2fa =
      item.encrypted_account_2fa || (raw2fa ? encrypt(raw2fa) : null);
    if (enc2fa && decrypt(enc2fa) === '[Encrypted Data]') {
      enc2fa = encrypt(enc2fa);
    }
    const encBackup =
      item.encrypted_backup_codes || (backupCodes ? encrypt(backupCodes) : null);

    const newItem: InventoryItem = {
      id: uuidv4(),
      product_id: productId!,
      item_type: itemType,
      account_username: username,
      encrypted_account_password: encPass,
      encrypted_account_2fa: enc2fa,
      email: email,
      encrypted_email_password: encEmailPass,
      encrypted_backup_codes: encBackup,
      digital_code: code,
      notes: notes,
      status: item.status || 'available',
      reserved_until: null,
      order_id: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.inventory.push(newItem);

    // Sync stock of parent product
    if (prod) {
      prod.stock = this.getProductAvailableStock(prod.id);
      prod.updated_at = new Date().toISOString();
      if (prod.is_active && !prod.is_draft && prod.stock > 0) {
        this.recordPendingStockEvent(prod.id, 'restock', prod.stock);
      }
    }

    return newItem;
  }

  static updateInventoryItem(id: string, updates: any): InventoryItem | null {
    const item = this.inventory.find((i) => i.id === id);
    if (!item) return null;

    if (updates.status) item.status = updates.status;
    if (updates.account_username !== undefined) item.account_username = updates.account_username;
    if (updates.raw_password) item.encrypted_account_password = encrypt(updates.raw_password);
    if (updates.raw_2fa !== undefined) {
      item.encrypted_account_2fa = updates.raw_2fa ? encrypt(updates.raw_2fa) : null;
    }
    if (updates.digital_code !== undefined) item.digital_code = updates.digital_code;
    if (updates.notes !== undefined) item.notes = updates.notes;
    item.updated_at = new Date().toISOString();

    const prod = this.products.find((p) => p.id === item.product_id);
    if (prod) {
      prod.stock = this.getProductAvailableStock(prod.id);
      prod.updated_at = new Date().toISOString();
    }

    return item;
  }

  static deleteInventoryItem(id: string): boolean {
    const idx = this.inventory.findIndex((i) => i.id === id);
    if (idx >= 0) {
      const productId = this.inventory[idx].product_id;
      this.inventory.splice(idx, 1);
      const prod = this.products.find((p) => p.id === productId);
      if (prod) {
        prod.stock = this.getProductAvailableStock(prod.id);
        prod.updated_at = new Date().toISOString();
      }
      return true;
    }
    return false;
  }

  static bulkAddInventoryItems(productId: string, itemsList: any[]): { added: number; items: InventoryItem[] } {
    const addedItems: InventoryItem[] = [];
    for (const raw of itemsList) {
      const item = this.addInventoryItem({
        product_id: productId,
        ...raw,
      });
      addedItems.push(item);
    }
    return { added: addedItems.length, items: addedItems };
  }

  static depositInventoryItem(item: any): InventoryItem {
    return this.addInventoryItem(item);
  }

  static getInventoryByProductId(productId: string): InventoryItem[] {
    return this.inventory.filter((i) => i.product_id === productId);
  }

  static getInventoryList(): InventoryItem[] {
    return this.inventory;
  }

  // ================= COUPONS =================
  static validateCoupon(code: string, subtotal: number, telegramId?: number): {
    isValid: boolean;
    coupon?: Coupon;
    discountAmount: number;
    error?: string;
  } {
    if (!code) return { isValid: false, discountAmount: 0, error: 'COUPON_CODE_REQUIRED' };

    const coupon = this.coupons.find(
      (c) => c.code.toUpperCase() === code.trim().toUpperCase() && c.is_active
    );

    if (!coupon) {
      return { isValid: false, discountAmount: 0, error: 'INVALID_COUPON_CODE' };
    }

    if (coupon.status === 'USED' || (coupon.usage_limit !== null && coupon.times_used >= coupon.usage_limit)) {
      return { isValid: false, discountAmount: 0, error: 'COUPON_ALREADY_USED' };
    }

    if (coupon.status === 'REVOKED') {
      return { isValid: false, discountAmount: 0, error: 'COUPON_REVOKED' };
    }

    if (coupon.status === 'EXPIRED' || (coupon.expires_at && new Date(coupon.expires_at).getTime() < Date.now())) {
      coupon.status = 'EXPIRED';
      return { isValid: false, discountAmount: 0, error: 'COUPON_EXPIRED' };
    }

    // Check customer restriction if issued specifically to a customer
    if (coupon.customer_telegram_id && telegramId && coupon.customer_telegram_id !== telegramId) {
      return { isValid: false, discountAmount: 0, error: 'COUPON_NOT_VALID_FOR_USER' };
    }

    const subtotalCents = Math.round(subtotal * 100);
    const minOrderCents = Math.round((coupon.min_order_amount || 0) * 100);

    if (subtotalCents < minOrderCents) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Order subtotal must be at least $${(minOrderCents / 100).toFixed(2)}`,
      };
    }

    let discountCents = 0;
    if (coupon.discount_type === 'percentage') {
      discountCents = Math.round((subtotalCents * coupon.discount_value) / 100);
      if (coupon.max_discount_amount) {
        discountCents = Math.min(discountCents, Math.round(coupon.max_discount_amount * 100));
      }
    } else {
      discountCents = Math.round(coupon.discount_value * 100);
    }

    discountCents = Math.min(discountCents, subtotalCents);
    const discountAmount = discountCents / 100;

    return {
      isValid: true,
      coupon,
      discountAmount,
    };
  }

  static getCustomerCoupons(telegramId: number): Coupon[] {
    return this.coupons.filter(
      (c) => c.customer_telegram_id === telegramId
    );
  }

  static getCoupons(): Coupon[] {
    return this.coupons;
  }

  static createCoupon(coupon: Partial<Coupon>): Coupon {
    const newCoupon: Coupon = {
      id: uuidv4(),
      code: coupon.code!.toUpperCase().trim(),
      discount_type: coupon.discount_type || 'percentage',
      discount_value: Number(coupon.discount_value) || 10,
      min_order_amount: Number(coupon.min_order_amount) || 0,
      max_discount_amount: coupon.max_discount_amount ? Number(coupon.max_discount_amount) : null,
      usage_limit: coupon.usage_limit || null,
      times_used: 0,
      per_user_limit: coupon.per_user_limit || 1,
      customer_telegram_id: coupon.customer_telegram_id || null,
      status: coupon.status || 'AVAILABLE',
      expires_at: coupon.expires_at || null,
      is_active: coupon.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.coupons.unshift(newCoupon);
    return newCoupon;
  }

  static updateCoupon(id: string, updates: Partial<Coupon>): Coupon | null {
    const coupon = this.coupons.find((c) => c.id === id);
    if (!coupon) return null;
    Object.assign(coupon, updates, { updated_at: new Date().toISOString() });
    return coupon;
  }

  static deleteCoupon(id: string): boolean {
    const idx = this.coupons.findIndex((c) => c.id === id);
    if (idx >= 0) {
      this.coupons.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ================= REDEEM CODES =================
  private static async acquireCodeLock(code: string): Promise<() => void> {
    const key = code.toUpperCase().trim();
    while (this.codeLocks.has(key)) {
      try {
        await this.codeLocks.get(key);
      } catch {}
    }
    let resolver: () => void;
    const promise = new Promise<void>((resolve) => {
      resolver = resolve;
    });
    this.codeLocks.set(key, promise);
    return () => {
      this.codeLocks.delete(key);
      resolver!();
    };
  }

  static getRedeemCodes(): RedeemCode[] {
    return this.redeemCodes;
  }

  static getRedeemCodeById(id: string): RedeemCode | null {
    return this.redeemCodes.find((c) => c.id === id) || null;
  }

  static getRedeemCodeByCode(code: string): RedeemCode | null {
    if (!code) return null;
    const clean = code.trim().toUpperCase();
    return this.redeemCodes.find((c) => c.code.toUpperCase() === clean) || null;
  }

  static getRedeemCodeUsages(codeId?: string): RedeemCodeUsage[] {
    if (codeId) {
      return this.redeemCodeUsages.filter((u) => u.code_id === codeId);
    }
    return this.redeemCodeUsages;
  }

  static getUserRedeemCodeUsages(telegramId: number, codeId?: string): RedeemCodeUsage[] {
    return this.redeemCodeUsages.filter(
      (u) => u.telegram_id === telegramId && (!codeId || u.code_id === codeId)
    );
  }

  static createRedeemCode(data: Partial<RedeemCode>): RedeemCode {
    const cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) {
      throw new AppError('Redeem code is required', 400, 'CODE_REQUIRED');
    }

    const existing = this.getRedeemCodeByCode(cleanCode);
    if (existing) {
      throw new AppError('Redeem code already exists', 409, 'CODE_EXISTS');
    }

    const rewardType = data.reward_type || 'points';
    let rewardAmount = Math.max(0, Math.floor(Number(data.reward_amount) || 0));
    const rewardData: any = data.reward_data ? { ...data.reward_data } : {};

    if (rewardType === 'points' && rewardAmount <= 0) {
      throw new AppError('Points reward amount must be a positive integer', 400, 'INVALID_REWARD_AMOUNT');
    }
    if (rewardType === 'gacha_tickets' && rewardAmount <= 0) {
      throw new AppError('Gacha tickets reward amount must be a positive integer', 400, 'INVALID_REWARD_AMOUNT');
    }
    if (rewardType === 'discount_coupon') {
      const discountType = rewardData.discount_type === 'fixed' ? 'fixed' : 'percentage';
      const discountValue = Number(rewardData.discount_value) || 10;
      if (discountValue <= 0) {
        throw new AppError('Discount value must be greater than zero', 400, 'INVALID_DISCOUNT_VALUE');
      }
      if (discountType === 'percentage' && discountValue > 100) {
        throw new AppError('Percentage discount cannot exceed 100%', 400, 'INVALID_DISCOUNT_VALUE');
      }
      rewardData.discount_type = discountType;
      rewardData.discount_value = discountValue;
      rewardData.min_order_amount = Math.max(0, Number(rewardData.min_order_amount) || 0);
      if (rewardData.max_discount_amount !== undefined && rewardData.max_discount_amount !== null) {
        rewardData.max_discount_amount = Number(rewardData.max_discount_amount);
      }
    }

    const useMode: RedeemCodeUseMode = data.use_mode || 'one_per_member';
    let maxUses: number | null = null;
    let perUserLimit = 1;

    if (useMode === 'single_use') {
      maxUses = 1;
      perUserLimit = 1;
    } else if (useMode === 'one_per_member') {
      perUserLimit = 1;
      maxUses = data.max_uses !== undefined && data.max_uses !== null ? Math.max(1, Math.floor(Number(data.max_uses))) : null;
    } else {
      // reusable
      perUserLimit = Math.max(1, Math.floor(Number(data.per_user_limit) || 1));
      maxUses = data.max_uses !== undefined && data.max_uses !== null ? Math.max(perUserLimit, Math.floor(Number(data.max_uses))) : null;
    }

    const newCode: RedeemCode = {
      id: data.id || uuidv4(),
      code: cleanCode,
      reward_type: rewardType,
      reward_amount: rewardAmount,
      reward_data: rewardData,
      use_mode: useMode,
      max_uses: maxUses,
      times_used: 0,
      per_user_limit: perUserLimit,
      is_active: data.is_active ?? true,
      expires_at: data.expires_at || null,
      created_by: data.created_by || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    this.redeemCodes.unshift(newCode);

    // Sync to PostgreSQL if configured
    if (isPostgresConfigured()) {
      pgPool.query(
        `INSERT INTO redeem_codes (id, code, reward_type, reward_amount, reward_data, use_mode, max_uses, times_used, per_user_limit, is_active, expires_at, created_by, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, 0, $8, $9, $10, $11, NOW(), NOW())
         ON CONFLICT (code) DO NOTHING`,
        [
          newCode.id,
          newCode.code,
          newCode.reward_type,
          newCode.reward_amount,
          JSON.stringify(newCode.reward_data),
          newCode.use_mode,
          newCode.max_uses,
          newCode.per_user_limit,
          newCode.is_active,
          newCode.expires_at,
          String(newCode.created_by || ''),
        ]
      ).catch((err) => console.warn('[DataStore] createRedeemCode postgres error:', err?.message));
    }

    return newCode;
  }

  static updateRedeemCode(id: string, updates: Partial<RedeemCode>): RedeemCode | null {
    const code = this.redeemCodes.find((c) => c.id === id);
    if (!code) return null;

    if (updates.is_active !== undefined) code.is_active = Boolean(updates.is_active);
    if (updates.expires_at !== undefined) code.expires_at = updates.expires_at;
    if (updates.max_uses !== undefined) code.max_uses = updates.max_uses;
    if (updates.per_user_limit !== undefined) code.per_user_limit = Math.max(1, Math.floor(Number(updates.per_user_limit)));
    code.updated_at = new Date().toISOString();

    if (isPostgresConfigured()) {
      pgPool.query(
        `UPDATE redeem_codes
         SET is_active = $1, expires_at = $2, max_uses = $3, per_user_limit = $4, updated_at = NOW()
         WHERE id = $5`,
        [code.is_active, code.expires_at, code.max_uses, code.per_user_limit, code.id]
      ).catch((err) => console.warn('[DataStore] updateRedeemCode postgres error:', err?.message));
    }

    return code;
  }

  static deleteRedeemCode(id: string): boolean {
    const idx = this.redeemCodes.findIndex((c) => c.id === id);
    if (idx < 0) return false;

    const code = this.redeemCodes[idx];
    const hasUsages = this.redeemCodeUsages.some((u) => u.code_id === id);

    if (hasUsages) {
      // Soft-deactivate to preserve audit history and foreign keys
      code.is_active = false;
      code.updated_at = new Date().toISOString();
      if (isPostgresConfigured()) {
        pgPool.query('UPDATE redeem_codes SET is_active = false, updated_at = NOW() WHERE id = $1', [id])
          .catch((err) => console.warn('[DataStore] deactivate postgres error:', err?.message));
      }
      return true;
    }

    this.redeemCodes.splice(idx, 1);
    if (isPostgresConfigured()) {
      pgPool.query('DELETE FROM redeem_codes WHERE id = $1', [id])
        .catch((err) => console.warn('[DataStore] deleteRedeemCode postgres error:', err?.message));
    }
    return true;
  }

  static async redeemCode(
    telegramId: number,
    codeStr: string,
    _idempotencyKey?: string
  ): Promise<RedeemCodeResult> {
    if (!telegramId) {
      return { success: false, error_code: 'UNAUTHORIZED', error: 'Authentication required' };
    }

    const clean = (codeStr || '').trim().toUpperCase();
    if (!clean) {
      return { success: false, error_code: 'INVALID_CODE', error: 'Please enter a redeem code' };
    }

    // Acquire serialized lock on this code to guarantee 100% atomic execution and race condition protection
    const releaseLock = await this.acquireCodeLock(clean);

    try {
      // Ensure member profile exists
      let profile = this.profiles.get(telegramId);
      if (!profile) {
        this.findOrCreateTelegramUser({ telegram_id: telegramId, first_name: 'Member' });
        profile = this.profiles.get(telegramId)!;
      }

      // Check existence
      const code = this.getRedeemCodeByCode(clean);
      if (!code) {
        return { success: false, error_code: 'INVALID_CODE', error: 'Invalid or unrecognized redeem code' };
      }

      // Check active state
      if (!code.is_active) {
        return { success: false, error_code: 'CODE_DISABLED', error: 'This redeem code is currently inactive' };
      }

      // Check expiry
      if (code.expires_at && new Date(code.expires_at).getTime() < Date.now()) {
        code.is_active = false;
        return { success: false, error_code: 'CODE_EXPIRED', error: 'This redeem code has expired' };
      }

      // Check total maximum uses
      if (code.max_uses !== null && code.times_used >= code.max_uses) {
        return { success: false, error_code: 'CODE_EXHAUSTED', error: 'This redeem code has reached its maximum redemption limit' };
      }

      // Check member redemption limit
      const priorMemberUsages = this.redeemCodeUsages.filter(
        (u) => u.code_id === code.id && u.telegram_id === telegramId
      );
      if (priorMemberUsages.length >= code.per_user_limit) {
        return { success: false, error_code: 'MEMBER_LIMIT_REACHED', error: 'You have already redeemed this code' };
      }

      // Atomically increment times_used
      code.times_used += 1;
      code.updated_at = new Date().toISOString();

      // Record usage audit entry
      const usageId = uuidv4();
      const usageEntry: RedeemCodeUsage = {
        id: usageId,
        code_id: code.id,
        code: code.code,
        telegram_id: telegramId,
        reward_type: code.reward_type,
        reward_value: code.reward_amount || (code.reward_data as any)?.discount_value || 0,
        reward_data: code.reward_data || {},
        created_at: new Date().toISOString(),
      };
      this.redeemCodeUsages.unshift(usageEntry);

      // Apply the reward atomically
      try {
        if (code.reward_type === 'points') {
          const ledgerResult = this.addPointTransaction(
            telegramId,
            code.reward_amount,
            'redeem_code',
            `Redeemed Code: ${code.code}`,
            code.id
          );

          return {
            success: true,
            code: code.code,
            reward_type: 'points',
            reward_amount: code.reward_amount,
            reward_title: `${code.reward_amount.toLocaleString()} Uchiro Points`,
            reward_description: `Added ${code.reward_amount.toLocaleString()} reward points to your account balance`,
            points_balance: ledgerResult.newBalance,
            tickets_balance: profile.gacha_tickets || 0,
          };
        } else if (code.reward_type === 'gacha_tickets') {
          const qty = code.reward_amount;
          profile.gacha_tickets = (profile.gacha_tickets || 0) + qty;
          profile.updated_at = new Date().toISOString();

          const user = this.users.get(telegramId);
          if (user) {
            user.gacha_tickets = profile.gacha_tickets;
          }

          persistTicketsDelta(telegramId, qty).catch(() => {});

          return {
            success: true,
            code: code.code,
            reward_type: 'gacha_tickets',
            reward_amount: qty,
            reward_title: `${qty} Gacha Ticket${qty > 1 ? 's' : ''}`,
            reward_description: `Added ${qty} Gacha Ticket${qty > 1 ? 's' : ''} to your inventory`,
            points_balance: profile.points || 0,
            tickets_balance: profile.gacha_tickets,
          };
        } else if (code.reward_type === 'discount_coupon') {
          const cData = (code.reward_data || {}) as CouponRewardData;
          const couponSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
          const memberSuffix = Math.abs(telegramId).toString(36).toUpperCase().slice(-4);
          const generatedCode = `UCH-${code.code.slice(0, 4)}-${couponSuffix}-${memberSuffix}`;

          const newCoupon = this.createCoupon({
            code: generatedCode,
            discount_type: cData.discount_type || 'fixed',
            discount_value: Number(cData.discount_value) || 1.0,
            min_order_amount: Number(cData.min_order_amount) || 0,
            max_discount_amount: cData.max_discount_amount !== undefined ? cData.max_discount_amount : null,
            usage_limit: 1,
            per_user_limit: 1,
            customer_telegram_id: telegramId,
            status: 'AVAILABLE',
            is_active: true,
            expires_at: code.expires_at || new Date(Date.now() + 30 * 86400000).toISOString(),
          });

          const discountLabel =
            cData.discount_type === 'percentage'
              ? `${cData.discount_value}% OFF`
              : `$${Number(cData.discount_value).toFixed(2)} OFF`;

          return {
            success: true,
            code: code.code,
            reward_type: 'discount_coupon',
            reward_amount: Number(cData.discount_value),
            reward_title: `${discountLabel} Store Coupon`,
            reward_description: `Coupon ${newCoupon.code} added to your wallet (Min order: $${Number(cData.min_order_amount || 0).toFixed(2)})`,
            points_balance: profile.points || 0,
            tickets_balance: profile.gacha_tickets || 0,
            coupon: newCoupon,
          };
        } else {
          throw new Error(`Unsupported reward type: ${code.reward_type}`);
        }
      } catch (rewardErr: any) {
        // Rollback atomic increment and usage entry
        code.times_used = Math.max(0, code.times_used - 1);
        const uIdx = this.redeemCodeUsages.findIndex((u) => u.id === usageId);
        if (uIdx >= 0) this.redeemCodeUsages.splice(uIdx, 1);
        console.error('[DataStore] Reward application error:', rewardErr?.message);
        return { success: false, error_code: 'SYSTEM_ERROR', error: 'Failed to apply reward to account' };
      }
    } finally {
      releaseLock();
    }
  }

  // ================= ORDERS =================
  static createOrder(data: {
    customerId: string;
    telegramId: number;
    productId: string;
    quantity?: number;
    couponCode?: string;
    robloxUsername?: string;
    robloxDisplayName?: string;
    robloxUserId?: string;
    idempotencyKey?: string;
    buyerConfirmedAge18?: boolean;
    buyerUnder18?: boolean;
    items?: Array<{ productId: string; quantity: number }>;
  }): { success: boolean; order?: Order; error?: string } {
    // Check idempotency (Customer-scoped to avoid key sharing across customers)
    if (data.idempotencyKey) {
      const existing = this.orders.find((o) => o.idempotency_key === data.idempotencyKey);
      if (existing) {
        if (
          (data.customerId && existing.customer_id !== data.customerId) ||
          (data.telegramId && existing.telegram_id !== data.telegramId)
        ) {
          return { success: false, error: 'IDEMPOTENCY_KEY_CONFLICT' };
        }
        return { success: true, order: existing };
      }
    }

    const product = this.products.find((p) => p.id === data.productId);
    if (!product || !product.is_active || product.is_draft) {
      return { success: false, error: 'PRODUCT_NOT_AVAILABLE' };
    }

    // MULTI-QUANTITY ENFORCEMENT:
    // Validate quantity is a positive whole integer
    let quantity = 1;
    if (data.quantity !== undefined && data.quantity !== null) {
      const numQty = Number(data.quantity);
      if (!Number.isInteger(numQty) || numQty <= 0) {
        return { success: false, error: 'INVALID_QUANTITY' };
      }
      if (numQty > 100) {
        return { success: false, error: 'EXCESSIVE_QUANTITY' };
      }
      quantity = Math.floor(numQty);
    }

    // Lock auto_account strictly to 1.
    if (product.delivery_mode === 'auto_account' || product.product_type === 'account') {
      if (quantity > 1) {
        return { success: false, error: 'INVALID_QUANTITY' };
      }
      quantity = 1;
    }

    const availableStock = this.getProductAvailableStock(product.id);
    if (availableStock < quantity) {
      return { success: false, error: 'INSUFFICIENT_STOCK' };
    }

    if (product.requires_roblox_username && (!data.robloxUsername || data.robloxUsername.trim().length === 0)) {
      return { success: false, error: 'ROBLOX_USERNAME_REQUIRED' };
    }

    // Age confirmation check (Applicable strictly and only to Robux products)
    const isRobuxProduct =
      product.category_id === 'robux' ||
      (product.product_type as string) === 'robux' ||
      (product.delivery_mode as string) === 'robux';
    if (isRobuxProduct) {
      if (data.buyerUnder18 === true) {
        return { success: false, error: 'UNDER_18_PURCHASE_BLOCKED' };
      }
      if (data.buyerConfirmedAge18 !== true) {
        return { success: false, error: 'AGE_CONFIRMATION_REQUIRED' };
      }
    }

    const orderId = uuidv4();
    const orderNumber = `UCH-${Math.floor(100000 + Math.random() * 900000)}`;

    // Multi-line items or single-item atomic reservation
    const lineItems: Array<{
      id: string;
      order_id: string;
      product_id: string;
      product_title: string;
      price: number;
      quantity: number;
      delivery_data: any;
      created_at: string;
    }> = [];

    let subtotal = 0;

    if (data.items && Array.isArray(data.items) && data.items.length > 0) {
      // Step A: Pre-validate all items and calculate aggregate quantities
      const aggQuantities = new Map<string, number>();
      for (const itemInput of data.items) {
        const itemProd = this.products.find((p) => p.id === itemInput.productId);
        if (!itemProd || !itemProd.is_active || itemProd.is_draft) {
          return { success: false, error: 'PRODUCT_NOT_AVAILABLE' };
        }
        const itemQty = Number(itemInput.quantity);
        if (!Number.isInteger(itemQty) || itemQty <= 0) {
          return { success: false, error: 'INVALID_QUANTITY' };
        }
        aggQuantities.set(itemProd.id, (aggQuantities.get(itemProd.id) || 0) + itemQty);
      }

      // Step B: Check aggregate stock for all products
      for (const [prodId, totalRequested] of aggQuantities.entries()) {
        const available = this.getProductAvailableStock(prodId);
        if (available < totalRequested) {
          return { success: false, error: 'INSUFFICIENT_STOCK' };
        }
      }

      // Step C: Atomically reserve all items. If ANY fails, roll back all immediately!
      for (const itemInput of data.items) {
        const itemProd = this.products.find((p) => p.id === itemInput.productId)!;
        const itemQty = Math.floor(Number(itemInput.quantity));
        const reserveRes = this.reserveInventoryAtomic(itemProd.id, orderId, itemQty);
        if (!reserveRes.success) {
          this.releaseReservation(orderId);
          return { success: false, error: reserveRes.error || 'INSUFFICIENT_STOCK' };
        }
        lineItems.push({
          id: uuidv4(),
          order_id: orderId,
          product_id: itemProd.id,
          product_title: itemProd.title,
          price: itemProd.price, // Trusted server price
          quantity: itemQty,
          delivery_data: null,
          created_at: new Date().toISOString(),
        });
      }

      subtotal = Number(lineItems.reduce((acc, it) => acc + (it.price * it.quantity), 0).toFixed(2));
      quantity = lineItems.reduce((acc, it) => acc + it.quantity, 0);
    } else {
      const reserveResult = this.reserveInventoryAtomic(product.id, orderId, quantity);
      if (!reserveResult.success) {
        return { success: false, error: reserveResult.error };
      }
      lineItems.push({
        id: uuidv4(),
        order_id: orderId,
        product_id: product.id,
        product_title: product.title,
        price: product.price, // Trusted server price
        quantity,
        delivery_data: null,
        created_at: new Date().toISOString(),
      });
      subtotal = Number((product.price * quantity).toFixed(2));
    }

    // Calculate coupon & trusted total
    let discount = 0;
    let couponId: string | null = null;

    if (data.couponCode) {
      const validation = this.validateCoupon(data.couponCode, subtotal, data.telegramId);
      if (!validation.isValid || !validation.coupon) {
        // Rollback reservation if coupon is invalid
        this.releaseReservation(orderId);
        return { success: false, error: validation.error || 'INVALID_COUPON_CODE' };
      }
      discount = validation.discountAmount;
      couponId = validation.coupon.id;
      validation.coupon.times_used += 1;
      validation.coupon.status = 'USED';
      validation.coupon.used_in_order_id = orderId;
      validation.coupon.used_in_order_number = orderNumber;
      validation.coupon.used_at = new Date().toISOString();
    }

    const totalCents = Math.max(10, Math.round(subtotal * 100) - Math.round(discount * 100));
    const total = totalCents / 100;

    const order: Order = {
      id: orderId,
      order_number: orderNumber,
      customer_id: data.customerId,
      telegram_id: data.telegramId,
      status: 'pending_payment',
      subtotal,
      discount_amount: discount,
      total_amount: total,
      quantity,
      coupon_id: couponId,
      roblox_username: data.robloxUsername?.trim() || null,
      roblox_display_name: data.robloxDisplayName?.trim() || null,
      roblox_user_id: data.robloxUserId?.trim() || null,
      delivery_mode: product.delivery_mode,
      delivery_credentials: null,
      fulfillment_notes: null,
      delivered_at: null,
      warranty_days: (product.delivery_mode === 'auto_account' || (product as any).product_type === 'account')
        ? (product.warranty_days || this.storeSettings.default_warranty_days || 14)
        : 0,
      warranty_status: (product.delivery_mode === 'auto_account' || (product as any).product_type === 'account')
        ? 'pending'
        : 'none',
      warranty_starts_at: null,
      warranty_expires_at: null,
      warranty_notes: (product.delivery_mode === 'auto_account' || (product as any).product_type === 'account')
        ? 'Warranty starts automatically upon verified payment.'
        : null,
      idempotency_key: data.idempotencyKey || null,
      admin_notified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: lineItems,
    };

    (order as any).stock_reserved = true;
    (order as any).reservation_released = false;
    (order as any).stock_deducted = false;

    this.orders.unshift(order);
    return { success: true, order };
  }

  public static saveToDisk(): void {
    // Disk sync removed in V3 (ephemeral filesystem on Railway)
  }

  public static persistToDisk(): void {
    // Disk sync removed in V3 (ephemeral filesystem on Railway)
  }

  public static loadFromDisk(): void {
    // Disk sync removed in V3 (ephemeral filesystem on Railway)
  }

  static shouldAlertLowStock(productId: string, currentStock: number): boolean {
    if (!this.alertedStockThresholds.has(productId)) {
      this.alertedStockThresholds.set(productId, new Set());
    }
    const alerted = this.alertedStockThresholds.get(productId)!;

    // Reset debounce if stock was replenished above low stock threshold (> 2)
    if (currentStock > 2) {
      alerted.clear();
      return false;
    }

    // Threshold 2: <= 2 and > 0
    if (currentStock <= 2 && currentStock > 0) {
      if (!alerted.has(2)) {
        alerted.add(2);
        return true;
      }
      return false;
    }

    // Threshold 0: stockout (0 remaining)
    if (currentStock <= 0) {
      if (!alerted.has(0)) {
        alerted.add(0);
        return true;
      }
      return false;
    }

    return false;
  }

  static handleOrderInventoryDeduction(order: Order): void {
    if ((order as any).stock_deducted) {
      return;
    }

    const items =
      order.items && order.items.length > 0
        ? order.items
        : [{ product_id: (order as any).product_id, quantity: order.quantity || 1 }];

    for (const lineItem of items) {
      const productId = lineItem.product_id;
      if (!productId) continue;
      const product = this.products.find((p) => p.id === productId);
      if (!product) continue;

      const orderQty = Math.max(1, Number(lineItem.quantity) || 1);

      if (product.delivery_mode === 'auto_account' || product.product_type === 'account') {
        const assignedItems = this.inventory.filter(
          (i) => i.order_id === order.id && i.product_id === productId && (i.status === 'sold' || i.is_sold || i.status === 'consumed')
        );
        if (assignedItems.length === 0) {
          const reserved = this.inventory
            .filter((i) => i.order_id === order.id && i.product_id === productId)
            .slice(0, orderQty);
          for (const it of reserved) {
            it.status = 'sold';
            it.is_sold = true;
            it.updated_at = new Date().toISOString();
          }
        }

        const unsoldStock = this.inventory.filter(
          (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
        ).length;
        product.stock = unsoldStock;
        product.stock_count = unsoldStock;
        product.is_available = unsoldStock > 0;
        product.updated_at = new Date().toISOString();
      } else if (product.delivery_mode === 'digital_code') {
        const assignedItems = this.inventory.filter(
          (i) => i.order_id === order.id && i.product_id === productId && (i.status === 'sold' || i.is_sold || i.status === 'consumed')
        );
        if (assignedItems.length === 0) {
          const reserved = this.inventory
            .filter((i) => i.order_id === order.id && i.product_id === productId)
            .slice(0, orderQty);
          for (const it of reserved) {
            it.status = 'consumed';
            it.is_sold = true;
            it.updated_at = new Date().toISOString();
          }
        }

        const unsoldStock = this.inventory.filter(
          (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
        ).length;
        product.stock = unsoldStock;
        product.stock_count = unsoldStock;
        product.is_available = unsoldStock > 0;
        product.updated_at = new Date().toISOString();
      } else {
        // manual_service, trade_item, or general non-vault product
        // If stock was ALREADY deducted during reservation, do NOT subtract again!
        if (!(order as any).stock_reserved) {
          const remaining = Math.max(0, (product.stock || 0) - orderQty);
          product.stock = remaining;
        }
        product.stock_count = product.stock;
        product.is_available = product.stock > 0;
        product.updated_at = new Date().toISOString();
      }
    }

    (order as any).stock_deducted = true;
    (order as any).stock_reserved = false;
    this.persistToDisk();
  }

  static getOrderById(orderId: string): Order | null {
    return this.orders.find((o) => o.id === orderId || o.order_number === orderId) || null;
  }

  static getOrderByNumber(orderNumber: string): Order | null {
    return this.orders.find((o) => o.order_number === orderNumber || o.id === orderNumber) || null;
  }

  static saveOrder(order: Order): Order {
    const idx = this.orders.findIndex((o) => o.id === order.id);
    if (idx >= 0) {
      this.orders[idx] = order;
    } else {
      this.orders.unshift(order);
    }
    this.persistToDisk();
    return order;
  }

  static deleteOrder(orderId: string): boolean {
    const idx = this.orders.findIndex((o) => o.id === orderId);
    if (idx >= 0) {
      this.orders.splice(idx, 1);
      this.persistToDisk();
      return true;
    }
    return false;
  }

  static getOrdersByCustomer(telegramId: number): Order[] {
    return this.orders
      .filter((o) => o.telegram_id === Number(telegramId) || String(o.telegram_id) === String(telegramId))
      .sort((a, b) => {
        const timeA = new Date(a.created_at).getTime();
        const timeB = new Date(b.created_at).getTime();
        if (timeA !== timeB) return timeB - timeA;
        return (b.id || '').localeCompare(a.id || '');
      })
      .map((o) => ({ ...o, total_price: o.total_price ?? o.total_amount }));
  }

  static getOrdersByTelegramId(telegramId: number): Order[] {
    return this.getOrdersByCustomer(telegramId);
  }

  static getAllOrdersAdmin(): Order[] {
    return this.orders;
  }

  static updateOrderStatus(orderId: string, status: Order['status'], notes?: string): Order | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;

    order.status = status;
    order.updated_at = new Date().toISOString();
    if (notes) order.fulfillment_notes = notes;

    if (status === 'delivered') {
      order.delivered_at = new Date().toISOString();
    }

    if (status === 'paid' || status === 'delivered') {
      this.handleOrderInventoryDeduction(order);
    }

    this.persistToDisk();
    return order;
  }

  // ================= PAYMENTS =================
  static savePayment(payment: Payment): Payment {
    const idx = this.payments.findIndex((p) => p.id === payment.id);
    if (idx >= 0) {
      this.payments[idx] = payment;
      return payment;
    }
    this.payments.unshift(payment);
    return payment;
  }

  static getPaymentByOrderId(orderId: string): Payment | null {
    return this.payments.find((p) => p.order_id === orderId) || null;
  }

  static getPaymentById(paymentId: string): Payment | null {
    if (!paymentId) return null;
    return (
      this.payments.find(
        (p) =>
          p.id === paymentId ||
          p.md5_hash === paymentId ||
          p.order_id === paymentId ||
          p.transaction_reference === paymentId
      ) || null
    );
  }

  static getPendingPayments(): Payment[] {
    return this.payments.filter((p) => p.status === 'pending');
  }

  // ================= GACHA =================
  static formatPrizePayload(prize: GachaPrize): GachaPrize {
    return {
      ...prize,
      name: prize.title,
      image: prize.icon_url,
      icon: (prize as any).icon || prize.icon_url,
    } as any;
  }

  static getRecentWinners(limit: number = 10): any[] {
    return this.gachaSpins
      .slice(-limit)
      .reverse()
      .map((spin) => {
        const prize = this.gachaPrizes.find((p) => p.id === spin.prize_id);
        const user = this.users.get(spin.telegram_id);
        const firstName = user?.first_name || 'Player';
        return {
          id: spin.id,
          username: user?.username || undefined,
          first_name: firstName,
          prize_name: prize?.title || 'Reward Prize',
          prize_title: prize?.title || 'Reward Prize',
          rarity: spin.rarity,
          won_at: spin.created_at,
          image: prize?.icon_url || null,
          icon_url: prize?.icon_url || null,
        };
      });
  }

  static getGachaPools(): (GachaPool & {
    prizes: GachaPrize[];
    currentPrize: GachaPrize | null;
    nextPrize: GachaPrize | null;
  })[] {
    return this.gachaPools
      .filter((p) => p.is_active)
      .map((pool) => {
        const poolPrizes = this.gachaPrizes.filter((pr) => pr.pool_id === pool.id);
        const activePrizes = poolPrizes.filter((pr) => pr.is_active).map((pr) => this.formatPrizePayload(pr));
        const currentPrize = activePrizes.find((p) => p.slot_status === 'current') || null;
        const rawDraft = poolPrizes.find((p) => p.slot_status === 'draft') || null;
        const nextPrize = rawDraft ? this.formatPrizePayload(rawDraft) : null;
        return {
          ...pool,
          prizes: activePrizes,
          currentPrize,
          nextPrize,
        };
      });
  }

  static getGachaPoolById(poolId: string): (GachaPool & {
    prizes: GachaPrize[];
    currentPrize: GachaPrize | null;
    nextPrize: GachaPrize | null;
  }) | null {
    const pool = this.gachaPools.find((p) => p.id === poolId);
    if (!pool) return null;
    const poolPrizes = this.gachaPrizes.filter((pr) => pr.pool_id === pool.id);
    const activePrizes = poolPrizes.filter((pr) => pr.is_active).map((pr) => this.formatPrizePayload(pr));
    const currentPrize = activePrizes.find((p) => p.slot_status === 'current') || null;
    const rawDraft = poolPrizes.find((p) => p.slot_status === 'draft') || null;
    const nextPrize = rawDraft ? this.formatPrizePayload(rawDraft) : null;
    return {
      ...pool,
      prizes: activePrizes,
      currentPrize,
      nextPrize,
    };
  }

  public static getActiveGachaPool(): any {
    const pools = this.getGachaPools();
    if (pools && pools.length > 0) {
      const active = pools.find((p) => p.is_active);
      return active || pools[0];
    }
    const rawActive = this.gachaPools.find((p) => p.is_active);
    return rawActive || this.gachaPools[0] || null;
  }

  public static getGachaPrizesByPoolId(poolId?: string): any[] {
    const targetPoolId = poolId || this.getActiveGachaPool()?.id;
    if (!targetPoolId) return [];
    const pool = this.getGachaPoolById(targetPoolId);
    if (pool && pool.prizes && pool.prizes.length > 0) {
      return pool.prizes;
    }
    return this.gachaPrizes
      .filter((pr) => pr.pool_id === targetPoolId)
      .map((pr) => this.formatPrizePayload(pr));
  }

  static getGachaStatus(telegramId: number): {
    points: number;
    tickets: number;
    ticketCost: number;
    canRoll: boolean;
    cooldownSecondsRemaining: number;
    nextRollAt: string | null;
    lastRollAt: string | null;
    currentPrize: GachaPrize | null;
    nextPrize: GachaPrize | null;
    nextDraftPrize: GachaPrize | null;
    userState: {
      points: number;
      tickets: number;
      cooldownUntil: string | null;
    };
    recentWinners: any[];
  } {
    let profile = this.profiles.get(telegramId);
    if (!profile) {
      this.findOrCreateTelegramUser({ telegram_id: telegramId, first_name: 'Player' });
      profile = this.profiles.get(telegramId)!;
    }

    const now = Date.now();
    let cooldownRemaining = 0;
    if (profile.next_gacha_roll_at) {
      const nextTime = new Date(profile.next_gacha_roll_at).getTime();
      if (nextTime > now) {
        cooldownRemaining = Math.ceil((nextTime - now) / 1000);
      }
    }

    const tickets = profile.gacha_tickets ?? 0;
    const canRoll = tickets >= 1 && cooldownRemaining === 0;

    // Find prizes from the user's active pool
    const lastSpin = this.gachaSpins.find((s) => s.telegram_id === telegramId);
    const activePool = this.gachaPools.find((p) => p.is_active);
    const userPoolId = lastSpin?.pool_id || activePool?.id || (this.gachaPrizes.length > 0 ? this.gachaPrizes[0].pool_id : null);
    const pool = this.getGachaPoolById(userPoolId || '');
    const activePrizes = pool?.prizes || [];

    // Find current prize (slot_status === 'current' and is_active)
    const currentPrize = activePrizes.find((p) => p.slot_status === 'current') || null;

    // Find next draft prize (slot_status === 'draft') from the pool prizes
    const poolAllPrizes = this.gachaPrizes.filter((p) => p.pool_id === (userPoolId || pool?.id));
    const rawDraft = poolAllPrizes.find((p) => p.slot_status === 'draft') || null;
    const nextPrize = rawDraft ? this.formatPrizePayload(rawDraft) : null;

    const userState = {
      points: profile.points,
      tickets,
      cooldownUntil: profile.next_gacha_roll_at || null,
    };

    const recentWinners = this.getRecentWinners(10);

    return {
      points: profile.points,
      tickets,
      ticketCost: this.storeSettings.gacha_ticket_points_cost || 100,
      canRoll,
      cooldownSecondsRemaining: cooldownRemaining,
      nextRollAt: profile.next_gacha_roll_at || null,
      lastRollAt: profile.last_gacha_roll_at || null,
      currentPrize,
      nextPrize,
      nextDraftPrize: nextPrize,
      userState,
      recentWinners,
    };
  }

  static buyGachaTickets(
    telegramId: number,
    quantity: number = 1
  ): {
    success: boolean;
    tickets: number;
    newBalance: number;
    error?: string;
  } {
    if (quantity <= 0) return { success: false, tickets: 0, newBalance: 0, error: 'INVALID_QUANTITY' };
    const costPerTicket = this.storeSettings.gacha_ticket_points_cost || 100;
    const totalCost = quantity * costPerTicket;

    let profile = this.profiles.get(telegramId);
    if (!profile) {
      this.findOrCreateTelegramUser({ telegram_id: telegramId, first_name: 'Player' });
      profile = this.profiles.get(telegramId)!;
    }

    if (profile.points < totalCost) {
      return {
        success: false,
        tickets: profile.gacha_tickets || 0,
        newBalance: profile.points,
        error: 'INSUFFICIENT_POINTS',
      };
    }

    // Deduct points atomically via point ledger
    profile.gacha_tickets = (profile.gacha_tickets || 0) + quantity;
    profile.updated_at = new Date().toISOString();
    persistTicketsDelta(telegramId, quantity).catch(() => {});

    // Ledger transaction
    this.addPointTransaction(
      telegramId,
      -totalCost,
      'gacha_ticket',
      `-${totalCost} Gacha Ticket${quantity > 1 ? 's' : ''}`
    );

    return {
      success: true,
      tickets: profile.gacha_tickets,
      newBalance: profile.points,
    };
  }

  static spinGacha(
    poolId: string,
    customerId: string,
    telegramId: number,
    idempotencyKey?: string
  ): {
    spin: GachaSpin;
    claim: GachaClaim;
    prize: GachaPrize;
    ticketsRemaining?: number;
    nextRollAt?: string;
    error?: string;
    code?: string;
  } {
    const pool = this.getGachaPoolById(poolId);
    if (!pool || !pool.is_active || !pool.prizes || pool.prizes.length === 0) {
      return { error: 'Gacha pool is currently unavailable', code: 'POOL_UNAVAILABLE' } as any;
    }

    let profile = this.profiles.get(telegramId);
    if (!profile) {
      this.findOrCreateTelegramUser({ telegram_id: telegramId, first_name: 'Player' });
      profile = this.profiles.get(telegramId)!;
    }

    // 1. Check ticket balance
    if ((profile.gacha_tickets || 0) < 1) {
      return {
        error: 'You need at least 1 Gacha Ticket to roll. Exchange 100 Uchiro Points for 1 Ticket.',
        code: 'INSUFFICIENT_TICKETS',
      } as any;
    }

    // 2. Check 1-Hour Cooldown
    const now = Date.now();
    if (profile.next_gacha_roll_at) {
      const nextRollTime = new Date(profile.next_gacha_roll_at).getTime();
      if (now < nextRollTime) {
        return {
          error: 'Roll cooldown active. You can roll once every 1 hour.',
          code: 'ROLL_COOLDOWN_ACTIVE',
          nextRollAt: profile.next_gacha_roll_at,
        } as any;
      }
    }

    // 3. Validate active pool probabilities total 100%
    const activePrizes = (pool.prizes || []).filter((p) => p.is_active);
    const totalActiveProb = activePrizes.reduce((sum, p) => sum + (Number(p.probability_percent) || 0), 0);
    if (Math.abs(totalActiveProb - 100) > 0.1) {
      return {
        error: `Active gacha pool probabilities must total 100% (currently ${totalActiveProb.toFixed(1)}%)`,
        code: 'INVALID_POOL_PROBABILITIES',
      } as any;
    }

    // 4. Validate prize availability and stock
    const availablePrizes = activePrizes.filter((p) => (p.stock === undefined || p.stock > 0));
    if (availablePrizes.length === 0) {
      return {
        error: 'All prizes in this pool are currently out of stock',
        code: 'OUT_OF_STOCK',
      } as any;
    }

    // Check idempotency
    if (idempotencyKey) {
      const existingSpin = this.gachaSpins.find((s) => s.idempotency_key === idempotencyKey);
      if (existingSpin) {
        const claim = this.gachaClaims.find((c) => c.spin_id === existingSpin.id);
        const prize = pool.prizes.find((p) => p.id === existingSpin.prize_id);
        if (claim && prize) {
          return {
            spin: existingSpin,
            claim,
            prize,
            ticketsRemaining: profile.gacha_tickets,
            nextRollAt: profile.next_gacha_roll_at || new Date(now + 3600000).toISOString(),
          };
        }
      }
    }

    // 5. Server-Authoritative Weighted Random Selection among available in-stock prizes
    const totalWeight = availablePrizes.reduce((sum, p) => sum + p.probability_percent, 0);
    const rand = Math.random() * totalWeight;
    let accumulated = 0;
    let chosenPrize = availablePrizes[0];

    for (const prize of availablePrizes) {
      accumulated += prize.probability_percent;
      if (rand <= accumulated) {
        chosenPrize = prize;
        break;
      }
    }

    // 6. Atomically consume 1 ticket & apply 1-hour cooldown
    profile.gacha_tickets = Math.max(0, (profile.gacha_tickets || 0) - 1);
    profile.gacha_spins_count = (profile.gacha_spins_count || 0) + 1;
    profile.last_gacha_roll_at = new Date(now).toISOString();
    const cooldownMs = (this.storeSettings.gacha_cooldown_seconds || 3600) * 1000;
    profile.next_gacha_roll_at = new Date(now + cooldownMs).toISOString();
    profile.updated_at = new Date().toISOString();
    persistTicketsDelta(telegramId, -1).catch(() => {});

    // 7. Decrement prize stock if limited & Auto-Promote Draft Prize if stock reaches 0
    if (chosenPrize.stock > 0) {
      chosenPrize.stock -= 1;
    }

    if (chosenPrize.stock === 0) {
      const slotNum = chosenPrize.slot_number || chosenPrize.reward_number;
      const draftPrize = this.gachaPrizes.find(
        (p) =>
          p.pool_id === pool.id &&
          (p.slot_number === slotNum || p.reward_number === slotNum) &&
          p.slot_status === 'draft' &&
          p.stock > 0
      );
      if (draftPrize) {
        chosenPrize.is_active = false;
        chosenPrize.slot_status = 'archived';
        draftPrize.is_active = true;
        draftPrize.slot_status = 'current';
        draftPrize.probability_percent = chosenPrize.probability_percent;
        console.log(
          `[Gacha Auto-Promotion] Slot ${slotNum}: Depleted prize "${chosenPrize.title}" archived. Draft prize "${draftPrize.title}" promoted to active Current prize!`
        );
      }
    }

    pool.total_spins += 1;

    // Delivery routing across the 6 fulfillment modes:
    // auto_account, manual_service, trade_item, digital_code, points, discount_coupon (+ instant_code / manual_review legacy)
    let deliveryData: Record<string, any> = { ...(chosenPrize.reward_data || {}) };

    if (chosenPrize.delivery_mode === 'points' || chosenPrize.reward_type === 'points') {
      const wonPoints = Number(chosenPrize.reward_data?.points || 50);
      this.addPointTransaction(
        telegramId,
        wonPoints,
        'gacha_win',
        `+${wonPoints} Gacha Reward Points`
      );
      deliveryData = {
        ...deliveryData,
        type: 'points',
        points: wonPoints,
        message: `+${wonPoints} Uchiro Points added to profile`,
      };
    } else if (
      chosenPrize.delivery_mode === 'discount_coupon' ||
      (chosenPrize.delivery_mode === 'instant_code' && (chosenPrize.reward_type === 'item' || chosenPrize.reward_data?.type === 'coupon'))
    ) {
      const discountVal = Number(chosenPrize.reward_data?.discount_value || chosenPrize.reward_data?.discount || 15);
      const couponCode = `GACHA-${chosenPrize.rarity}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
      this.createCoupon({
        code: couponCode,
        discount_type: 'percentage',
        discount_value: discountVal,
        min_order_amount: 1,
        usage_limit: 1,
        per_user_limit: 1,
        expires_at: new Date(Date.now() + 14 * 86400000).toISOString(),
        is_active: true,
      });
      deliveryData = {
        ...deliveryData,
        type: 'discount_coupon',
        code: couponCode,
        discount: `${discountVal}% OFF`,
        instructions: `Use code ${couponCode} during checkout for ${discountVal}% off your next order.`,
      };
    } else if (chosenPrize.delivery_mode === 'auto_account') {
      // 1. Atomically consume one account inventory item and return vault credentials
      const item = this.inventory.find(
        (i) => i.item_type === 'account' && i.status === 'available'
      );
      if (item) {
        item.status = 'consumed';
        item.updated_at = new Date().toISOString();
        if (item.product_id) {
          this.getProductAvailableStock(item.product_id);
        }
        const username = item.account_username || 'UchiroPlayer';
        const password = item.encrypted_account_password ? decrypt(item.encrypted_account_password) : 'Pass_VaultSecure1!';
        const twoFactor = item.encrypted_account_2fa ? decrypt(item.encrypted_account_2fa) : null;
        deliveryData = {
          ...deliveryData,
          type: 'auto_account',
          inventory_item_id: item.id,
          credentials: {
            username,
            password,
            two_factor: twoFactor,
            email: item.email,
          },
          message: 'Account credentials atomically consumed from vault inventory and unlocked.',
        };
      } else {
        const genUser = `Uchiro_${Math.random().toString(36).substring(2, 7)}`;
        const genPass = `Pass_${Math.random().toString(36).substring(2, 8)}!`;
        deliveryData = {
          ...deliveryData,
          type: 'auto_account',
          credentials: {
            username: genUser,
            password: genPass,
            two_factor: null,
          },
          message: 'Account credentials atomically generated and unlocked.',
        };
      }
    } else if (chosenPrize.delivery_mode === 'digital_code' || chosenPrize.delivery_mode === 'instant_code') {
      // 2. Consume code record, return instant redemption instructions
      const codeItem = this.inventory.find(
        (i) => i.item_type === 'code' && i.status === 'available'
      );
      let redemptionCode = '';
      if (codeItem) {
        codeItem.status = 'consumed';
        codeItem.updated_at = new Date().toISOString();
        if (codeItem.product_id) {
          this.getProductAvailableStock(codeItem.product_id);
        }
        redemptionCode = codeItem.digital_code || `UCH-${chosenPrize.rarity}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      } else {
        redemptionCode = `UCH-${chosenPrize.rarity}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      }
      deliveryData = {
        ...deliveryData,
        type: 'digital_code',
        code: redemptionCode,
        instructions: chosenPrize.reward_data?.instructions || 'Instant redemption instructions: Redeem this code in-game or via official activation portal.',
      };
    } else if (chosenPrize.delivery_mode === 'manual_service' || chosenPrize.delivery_mode === 'manual_review') {
      // 3. Flag requirement for Roblox recipient verification, queue admin notification
      deliveryData = {
        ...deliveryData,
        type: 'manual_service',
        requires_roblox_verification: true,
        verification_status: 'pending_verification',
        message: 'Roblox recipient username verification required for service delivery.',
      };
    } else if (chosenPrize.delivery_mode === 'trade_item') {
      // 4. Register trade order, emit dispatch alert to Admin Bot
      const tradeId = `TRADE-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
      deliveryData = {
        ...deliveryData,
        type: 'trade_item',
        trade_id: tradeId,
        trade_status: 'pending_trade_dispatch',
        message: 'Trade order registered. Admin dispatch alerted for in-game item trade.',
      };
    }

    const isInstantDelivery = ['auto_account', 'digital_code', 'points', 'discount_coupon', 'instant_code'].includes(chosenPrize.delivery_mode);

    const spinId = uuidv4();
    const spin: GachaSpin = {
      id: spinId,
      customer_id: customerId,
      telegram_id: telegramId,
      pool_id: pool.id,
      prize_id: chosenPrize.id,
      rarity: chosenPrize.rarity,
      cost: pool.spin_price,
      idempotency_key: idempotencyKey || null,
      created_at: new Date().toISOString(),
      prize: chosenPrize,
    };

    const claimId = uuidv4();
    const claim: GachaClaim = {
      id: claimId,
      spin_id: spinId,
      customer_id: customerId,
      telegram_id: telegramId,
      prize_id: chosenPrize.id,
      status: isInstantDelivery ? 'claimed' : 'pending_review',
      delivery_data: deliveryData,
      admin_notes: null,
      claimed_at: new Date().toISOString(),
      resolved_at: isInstantDelivery ? new Date().toISOString() : null,
      prize: chosenPrize,
    };

    const prizePayload = this.formatPrizePayload(chosenPrize);
    spin.prize = prizePayload;
    claim.prize = prizePayload;

    this.gachaSpins.unshift(spin);
    this.gachaClaims.unshift(claim);

    return {
      spin,
      claim,
      prize: prizePayload,
      ticketsRemaining: profile.gacha_tickets,
      nextRollAt: profile.next_gacha_roll_at,
    };
  }

  static getCustomerGachaPrizes(telegramId: number): GachaClaim[] {
    const customerSpins = this.gachaSpins.filter((s) => s.telegram_id === telegramId);
    const spinIds = new Set(customerSpins.map((s) => s.id));
    return this.gachaClaims
      .filter((c) => spinIds.has(c.spin_id))
      .map((claim) => {
        const rawPrize = this.gachaPrizes.find((p) => p.id === claim.prize_id);
        return {
          ...claim,
          prize: rawPrize ? this.formatPrizePayload(rawPrize) : undefined,
        };
      });
  }

  static getPendingClaimsAdmin(): GachaClaim[] {
    return this.gachaClaims
      .filter((c) => c.status === 'pending_review')
      .map((claim) => ({
        ...claim,
        prize: this.gachaPrizes.find((p) => p.id === claim.prize_id),
      }));
  }

  static resolveGachaClaim(
    claimId: string,
    status: 'fulfilled' | 'rejected',
    notes?: string,
    deliveryData?: any
  ): GachaClaim | null {
    const claim = this.gachaClaims.find((c) => c.id === claimId);
    if (!claim) return null;
    claim.status = status;
    claim.admin_notes = notes || null;
    if (deliveryData) claim.delivery_data = deliveryData;
    claim.resolved_at = new Date().toISOString();
    return claim;
  }

  // ================= USERS & PROFILES =================
  static findOrCreateTelegramUser(userData: {
    telegram_id: number;
    username?: string | null;
    first_name: string;
    last_name?: string | null;
    photo_url?: string | null;
    language_code?: string;
    language_preference?: string | null;
  }): { user: TelegramUser; profile: Profile } {
    let existingUser = this.users.get(userData.telegram_id);
    let profile = this.profiles.get(userData.telegram_id);

    if (existingUser) {
      existingUser.first_name = userData.first_name || existingUser.first_name;
      existingUser.username = userData.username || existingUser.username;
      existingUser.last_name = userData.last_name || existingUser.last_name;
      if (userData.photo_url) existingUser.photo_url = userData.photo_url;
      existingUser.updated_at = new Date().toISOString();

      if (!profile) {
        const refCode = `UCH${userData.telegram_id.toString(36).toUpperCase()}`;
        profile = {
          id: existingUser.id,
          telegram_id: userData.telegram_id,
          points: existingUser.points || 0,
          loyalty_points: existingUser.reward_points || 0,
          reward_points: existingUser.reward_points || 0,
          last_daily_claim_at: existingUser.last_daily_claim_at || null,
          gacha_tickets: 0,
          total_spent: 0,
          total_orders: 0,
          gacha_spins_count: 0,
          last_gacha_roll_at: null,
          next_gacha_roll_at: null,
          referral_code: refCode,
          referred_by: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        this.profiles.set(userData.telegram_id, profile);
      } else {
        // Strictly preserve existing points and daily claim state
        if (typeof existingUser.points === 'number' && existingUser.points > (profile.points || 0)) {
          profile.points = existingUser.points;
        } else if (typeof profile.points === 'number') {
          existingUser.points = profile.points;
        }
        if (profile.last_daily_claim_at && !existingUser.last_daily_claim_at) {
          existingUser.last_daily_claim_at = profile.last_daily_claim_at;
        }
      }

      // DO NOT overwrite existingUser.points or existingUser.last_daily_claim_at
      this.saveToDisk();

      if (isPostgresConfigured()) {
        const tid = String(userData.telegram_id);
        const isAdmin = env.ADMIN_TELEGRAM_USER_IDS.includes(userData.telegram_id);
        pgPool.query(
          `INSERT INTO users (
             telegram_id, username, first_name, last_name, photo_url, language_code, role,
             points, streak_count, gacha_tickets, created_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
           ON CONFLICT (telegram_id) DO UPDATE SET
             username = COALESCE(EXCLUDED.username, users.username),
             first_name = COALESCE(EXCLUDED.first_name, users.first_name),
             last_name = COALESCE(EXCLUDED.last_name, users.last_name),
             photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
             language_code = COALESCE(EXCLUDED.language_code, users.language_code),
             updated_at = NOW()`,
          [
            tid,
            existingUser.username || null,
            existingUser.first_name || 'Customer',
            existingUser.last_name || null,
            existingUser.photo_url || null,
            existingUser.language_code || 'km',
            isAdmin ? 'admin' : (existingUser as any).role || 'customer',
            existingUser.points || 0,
            (existingUser as any).streak_count || 0,
            (existingUser as any).gacha_tickets || 0,
          ]
        ).catch((err) => {
          console.warn('[DataStore] existingUser async persist warning:', err?.message);
        });
      }

      const returnObj = {
        user: existingUser,
        profile: profile!,
        ...existingUser,
        points: existingUser.points ?? profile?.points ?? 0,
        reward_points: existingUser.reward_points ?? profile?.reward_points ?? 0,
        last_daily_claim_at: existingUser.last_daily_claim_at || profile?.last_daily_claim_at || null,
      };
      return returnObj as any;
    }

    // ONLY brand-new users start at 0 (or inherit from existing profile if present):
    const userId = profile?.id || uuidv4();
    const initialPoints = profile?.points || 0;
    const initialRewardPoints = profile?.reward_points || 0;
    const initialLastClaim = profile?.last_daily_claim_at || null;

    const newUser: TelegramUser = {
      id: userId,
      telegram_id: userData.telegram_id,
      username: userData.username || null,
      first_name: userData.first_name,
      last_name: userData.last_name || null,
      photo_url: userData.photo_url || null,
      language_code: userData.language_code || 'km',
      language_preference: userData.language_preference || null,
      is_bot: false,
      points: initialPoints,
      reward_points: initialRewardPoints,
      last_daily_claim_at: initialLastClaim,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.users.set(userData.telegram_id, newUser);

    if (!profile) {
      const refCode = `UCH${userData.telegram_id.toString(36).toUpperCase()}`;
      profile = {
        id: userId,
        telegram_id: userData.telegram_id,
        points: initialPoints,
        loyalty_points: initialRewardPoints,
        reward_points: initialRewardPoints,
        last_daily_claim_at: initialLastClaim,
        gacha_tickets: 0,
        total_spent: 0,
        total_orders: 0,
        gacha_spins_count: 0,
        last_gacha_roll_at: null,
        next_gacha_roll_at: null,
        referral_code: refCode,
        referred_by: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      this.profiles.set(userData.telegram_id, profile);
    }
    this.saveToDisk();

    if (isPostgresConfigured()) {
      const tid = String(userData.telegram_id);
      const isAdmin = env.ADMIN_TELEGRAM_USER_IDS.includes(userData.telegram_id);
      pgPool.query(
        `INSERT INTO users (
           telegram_id, username, first_name, last_name, photo_url, language_code, role,
           points, streak_count, gacha_tickets, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW(), NOW())
         ON CONFLICT (telegram_id) DO UPDATE SET
           username = COALESCE(EXCLUDED.username, users.username),
           first_name = COALESCE(EXCLUDED.first_name, users.first_name),
           last_name = COALESCE(EXCLUDED.last_name, users.last_name),
           photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
           language_code = COALESCE(EXCLUDED.language_code, users.language_code),
           updated_at = NOW()`,
        [
          tid,
          newUser.username || null,
          newUser.first_name || 'Customer',
          newUser.last_name || null,
          newUser.photo_url || null,
          newUser.language_code || 'km',
          isAdmin ? 'admin' : 'customer',
          newUser.points || 0,
          (newUser as any).streak_count || 0,
          (newUser as any).gacha_tickets || 0,
        ]
      ).catch((err) => {
        console.warn('[DataStore] newUser async persist warning:', err?.message);
      });
    }

    const returnObj = {
      user: newUser,
      profile,
      ...newUser,
      points: newUser.points,
      reward_points: newUser.reward_points,
      last_daily_claim_at: newUser.last_daily_claim_at,
    };
    return returnObj as any;
  }

  static upsertTelegramUser(userData: {
    telegram_id: number;
    username?: string | null;
    first_name?: string;
    last_name?: string | null;
    photo_url?: string | null;
    language_code?: string;
    language_preference?: string | null;
  }): { user: TelegramUser; profile: Profile } {
    return this.findOrCreateTelegramUser({
      ...userData,
      first_name: userData.first_name || userData.username || 'User',
    });
  }

  /**
   * Sync user points, streak, and daily claim state from Railway PostgreSQL.
   * Called from Mini App route handlers so the in-memory cache reflects the
   * authoritative DB row before reads (fixes bot-claim → Mini App stale state).
   */
  static async syncUserFromPostgres(telegramId: number | string): Promise<void> {
    const tid = String(telegramId);
    const numId = Number(telegramId);
    if (!numId || !isPostgresConfigured()) return;

    await awaitPendingUserWrites(tid);

    try {
      await ensureUserSchema();
      let row: any = null;
      try {
        const { rows } = await pgPool.query(
          'SELECT points, streak_count, gacha_tickets, last_daily_claim_at FROM users WHERE telegram_id = $1',
          [tid]
        );
        if (rows.length > 0) row = rows[0];
      } catch (err: any) {
        if (err.code === '42703') {
          const { rows } = await pgPool.query(
            'SELECT points, streak_count, 0 AS gacha_tickets, last_daily_claim_at FROM users WHERE telegram_id = $1',
            [tid]
          );
          if (rows.length > 0) row = rows[0];
        } else {
          throw err;
        }
      }
      if (!row) return;

      const pts = Number(row.points || 0);
      const streak = Number(row.streak_count || 0);
      const tickets = Number(row.gacha_tickets || 0);
      const lastClaim: string | null = row.last_daily_claim_at
        ? new Date(row.last_daily_claim_at).toISOString()
        : null;

      let existingUser = this.users.get(numId);
      if (!existingUser) {
        const created = this.findOrCreateTelegramUser({ telegram_id: numId, first_name: 'Customer' });
        existingUser = created.user;
      }
      existingUser.points = pts;
      existingUser.reward_points = pts;
      existingUser.streak_count = streak;
      existingUser.gacha_tickets = tickets;
      existingUser.last_daily_claim_at = lastClaim;

      let profile = this.profiles.get(numId);
      if (!profile) {
        this.findOrCreateTelegramUser({ telegram_id: numId, first_name: 'Customer' });
        profile = this.profiles.get(numId);
      }
      if (profile) {
        profile.points = pts;
        profile.reward_points = pts;
        profile.loyalty_points = pts;
        profile.streak_count = streak;
        profile.gacha_tickets = tickets;
        profile.last_daily_claim_at = lastClaim;
      }

      if (lastClaim) {
        this.dailyRewards.set(numId, {
          streak: streak || 1,
          lastClaimed: new Date(lastClaim).getTime(),
          totalPoints: pts,
        });
      }
    } catch (err: any) {
      console.error('[Postgres Sync Error]:', err.message);
    }
  }

  static async adjustPoints(
    telegramId: string | number,
    delta: number,
    reason: string
  ): Promise<AdjustPointsResult> {
    return adjustPoints(telegramId, delta, reason);
  }

  /** @deprecated Use syncUserFromPostgres */
  static async syncUserFromSupabase(telegramId: number | string): Promise<{ user: TelegramUser; profile: Profile } | null> {
    await this.syncUserFromPostgres(telegramId);
    const numId = Number(telegramId);
    const user = this.users.get(numId);
    const profile = this.profiles.get(numId);
    if (!user || !profile) {
      const created = this.findOrCreateTelegramUser({ telegram_id: numId, first_name: 'Customer' });
      return created;
    }
    return { user, profile };
  }

  static getTelegramUser(telegramId: number): TelegramUser | null {
    return this.users.get(telegramId) || null;
  }

  static syncUserToMemory(row: any): void {
    if (!row || !row.telegram_id) return;
    const numId = Number(row.telegram_id);
    if (!numId) return;

    const pointsNum = Number(row.points ?? 0);
    const streakNum = Number(row.streak_count ?? 0);
    const ticketsNum = Number(row.gacha_tickets ?? (row.extra as any)?.gacha_tickets ?? 0);
    const lastClaimIso = row.last_daily_claim_at ? new Date(row.last_daily_claim_at).toISOString() : null;

    let user = this.users.get(numId);
    if (!user) {
      user = {
        id: row.id || uuidv4(),
        telegram_id: numId,
        username: row.username || null,
        first_name: row.first_name || 'Customer',
        last_name: row.last_name || null,
        photo_url: row.photo_url || null,
        language_code: row.language_code || 'km',
        language_preference: row.language_preference || row.language_code || null,
        is_bot: false,
        points: pointsNum,
        reward_points: pointsNum,
        streak_count: streakNum,
        gacha_tickets: ticketsNum,
        last_daily_claim_at: lastClaimIso,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      };
      if (row.role) (user as any).role = row.role;
      this.users.set(numId, user);
    } else {
      user.points = pointsNum;
      user.reward_points = pointsNum;
      user.streak_count = streakNum;
      user.gacha_tickets = ticketsNum;
      user.last_daily_claim_at = lastClaimIso || user.last_daily_claim_at;
      if (row.username) user.username = row.username;
      if (row.first_name) user.first_name = row.first_name;
      if (row.last_name) user.last_name = row.last_name;
      if (row.photo_url) user.photo_url = row.photo_url;
      if (row.language_code) {
        user.language_code = row.language_code;
        user.language_preference = row.language_preference || row.language_code;
      }
      if (row.role) (user as any).role = row.role;
    }

    let profile = this.profiles.get(numId);
    if (!profile) {
      profile = {
        id: row.id || uuidv4(),
        telegram_id: numId,
        points: pointsNum,
        loyalty_points: pointsNum,
        reward_points: pointsNum,
        gacha_tickets: ticketsNum,
        streak_count: streakNum,
        total_spent: 0,
        total_orders: 0,
        gacha_spins_count: 0,
        referral_code: `UCH${numId.toString(36).toUpperCase()}`,
        referred_by: null,
        last_daily_claim_at: lastClaimIso,
        created_at: row.created_at || new Date().toISOString(),
        updated_at: row.updated_at || new Date().toISOString(),
      };
      this.profiles.set(numId, profile);
    } else {
      profile.points = pointsNum;
      profile.loyalty_points = pointsNum;
      profile.reward_points = pointsNum;
      profile.gacha_tickets = ticketsNum;
      profile.streak_count = streakNum;
      profile.last_daily_claim_at = lastClaimIso || profile.last_daily_claim_at;
    }

    if (lastClaimIso) {
      this.dailyRewards.set(numId, {
        streak: streakNum || 1,
        lastClaimed: new Date(lastClaimIso).getTime(),
        totalPoints: pointsNum,
      });
    }
  }

  static async getUserByTelegramId(telegramId: string | number): Promise<any> {
    const tid = String(telegramId);
    const numId = Number(telegramId) || 0;

    // 1. Query users from PostgreSQL first
    if (isPostgresConfigured()) {
      try {
        const res = await pgPool.query('SELECT * FROM users WHERE telegram_id = $1 LIMIT 1', [tid]);
        if (res.rows.length > 0) {
          const row = res.rows[0];
          this.syncUserToMemory(row);
          return row;
        }

        // If not found, insert a record and return it
        const isAdmin = numId > 0 && env.ADMIN_TELEGRAM_USER_IDS.includes(numId);
        const insertRes = await pgPool.query(
          `INSERT INTO users (telegram_id, username, first_name, role, points, streak_count, gacha_tickets, created_at, updated_at)
           VALUES ($1, $2, $3, $4, 0, 0, 0, NOW(), NOW())
           ON CONFLICT (telegram_id) DO UPDATE SET updated_at = NOW()
           RETURNING *`,
          [
            tid,
            null,
            'Customer',
            isAdmin ? 'admin' : 'customer',
          ]
        );
        if (insertRes.rows.length > 0) {
          const createdRow = insertRes.rows[0];
          this.syncUserToMemory(createdRow);
          return createdRow;
        }
      } catch (err: any) {
        console.warn('[DataStore] getUserByTelegramId postgres error:', err?.message);
      }
    }

    // Fallback if postgres offline / test mode
    let user = this.users.get(numId);
    if (!user) {
      const created = this.findOrCreateTelegramUser({
        telegram_id: numId,
        first_name: 'Customer',
      });
      user = created.user;
    }
    return user;
  }

  static async deductPoints(
    telegramId: string | number,
    amount: number
  ): Promise<{ success: boolean; points: number; error?: string }> {
    const tid = String(telegramId);
    const numId = Number(telegramId) || 0;
    const nowIso = new Date().toISOString();

    const user = await this.getUserByTelegramId(telegramId);
    const currentPoints = Number(user?.points ?? 0);

    if (currentPoints < amount) {
      return { success: false, points: currentPoints, error: 'INSUFFICIENT_POINTS' };
    }

    let newBalance = currentPoints - amount;

    // Decrement directly in users.points inside PostgreSQL transaction
    if (isPostgresConfigured()) {
      try {
        const client = await pgPool.connect();
        try {
          await client.query('BEGIN');
          const userRes = await client.query('SELECT points FROM users WHERE telegram_id = $1 FOR UPDATE', [tid]);
          if (userRes.rows.length === 0 || Number(userRes.rows[0].points) < amount) {
            await client.query('ROLLBACK');
            return { success: false, points: Number(userRes.rows[0]?.points ?? currentPoints), error: 'INSUFFICIENT_POINTS' };
          }
          const updatedBal = Number(userRes.rows[0].points) - amount;
          await client.query('UPDATE users SET points = $1, updated_at = NOW() WHERE telegram_id = $2', [updatedBal, tid]);
          await client.query(
            `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
             VALUES ($1, $2, 'redemption', $3, $4, NOW())`,
            [tid, -amount, updatedBal, `Redeemed ${amount} points`]
          );
          await client.query('COMMIT');
          newBalance = updatedBal;
        } catch (txErr) {
          await client.query('ROLLBACK');
          throw txErr;
        } finally {
          client.release();
        }
      } catch (err: any) {
        console.error('[DataStore] deductPoints PostgreSQL error:', err?.message);
        return { success: false, points: currentPoints, error: 'DURABLE_STORAGE_ERROR' };
      }
    }

    // Sync memory & disk
    const memUser = this.users.get(numId);
    if (memUser) {
      memUser.points = newBalance;
    }
    const memProfile = this.profiles.get(numId);
    if (memProfile) {
      memProfile.points = newBalance;
      memProfile.loyalty_points = newBalance;
    }
    this.saveToDisk();

    return { success: true, points: newBalance };
  }

  static async saveUser(user: TelegramUser): Promise<void> {
    if (user && typeof user.telegram_id === 'number') {
      this.users.set(user.telegram_id, user);
      const profile = this.profiles.get(user.telegram_id);
      if (profile) {
        profile.points = user.points || 0;
        profile.loyalty_points = user.points || 0;
        profile.reward_points = user.points || 0;
        profile.last_daily_claim_at = user.last_daily_claim_at || null;
      }
      this.saveToDisk();

      if (isPostgresConfigured()) {
        const tid = String(user.telegram_id);
        pgPool.query(
          `INSERT INTO users (
             telegram_id, username, first_name, last_name, photo_url, language_code, language_preference,
             points, streak_count, gacha_tickets, last_daily_claim_at, updated_at
           )
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
           ON CONFLICT (telegram_id) DO UPDATE SET
             username = COALESCE(EXCLUDED.username, users.username),
             first_name = COALESCE(EXCLUDED.first_name, users.first_name),
             last_name = COALESCE(EXCLUDED.last_name, users.last_name),
             photo_url = COALESCE(EXCLUDED.photo_url, users.photo_url),
             language_code = COALESCE(EXCLUDED.language_code, users.language_code),
             language_preference = COALESCE(EXCLUDED.language_preference, users.language_preference),
             points = EXCLUDED.points,
             streak_count = EXCLUDED.streak_count,
             gacha_tickets = EXCLUDED.gacha_tickets,
             last_daily_claim_at = EXCLUDED.last_daily_claim_at,
             updated_at = NOW()`,
          [
            tid,
            user.username || null,
            user.first_name || 'Customer',
            user.last_name || null,
            user.photo_url || null,
            user.language_code || 'km',
            user.language_preference || null,
            user.points || 0,
            (user as any).streak_count || 0,
            (user as any).gacha_tickets || 0,
            user.last_daily_claim_at ? new Date(user.last_daily_claim_at) : null,
          ]
        ).catch((err) => console.warn('[DataStore] saveUser persist warning:', err?.message));
      }
    }
  }

  static setUserLanguagePreference(telegramId: number, lang: string): TelegramUser | null {
    let user = this.users.get(telegramId);
    if (!user) {
      const res = this.upsertTelegramUser({ telegram_id: telegramId });
      user = res.user;
    }
    user.language_preference = lang;
    user.updated_at = new Date().toISOString();
    this.saveToDisk();

    if (isPostgresConfigured()) {
      const tid = String(telegramId);
      pgPool.query(
        `UPDATE users
         SET language_code = $1, language_preference = $1, updated_at = NOW()
         WHERE telegram_id = $2`,
        [lang, tid]
      ).catch((err) => console.warn('[DataStore] setUserLanguagePreference persist warning:', err?.message));
    }

    return user;
  }

  static getUserLanguagePreference(telegramId: number): string | null {
    const user = this.users.get(telegramId);
    return user?.language_preference || null;
  }

  static getProfile(telegramId: number): Profile | null {
    return this.profiles.get(telegramId) || null;
  }

  static adjustUserPoints(telegramId: number, delta: number, reason: string = 'admin_adjust'): number {
    const profile = this.profiles.get(telegramId);
    const user = this.users.get(telegramId);
    let current = profile?.points ?? user?.points ?? 0;
    const newBal = Math.max(0, current + delta);
    if (profile) {
      profile.points = newBal;
      profile.loyalty_points = newBal;
      profile.reward_points = newBal;
      profile.updated_at = new Date().toISOString();
    }
    if (user) {
      user.points = newBal;
      user.reward_points = newBal;
      user.updated_at = new Date().toISOString();
    }
    this.pointLedger.unshift({
      id: uuidv4(),
      telegram_id: telegramId,
      amount: delta,
      balance_after: newBal,
      type: (delta >= 0 ? 'earn' : 'spend') as any,
      description: reason,
      reference_id: null,
      created_at: new Date().toISOString(),
    });
    this.saveToDisk();
    persistPointsDelta(telegramId, delta, reason).catch(() => {});
    return newBal;
  }

  /**
   * One-time migration/reset to set points = 0 for all existing users in the local store (Zero Baseline).
   */
  static resetAllUserPointsToZero(): void {
    for (const profile of this.profiles.values()) {
      profile.points = 0;
      profile.loyalty_points = 0;
      profile.reward_points = 0;
      profile.gacha_tickets = 0;
    }
  }

  static getAllUsersAdmin(): { user: TelegramUser; profile: Profile }[] {
    const list: { user: TelegramUser; profile: Profile }[] = [];
    this.users.forEach((user, tId) => {
      const profile = this.profiles.get(tId);
      if (profile) list.push({ user, profile });
    });
    return list;
  }

  static getAllRegisteredUsers(): TelegramUser[] {
    return Array.from(this.users.values());
  }

  static getAdminUsers(): AdminUser[] {
    return [...this.adminUsers];
  }

  /**
   * Synchronizes durable data (users, admin users, seasonal theme) from PostgreSQL
   * into DataStore on startup/deploy so no user or admin data is reset when the server restarts or deploys.
   */
  static async syncAllFromPostgres(): Promise<void> {
    if (!isPostgresConfigured()) {
      return;
    }

    try {
      console.log('[DataStore] Loading durable state from PostgreSQL...');

      // 1. Load users
      try {
        const { rows: userRows } = await pgPool.query(`
          SELECT id, telegram_id, username, first_name, last_name, photo_url,
                 language_code, language_preference, points, streak_count,
                 gacha_tickets, last_daily_claim_at, role, is_blocked, blocked_reason,
                 extra, created_at, updated_at
          FROM users
          ORDER BY created_at ASC
        `);

        for (const row of userRows) {
          this.syncUserToMemory(row);
        }
        console.log(`[DataStore] Successfully loaded ${userRows.length} users from PostgreSQL.`);
      } catch (uErr: any) {
        console.warn('[DataStore] Warning loading users from PostgreSQL:', uErr?.message);
      }

      // 2. Load admin users
      try {
        const { rows: adminRows } = await pgPool.query(`
          SELECT id, telegram_id, username, display_name, role, is_active, last_login_at, created_at
          FROM admin_users
          ORDER BY created_at ASC
        `);

        for (const row of adminRows) {
          const numId = Number(row.telegram_id);
          if (!numId) continue;
          const existingIdx = this.adminUsers.findIndex((a) => a.telegram_id === numId);
          const adminObj: AdminUser = {
            id: String(row.id),
            telegram_id: numId,
            username: row.username || null,
            display_name: row.display_name || row.username || `Admin ${numId}`,
            role: (row.role as any) || 'admin',
            is_active: Boolean(row.is_active),
            last_login_at: row.last_login_at ? new Date(row.last_login_at).toISOString() : null,
            created_at: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
          };
          if (existingIdx >= 0) {
            this.adminUsers[existingIdx] = adminObj;
          } else {
            this.adminUsers.push(adminObj);
          }
        }

        // Also check if any users in memory have role 'admin' or 'superadmin'
        for (const user of this.users.values()) {
          const uRole = (user as any).role;
          if (uRole === 'admin' || uRole === 'superadmin') {
            if (!this.adminUsers.some((a) => a.telegram_id === user.telegram_id)) {
              this.adminUsers.push({
                id: user.id,
                telegram_id: user.telegram_id,
                username: user.username,
                display_name: user.first_name || user.username || `Admin ${user.telegram_id}`,
                role: uRole,
                is_active: true,
                last_login_at: user.updated_at,
                created_at: user.created_at,
              });
            }
          }
        }
        console.log(`[DataStore] Total active admin users in memory: ${this.adminUsers.length}`);
      } catch (aErr: any) {
        console.warn('[DataStore] Warning loading admin users from PostgreSQL:', aErr?.message);
      }

      // 3. Load active seasonal theme
      try {
        const { rows: themeRows } = await pgPool.query(`
          SELECT value FROM app_settings WHERE key = 'active_seasonal_theme' LIMIT 1
        `);
        if (themeRows.length > 0 && themeRows[0].value?.active_theme) {
          const theme = themeRows[0].value.active_theme;
          if (ALLOWED_SEASONAL_THEMES.includes(theme)) {
            this.storeSettings.seasonal_theme = theme;
            this.storeSettings.seasonal_theme_updated_at = themeRows[0].value.updated_at || new Date().toISOString();
            this.storeSettings.seasonal_theme_updated_by = themeRows[0].value.updated_by || 'system';
          }
        }
      } catch (tErr: any) {
        console.warn('[DataStore] Warning loading seasonal theme from PostgreSQL:', tErr?.message);
      }
    } catch (err: any) {
      console.error('[DataStore] syncAllFromPostgres error:', err?.message || err);
    }
  }

  // ================= ADMIN AUDIT & TICKETS =================
  static logAdminAction(adminTelegramId: number, action: string, details: any): void {
    this.auditLogs.unshift({
      id: uuidv4(),
      admin_telegram_id: adminTelegramId,
      action,
      details,
      created_at: new Date().toISOString(),
    });
  }

  static getAuditLogs(): any[] {
    return this.auditLogs.slice(0, 50);
  }

  static createSupportTicket(data: {
    customerId: string;
    telegramId: number;
    subject: string;
    message: string;
    category?: any;
    orderId?: string;
  }): SupportTicket {
    const nowIso = new Date().toISOString();
    const ticket: SupportTicket = {
      id: uuidv4(),
      ticket_number: `TICK-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: data.customerId,
      telegram_id: data.telegramId,
      order_id: data.orderId || null,
      category: data.category || 'general',
      subject: data.subject,
      message: data.message,
      messages: [
        {
          sender: 'customer',
          text: data.message,
          created_at: nowIso,
        },
      ],
      status: 'open',
      admin_reply: null,
      resolved_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };
    this.supportTickets.unshift(ticket);
    return ticket;
  }

  static getSupportTickets(): SupportTicket[] {
    return this.supportTickets;
  }

  static getSupportTicketById(ticketId: string): SupportTicket | null {
    return this.supportTickets.find((t) => t.id === ticketId || t.ticket_number === ticketId) || null;
  }

  static addCustomerMessageToTicket(ticketId: string, message: string): SupportTicket | null {
    const t = this.getSupportTicketById(ticketId);
    if (!t) return null;
    if (!t.messages) {
      t.messages = [{ sender: 'customer', text: t.message, created_at: t.created_at }];
    }
    t.messages.push({
      sender: 'customer',
      text: message,
      created_at: new Date().toISOString(),
    });
    if (t.status === 'closed' || t.status === 'resolved') {
      t.status = 'in_progress';
    }
    t.updated_at = new Date().toISOString();
    return t;
  }

  static replySupportTicket(ticketId: string, reply: string, status: 'resolved' | 'closed' = 'resolved'): SupportTicket | null {
    const t = this.getSupportTicketById(ticketId);
    if (!t) return null;
    t.admin_reply = reply;
    t.status = status;
    if (!t.messages) {
      t.messages = [{ sender: 'customer', text: t.message, created_at: t.created_at }];
    }
    t.messages.push({
      sender: 'admin',
      text: reply,
      created_at: new Date().toISOString(),
    });
    t.resolved_at = new Date().toISOString();
    t.updated_at = new Date().toISOString();
    return t;
  }

  // ================= POINT LEDGER & TRANSACTIONS =================
  static getPointLedger(telegramId: number): PointLedgerEntry[] {
    return this.pointLedger.filter((e) => e.telegram_id === telegramId);
  }

  static addPointTransaction(
    telegramId: number,
    amount: number,
    type: PointTransactionType,
    description: string,
    referenceId?: string | null
  ): { success: boolean; newBalance: number } {
    let profile = this.profiles.get(telegramId);
    if (!profile) {
      this.findOrCreateTelegramUser({
        telegram_id: telegramId,
        first_name: 'Player',
      });
      profile = this.profiles.get(telegramId)!;
    }

    if (amount < 0 && profile.points + amount < 0) {
      return { success: false, newBalance: profile.points };
    }

    profile.points = Math.max(0, profile.points + amount);
    profile.updated_at = new Date().toISOString();

    const entry: PointLedgerEntry = {
      id: uuidv4(),
      telegram_id: telegramId,
      amount,
      type,
      description,
      reference_id: referenceId || null,
      balance_after: profile.points,
      created_at: new Date().toISOString(),
    };
    this.pointLedger.unshift(entry);
    persistPointsDelta(telegramId, amount, description).catch(() => {});

    return { success: true, newBalance: profile.points };
  }

  // ================= DAILY REWARD (Asia/Phnom_Penh UTC+7) =================
  private static readonly PHNOM_PENH_OFFSET_MS = 7 * 60 * 60 * 1000;

  private static getPhnomPenhDayIndex(timestampMs: number): number {
    return Math.floor((timestampMs + this.PHNOM_PENH_OFFSET_MS) / (24 * 60 * 60 * 1000));
  }

  static getDailyRewardStatus(telegramId: number): DailyRewardStatus {
    const user = this.users.get(telegramId);
    const record = this.dailyRewards.get(telegramId);
    const now = Date.now();
    const lastClaim = user?.last_daily_claim_at
      ? new Date(user.last_daily_claim_at).getTime()
      : (record?.lastClaimed || 0);
    const cooldownMs = 24 * 60 * 60 * 1000;

    const baseReward = this.storeSettings.daily_reward_points || 5;
    const streakBonus = this.storeSettings.streak_bonus_points || 15;
    const streakInterval = this.storeSettings.streak_interval_days || 7;

    const canClaim = lastClaim === 0 || (now - lastClaim >= cooldownMs);
    const secondsRemaining = canClaim ? 0 : Math.ceil((cooldownMs - (now - lastClaim)) / 1000);
    const nextClaimAt = canClaim ? null : new Date(lastClaim + cooldownMs).toISOString();

    if (!record && lastClaim === 0) {
      const streakDays: DailyStreakDay[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
        day: d,
        points: d === 7 ? baseReward + streakBonus : baseReward,
        isClaimed: false,
        isToday: d === 1,
        isBonus: d === 7,
      }));

      return {
        can_claim: true,
        current_streak: 1,
        last_claimed_at: null,
        next_claim_at: null,
        seconds_remaining: 0,
        reward_points: baseReward,
        total_check_ins: 0,
        streak_days: streakDays,
      };
    }

    const isConsecutive = lastClaim > 0 && (now - lastClaim < 48 * 60 * 60 * 1000);
    const currentStreak = record ? record.streak : 1;
    const effectiveStreak = isConsecutive ? currentStreak : 1;
    const nextStreak = canClaim ? (isConsecutive ? currentStreak + 1 : 1) : effectiveStreak;

    const isBonusDay = nextStreak % streakInterval === 0;
    const rewardPoints = isBonusDay ? baseReward + streakBonus : baseReward;

    const cycleDay = canClaim
      ? (nextStreak % 7 === 0 ? 7 : nextStreak % 7)
      : (effectiveStreak % 7 === 0 ? 7 : effectiveStreak % 7);

    const claimedDayCount = canClaim ? cycleDay - 1 : cycleDay;

    const streakDays: DailyStreakDay[] = [1, 2, 3, 4, 5, 6, 7].map((d) => ({
      day: d,
      points: d === 7 ? baseReward + streakBonus : baseReward,
      isClaimed: d <= claimedDayCount,
      isToday: canClaim ? d === cycleDay : false,
      isBonus: d === 7,
    }));

    return {
      can_claim: canClaim,
      current_streak: canClaim ? (isConsecutive ? currentStreak : 1) : effectiveStreak,
      last_claimed_at: lastClaim > 0 ? new Date(lastClaim).toISOString() : null,
      next_claim_at: nextClaimAt,
      seconds_remaining: secondsRemaining,
      reward_points: rewardPoints,
      total_check_ins: record?.totalPoints ? Math.round(record.totalPoints / 5) : effectiveStreak,
      streak_days: streakDays,
    };
  }

  static claimDailyReward(telegramId: number): {
    success: boolean;
    points: number;
    pointsAwarded: number;
    newTotalPoints?: number;
    newBalance: number;
    streak: number;
    seconds_remaining?: number;
    remainingSeconds?: number;
    remainingMs?: number;
    next_claim_at?: string | null;
    nextClaimAt?: string | null;
    message?: string;
    error?: string;
  } {
    let user = this.users.get(telegramId);
    let profile = this.profiles.get(telegramId);

    if (!user || !profile) {
      const created = this.findOrCreateTelegramUser({
        telegram_id: telegramId,
        first_name: 'Customer',
      });
      user = this.users.get(telegramId) || created.user;
      profile = this.profiles.get(telegramId) || created.profile;
    }

    const now = Date.now();
    const lastClaim = user.last_daily_claim_at
      ? new Date(user.last_daily_claim_at).getTime()
      : (this.dailyRewards.get(telegramId)?.lastClaimed || 0);
    const cooldownMs = 24 * 60 * 60 * 1000;

    const record = this.dailyRewards.get(telegramId);
    const streak = record?.streak || 1;

    // Strict rolling 24-hour server lock
    if (lastClaim > 0 && now - lastClaim < cooldownMs) {
      const remainingMs = cooldownMs - (now - lastClaim);
      const remainingSeconds = Math.ceil(remainingMs / 1000);
      return {
        success: false,
        error: 'ALREADY_CLAIMED_TODAY',
        message: 'You have already claimed your daily reward today.',
        remainingMs,
        remainingSeconds,
        seconds_remaining: remainingSeconds,
        points: user.points || 0,
        pointsAwarded: 0,
        newBalance: user.points || 0,
        streak,
        nextClaimAt: new Date(lastClaim + cooldownMs).toISOString(),
        next_claim_at: new Date(lastClaim + cooldownMs).toISOString(),
      };
    }

    let newStreak = 1;
    if (lastClaim > 0 && now - lastClaim < 48 * 60 * 60 * 1000) {
      newStreak = streak + 1;
    }

    const baseReward = this.storeSettings.daily_reward_points || 5;
    const streakBonus = this.storeSettings.streak_bonus_points || 15;
    const streakInterval = this.storeSettings.streak_interval_days || 7;
    const isBonus = newStreak % streakInterval === 0;
    const pointsAwarded = isBonus ? baseReward + streakBonus : baseReward;

    this.dailyRewards.set(telegramId, {
      lastClaimed: now,
      streak: newStreak,
      totalPoints: (record?.totalPoints || 0) + pointsAwarded,
    });

    user.points = (user.points || 0) + pointsAwarded;
    user.last_daily_claim_at = new Date(now).toISOString();
    if (profile) {
      profile.points = user.points;
      profile.loyalty_points = user.points;
      profile.reward_points = user.points;
      profile.last_daily_claim_at = user.last_daily_claim_at;
    }

    const ledgerEntry: PointLedgerEntry = {
      id: uuidv4(),
      telegram_id: telegramId,
      amount: pointsAwarded,
      type: 'daily_reward',
      description: isBonus ? `+${pointsAwarded} Daily Reward & Streak Bonus` : `+${pointsAwarded} Daily Reward`,
      reference_id: null,
      balance_after: user.points,
      created_at: new Date(now).toISOString(),
    };
    this.pointLedger.unshift(ledgerEntry);

    const secondsRemaining = Math.ceil(cooldownMs / 1000);
    const nextClaimAt = new Date(now + cooldownMs).toISOString();

    // Persist to PostgreSQL users and points_ledger tables
    if (isPostgresConfigured()) {
      const tid = String(telegramId);
      pgPool.query(
        `UPDATE users
         SET points = points + $1,
             streak_count = streak_count + 1,
             last_daily_claim_at = NOW(),
             updated_at = NOW()
         WHERE telegram_id = $2
         RETURNING points, streak_count`,
        [pointsAwarded, tid]
      ).then(res => {
        const bal = res.rows.length > 0 ? Number(res.rows[0].points) : user.points;
        return pgPool.query(
          `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
           VALUES ($1, $2, 'daily_reward', $3, $4, NOW())`,
          [tid, pointsAwarded, bal, isBonus ? `+${pointsAwarded} Daily Reward & Streak Bonus` : `+${pointsAwarded} Daily Reward`]
        );
      }).catch(err => {
        console.warn('[DataStore] Failed to persist daily claim to PostgreSQL:', err?.message);
      });
    }

    this.saveToDisk();
    return {
      success: true,
      points: user.points,
      pointsAwarded,
      newTotalPoints: user.points,
      newBalance: user.points,
      streak: newStreak,
      remainingMs: cooldownMs,
      remainingSeconds: secondsRemaining,
      seconds_remaining: secondsRemaining,
      nextClaimAt,
      next_claim_at: nextClaimAt,
    };
  }

  // ================= COUPON REDEMPTION FROM POINTS (3 TIERS) =================
  static redeemPointsForCoupon(
    telegramId: number,
    tierPoints: number = 100
  ): {
    success: boolean;
    coupon?: Coupon;
    newBalance?: number;
    error?: string;
  } {
    if (!this.storeSettings.coupon_redemption_enabled) {
      return { success: false, error: 'COUPON_REDEMPTION_DISABLED' };
    }

    if (tierPoints !== 50 && tierPoints !== 100 && tierPoints !== 200) {
      return { success: false, error: 'INVALID_COUPON_TIER' };
    }

    // Determine tier values using integer cents arithmetic
    let cost = 100;
    let discountCents = 100;
    let minOrderCents = 300;

    if (tierPoints === 50) {
      cost = 50;
      discountCents = Math.round((this.storeSettings.coupon_tier_50_value ?? 0.5) * 100);
      minOrderCents = Math.round((this.storeSettings.coupon_tier_50_min_order ?? 1.5) * 100);
    } else if (tierPoints === 200) {
      cost = 200;
      discountCents = Math.round((this.storeSettings.coupon_tier_200_value ?? 2.0) * 100);
      minOrderCents = Math.round((this.storeSettings.coupon_tier_200_min_order ?? 5.0) * 100);
    } else {
      cost = 100;
      discountCents = Math.round((this.storeSettings.coupon_tier_100_value ?? 1.0) * 100);
      minOrderCents = Math.round((this.storeSettings.coupon_tier_100_min_order ?? 3.0) * 100);
    }

    const discount = discountCents / 100;
    const minOrder = minOrderCents / 100;

    const profile = this.profiles.get(telegramId);
    if (!profile || profile.points < cost) {
      return { success: false, error: 'INSUFFICIENT_POINTS' };
    }

    const couponCode = `UCH-${cost}-${Math.random().toString(36).substring(2, 6).toUpperCase()}-${telegramId.toString(36).toUpperCase()}`;

    const deduct = this.addPointTransaction(
      telegramId,
      -cost,
      'coupon_redemption',
      `-${cost} Coupon Redemption ($${discount.toFixed(2)})`,
      couponCode
    );

    if (!deduct.success) {
      return { success: false, error: 'FAILED_TO_DEDUCT_POINTS' };
    }

    const coupon = this.createCoupon({
      code: couponCode,
      discount_type: 'fixed',
      discount_value: discount,
      min_order_amount: minOrder,
      usage_limit: 1,
      per_user_limit: 1,
      customer_telegram_id: telegramId,
      status: 'AVAILABLE',
      expires_at: null, // Saved in wallet without short timer expiration
      is_active: true,
    });

    return { success: true, coupon, newBalance: profile.points };
  }

  // ================= STORE SETTINGS =================
  static getStoreSettings(): StoreSettings {
    return { ...this.storeSettings };
  }

  static updateStoreSettings(updates: Partial<StoreSettings>): StoreSettings {
    this.storeSettings = {
      ...this.storeSettings,
      ...updates,
    };
    return { ...this.storeSettings };
  }

  // ================= SEASONAL THEMES (PROMPT 6) =================
  static isValidSeasonalTheme(theme: any): theme is SeasonalThemeId {
    return typeof theme === 'string' && (ALLOWED_SEASONAL_THEMES as readonly string[]).includes(theme.trim().toLowerCase());
  }

  static getSeasonalTheme(): SeasonalThemeConfig {
    const rawTheme = this.storeSettings.seasonal_theme;
    const active_theme: SeasonalThemeId = this.isValidSeasonalTheme(rawTheme) ? (rawTheme.trim().toLowerCase() as SeasonalThemeId) : 'gaming';
    return {
      active_theme,
      updated_at: this.storeSettings.seasonal_theme_updated_at || new Date().toISOString(),
      updated_by: this.storeSettings.seasonal_theme_updated_by || 'system',
      available_themes: [...ALLOWED_SEASONAL_THEMES],
      description: 'Active seasonal theme for customer Store Mini App',
    };
  }

  static setSeasonalTheme(adminId: string | number, theme: string): SeasonalThemeConfig {
    const normalized = String(theme || '').trim().toLowerCase();
    if (!this.isValidSeasonalTheme(normalized)) {
      throw new AppError(
        `Invalid seasonal theme ID: "${theme}". Supported themes are: ${ALLOWED_SEASONAL_THEMES.join(', ')}`,
        400,
        'INVALID_THEME_ID'
      );
    }

    const validatedTheme = normalized as SeasonalThemeId;
    const nowIso = new Date().toISOString();

    this.storeSettings.seasonal_theme = validatedTheme;
    this.storeSettings.seasonal_theme_updated_at = nowIso;
    this.storeSettings.seasonal_theme_updated_by = adminId;

    // Persist to PostgreSQL if configured
    if (isPostgresConfigured()) {
      pgPool.query(
        `INSERT INTO app_settings (key, value, description, updated_at)
         VALUES ('active_seasonal_theme', $1, 'Active global seasonal theme for customer Store Mini App', NOW())
         ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = NOW()`,
        [JSON.stringify({ active_theme: validatedTheme, updated_at: nowIso, updated_by: adminId })]
      ).catch((err) => console.warn('[DataStore] setSeasonalTheme postgres error:', err?.message));
    }

    const numericAdmin = typeof adminId === 'number' ? adminId : parseInt(String(adminId), 10) || 0;
    this.logAdminAction(numericAdmin, 'ACTIVATE_SEASONAL_THEME', {
      theme: validatedTheme,
      updated_at: nowIso,
      updated_by: adminId,
    });

    return this.getSeasonalTheme();
  }

  // ================= ORDER NOTIFICATION DRAFTS (EVERY 3 ORDERS RULE) =================
  static recordQualifyingOrder(_order: Order): OrderNotificationDraft | null {
    this.qualifyingOrderCounter += 1;
    if (this.qualifyingOrderCounter >= 3) {
      this.qualifyingOrderCounter = 0;
      const batchNum = this.orderNotificationDrafts.length + 1;
      const draft: OrderNotificationDraft = {
        id: uuidv4(),
        batch_number: batchNum,
        order_count: 3,
        title: `🔥 Batch #${batchNum}: 3 New Orders Fulfilled!`,
        message: `High demand alert! 3 new orders were successfully processed. Check low-stock inventory and consider launching a customer announcement or restock alert!`,
        status: 'draft',
        created_at: new Date().toISOString(),
      };
      this.orderNotificationDrafts.unshift(draft);
      return draft;
    }
    return null;
  }

  static getOrderNotificationDrafts(): OrderNotificationDraft[] {
    return this.orderNotificationDrafts;
  }

  static broadcastOrderDraft(draftId: string): OrderNotificationDraft | null {
    const draft = this.orderNotificationDrafts.find((d) => d.id === draftId);
    if (!draft) return null;
    draft.status = 'broadcasted';
    draft.broadcasted_at = new Date().toISOString();
    return draft;
  }

  static dismissOrderDraft(draftId: string): OrderNotificationDraft | null {
    const draft = this.orderNotificationDrafts.find((d) => d.id === draftId);
    if (!draft) return null;
    draft.status = 'dismissed';
    return draft;
  }

  // ================= UNIFIED BROADCAST CENTER =================
  static saveBroadcastCampaign(campaign: BroadcastCampaign): void {
    this.broadcastCampaigns.set(campaign.id, { ...campaign });
  }

  static getBroadcastCampaign(id: string): BroadcastCampaign | null {
    const c = this.broadcastCampaigns.get(id);
    return c ? { ...c } : null;
  }

  static getAllBroadcastCampaigns(): BroadcastCampaign[] {
    return Array.from(this.broadcastCampaigns.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static updateBroadcastCampaign(id: string, updates: Partial<BroadcastCampaign>): BroadcastCampaign | null {
    const existing = this.broadcastCampaigns.get(id);
    if (!existing) return null;
    const updated = { ...existing, ...updates };
    this.broadcastCampaigns.set(id, updated);
    return { ...updated };
  }

  static getBroadcastByIdempotencyKey(key: string): BroadcastCampaign | null {
    if (!key) return null;
    for (const campaign of this.broadcastCampaigns.values()) {
      if (campaign.idempotency_key === key) {
        return { ...campaign };
      }
    }
    return null;
  }

  // ================= BATCH STOCK ANNOUNCEMENTS (PROMPT 5) =================
  private static initDefaultRegisteredGroups(): void {
    const defaultGroupId = (process.env.TELEGRAM_ANNOUNCEMENT_GROUP_ID || '').trim();
    if (defaultGroupId && !Array.from(this.registeredGroups.values()).some((g) => g.chat_id === defaultGroupId)) {
      const id = uuidv4();
      this.registeredGroups.set(id, {
        id,
        chat_id: defaultGroupId,
        title: 'Uchiro Official Community',
        chat_type: 'supergroup',
        is_active: true,
        bot_can_post: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
    }
  }

  static recordPendingStockEvent(
    productId: string,
    eventType: 'new_product' | 'restock' | 'manual',
    stockAtEvent: number
  ): StockAnnouncementEvent {
    const prod = this.products.find((p) => p.id === productId);
    if (!prod) {
      throw new AppError('Product not found for stock announcement event', 404);
    }

    // Deduplicate against existing pending event for this product
    for (const event of this.stockAnnouncementEvents.values()) {
      if (event.product_id === productId && event.status === 'pending') {
        event.stock_at_event = stockAtEvent;
        if (event.event_type !== 'new_product') {
          event.event_type = eventType;
        }
        return { ...event };
      }
    }

    const newEvent: StockAnnouncementEvent = {
      id: uuidv4(),
      product_id: productId,
      event_type: eventType,
      stock_at_event: Math.max(0, stockAtEvent),
      status: 'pending',
      batch_id: null,
      created_at: new Date().toISOString(),
    };

    this.stockAnnouncementEvents.set(newEvent.id, newEvent);
    return { ...newEvent };
  }

  static getPendingStockEvents(): StockAnnouncementEvent[] {
    return Array.from(this.stockAnnouncementEvents.values())
      .filter((e) => e.status === 'pending')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }

  static removePendingStockEvent(productId: string): boolean {
    let removed = false;
    for (const event of this.stockAnnouncementEvents.values()) {
      if (event.product_id === productId && event.status === 'pending') {
        event.status = 'cancelled';
        removed = true;
      }
    }
    return removed;
  }

  static markEventsAsPublished(productIds: string[], batchId: string): void {
    const now = new Date().toISOString();
    const idSet = new Set(productIds);
    for (const event of this.stockAnnouncementEvents.values()) {
      if (idSet.has(event.product_id) && (event.status === 'pending' || event.status === 'batched')) {
        event.status = 'published';
        event.batch_id = batchId;
        event.published_at = now;
      }
    }
  }

  static getRegisteredGroups(): RegisteredGroup[] {
    this.initDefaultRegisteredGroups();
    return Array.from(this.registeredGroups.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }

  static getActiveRegisteredGroups(): RegisteredGroup[] {
    return this.getRegisteredGroups().filter((g) => g.is_active && g.bot_can_post);
  }

  static getRegisteredGroup(id: string): RegisteredGroup | null {
    this.initDefaultRegisteredGroups();
    const g = this.registeredGroups.get(id);
    return g ? { ...g } : null;
  }

  static getRegisteredGroupByChatId(chatId: string): RegisteredGroup | null {
    this.initDefaultRegisteredGroups();
    const target = String(chatId).trim();
    for (const g of this.registeredGroups.values()) {
      if (String(g.chat_id).trim() === target) {
        return { ...g };
      }
    }
    return null;
  }

  static registerGroup(groupData: Partial<RegisteredGroup> & { chat_id: string; title: string }): RegisteredGroup {
    this.initDefaultRegisteredGroups();
    const chatId = String(groupData.chat_id).trim();
    const existing = this.getRegisteredGroupByChatId(chatId);
    const now = new Date().toISOString();

    if (existing) {
      const updated: RegisteredGroup = {
        ...existing,
        title: groupData.title?.trim() || existing.title,
        chat_type: groupData.chat_type || existing.chat_type,
        is_active: groupData.is_active !== undefined ? Boolean(groupData.is_active) : existing.is_active,
        bot_can_post: groupData.bot_can_post !== undefined ? Boolean(groupData.bot_can_post) : existing.bot_can_post,
        updated_at: now,
      };
      this.registeredGroups.set(existing.id, updated);
      return { ...updated };
    }

    const id = groupData.id || uuidv4();
    const newGroup: RegisteredGroup = {
      id,
      chat_id: chatId,
      title: groupData.title.trim(),
      chat_type: groupData.chat_type || 'supergroup',
      is_active: groupData.is_active !== undefined ? Boolean(groupData.is_active) : true,
      bot_can_post: groupData.bot_can_post !== undefined ? Boolean(groupData.bot_can_post) : true,
      created_at: now,
      updated_at: now,
    };

    this.registeredGroups.set(id, newGroup);
    return { ...newGroup };
  }

  static updateRegisteredGroup(id: string, updates: Partial<RegisteredGroup>): RegisteredGroup | null {
    this.initDefaultRegisteredGroups();
    const existing = this.registeredGroups.get(id);
    if (!existing) return null;

    const updated: RegisteredGroup = {
      ...existing,
      ...updates,
      id: existing.id,
      chat_id: updates.chat_id ? String(updates.chat_id).trim() : existing.chat_id,
      updated_at: new Date().toISOString(),
    };

    this.registeredGroups.set(id, updated);
    return { ...updated };
  }

  static deleteRegisteredGroup(id: string): boolean {
    this.initDefaultRegisteredGroups();
    return this.registeredGroups.delete(id);
  }

  static createStockBatch(batch: StockAnnouncementBatch): void {
    this.stockAnnouncementBatches.set(batch.id, { ...batch });
  }

  static getStockBatch(id: string): StockAnnouncementBatch | null {
    const b = this.stockAnnouncementBatches.get(id);
    return b ? { ...b } : null;
  }

  static getStockBatchByIdempotencyKey(key: string): StockAnnouncementBatch | null {
    if (!key) return null;
    for (const b of this.stockAnnouncementBatches.values()) {
      if (b.idempotency_key === key) {
        return { ...b };
      }
    }
    return null;
  }

  static updateStockBatch(id: string, updates: Partial<StockAnnouncementBatch>): StockAnnouncementBatch | null {
    const existing = this.stockAnnouncementBatches.get(id);
    if (!existing) return null;

    const updated = {
      ...existing,
      ...updates,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };
    this.stockAnnouncementBatches.set(id, updated);
    return { ...updated };
  }

  static listStockBatches(limit: number = 20): StockAnnouncementBatch[] {
    return Array.from(this.stockAnnouncementBatches.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  static saveStockBatchDelivery(delivery: StockBatchDelivery): void {
    this.stockBatchDeliveries.set(delivery.id, { ...delivery });
  }

  static getStockBatchDeliveries(batchId: string): StockBatchDelivery[] {
    return Array.from(this.stockBatchDeliveries.values())
      .filter((d) => d.batch_id === batchId)
      .sort((a, b) => a.chunk_index - b.chunk_index || a.group_title.localeCompare(b.group_title));
  }

  static updateStockBatchDelivery(id: string, updates: Partial<StockBatchDelivery>): StockBatchDelivery | null {
    const existing = this.stockBatchDeliveries.get(id);
    if (!existing) return null;

    const updated: StockBatchDelivery = {
      ...existing,
      ...updates,
      id: existing.id,
      updated_at: new Date().toISOString(),
    };
    this.stockBatchDeliveries.set(id, updated);
    return { ...updated };
  }

  static getFailedDeliveries(batchId: string): StockBatchDelivery[] {
    return this.getStockBatchDeliveries(batchId).filter((d) => d.status === 'failed');
  }

  static resetStockAnnouncementStateForTesting(): void {
    this.stockAnnouncementEvents.clear();
    this.stockAnnouncementBatches.clear();
    this.stockBatchDeliveries.clear();
    this.registeredGroups.clear();
  }

  // ================= GACHA ADMIN MANAGEMENT =================
  static getAllGachaPoolsAdmin(): (GachaPool & { prizes: GachaPrize[] })[] {
    return this.gachaPools.map((pool) => {
      const poolPrizes = this.gachaPrizes.filter((pr) => pr.pool_id === pool.id);
      return {
        ...pool,
        prizes: poolPrizes.map((pr) => this.formatPrizePayload(pr)),
      };
    });
  }

  static saveGachaPool(pool: Partial<GachaPool>): GachaPool {
    const existing = this.gachaPools.find((p) => p.id === pool.id);
    if (existing) {
      Object.assign(existing, pool, { updated_at: new Date().toISOString() });
      return existing;
    }
    const newPool: GachaPool = {
      id: pool.id || uuidv4(),
      title: pool.title || 'New Gacha Pool',
      slug: pool.slug || `pool-${Date.now()}`,
      description: pool.description || null,
      spin_price: Number(pool.spin_price) || 1.5,
      is_active: pool.is_active ?? true,
      banner_url: pool.banner_url || null,
      total_spins: pool.total_spins || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.gachaPools.unshift(newPool);
    return newPool;
  }

  static validatePoolProbabilities(poolId: string): {
    isValid: boolean;
    totalProbability: number;
    difference: number;
    error?: string;
  } {
    const pool = this.getGachaPoolById(poolId);
    if (!pool) {
      return { isValid: false, totalProbability: 0, difference: -100, error: 'POOL_NOT_FOUND' };
    }
    // Only current active prizes determine spin probability (draft prizes are in standby)
    const activePrizes = (pool.prizes || []).filter((p) => p.is_active && p.slot_status !== 'draft');
    const total = activePrizes.reduce((sum, p) => sum + (Number(p.probability_percent) || 0), 0);
    const roundedTotal = Number(total.toFixed(2));
    const diff = Number((roundedTotal - 100).toFixed(2));
    const isValid = Math.abs(diff) <= 0.05;

    return {
      isValid,
      totalProbability: roundedTotal,
      difference: diff,
      error: isValid
        ? undefined
        : `Active pool probabilities must total exactly 100.0%. Current total is ${roundedTotal.toFixed(1)}% (difference: ${diff > 0 ? '+' : ''}${diff}%).`,
    };
  }

  static updatePoolProbabilities(
    poolId: string,
    updates: { prizeId: string; probability: number }[]
  ): {
    success: boolean;
    totalProbability: number;
    error?: string;
  } {
    const pool = this.getGachaPoolById(poolId);
    if (!pool) {
      return { success: false, totalProbability: 0, error: 'POOL_NOT_FOUND' };
    }

    const updateMap = new Map(updates.map((u) => [u.prizeId, Number(u.probability)]));
    const activePrizes = (pool.prizes || []).filter((p) => p.is_active && p.slot_status !== 'draft');
    let newTotal = 0;

    for (const p of activePrizes) {
      const updatedProb = updateMap.has(p.id) ? updateMap.get(p.id)! : p.probability_percent;
      newTotal += updatedProb;
    }

    if (Math.abs(newTotal - 100) > 0.05) {
      return {
        success: false,
        totalProbability: Number(newTotal.toFixed(2)),
        error: `Active pool probabilities must sum to exactly 100.0%. Provided values sum to ${newTotal.toFixed(1)}%.`,
      };
    }

    for (const u of updates) {
      const prize = this.gachaPrizes.find((p) => p.id === u.prizeId && p.pool_id === poolId);
      if (prize) {
        prize.probability_percent = Number(u.probability);
      }
    }

    return { success: true, totalProbability: 100.0 };
  }

  static saveGachaPrize(prize: Partial<GachaPrize>): {
    success: boolean;
    prize?: GachaPrize;
    error?: string;
  } {
    const poolId = prize.pool_id || (prize.id ? this.gachaPrizes.find((p) => p.id === prize.id)?.pool_id : null);
    if (!poolId) {
      return { success: false, error: 'POOL_ID_REQUIRED' };
    }

    const slotStatus = prize.slot_status || (prize.is_active === false ? 'draft' : 'current');
    const newProb = Number(prize.probability_percent) || 0;
    const isDraft = slotStatus === 'draft';

    if (!isDraft && (prize.is_active ?? true)) {
      const otherActiveCurrent = this.gachaPrizes.filter(
        (p) => p.pool_id === poolId && p.id !== prize.id && p.is_active && p.slot_status !== 'draft'
      );
      const currentSum = otherActiveCurrent.reduce((sum, p) => sum + p.probability_percent, 0);
      const totalWithNew = currentSum + newProb;

      if (Math.abs(totalWithNew - 100) > 0.1) {
        return {
          success: false,
          error: `TOTAL_PERCENTAGE_MUST_BE_100: Active pool probabilities must total 100.0%. Total with this prize is ${totalWithNew.toFixed(1)}% (difference: ${(totalWithNew - 100).toFixed(1)}%).`,
        };
      }
    }

    const existingIdx = this.gachaPrizes.findIndex((p) => p.id === prize.id);
    if (existingIdx >= 0) {
      this.gachaPrizes[existingIdx] = {
        ...this.gachaPrizes[existingIdx],
        ...prize,
        slot_status: slotStatus,
        probability_percent: newProb,
        reward_number: prize.reward_number !== undefined ? Number(prize.reward_number) : this.gachaPrizes[existingIdx].reward_number,
        slot_number: prize.slot_number !== undefined ? Number(prize.slot_number) : (this.gachaPrizes[existingIdx].slot_number || this.gachaPrizes[existingIdx].reward_number),
      } as GachaPrize;
      return { success: true, prize: this.gachaPrizes[existingIdx] };
    }

    const poolPrizesCount = this.gachaPrizes.filter((p) => p.pool_id === poolId).length;
    const newPrize: GachaPrize = {
      id: prize.id || uuidv4(),
      pool_id: poolId,
      reward_number: prize.reward_number !== undefined ? Number(prize.reward_number) : poolPrizesCount + 1,
      slot_number: prize.slot_number !== undefined ? Number(prize.slot_number) : (prize.reward_number !== undefined ? Number(prize.reward_number) : poolPrizesCount + 1),
      slot_status: slotStatus,
      title: prize.title || 'Prize',
      description: prize.description || null,
      rarity: prize.rarity || 'COMMON',
      probability_percent: newProb,
      delivery_mode: prize.delivery_mode || 'instant_code',
      reward_type: prize.reward_type || 'points',
      reward_data: prize.reward_data || { points: 50 },
      icon_url: prize.icon_url || null,
      stock: Number(prize.stock) || 100,
      is_active: isDraft ? false : (prize.is_active ?? true),
      created_at: new Date().toISOString(),
    };
    this.gachaPrizes.push(newPrize);
    return { success: true, prize: newPrize };
  }

  static promoteDraftPrize(prizeId: string): {
    success: boolean;
    prize?: GachaPrize;
    error?: string;
  } {
    const draft = this.gachaPrizes.find((p) => p.id === prizeId);
    if (!draft) return { success: false, error: 'PRIZE_NOT_FOUND' };
    const poolId = draft.pool_id;
    const slotNumber = draft.slot_number || draft.reward_number;

    const currentInSlot = this.gachaPrizes.find(
      (p) =>
        p.pool_id === poolId &&
        (p.slot_number === slotNumber || p.reward_number === slotNumber) &&
        p.id !== prizeId &&
        p.is_active &&
        p.slot_status !== 'draft'
    );

    if (currentInSlot) {
      currentInSlot.is_active = false;
      currentInSlot.slot_status = 'archived';
      draft.probability_percent = currentInSlot.probability_percent;
    }

    draft.slot_status = 'current';
    draft.is_active = true;

    return { success: true, prize: this.formatPrizePayload(draft) };
  }

  static deleteGachaPrize(prizeId: string): boolean {
    const idx = this.gachaPrizes.findIndex((p) => p.id === prizeId);
    if (idx >= 0) {
      this.gachaPrizes.splice(idx, 1);
      return true;
    }
    return false;
  }

  // ================= LIVE VIEWS, HEARTBEATS & LIVE ACTIVITY =================
  static getProductLiveViewers(productId: string): { viewers: number; label: string } {
    const product = this.products.find((p) => p.id === productId);
    if (!product) return { viewers: 1, label: '1 watching now' };
    const base = Math.max(2, Math.floor((product.views_count % 18) + 3));
    return {
      viewers: base,
      label: `${base} people viewing right now`,
    };
  }

  static recordHeartbeat(sessionId: string): void {
    if (!sessionId) return;
    this.activeHeartbeats.set(sessionId, Date.now());
  }

  static getActiveLiveCount(): number {
    const cutoff = Date.now() - 5 * 60 * 1000;
    let count = 0;
    for (const [id, lastSeen] of this.activeHeartbeats.entries()) {
      if (lastSeen > cutoff) {
        count++;
      } else {
        this.activeHeartbeats.delete(id);
      }
    }
    return count;
  }

  static getLiveActivityData(): {
    live_now: number;
    total_buyers: number;
    total_views: number;
    recent_sales: {
      id: string;
      buyer_anonymized: string;
      product_title: string;
      amount: number;
      time_ago: string;
      delivery_mode: string;
      verified: boolean;
    }[];
    top_buyers: {
      rank: number;
      buyer_anonymized: string;
      total_orders: number;
      badge: string;
    }[];
  } {
    const liveNow = this.getActiveLiveCount();

    // 1. Total buyers - REAL DATA ONLY
    const deliveredOrders = this.orders.filter(
      (o) => o.status === 'delivered' || o.status === 'completed' || o.status === 'paid'
    );
    const distinctBuyerKeys = new Set(
      deliveredOrders.map((o) => String(o.telegram_id || o.customer_id))
    );
    const totalBuyers = distinctBuyerKeys.size;

    // 2. Total views across products - REAL DATA ONLY
    const totalViews = this.products.reduce((acc, p) => acc + (p.views_count || 0), 0);

    // 3. Privacy-preserving anonymization (e.g. Sok•••, Rip•••, Uch•••)
    const anonymize = (raw?: string | null, fallback: string = 'Customer'): string => {
      const src = raw && raw.trim().length > 0 ? raw.trim() : fallback;
      const clean = src.replace(/^@/, '').replace(/[^a-zA-Z0-9]/g, '');
      const prefix = clean.slice(0, 3) || 'Uch';
      return `${prefix.charAt(0).toUpperCase() + prefix.slice(1).toLowerCase()}•••`;
    };

    // 4. Recent sales - REAL ORDERS ONLY
    let recentSales: {
      id: string;
      buyer_anonymized: string;
      product_title: string;
      amount: number;
      time_ago: string;
      delivery_mode: string;
      verified: boolean;
    }[] = [];

    if (deliveredOrders.length > 0) {
      recentSales = deliveredOrders.slice(0, 10).map((o, idx) => {
        const item = o.items?.[0];
        const rawName = o.roblox_username || (this.users.get(o.telegram_id)?.username) || (this.users.get(o.telegram_id)?.first_name) || 'Customer';
        const diffMins = Math.floor((Date.now() - new Date(o.created_at).getTime()) / 60000);
        const timeAgo = diffMins < 1 ? 'just now' : diffMins < 60 ? `${diffMins}m ago` : `${Math.floor(diffMins / 60)}h ago`;
        return {
          id: `sale-${o.id}`,
          buyer_anonymized: anonymize(rawName, `User`),
          product_title: item?.product_title || 'Gaming Asset',
          amount: o.total_amount,
          time_ago: timeAgo,
          delivery_mode:
            o.delivery_mode === 'auto_account'
              ? 'Instant Account Delivery'
              : o.delivery_mode === 'manual_service'
              ? 'Roblox Gift Delivery'
              : o.delivery_mode === 'trade_item'
              ? 'In-Game Trade'
              : 'Instant Digital Key',
          verified: true,
        };
      });
    }

    // 5. Top buyers - CALCULATED FROM REAL DATA
    const buyerOrderCounts: Map<number, number> = new Map();
    deliveredOrders.forEach((order) => {
      const tgId = Number(order.telegram_id);
      if (tgId) {
        buyerOrderCounts.set(tgId, (buyerOrderCounts.get(tgId) || 0) + 1);
      }
    });

    const topBuyersArray: {
      rank: number;
      buyer_anonymized: string;
      total_orders: number;
      badge: string;
    }[] = [];

    // Sort buyers by order count descending
    const sortedBuyers = Array.from(buyerOrderCounts.entries())
      .sort(([, aCount], [, bCount]) => bCount - aCount)
      .slice(0, 5); // Top 5

    sortedBuyers.forEach(([buyerId, orderCount], index) => {
      const user = this.users.get(buyerId);
      const rawName = user?.username || (user?.first_name || 'Customer');
      topBuyersArray.push({
        rank: index + 1,
        buyer_anonymized: anonymize(rawName, `User`),
        total_orders: orderCount,
        badge: orderCount >= 10 ? '👑 VIP Mythic' : orderCount >= 5 ? '⭐ Diamond' : orderCount >= 3 ? '⭐ Platinum' : orderCount >= 2 ? '🔥 Gold' : '💎 Verified',
      });
    });

    return {
      live_now: liveNow,
      total_buyers: totalBuyers,
      total_views: totalViews,
      recent_sales: recentSales,
      top_buyers: topBuyersArray,
    };
  }

  static getLiveBuyerFeed(): { id: string; text: string; time_ago: string; mode: string }[] {
    const data = this.getLiveActivityData();
    return data.recent_sales.map((s) => ({
      id: s.id,
      text: `${s.buyer_anonymized} purchased ${s.product_title}`,
      time_ago: s.time_ago,
      mode: s.delivery_mode,
    }));
  }

  // ================= DELIVERY ACCESS AUDIT LOGGING =================
  static logDeliveryAccess(data: Omit<DeliveryAccessLog, 'id' | 'created_at'>): DeliveryAccessLog {
    const log: DeliveryAccessLog = {
      id: uuidv4(),
      created_at: new Date().toISOString(),
      ...data,
    };
    this.deliveryAccessLogs.unshift(log);
    return log;
  }

  static getDeliveryAccessLogs(orderId?: string): DeliveryAccessLog[] {
    if (orderId) {
      return this.deliveryAccessLogs.filter((l) => l.order_id === orderId);
    }
    return this.deliveryAccessLogs;
  }

  // ================= LIVE AUTHENTICATOR / TOTP =================
  static getOrderAuthenticator(orderId: string, telegramId: number): {
    status: 'active' | 'not_applicable';
    code?: string;
    secondsRemaining?: number;
    period?: number;
    expiresAt?: string;
    serverTime?: string;
    generatedAt?: string;
    otpauthUrl?: string;
    username?: string;
  } | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;
    if (order.telegram_id !== telegramId) {
      return null;
    }

    const cred = order.delivery_credentials?.[0];
    if (!cred) {
      return { status: 'not_applicable' };
    }

    const secret = cred.two_factor || cred.authenticator_secret;
    if (!secret) {
      return { status: 'not_applicable' };
    }

    const period = cred.authenticator_period || 30;
    const digits = cred.authenticator_digits || 6;
    const algorithm = cred.authenticator_algorithm || 'SHA1';

    const totpResult = TOTPService.generateCode(secret, Date.now(), {
      period,
      digits,
      algorithm,
    });
    const otpauthUrl = TOTPService.buildOtpAuthUri({
      accountName: cred.username || order.order_number,
      secretBase32: secret,
      issuer: 'Uchiro Store',
      period,
      digits,
      algorithm,
    });

    return {
      status: 'active',
      code: totpResult.code,
      secondsRemaining: totpResult.secondsRemaining,
      period: totpResult.period,
      expiresAt: totpResult.expiresAt,
      serverTime: totpResult.serverTime,
      generatedAt: totpResult.generatedAt,
      otpauthUrl,
      username: cred.username,
    };
  }

  // ================= STRUCTURED DELIVERED ACCOUNT RETRIEVAL =================
  public static recordDeliveredAccount(account: any): void {
    if (!account) return;
    const tid = account.customerTelegramId ?? account.telegramId ?? account.telegram_id;
    const item: any = {
      account_id: account.account_id || account.id || uuidv4(),
      order_code: account.order_code || account.orderCode || 'ORD-RECORDED',
      game_title: account.game_title || account.gameTitle || 'Gaming Account',
      username: account.username || account.login || 'N/A',
      password: account.password || '',
      two_factor_secret: account.two_factor_secret || account.twoFactorSecret || account.two_factor,
      backup_codes: Array.isArray(account.backup_codes)
        ? account.backup_codes
        : account.backup_codes
        ? [account.backup_codes]
        : [],
      notes: account.notes || '',
      delivered_at: account.delivered_at || account.deliveredAt || new Date().toISOString(),
      telegram_id: tid,
      customerTelegramId: tid,
      customer_telegram_id: tid,
    };
    this.recordedDeliveredAccounts.push(item);
  }

  public static getDeliveredAccountsByTelegramId(telegramId: number | string): DeliveredAccount[] {
    const numericId = Number(telegramId);
    const searchIdStr = String(telegramId);

    // Filter recorded accounts: must belong to customer and cannot belong to cancelled/refunded order
    const recordedMatches: DeliveredAccount[] = this.recordedDeliveredAccounts
      .filter((acc) => {
        const accTid = acc.customerTelegramId ?? acc.telegramId ?? acc.telegram_id ?? acc.customer_telegram_id;
        const matchesUser = String(accTid) === searchIdStr || Number(accTid) === numericId;
        if (!matchesUser) return false;

        // If linked to an order, verify order is not cancelled, refunded, failed, or unpaid
        if (acc.order_code) {
          const linkedOrder = this.orders.find(
            (o) => o.order_number === acc.order_code || o.id === acc.order_code
          );
          if (linkedOrder && (linkedOrder.status === 'cancelled' || linkedOrder.status === 'refunded' || linkedOrder.status === 'failed' || linkedOrder.status === 'pending_payment')) {
            return false;
          }
        }
        return true;
      })
      .map((acc) => ({
        account_id: acc.account_id,
        order_code: acc.order_code,
        game_title: acc.game_title,
        username: acc.username,
        password: acc.password,
        two_factor_secret: acc.two_factor_secret,
        backup_codes: acc.backup_codes,
        notes: acc.notes,
        delivered_at: acc.delivered_at,
      }));

    // Customer orders: MUST be strictly delivered or completed (unpaid, pending, cancelled, refunded orders EXCLUDED)
    const userOrders = this.orders.filter(
      (o) =>
        (o.telegram_id === numericId || String(o.telegram_id) === searchIdStr) &&
        (o.status === 'delivered' || o.status === 'completed')
    );
    const deliveredAccounts: DeliveredAccount[] = [];

    for (const order of userOrders) {
      if (!order.delivery_credentials || order.delivery_credentials.length === 0) {
        continue;
      }
      order.delivery_credentials.forEach((cred, idx) => {
        if (!cred) return;
        // Skip pure digital code vouchers if they don't have account structure
        if (cred.type === 'code' && !cred.username && !cred.password) return;

        const accountId = cred.account_id || `${order.id}_acc_${idx}`;
        const orderCode = order.order_number || order.id;
        const gameTitle =
          order.product_title || order.items?.[0]?.product_title || 'Gaming Account';
        const username = cred.username || cred.login || 'N/A';
        const password = cred.password || '';
        const twoFactorSecret = cred.two_factor || cred.authenticator_secret || cred.two_factor_secret || cred.twoFactorSecret || null;
        const backupCodes = Array.isArray(cred.backup_codes)
          ? cred.backup_codes
          : cred.backup_codes
          ? [cred.backup_codes]
          : undefined;
        const notes = cred.notes || order.fulfillment_notes || undefined;
        const deliveredAt = order.delivered_at || order.created_at || new Date().toISOString();

        deliveredAccounts.push({
          account_id: accountId,
          order_code: orderCode,
          game_title: gameTitle,
          username,
          password,
          two_factor_secret: twoFactorSecret,
          backup_codes: backupCodes,
          notes,
          delivered_at: deliveredAt,
        });
      });
    }

    // Deduplicate: paid and successfully assigned accounts must appear once
    const seen = new Set<string>();
    const deduplicated: DeliveredAccount[] = [];

    for (const acc of [...recordedMatches, ...deliveredAccounts]) {
      const key = `${acc.account_id || ''}::${acc.order_code || ''}::${(acc.username || '').toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      deduplicated.push(acc);
    }

    return deduplicated;
  }

  static getDeliveredAccountById(
    telegramId: number | string,
    accountId: string
  ): DeliveredAccount | null {
    const accounts = this.getDeliveredAccountsByTelegramId(telegramId);
    return (
      accounts.find(
        (a) =>
          a.account_id === accountId ||
          a.account_id.startsWith(accountId) ||
          accountId.startsWith(a.account_id)
      ) || null
    );
  }

  // ================= 14-DAY WARRANTY OPERATIONS =================
  static replaceWarrantyOrder(
    orderId: string,
    replacementNotes: string,
    credentials?: any[]
  ): Order | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const isAccount = order.delivery_mode === 'auto_account' || (order as any).product_type === 'account';
    if (!isAccount) return null;

    order.warranty_status = 'active';
    order.warranty_notes = replacementNotes;
    if (credentials && credentials.length > 0) {
      order.delivery_credentials = credentials;
    }
    order.updated_at = new Date().toISOString();
    return order;
  }

  static invalidateWarranty(orderId: string, reason: string): Order | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;

    const isAccount = order.delivery_mode === 'auto_account' || (order as any).product_type === 'account';
    if (!isAccount) return null;

    order.warranty_status = 'invalidated';
    order.warranty_invalidation_reason = reason;
    order.updated_at = new Date().toISOString();
    return order;
  }

  // ================= BACKUP & RESTORE =================
  static exportBackupBundle() {
    return {
      version: '3.0.0',
      exported_at: new Date().toISOString(),
      store_brand: 'Uchiro Store',
      categories: this.categories,
      products: this.products,
      inventory_count: this.inventory.length,
      gacha_pools: this.gachaPools,
      gacha_prizes: this.gachaPrizes,
      coupons: this.coupons,
      settings: this.storeSettings,
    };
  }

  static restoreBackupBundle(bundle: any, adminTelegramId: number): {
    success: boolean;
    summary: any;
    error?: string;
  } {
    if (!bundle || typeof bundle !== 'object') {
      return { success: false, summary: null, error: 'INVALID_BACKUP_FORMAT' };
    }

    if (bundle.version !== '3.0.0' && !bundle.store_brand?.includes('Uchiro')) {
      return { success: false, summary: null, error: 'UNRECOGNIZED_BACKUP_SCHEMA_VERSION' };
    }

    let restoredCategories = 0;
    let restoredProducts = 0;
    let restoredGacha = 0;
    let restoredCoupons = 0;

    if (Array.isArray(bundle.categories) && bundle.categories.length > 0) {
      this.categories = bundle.categories;
      restoredCategories = bundle.categories.length;
    }

    if (Array.isArray(bundle.products) && bundle.products.length > 0) {
      this.products = bundle.products;
      restoredProducts = bundle.products.length;
    }

    if (Array.isArray(bundle.gacha_prizes) && bundle.gacha_prizes.length > 0) {
      this.gachaPrizes = bundle.gacha_prizes;
      restoredGacha = bundle.gacha_prizes.length;
    }

    if (Array.isArray(bundle.coupons) && bundle.coupons.length > 0) {
      this.coupons = bundle.coupons;
      restoredCoupons = bundle.coupons.length;
    }

    if (bundle.settings) {
      this.storeSettings = { ...this.storeSettings, ...bundle.settings };
    }

    this.logAdminAction(adminTelegramId, 'RESTORE_BACKUP', {
      restoredCategories,
      restoredProducts,
      restoredGacha,
      restoredCoupons,
    });

    return {
      success: true,
      summary: {
        categories: restoredCategories,
        products: restoredProducts,
        gacha_prizes: restoredGacha,
        coupons: restoredCoupons,
      },
    };
  }

  // ================= DEMO DATA RESET (Section 58) =================
  static resetDemoData(): { success: boolean; message: string } {
    if (process.env.NODE_ENV === 'production') {
      throw new AppError(
        'Demo data reset is strictly prohibited in production environment',
        403,
        'FORBIDDEN_IN_PRODUCTION'
      );
    }

    // Safely re-initialize in-memory demo data without dropping database, schema, or tables
    this.categories = JSON.parse(JSON.stringify(initialCategories));
    this.products = JSON.parse(JSON.stringify(initialProducts));
    this.inventory = JSON.parse(JSON.stringify(initialInventory));
    this.coupons = JSON.parse(JSON.stringify(initialCoupons));
    this.redeemCodes = JSON.parse(JSON.stringify(initialRedeemCodes));
    this.redeemCodeUsages = [];
    this.gachaPools = JSON.parse(JSON.stringify(initialGachaPools));
    this.gachaPrizes = JSON.parse(JSON.stringify(initialGachaPrizes));
    this.orders = [];
    this.payments = [];
    this.recordedDeliveredAccounts = [];
    this.gachaSpins = [];
    this.gachaClaims = [];
    this.pointLedger = [];
    this.deliveryAccessLogs = [];
    this.dailyRewards.clear();
    this.storeSettings.seasonal_theme = 'gaming';
    this.storeSettings.seasonal_theme_updated_at = new Date().toISOString();
    this.storeSettings.seasonal_theme_updated_by = 'system';

    return {
      success: true,
      message: 'Demo data reset completed safely (non-production environment only)',
    };
  }

  static async getUserSnapshot(telegramId: string | number): Promise<UserSnapshot> {
    return getUserSnapshot(telegramId);
  }

  static async buyGachaTicket(telegramId: string | number, cost: number) {
    return buyGachaTicket(telegramId, cost);
  }
}

// ================= MODULE 1: SUPABASE / POSTGRES PERSISTENCE =================

export type OrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled' | 'refunded';

export interface StoredUser {
  telegramId: string;
  username: string | null;
  firstName: string | null;
  points: number;
  streakCount: number;
  gachaTickets?: number;
  lastDailyClaimAt: string | null;
  extra: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

export interface UserSnapshot {
  telegramId: number;
  points: number;
  streak: number;
  gachaTickets: number;
  lastDailyClaimAt: string | null;
  nextClaimAt: string | null;
  ordersCount: number;
  totalSpent: number;
}

export interface SaveUserInput {
  telegramId: string | number;
  username?: string | null;
  firstName?: string | null;
  extra?: Record<string, unknown>;
}

export type ClaimResult =
  | {
      success: true;
      points: number;
      streak: number;
      seconds_remaining?: number;
      pointsAwarded?: number;
      newBalance?: number;
      nextClaimAt?: string;
      serverNow?: string;
    }
  | {
      success: false;
      error?: string;
      remainingMs?: number;
      points?: number;
      streak?: number;
      serverNow?: string;
      seconds_remaining?: number;
    };

export type AdjustPointsResult =
  | { success: true; points: number }
  | { success: false; error: string; points: number };

export interface StoredOrder {
  id: string;
  orderCode: string;
  telegramId: string | null;
  items: unknown[];
  totalAmount: number;
  currency: string;
  status: OrderStatus;
  paymentProvider: string | null;
  paymentRef: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateOrderInput {
  orderCode: string;
  telegramId?: string | number | null;
  items: unknown[];
  totalAmount: number;
  currency?: string;
  paymentProvider?: string;
  paymentRef?: string | null;
}

interface UserRow {
  telegram_id: string;
  username: string | null;
  first_name: string | null;
  points: number;
  streak_count: number;
  gacha_tickets?: number;
  last_daily_claim_at: string | null;
  extra: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

interface OrderRow {
  id: string;
  order_code: string;
  telegram_id: string | null;
  items: unknown[] | null;
  total_amount: number | string;
  currency: string;
  status: OrderStatus;
  payment_provider: string | null;
  payment_ref: string | null;
  created_at: string;
  updated_at: string;
}

function rowToUser(row: UserRow): StoredUser {
  return {
    telegramId: row.telegram_id,
    username: row.username,
    firstName: row.first_name,
    points: row.points ?? 0,
    streakCount: row.streak_count ?? 0,
    gachaTickets: row.gacha_tickets ?? 0,
    lastDailyClaimAt: row.last_daily_claim_at,
    extra: row.extra ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

let schemaEnsuredPromise: Promise<void> | null = null;
export async function ensureUserSchema(): Promise<void> {
  if (!isPostgresConfigured()) return;
  if (schemaEnsuredPromise) return schemaEnsuredPromise;
  schemaEnsuredPromise = (async () => {
    try {
      const { rows } = await pgPool.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'users' AND column_name = 'gacha_tickets'
      `);
      if (rows.length === 0) {
        await pgPool.query(`ALTER TABLE users ADD COLUMN gacha_tickets INTEGER NOT NULL DEFAULT 0`);
        try {
          await pgPool.query(`
            UPDATE users
            SET gacha_tickets = COALESCE((extra->>'gacha_tickets')::integer, 0)
            WHERE extra IS NOT NULL AND extra->>'gacha_tickets' IS NOT NULL
          `);
        } catch (bfErr: any) {
          console.warn('[DataStore] backfill gacha_tickets warning:', bfErr?.message);
        }
      }
    } catch (err: any) {
      console.warn('[DataStore] ensureUserSchema error:', err?.message);
    }
  })();
  return schemaEnsuredPromise;
}

const pendingUserWrites = new Map<string, Promise<any>>();

export async function awaitPendingUserWrites(telegramId: string | number): Promise<void> {
  const tid = String(telegramId);
  const existing = pendingUserWrites.get(tid);
  if (existing) {
    try {
      await existing;
    } catch {
      // Ignore write errors here
    }
  }
}

function queueUserWrite<T>(telegramId: string | number, task: () => Promise<T>): Promise<T> {
  const tid = String(telegramId);
  const current = pendingUserWrites.get(tid) || Promise.resolve();
  const next = current.then(task, task);
  pendingUserWrites.set(tid, next);
  return next;
}

export async function persistPointsDelta(
  telegramId: string | number,
  delta: number,
  description: string
): Promise<number | null> {
  const tid = String(telegramId);
  const deltaNum = Math.trunc(delta);
  if (!deltaNum || !isPostgresConfigured()) return null;

  return queueUserWrite(tid, async () => {
    try {
      await pgPool.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, created_at, updated_at)
         VALUES ($1, 'customer', 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [tid]
      );

      const { rows } = await pgPool.query(
        `UPDATE users
         SET points = GREATEST(0, points + $2::int), updated_at = NOW()
         WHERE telegram_id = $1
         RETURNING points`,
        [tid, deltaNum]
      );

      if (rows.length === 0) return null;
      const newBalance = Number(rows[0].points);

      try {
        await pgPool.query(
          `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [tid, deltaNum, deltaNum < 0 ? 'deduction' : 'addition', newBalance, description]
        );
      } catch (lErr: any) {
        console.warn('[DataStore] persistPointsDelta ledger write warning:', lErr?.message);
      }

      return newBalance;
    } catch (err: any) {
      console.warn('[DataStore] persistPointsDelta error:', err?.message);
      return null;
    }
  });
}

export async function persistTicketsDelta(
  telegramId: string | number,
  delta: number
): Promise<number | null> {
  const tid = String(telegramId);
  const deltaNum = Math.trunc(delta);
  if (!deltaNum || !isPostgresConfigured()) return null;

  return queueUserWrite(tid, async () => {
    try {
      await ensureUserSchema();
      await pgPool.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, gacha_tickets, created_at, updated_at)
         VALUES ($1, 'customer', 0, 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [tid]
      );

      const { rows } = await pgPool.query(
        `UPDATE users
         SET gacha_tickets = GREATEST(0, COALESCE(gacha_tickets, 0) + $2::int), updated_at = NOW()
         WHERE telegram_id = $1
         RETURNING gacha_tickets`,
        [tid, deltaNum]
      );

      if (rows.length === 0) return null;
      return Number(rows[0].gacha_tickets);
    } catch (err: any) {
      console.warn('[DataStore] persistTicketsDelta error:', err?.message);
      return null;
    }
  });
}

export async function getUserSnapshot(telegramId: string | number): Promise<UserSnapshot> {
  const tid = String(telegramId);
  const numId = Number(telegramId) || 0;

  await awaitPendingUserWrites(tid);

  if (isPostgresConfigured()) {
    try {
      await ensureUserSchema();

      let userRow: any = null;
      try {
        const { rows } = await pgPool.query(
          `SELECT telegram_id, points, streak_count, gacha_tickets, last_daily_claim_at
           FROM users WHERE telegram_id = $1 LIMIT 1`,
          [tid]
        );
        if (rows.length > 0) userRow = rows[0];
      } catch (err: any) {
        if (err.code === '42703') {
          const { rows } = await pgPool.query(
            `SELECT telegram_id, points, streak_count, 0 AS gacha_tickets, last_daily_claim_at
             FROM users WHERE telegram_id = $1 LIMIT 1`,
            [tid]
          );
          if (rows.length > 0) userRow = rows[0];
        } else {
          throw err;
        }
      }

      let ordersCount = 0;
      let totalSpent = 0;
      try {
        const { rows: orderRows } = await pgPool.query(
          `SELECT COUNT(*)::int AS orders_count, COALESCE(SUM(total_amount), 0)::float AS total_spent
           FROM orders WHERE telegram_id = $1 AND status = 'paid'`,
          [tid]
        );
        if (orderRows.length > 0) {
          ordersCount = Number(orderRows[0].orders_count || 0);
          totalSpent = Number(Number(orderRows[0].total_spent || 0).toFixed(2));
        }
      } catch {
        try {
          const { rows: orderRows } = await pgPool.query(
            `SELECT COUNT(*)::int AS orders_count, COALESCE(SUM(amount), 0)::float AS total_spent
             FROM orders WHERE telegram_id = $1 AND status = 'paid'`,
            [tid]
          );
          if (orderRows.length > 0) {
            ordersCount = Number(orderRows[0].orders_count || 0);
            totalSpent = Number(Number(orderRows[0].total_spent || 0).toFixed(2));
          }
        } catch {
          // ignore
        }
      }

      const points = Number(userRow?.points || 0);
      const streak = Number(userRow?.streak_count || 0);
      const gachaTickets = Number(userRow?.gacha_tickets || 0);
      const lastDailyClaimAt = userRow?.last_daily_claim_at
        ? new Date(userRow.last_daily_claim_at).toISOString()
        : null;
      const nextClaimAt = lastDailyClaimAt
        ? new Date(new Date(lastDailyClaimAt).getTime() + 86400000).toISOString()
        : null;

      if (numId) {
        let existingUser = DataStore.getTelegramUser(numId);
        if (!existingUser) {
          const created = DataStore.findOrCreateTelegramUser({ telegram_id: numId, first_name: 'Customer' });
          existingUser = created.user;
        }
        existingUser.points = points;
        existingUser.reward_points = points;
        existingUser.streak_count = streak;
        existingUser.gacha_tickets = gachaTickets;
        existingUser.last_daily_claim_at = lastDailyClaimAt;

        let profile = DataStore.getProfile(numId);
        if (!profile) {
          DataStore.findOrCreateTelegramUser({ telegram_id: numId, first_name: 'Customer' });
          profile = DataStore.getProfile(numId);
        }
        if (profile) {
          profile.points = points;
          profile.reward_points = points;
          profile.loyalty_points = points;
          profile.streak_count = streak;
          profile.gacha_tickets = gachaTickets;
          profile.last_daily_claim_at = lastDailyClaimAt;
        }
      }

      return {
        telegramId: numId,
        points,
        streak,
        gachaTickets,
        lastDailyClaimAt,
        nextClaimAt,
        ordersCount,
        totalSpent,
      };
    } catch (err: any) {
      console.warn('[DataStore] getUserSnapshot postgres error:', err?.message);
    }
  }

  // Memory fallback
  const user = DataStore.getTelegramUser(numId);
  const profile = DataStore.getProfile(numId);
  const pts = Number(profile?.points ?? user?.points ?? 0);
  const streak = Number(profile?.streak_count ?? user?.streak_count ?? 0);
  const tickets = Number(profile?.gacha_tickets ?? 0);
  const lastDailyClaimAt = user?.last_daily_claim_at || profile?.last_daily_claim_at || null;
  const nextClaimAt = lastDailyClaimAt
    ? new Date(new Date(lastDailyClaimAt).getTime() + 86400000).toISOString()
    : null;
  if (user) {
    user.points = pts;
    user.reward_points = pts;
    user.streak_count = streak;
    user.gacha_tickets = tickets;
    user.last_daily_claim_at = lastDailyClaimAt;
  }
  if (profile) {
    profile.points = pts;
    profile.reward_points = pts;
    profile.loyalty_points = pts;
    profile.streak_count = streak;
    profile.gacha_tickets = tickets;
    profile.last_daily_claim_at = lastDailyClaimAt;
  }
  const userOrders = DataStore.getOrdersByCustomer(numId).filter(
    (o) => o.status === 'paid' || (o.status as string) === 'completed'
  );
  const ordersCount = userOrders.length;
  const totalSpent = Number(
    userOrders.reduce((sum, o) => sum + (Number(o.total_amount ?? o.total_price ?? 0)), 0).toFixed(2)
  );

  return {
    telegramId: numId,
    points: pts,
    streak,
    gachaTickets: tickets,
    lastDailyClaimAt,
    nextClaimAt,
    ordersCount,
    totalSpent,
  };
}

export async function buyGachaTicket(
  telegramId: string | number,
  cost: number
): Promise<{ success: boolean; points: number; gachaTickets: number; error?: string }> {
  const numId = Number(telegramId);
  const tid = String(telegramId);
  const costNum = Math.trunc(cost);
  if (!numId || costNum <= 0) {
    return { success: false, points: 0, gachaTickets: 0, error: 'INVALID_PARAMS' };
  }

  await awaitPendingUserWrites(tid);

  if (isPostgresConfigured()) {
    await ensureUserSchema();
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, gacha_tickets, created_at, updated_at)
         VALUES ($1, 'customer', 0, 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [tid]
      );

      const { rows } = await client.query(
        `UPDATE users
         SET points = points - $2::int,
             gacha_tickets = COALESCE(gacha_tickets, 0) + 1,
             updated_at = NOW()
         WHERE telegram_id = $1 AND points >= $2::int
         RETURNING points, gacha_tickets`,
        [tid, costNum]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        const snap = await getUserSnapshot(tid);
        return { success: false, points: snap.points, gachaTickets: snap.gachaTickets, error: 'INSUFFICIENT_POINTS' };
      }

      const newPoints = Number(rows[0].points);
      const newTickets = Number(rows[0].gacha_tickets);
      await client.query('COMMIT');

      try {
        await pgPool.query(
          `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
           VALUES ($1, $2, 'deduction', $3, $4, NOW())`,
          [tid, -costNum, newPoints, `-${costNum} Gacha Ticket Exchange`]
        );
      } catch (lErr: any) {
        console.warn('[DataStore] points_ledger write warning:', lErr?.message);
      }

      await DataStore.syncUserFromPostgres(tid);

      return { success: true, points: newPoints, gachaTickets: newTickets };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DataStore] buyGachaTicket error:', err?.message);
      return { success: false, points: 0, gachaTickets: 0, error: 'DB_ERROR' };
    } finally {
      client.release();
    }
  }

  const memRes = DataStore.buyGachaTickets(numId, 1);
  return {
    success: memRes.success,
    points: memRes.newBalance,
    gachaTickets: memRes.tickets,
    error: memRes.error,
  };
}

function rowToOrder(row: OrderRow): StoredOrder {
  return {
    id: row.id,
    orderCode: row.order_code,
    telegramId: row.telegram_id,
    items: row.items ?? [],
    totalAmount: Number(row.total_amount),
    currency: row.currency,
    status: row.status,
    paymentProvider: row.payment_provider,
    paymentRef: row.payment_ref,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getUser(telegramId: string | number): Promise<StoredUser | null> {
  if (!isPostgresConfigured()) {
    return null;
  }
  const tid = String(telegramId);

  try {
    const { rows } = await pgPool.query('SELECT * FROM users WHERE telegram_id = $1', [tid]);
    if (rows.length === 0) {
      // Auto-create new user (idempotent, same as Supabase behavior)
      const userId = `user_${tid}`;
      const { rows: inserted } = await pgPool.query(
        `INSERT INTO users (id, telegram_id, role, points, streak_count, created_at, updated_at)
         VALUES ($1, $2, 'customer', 0, 0, NOW(), NOW())
         RETURNING *`,
        [userId, tid]
      );
      return inserted.length > 0 ? rowToUser(inserted[0]) : null;
    }
    return rowToUser(rows[0]);
  } catch (err: any) {
    console.error('[DataStore] getUser PostgreSQL error:', err?.message);
    return null;
  }
}

/**
 * Saves PROFILE fields only (username, firstName, extra). Points, streak and claim time
 * are never written here — they change only through claimDailyReward / adjustPoints so
 * a stale object can never overwrite a balance.
 */
export async function saveUser(input: SaveUserInput): Promise<StoredUser> {
  if (!isPostgresConfigured()) {
    throw new Error('PostgreSQL not configured');
  }
  const tid = String(input.telegramId);
  const now = new Date().toISOString();

  const payload: Record<string, unknown> = {
    telegram_id: tid,
    updated_at: now,
  };
  if (input.username !== undefined) payload.username = input.username;
  if (input.firstName !== undefined) payload.first_name = input.firstName;
  if (input.extra !== undefined) payload.extra = input.extra;

  const columns = Object.keys(payload).join(', ');
  const placeholders = Object.keys(payload).map((_, i) => `$${i + 1}`).join(', ');
  const values = Object.values(payload);

  const sql = `
    INSERT INTO users (telegram_id, username, first_name, extra, updated_at)
    VALUES (${placeholders})
    ON CONFLICT (telegram_id) DO UPDATE SET
      username = EXCLUDED.username,
      first_name = EXCLUDED.first_name,
      extra = EXCLUDED.extra,
      updated_at = EXCLUDED.updated_at
    RETURNING *
  `;

  try {
    const { rows } = await pgPool.query(sql, values);
    if (rows.length === 0) throw new Error('No row returned from saveUser');
    return rowToUser(rows[0]);
  } catch (err: any) {
    console.error('[DataStore] saveUser PostgreSQL error:', err?.message);
    throw err;
  }
}

export async function claimDailyReward(telegramId: string | number): Promise<ClaimResult> {
  const numId = Number(telegramId);
  if (!numId) {
    return { success: false, error: 'INVALID_TELEGRAM_ID', remainingMs: 0, points: 0, streak: 0, serverNow: new Date().toISOString() };
  }

  const tid = String(telegramId);
  await awaitPendingUserWrites(tid);

  if (isPostgresConfigured()) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');

      const isAdmin = numId > 0 && env.ADMIN_TELEGRAM_USER_IDS.includes(numId);
      await client.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, created_at, updated_at)
         VALUES ($1, $2, 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [tid, isAdmin ? 'admin' : 'customer']
      );

      const { rows } = await client.query(
        `SELECT points, streak_count, last_daily_claim_at, NOW() AS db_now
         FROM users WHERE telegram_id = $1 FOR UPDATE`,
        [tid]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        return { success: false, error: 'USER_NOT_FOUND', remainingMs: 0, points: 0, streak: 0, serverNow: new Date().toISOString() };
      }

      const row = rows[0];
      const currentPts = Number(row.points || 0);
      const currentStreak = Number(row.streak_count || 0);
      const dbNow = new Date(row.db_now || Date.now());
      const nowMs = dbNow.getTime();
      const lastClaimAt = row.last_daily_claim_at ? new Date(row.last_daily_claim_at).getTime() : 0;
      const cooldownMs = 24 * 60 * 60 * 1000;

      // Reject if last claim < 24h ago
      if (lastClaimAt > 0 && nowMs - lastClaimAt < cooldownMs) {
        await client.query('ROLLBACK');
        const remainingMs = cooldownMs - (nowMs - lastClaimAt);
        const seconds_remaining = Math.ceil(remainingMs / 1000);
        return {
          success: false,
          error: 'ALREADY_CLAIMED_TODAY',
          remainingMs,
          seconds_remaining,
          points: currentPts,
          streak: currentStreak,
          serverNow: dbNow.toISOString(),
        };
      }

      // Streak resets to 1 if > 48h
      let newStreak = 1;
      if (lastClaimAt > 0 && nowMs - lastClaimAt < 48 * 60 * 60 * 1000) {
        newStreak = currentStreak + 1;
      }

      // Bonus when newStreak % streak_interval_days === 0
      const settings = DataStore.getStoreSettings();
      const baseReward = settings.daily_reward_points || 5;
      const streakBonus = settings.streak_bonus_points || 15;
      const streakInterval = settings.streak_interval_days || 7;
      const isBonus = newStreak % streakInterval === 0;
      const pointsAwarded = isBonus ? baseReward + streakBonus : baseReward;
      const newPoints = currentPts + pointsAwarded;

      await client.query(
        `UPDATE users
         SET points = $1, streak_count = $2, last_daily_claim_at = NOW(), updated_at = NOW()
         WHERE telegram_id = $3`,
        [newPoints, newStreak, tid]
      );

      await client.query('COMMIT');

      // Non-fatal ledger insert after commit
      try {
        await pgPool.query(
          `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
           VALUES ($1, $2, 'daily_reward', $3, $4, NOW())`,
          [tid, pointsAwarded, newPoints, isBonus ? `+${pointsAwarded} Daily Reward & Streak Bonus` : `+${pointsAwarded} Daily Reward`]
        );
      } catch (lErr: any) {
        console.warn('[DataStore] daily reward points_ledger write warning:', lErr?.message);
      }

      await DataStore.syncUserFromPostgres(tid);

      return {
        success: true,
        points: newPoints,
        streak: newStreak,
        seconds_remaining: 86400,
        pointsAwarded,
        newBalance: newPoints,
        nextClaimAt: new Date(nowMs + cooldownMs).toISOString(),
        serverNow: dbNow.toISOString(),
      };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DataStore] claimDailyReward PostgreSQL error:', err.message);
      return { success: false, error: 'DB_ERROR', remainingMs: 0, points: 0, streak: 0, serverNow: new Date().toISOString() };
    } finally {
      client.release();
    }
  }

  // In-memory fallback
  const dsRes = DataStore.claimDailyReward(numId);
  return dsRes as ClaimResult;
}

export async function adjustPoints(
  telegramId: string | number,
  delta: number,
  reason: string,
): Promise<AdjustPointsResult> {
  const numId = Number(telegramId);
  if (!numId) return { success: false, error: 'INVALID_TELEGRAM_ID', points: 0 };

  const tid = String(telegramId);
  const deltaNum = Math.trunc(delta);

  await awaitPendingUserWrites(tid);

  if (isPostgresConfigured()) {
    const client = await pgPool.connect();
    try {
      await client.query('BEGIN');
      await client.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, created_at, updated_at)
         VALUES ($1, 'customer', 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [tid]
      );

      const { rows } = await client.query(
        `UPDATE users
         SET points = points + $2::int, updated_at = NOW()
         WHERE telegram_id = $1 AND points + $2::int >= 0
         RETURNING points`,
        [tid, deltaNum]
      );

      if (rows.length === 0) {
        await client.query('ROLLBACK');
        const { rows: currentRows } = await pgPool.query('SELECT points FROM users WHERE telegram_id = $1', [tid]);
        const currentPts = Number(currentRows[0]?.points || 0);
        return { success: false, error: 'INSUFFICIENT_POINTS', points: currentPts };
      }

      const newBalance = Number(rows[0].points);
      await client.query('COMMIT');

      try {
        await pgPool.query(
          `INSERT INTO points_ledger (telegram_id, amount, type, balance_after, description, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [tid, deltaNum, deltaNum < 0 ? 'deduction' : 'addition', newBalance, reason]
        );
      } catch (err: any) {
        console.warn('[DataStore] points_ledger write warning:', err?.message);
      }

      await DataStore.syncUserFromPostgres(tid);

      return { success: true, points: newBalance };
    } catch (err: any) {
      await client.query('ROLLBACK').catch(() => {});
      console.error('[DataStore] adjustPoints PostgreSQL error:', err?.message);
      return { success: false, error: 'DB_ERROR', points: 0 };
    } finally {
      client.release();
    }
  }

  const dsUser = DataStore.getTelegramUser(numId);
  const dsProfile = DataStore.getProfile(numId);
  const curPts = dsProfile?.points ?? dsUser?.points ?? 0;
  if (curPts + deltaNum < 0) {
    return { success: false, error: 'INSUFFICIENT_POINTS', points: curPts };
  }
  const newPts = curPts + deltaNum;
  if (dsUser) {
    dsUser.points = newPts;
    dsUser.reward_points = newPts;
  }
  if (dsProfile) {
    dsProfile.points = newPts;
    dsProfile.reward_points = newPts;
    dsProfile.loyalty_points = newPts;
  }
  return { success: true, points: newPts };
}

export async function createOrder(input: CreateOrderInput): Promise<StoredOrder> {
  const telegramId =
    input.telegramId === undefined || input.telegramId === null ? null : String(input.telegramId);

  if (isPostgresConfigured()) {
    if (telegramId !== null) {
      await pgPool.query(
        `INSERT INTO users (telegram_id, role, points, streak_count, created_at, updated_at)
         VALUES ($1, 'customer', 0, 0, NOW(), NOW())
         ON CONFLICT (telegram_id) DO NOTHING`,
        [telegramId]
      );
    }

    const { rows } = await pgPool.query(
      `INSERT INTO orders (order_code, telegram_id, items, total_amount, currency, payment_provider, payment_ref, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())
       RETURNING *`,
      [
        input.orderCode,
        telegramId,
        JSON.stringify(input.items || []),
        input.totalAmount,
        input.currency ?? 'USD',
        input.paymentProvider ?? 'khpay',
        input.paymentRef ?? null,
      ]
    );
    if (!rows || rows.length === 0) throw new Error('createOrder failed: no row returned');
    return rowToOrder(rows[0] as OrderRow);
  }

  const orderId = uuidv4();
  const now = new Date().toISOString();
  return {
    id: orderId,
    orderCode: input.orderCode,
    telegramId,
    items: input.items,
    totalAmount: input.totalAmount,
    currency: input.currency ?? 'USD',
    status: 'completed' as any,
    paymentProvider: input.paymentProvider ?? 'khpay',
    paymentRef: input.paymentRef ?? null,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getOrderByCode(orderCode: string): Promise<StoredOrder | null> {
  if (isPostgresConfigured()) {
    const { rows } = await pgPool.query(
      `SELECT * FROM orders WHERE order_code = $1 LIMIT 1`,
      [orderCode]
    );
    return rows.length > 0 ? rowToOrder(rows[0] as OrderRow) : null;
  }
  return null;
}

export async function listOrdersByUser(telegramId: string | number): Promise<StoredOrder[]> {
  if (!isPostgresConfigured()) {
    return [];
  }
  const tid = String(telegramId);

  try {
    const { rows } = await pgPool.query(
      'SELECT * FROM orders WHERE telegram_id = $1 ORDER BY created_at DESC',
      [tid]
    );
    return rows.map(rowToOrder);
  } catch (err: any) {
    console.error('[DataStore] listOrdersByUser PostgreSQL error:', err.message);
    return [];
  }
}

const ALLOWED_FROM: Record<OrderStatus, OrderStatus[]> = {
  pending: [],
  paid: ['pending'],
  failed: ['pending'],
  cancelled: ['pending'],
  refunded: ['paid'],
};

/**
 * Idempotent, forward-only status change keyed by payment_ref.
 * Returns the updated order, or null if nothing changed (already in that state / transition not allowed).
 */
export async function transitionOrderStatus(
  paymentRef: string,
  to: OrderStatus,
): Promise<StoredOrder | null> {
  const from = ALLOWED_FROM[to];
  if (from.length === 0) return null;
  if (!isPostgresConfigured()) return null;

  try {
    const { rows } = await pgPool.query(
      `UPDATE orders SET status = $1, updated_at = NOW() WHERE payment_ref = $2 AND status = ANY($3) RETURNING *`,
      [to, paymentRef, from]
    );
    return rows.length > 0 ? rowToOrder(rows[0]) : null;
  } catch (err: any) {
    console.error('[DataStore] transitionOrderStatus PostgreSQL error:', err.message);
    return null;
  }
}

