import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  Category,
  Product,
  ProductMedia,
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
} from '../types';
import { encrypt, decrypt } from '../security/encryption';
import { TOTPService } from '../security/totp';
import { AppError } from '../middleware/error-handler';

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

// Seed Products
const initialProducts: Product[] = [
  {
    id: '22222222-2222-2222-2222-222222222201',
    category_id: '11111111-1111-1111-1111-111111111103',
    title: 'Blox Fruits Max Level Kitsune Account',
    slug: 'blox-fruits-max-kitsune-account',
    description:
      'Complete powerhouse account ready for competitive PvP. Includes Max Level 2550, fully awakened Kitsune Fruit, Godhuman fighting style, Soul Guitar, and Cursed Dual Katana. Clean email unverified, 100% safe transfer with 7 days full warranty.',
    short_description: 'Max Level 2550 • Awakened Kitsune • Godhuman • CDK • Unverified Email',
    price: 12.5,
    compare_at_price: 18.0,
    stock: 3,
    is_active: true,
    is_draft: false,
    is_featured: true,
    delivery_mode: 'auto_account',
    warranty_days: 7,
    requires_roblox_username: false,
    badge: 'BESTSELLER',
    specifications: {
      Level: '2550 (MAX)',
      Fruit: 'Kitsune (Awakened / Full Mastery)',
      'Fighting Style': 'Godhuman (600 Mastery)',
      Weapons: ['Cursed Dual Katana', 'Soul Guitar'],
      Beli: '50,000,000+',
      Fragments: '35,000+',
      Security: 'Unverified Email, No Pin',
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222201',
        url: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Blox Fruits Kitsune Hero',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222201',
        url: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Inventory Preview',
        is_primary: false,
        sort_order: 2,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222202',
    category_id: '11111111-1111-1111-1111-111111111103',
    title: 'Blox Fruits Permanent Buddha Gamepass Code',
    slug: 'blox-fruits-permanent-buddha-code',
    description:
      'Official instant redeem digital code for Permanent Buddha fruit in Blox Fruits. Grants unlimited transformations forever across any server without losing previous fruits.',
    short_description: 'Instant Digital Voucher • Permanent Buddha • Works on Any Device',
    price: 15.0,
    compare_at_price: 20.0,
    stock: 5,
    is_active: true,
    is_draft: false,
    is_featured: true,
    delivery_mode: 'digital_code',
    warranty_days: 30,
    requires_roblox_username: false,
    badge: 'MYTHICAL',
    specifications: {
      Item: 'Permanent Buddha Fruit',
      Platform: 'Roblox / Blox Fruits',
      Redemption: 'Instant In-Game Gift Code',
      Guarantee: '100% Official Working Voucher',
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222202',
        url: 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Permanent Buddha Fruit',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222203',
    category_id: '11111111-1111-1111-1111-111111111104',
    title: 'MM2 Harvester + Corrupt Ancient Weapon Set',
    slug: 'mm2-harvester-corrupt-ancient-set',
    description:
      'The pinnacle Murder Mystery 2 collection: 1x Corrupt (Ancient Knife) and 1x Harvester (Ancient Gun). Traded directly to your Roblox avatar via secure in-game trade server within 5 minutes.',
    short_description: 'Corrupt Knife + Harvester Gun • Delivered via Roblox Trade',
    price: 14.5,
    compare_at_price: 22.0,
    stock: 2,
    is_active: true,
    is_draft: false,
    is_featured: true,
    delivery_mode: 'manual_service',
    warranty_days: 14,
    requires_roblox_username: true,
    badge: 'RARE SET',
    specifications: {
      Game: 'Murder Mystery 2',
      Items: ['Corrupt Knife (Ancient)', 'Harvester Gun (Ancient)'],
      Delivery: 'Direct In-Game Trade Server',
      Requirement: 'Roblox Username Required',
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222203',
        url: 'https://images.unsplash.com/photo-1579373903781-fd5c0c30c4cd?w=800&auto=format&fit=crop&q=80',
        alt_text: 'MM2 Harvester and Corrupt',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222204',
    category_id: '11111111-1111-1111-1111-111111111105',
    title: 'Blade Ball Infinity Ability + Dual Cosmos Swords',
    slug: 'blade-ball-infinity-dual-cosmos',
    description:
      'Instant upgrade pack for Blade Ball! Unlocks Infinity Ability immediately, along with Dual Cosmos Swords and custom kill VFX. Dominates public & ranked tournaments.',
    short_description: 'Infinity Ability • Dual Cosmos Swords • Galaxy Finisher',
    price: 9.99,
    compare_at_price: 14.0,
    stock: 4,
    is_active: true,
    is_draft: false,
    is_featured: false,
    delivery_mode: 'digital_code',
    warranty_days: 14,
    requires_roblox_username: false,
    badge: 'POPULAR',
    specifications: {
      Game: 'Blade Ball',
      Items: 'Infinity Ability Voucher + Dual Cosmos Bundle',
      Platform: 'Roblox',
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222204',
        url: 'https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Blade Ball Ability',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222205',
    category_id: '11111111-1111-1111-1111-111111111106',
    title: 'Evade VIP Pass + Custom Radio Gamepass',
    slug: 'evade-vip-custom-radio',
    description:
      'VIP Gamepass code for Evade. Grants 2x Points multiplier, custom high-volume radio boombox, VIP chat tag, and access to the exclusive VIP lounge.',
    short_description: '2x Points • Custom Radio Boombox • VIP Room Access',
    price: 4.99,
    compare_at_price: 7.5,
    stock: 8,
    is_active: true,
    is_draft: false,
    is_featured: false,
    delivery_mode: 'digital_code',
    warranty_days: 30,
    requires_roblox_username: false,
    badge: 'HOT',
    specifications: {
      Game: 'Evade',
      Perks: ['2x XP and Points Multiplier', 'Custom Radio Gamepass', 'VIP Gold Tag'],
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222205',
        url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Evade VIP',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
  {
    id: '22222222-2222-2222-2222-222222222206',
    category_id: '11111111-1111-1111-1111-111111111107',
    title: 'Steal Egg 1,000x Golden Dragon Egg Multiplier',
    slug: 'steal-egg-golden-dragon-pack',
    description:
      'Legendary Golden Dragon Egg pack with instant 1000x hatchery boost. In-game delivery handled directly by our automated dispatch bot.',
    short_description: 'Golden Dragon Egg • 1000x Multiplier • Instant Delivery',
    price: 3.5,
    compare_at_price: 5.0,
    stock: 6,
    is_active: true,
    is_draft: false,
    is_featured: false,
    delivery_mode: 'manual_service',
    warranty_days: 7,
    requires_roblox_username: true,
    badge: 'EVENT',
    specifications: {
      Game: 'Steal Egg',
      Multiplier: '1000x Hatch Speed',
      Pet: 'Golden Dragon Mythical Tier',
    },
    views_count: 0,
    sales_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    media: [
      {
        id: uuidv4(),
        product_id: '22222222-2222-2222-2222-222222222206',
        url: 'https://images.unsplash.com/photo-1563089145-599997674d42?w=800&auto=format&fit=crop&q=80',
        alt_text: 'Steal Egg Golden Dragon',
        is_primary: true,
        sort_order: 1,
        created_at: new Date().toISOString(),
      },
    ],
  },
];

// Seed Inventory Items (pre-encrypted credentials)
const initialInventory: InventoryItem[] = [
  // Blox Fruits Account Items
  {
    id: '33333333-3333-3333-3333-333333333301',
    product_id: '22222222-2222-2222-2222-222222222201',
    item_type: 'account',
    account_username: 'BloxLegend_Kitsune99',
    encrypted_account_password: encrypt('KitsuneV3_Secret2025!'),
    encrypted_account_2fa: encrypt('JBSWY3DPEHPK3PXP'),
    digital_code: null,
    notes: 'Max Level 2550, Clean email unverified, 7-day warranty',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333302',
    product_id: '22222222-2222-2222-2222-222222222201',
    item_type: 'account',
    account_username: 'BloxMaster_CDK77',
    encrypted_account_password: encrypt('GodhumanPass_987!'),
    encrypted_account_2fa: encrypt('HXDMVJECJJWSSR3H'),
    digital_code: null,
    notes: 'Max Level 2550, Godhuman 600, Clean email',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333303',
    product_id: '22222222-2222-2222-2222-222222222201',
    item_type: 'account',
    account_username: 'UchiroWarrior_01',
    encrypted_account_password: encrypt('Gear5Energy_2025$'),
    encrypted_account_2fa: encrypt('GEZDGNBVGY3TQOJQ'),
    digital_code: null,
    notes: 'Max Level 2550, Soul Guitar unlocked',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Blox Fruits Permanent Buddha Digital Codes
  {
    id: '33333333-3333-3333-3333-333333333304',
    product_id: '22222222-2222-2222-2222-222222222202',
    item_type: 'code',
    account_username: null,
    encrypted_account_password: null,
    encrypted_account_2fa: null,
    digital_code: 'BUDDHA-PERM-9821-XKQW-2025',
    notes: 'Instant permanent fruit voucher code',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: '33333333-3333-3333-3333-333333333305',
    product_id: '22222222-2222-2222-2222-222222222202',
    item_type: 'code',
    account_username: null,
    encrypted_account_password: null,
    encrypted_account_2fa: null,
    digital_code: 'BUDDHA-PERM-7714-LMNA-2025',
    notes: 'Instant permanent fruit voucher code',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Blade Ball Digital Codes
  {
    id: '33333333-3333-3333-3333-333333333306',
    product_id: '22222222-2222-2222-2222-222222222204',
    item_type: 'code',
    account_username: null,
    encrypted_account_password: null,
    encrypted_account_2fa: null,
    digital_code: 'BB-INFINITY-8842-COSMOS-V3',
    notes: 'Infinity Ability + Dual Cosmos Code',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  // Evade Digital Codes
  {
    id: '33333333-3333-3333-3333-333333333307',
    product_id: '22222222-2222-2222-2222-222222222205',
    item_type: 'code',
    account_username: null,
    encrypted_account_password: null,
    encrypted_account_2fa: null,
    digital_code: 'EVADE-VIP-RADIO-4491-GOLD',
    notes: 'VIP Pass Voucher',
    status: 'available',
    reserved_until: null,
    order_id: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

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
    probability_percent: 50.0,
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
    probability_percent: 28.0,
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
    probability_percent: 14.0,
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
    probability_percent: 6.5,
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
    probability_percent: 1.5,
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
    probability_percent: 6.5,
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
    probability_percent: 1.5,
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
  private static gachaPools: GachaPool[] = [...initialGachaPools];
  private static gachaPrizes: GachaPrize[] = [...initialGachaPrizes];
  private static gachaSpins: GachaSpin[] = [];
  private static gachaClaims: GachaClaim[] = [];
  private static orders: Order[] = [];
  private static payments: Payment[] = [];
  private static alertedStockThresholds: Map<string, Set<number>> = new Map();
  private static users: Map<number, TelegramUser> = new Map();
  private static profiles: Map<number, Profile> = new Map();
  private static adminUsers: AdminUser[] = [
    {
      id: uuidv4(),
      telegram_id: 123456789,
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
  };

  // ================= INVENTORY CLEANUP & STOCK HELPER =================
  static cleanupExpiredReservations(): void {
    const now = Date.now();
    for (const item of this.inventory) {
      if (item.status === 'reserved' && item.reserved_until) {
        if (new Date(item.reserved_until).getTime() < now) {
          item.status = 'available';
          item.reserved_until = null;
          item.order_id = null;
          item.updated_at = new Date().toISOString();
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
  // Core Requirement: HOME shows ALL in-stock products
  static getInStockProducts(): Product[] {
    return this.products
      .filter((p) => p.is_active && !p.is_draft && this.getProductAvailableStock(p.id) > 0)
      .map((p) => {
        const stock = this.getProductAvailableStock(p.id);
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
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
        return {
          ...p,
          stock,
          stock_count: stock,
          is_available: stock > 0,
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
    return {
      ...p,
      stock,
      stock_count: stock,
      is_available: stock > 0,
      category: this.categories.find((c) => c.id === p.category_id),
    };
  }

  static getAllProductsAdmin(): Product[] {
    this.cleanupExpiredReservations();
    return this.products.map((p) => ({
      ...p,
      stock: this.getProductAvailableStock(p.id),
      category: this.categories.find((c) => c.id === p.category_id),
    }));
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
      warranty_days: product.warranty_days !== undefined ? product.warranty_days : 14,
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
      media: product.media || [],
      video_url: product.video_url || null,
      created_at: product.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (index >= 0) {
      this.products[index] = { ...this.products[index], ...baseProduct, updated_at: new Date().toISOString() };
      return this.products[index];
    } else {
      this.products.unshift(baseProduct);
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
      updated_at: new Date().toISOString(),
    };

    this.products[index] = updatedProduct;
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
    product.updated_at = new Date().toISOString();
    return { success: true };
  }

  static releaseReservation(orderId: string): void {
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
        product.stock = this.getProductAvailableStock(product.id);
        product.updated_at = new Date().toISOString();
      }
    }

    // For manual_service orders that didn't have inventory items
    const order = this.orders.find((o) => o.id === orderId);
    if (order && (order.delivery_mode === 'manual_service' || order.delivery_mode === 'trade_item')) {
      const item = order.items?.[0];
      if (item) {
        const prod = this.products.find((p) => p.id === item.product_id);
        if (prod) {
          const qty = order.quantity || item.quantity || 1;
          prod.stock = (prod.stock || 0) + qty;
          prod.stock_count = prod.stock;
          prod.is_available = prod.stock > 0;
          prod.updated_at = new Date().toISOString();
        }
      }
    }
  }

  static consumeInventoryForOrder(orderId: string, productId: string): InventoryItem | null {
    let item = this.inventory.find(
      (i) => i.order_id === orderId && i.product_id === productId && i.status !== 'sold' && i.status !== 'consumed'
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
      (i) => i.order_id === orderId && i.product_id === productId && i.status !== 'sold' && i.status !== 'consumed'
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

    if (subtotal < coupon.min_order_amount) {
      return {
        isValid: false,
        discountAmount: 0,
        error: `Order subtotal must be at least $${coupon.min_order_amount.toFixed(2)}`,
      };
    }

    let discount = 0;
    if (coupon.discount_type === 'percentage') {
      discount = (subtotal * coupon.discount_value) / 100;
      if (coupon.max_discount_amount) {
        discount = Math.min(discount, coupon.max_discount_amount);
      }
    } else {
      discount = coupon.discount_value;
    }

    discount = Math.min(discount, subtotal);

    return {
      isValid: true,
      coupon,
      discountAmount: Number(discount.toFixed(2)),
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
  }): { success: boolean; order?: Order; error?: string } {
    // Check idempotency
    if (data.idempotencyKey) {
      const existing = this.orders.find((o) => o.idempotency_key === data.idempotencyKey);
      if (existing) {
        return { success: true, order: existing };
      }
    }

    const product = this.products.find((p) => p.id === data.productId);
    if (!product || !product.is_active || product.is_draft) {
      return { success: false, error: 'PRODUCT_NOT_AVAILABLE' };
    }

    // MULTI-QUANTITY ENFORCEMENT:
    // Lock auto_account strictly to 1. Other modes support multi-quantity up to stock.
    let quantity = Math.max(1, Number(data.quantity) || 1);
    if (product.delivery_mode === 'auto_account' || product.product_type === 'account') {
      quantity = 1;
    }

    const availableStock = this.getProductAvailableStock(product.id);
    if (availableStock < quantity) {
      return { success: false, error: 'INSUFFICIENT_STOCK' };
    }

    if (product.requires_roblox_username && (!data.robloxUsername || data.robloxUsername.trim().length === 0)) {
      return { success: false, error: 'ROBLOX_USERNAME_REQUIRED' };
    }

    const orderId = uuidv4();
    const orderNumber = `UCH-${Math.floor(100000 + Math.random() * 900000)}`;

    // Calculate pricing & coupon
    const subtotal = Number((product.price * quantity).toFixed(2));
    let discount = 0;
    let couponId: string | null = null;

    if (data.couponCode) {
      const validation = this.validateCoupon(data.couponCode, subtotal, data.telegramId);
      if (!validation.isValid || !validation.coupon) {
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

    const total = Math.max(0.1, Number((subtotal - discount).toFixed(2)));

    // Reserve inventory
    const reserveResult = this.reserveInventoryAtomic(product.id, orderId, quantity);
    if (!reserveResult.success) {
      return { success: false, error: reserveResult.error };
    }

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
      warranty_days: this.storeSettings.default_warranty_days || 14,
      warranty_status: 'pending',
      warranty_starts_at: null,
      warranty_expires_at: null,
      warranty_notes: 'Warranty starts automatically upon verified payment.',
      idempotency_key: data.idempotencyKey || null,
      admin_notified: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      items: [
        {
          id: uuidv4(),
          order_id: orderId,
          product_id: product.id,
          product_title: product.title,
          price: product.price,
          quantity,
          delivery_data: null,
          created_at: new Date().toISOString(),
        },
      ],
    };

    this.orders.unshift(order);
    return { success: true, order };
  }

  private static readonly PERSIST_FILE = path.resolve(__dirname, '../../data/store-data.json');

  public static saveToDisk(): void {
    this.persistToDisk();
  }

  public static persistToDisk(): void {
    if (process.env.NODE_ENV === 'test') return;
    try {
      const dir = path.dirname(this.PERSIST_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      const data = {
        orders: this.orders,
        inventory: this.inventory.map((i) => ({
          id: i.id,
          product_id: i.product_id,
          status: i.status,
          is_sold: i.is_sold,
          order_id: i.order_id,
        })),
        users: Array.from(this.users.values()),
        profiles: Array.from(this.profiles.values()),
        dailyRewards: Array.from(this.dailyRewards.entries()).map(([k, v]) => ({
          telegramId: k,
          ...v,
        })),
        pointLedger: this.pointLedger,
      };
      fs.writeFileSync(this.PERSIST_FILE, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Non-fatal fallback for tests or read-only disks
    }
  }

  public static loadFromDisk(): void {
    if (process.env.NODE_ENV === 'test') return;
    try {
      if (!fs.existsSync(this.PERSIST_FILE)) return;
      const raw = fs.readFileSync(this.PERSIST_FILE, 'utf-8');
      if (!raw || !raw.trim()) return;
      const data = JSON.parse(raw);
      if (Array.isArray(data.orders)) {
        this.orders = data.orders;
      }
      if (Array.isArray(data.inventory)) {
        data.inventory.forEach((saved: any) => {
          const item = this.inventory.find((i) => i.id === saved.id);
          if (item) {
            item.status = saved.status;
            item.is_sold = saved.is_sold;
            item.order_id = saved.order_id;
          }
        });
      }
      if (Array.isArray(data.users)) {
        data.users.forEach((u: TelegramUser) => {
          if (u && typeof u.telegram_id === 'number') {
            this.users.set(u.telegram_id, u);
          }
        });
      }
      if (Array.isArray(data.profiles)) {
        data.profiles.forEach((p: Profile) => {
          if (p && typeof p.telegram_id === 'number') {
            this.profiles.set(p.telegram_id, p);
          }
        });
      }
      if (Array.isArray(data.dailyRewards)) {
        data.dailyRewards.forEach((r: any) => {
          if (r && typeof r.telegramId === 'number') {
            this.dailyRewards.set(r.telegramId, {
              lastClaimed: r.lastClaimed,
              streak: r.streak,
              totalPoints: r.totalPoints,
            });
          }
        });
      }
      if (Array.isArray(data.pointLedger)) {
        this.pointLedger = data.pointLedger;
      }
    } catch {
      // Non-fatal fallback for tests or unformatted files
    }
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
    const productId = order.items?.[0]?.product_id;
    if (!productId) return;
    const product = this.products.find((p) => p.id === productId);
    if (!product) return;

    const orderQty = Math.max(1, order.quantity || order.items?.[0]?.quantity || 1);

    if (product.delivery_mode === 'auto_account' || order.delivery_mode === 'auto_account') {
      const assignedItem = this.inventory.find(
        (i) => (i.order_id === order.id || !i.order_id) && i.product_id === productId && (i.status === 'sold' || i.is_sold || i.status === 'consumed')
      );
      if (assignedItem) {
        assignedItem.status = 'sold';
        assignedItem.is_sold = true;
        assignedItem.order_id = order.id;
        assignedItem.updated_at = new Date().toISOString();
      }

      const unsoldStock = this.inventory.filter(
        (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
      ).length;
      product.stock = unsoldStock;
      product.stock_count = unsoldStock;
      product.is_available = unsoldStock > 0;
      product.updated_at = new Date().toISOString();
      this.persistToDisk();
    } else if (product.delivery_mode === 'digital_code') {
      const unsoldStock = this.inventory.filter(
        (i) => i.product_id === productId && i.status === 'available' && !i.is_sold
      ).length;
      product.stock = unsoldStock;
      product.stock_count = unsoldStock;
      product.is_available = unsoldStock > 0;
      product.updated_at = new Date().toISOString();
      this.persistToDisk();
    } else {
      // manual_service or trade_item
      const remaining = Math.max(0, (product.stock || 0) - orderQty);
      product.stock = remaining;
      product.stock_count = remaining;
      product.is_available = remaining > 0;
      product.updated_at = new Date().toISOString();
      this.persistToDisk();
    }
  }

  static getOrderById(orderId: string): Order | null {
    return this.orders.find((o) => o.id === orderId) || null;
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
    return this.orders.filter((o) => o.telegram_id === telegramId);
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
    };
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
    profile.gacha_tickets -= 1;
    profile.gacha_spins_count = (profile.gacha_spins_count || 0) + 1;
    profile.last_gacha_roll_at = new Date(now).toISOString();
    const cooldownMs = (this.storeSettings.gacha_cooldown_seconds || 3600) * 1000;
    profile.next_gacha_roll_at = new Date(now + cooldownMs).toISOString();
    profile.updated_at = new Date().toISOString();

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

  static getTelegramUser(telegramId: number): TelegramUser | null {
    return this.users.get(telegramId) || null;
  }

  static setUserLanguagePreference(telegramId: number, lang: string): TelegramUser | null {
    const user = this.users.get(telegramId);
    if (!user) return null;
    user.language_preference = lang;
    user.updated_at = new Date().toISOString();
    return user;
  }

  static getUserLanguagePreference(telegramId: number): string | null {
    const user = this.users.get(telegramId);
    return user?.language_preference || null;
  }

  static getProfile(telegramId: number): Profile | null {
    return this.profiles.get(telegramId) || null;
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
    const ticket: SupportTicket = {
      id: uuidv4(),
      ticket_number: `TICK-${Math.floor(1000 + Math.random() * 9000)}`,
      customer_id: data.customerId,
      telegram_id: data.telegramId,
      order_id: data.orderId || null,
      category: data.category || 'general',
      subject: data.subject,
      message: data.message,
      status: 'open',
      admin_reply: null,
      resolved_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.supportTickets.unshift(ticket);
    return ticket;
  }

  static getSupportTickets(): SupportTicket[] {
    return this.supportTickets;
  }

  static replySupportTicket(ticketId: string, reply: string, status: 'resolved' | 'closed' = 'resolved'): SupportTicket | null {
    const t = this.supportTickets.find((tick) => tick.id === ticketId);
    if (!t) return null;
    t.admin_reply = reply;
    t.status = status;
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
    newBalance: number;
    streak: number;
    seconds_remaining?: number;
    remainingSeconds?: number;
    next_claim_at?: string | null;
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
      const remainingSeconds = Math.ceil((cooldownMs - (now - lastClaim)) / 1000);
      return {
        success: false,
        error: 'COOLDOWN_ACTIVE',
        remainingSeconds,
        seconds_remaining: remainingSeconds,
        points: user.points || 0,
        pointsAwarded: 0,
        newBalance: user.points || 0,
        streak,
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

    this.saveToDisk();
    return {
      success: true,
      points: user.points,
      pointsAwarded,
      newBalance: user.points,
      streak: newStreak,
      remainingSeconds: secondsRemaining,
      seconds_remaining: secondsRemaining,
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
    error?: string;
  } {
    if (!this.storeSettings.coupon_redemption_enabled) {
      return { success: false, error: 'COUPON_REDEMPTION_DISABLED' };
    }

    if (tierPoints !== 50 && tierPoints !== 100 && tierPoints !== 200) {
      return { success: false, error: 'INVALID_COUPON_TIER' };
    }

    // Determine tier values
    let cost = 100;
    let discount = 1.0;
    let minOrder = 3.0;

    if (tierPoints === 50) {
      cost = 50;
      discount = this.storeSettings.coupon_tier_50_value || 0.5;
      minOrder = this.storeSettings.coupon_tier_50_min_order || 1.5;
    } else if (tierPoints === 200) {
      cost = 200;
      discount = this.storeSettings.coupon_tier_200_value || 2.0;
      minOrder = this.storeSettings.coupon_tier_200_min_order || 5.0;
    } else {
      cost = 100;
      discount = this.storeSettings.coupon_tier_100_value || 1.0;
      minOrder = this.storeSettings.coupon_tier_100_min_order || 3.0;
    }

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

    return { success: true, coupon };
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
      if (!draft.probability_percent || draft.probability_percent === 0) {
        draft.probability_percent = currentInSlot.probability_percent;
      }
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

  // ================= 14-DAY WARRANTY OPERATIONS =================
  static replaceWarrantyOrder(
    orderId: string,
    replacementNotes: string,
    credentials?: any[]
  ): Order | null {
    const order = this.orders.find((o) => o.id === orderId);
    if (!order) return null;

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
    this.gachaPools = JSON.parse(JSON.stringify(initialGachaPools));
    this.gachaPrizes = JSON.parse(JSON.stringify(initialGachaPrizes));
    this.orders = [];
    this.payments = [];
    this.gachaSpins = [];
    this.gachaClaims = [];
    this.pointLedger = [];
    this.deliveryAccessLogs = [];
    this.dailyRewards.clear();

    return {
      success: true,
      message: 'Demo data reset completed safely (non-production environment only)',
    };
  }
}

// Automatically restore persisted data from disk on module initialization
DataStore.loadFromDisk();
