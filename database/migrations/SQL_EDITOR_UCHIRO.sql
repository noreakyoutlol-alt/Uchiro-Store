-- ==============================================================================
-- UCHIRO STORE — CANONICAL DATABASE SCHEMA (SQL_EDITOR_UCHIRO.sql)
-- ==============================================================================
-- TARGET: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query -> Run)
-- ENVIRONMENT: Standalone, Idempotent, Zero Wallet / Zero Balance Architecture
-- SAFETY GUARANTEES:
--   - No internal fiat wallet or deposit balances (all purchases settle via KHPay).
--   - 4 Product Delivery Modes: auto_account, manual_service, trade_item, digital_code.
--   - 6 Gacha Delivery Modes: auto_account, manual_service, trade_item, digital_code, points, discount_coupon.
--   - 1-to-1 Inventory tracking (available -> reserved -> consumed).
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. USERS & PROFILES (ZERO WALLET / DIRECT KHPAY SETTLEMENT ONLY)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    photo_url TEXT,
    language_code VARCHAR(10) DEFAULT 'en',
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    gacha_tickets INTEGER DEFAULT 0 CHECK (gacha_tickets >= 0),
    total_spent NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_spent >= 0),
    total_orders INTEGER DEFAULT 0 CHECK (total_orders >= 0),
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Backwards-compatibility alias for telegram_users
CREATE TABLE IF NOT EXISTS telegram_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    last_name TEXT,
    photo_url TEXT,
    language_code VARCHAR(10) DEFAULT 'en',
    is_bot BOOLEAN DEFAULT FALSE,
    is_blocked BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES telegram_users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE NOT NULL,
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    gacha_tickets INTEGER DEFAULT 0 CHECK (gacha_tickets >= 0),
    total_spent NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_spent >= 0),
    total_orders INTEGER DEFAULT 0 CHECK (total_orders >= 0),
    gacha_spins_count INTEGER DEFAULT 0 CHECK (gacha_spins_count >= 0),
    last_gacha_roll_at TIMESTAMPTZ,
    next_gacha_roll_at TIMESTAMPTZ,
    referral_code VARCHAR(32) UNIQUE,
    referred_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. STORE CATEGORIES & PRODUCTS (4 CANONICAL DELIVERY MODES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    icon TEXT,
    description TEXT,
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    product_type VARCHAR(32) DEFAULT 'account' CHECK (product_type IN ('account', 'gift', 'trade', 'digital_code')),
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_mode VARCHAR(30) NOT NULL CHECK (delivery_mode IN ('auto_account', 'manual_service', 'trade_item', 'digital_code')),
    warranty_days INTEGER DEFAULT 14 CHECK (warranty_days >= 0),
    warranty_notes TEXT DEFAULT 'Warranty valid for 14 days provided original email and authenticator are not removed.',
    require_email_protection BOOLEAN DEFAULT TRUE,
    require_authenticator_protection BOOLEAN DEFAULT TRUE,
    requires_roblox_username BOOLEAN DEFAULT FALSE,
    requires_roblox_verification BOOLEAN DEFAULT FALSE,
    badge VARCHAR(50),
    specifications JSONB DEFAULT '{}'::jsonb,
    video_url TEXT,
    views_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 4. INVENTORY ITEMS (1-TO-1 ACCOUNT & KEY TRACKING: AVAILABLE -> CONSUMED)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    item_type VARCHAR(20) DEFAULT 'account' CHECK (item_type IN ('account', 'code', 'token', 'other')),
    account_username TEXT,
    encrypted_account_password TEXT,
    encrypted_account_2fa TEXT,
    email TEXT,
    encrypted_email_password TEXT,
    encrypted_backup_codes TEXT,
    account_notes TEXT,
    digital_code TEXT,
    notes TEXT,
    payload JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'consumed')),
    batch_id UUID,
    order_id UUID,
    reserved_until TIMESTAMPTZ,
    authenticator_enabled BOOLEAN DEFAULT FALSE,
    authenticator_secret_ciphertext TEXT,
    recovery_email TEXT,
    recovery_password_ciphertext TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 5. COUPONS & DISCOUNTS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (min_order_amount >= 0),
    max_discount_amount NUMERIC(10, 2) CHECK (max_discount_amount IS NULL OR max_discount_amount > 0),
    usage_limit INTEGER CHECK (usage_limit IS NULL OR usage_limit > 0),
    used_count INTEGER DEFAULT 0 CHECK (used_count >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 6. ORDERS & DIRECT REAL-TIME FULFILLMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) UNIQUE NOT NULL,
    customer_id UUID NOT NULL,
    telegram_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending_payment' CHECK (
        status IN (
            'draft',
            'pending_payment',
            'payment_processing',
            'paid',
            'fulfillment',
            'delivered',
            'completed',
            'cancelled',
            'expired',
            'failed'
        )
    ),
    subtotal NUMERIC(10, 2) NOT NULL CHECK (subtotal >= 0),
    discount_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (discount_amount >= 0),
    total_amount NUMERIC(10, 2) NOT NULL CHECK (total_amount >= 0),
    coupon_id UUID REFERENCES coupons(id) ON DELETE SET NULL,
    roblox_username TEXT,
    roblox_verified BOOLEAN DEFAULT FALSE,
    delivery_mode VARCHAR(30) NOT NULL CHECK (delivery_mode IN ('auto_account', 'manual_service', 'trade_item', 'digital_code')),
    delivery_credentials JSONB,
    fulfillment_notes TEXT,
    warranty_days INTEGER DEFAULT 14 CHECK (warranty_days >= 0),
    warranty_status VARCHAR(20) DEFAULT 'pending' CHECK (warranty_status IN ('pending', 'active', 'warning', 'expired', 'invalidated')),
    warranty_starts_at TIMESTAMPTZ,
    warranty_expires_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_title TEXT NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price NUMERIC(10, 2) NOT NULL CHECK (unit_price >= 0),
    total_price NUMERIC(10, 2) NOT NULL CHECK (total_price >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 7. KHPAY REAL-TIME SETTLEMENT
-- ==============================================================================
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL DEFAULT 'khpay',
    transaction_id VARCHAR(128),
    md5_hash VARCHAR(64),
    qr_payload TEXT,
    qr_image_url TEXT,
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 8. GACHA POOLS & PRIZES (6 CANONICAL DELIVERY MODES)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS gacha_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    cost_per_spin NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    ticket_cost INTEGER NOT NULL DEFAULT 1 CHECK (ticket_cost >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    banner_url TEXT,
    total_spins INTEGER DEFAULT 0 CHECK (total_spins >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gacha_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES gacha_pools(id) ON DELETE CASCADE,
    reward_number INTEGER DEFAULT 1,
    slot_number INTEGER DEFAULT 1,
    slot_status VARCHAR(20) DEFAULT 'current' CHECK (slot_status IN ('current', 'draft')),
    title TEXT NOT NULL,
    description TEXT,
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL')),
    probability_percent NUMERIC(6, 3) NOT NULL CHECK (probability_percent > 0),
    delivery_mode VARCHAR(30) NOT NULL CHECK (
        delivery_mode IN (
            'auto_account',
            'manual_service',
            'trade_item',
            'digital_code',
            'points',
            'discount_coupon',
            'instant_code',
            'manual_review'
        )
    ),
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('code', 'points', 'item')),
    reward_data JSONB DEFAULT '{}'::jsonb,
    icon_url TEXT,
    stock INTEGER DEFAULT 9999 CHECK (stock >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gacha_spins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    pool_id UUID NOT NULL REFERENCES gacha_pools(id) ON DELETE RESTRICT,
    prize_id UUID NOT NULL REFERENCES gacha_prizes(id) ON DELETE RESTRICT,
    rarity VARCHAR(20) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tickets_consumed INTEGER DEFAULT 1 CHECK (tickets_consumed >= 0),
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 9. POINTS LEDGER (LOYALTY & REWARD ECONOMY)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS point_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL,
    amount INTEGER NOT NULL,
    type VARCHAR(32) NOT NULL CHECK (
        LOWER(type) IN (
            'order_purchase',
            'purchase_reward',
            'gacha_spin',
            'gacha_ticket',
            'coupon_redemption',
            'daily_reward',
            'streak_bonus',
            'admin_adjustment',
            'referral_bonus',
            'refund_reversal'
        )
    ),
    description TEXT NOT NULL,
    reference_id TEXT,
    balance_after INTEGER NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 10. INDEXES FOR HIGH-THROUGHPUT REAL-TIME ACCESS
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_products_active_category ON products(is_active, category_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_items(product_id, status);
CREATE INDEX IF NOT EXISTS idx_orders_customer_status ON orders(telegram_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_payments_order_status ON payments(order_id, status);
CREATE INDEX IF NOT EXISTS idx_gacha_prizes_pool ON gacha_prizes(pool_id, slot_status, is_active);
CREATE INDEX IF NOT EXISTS idx_point_ledger_tgid ON point_ledger(telegram_id, created_at DESC);
