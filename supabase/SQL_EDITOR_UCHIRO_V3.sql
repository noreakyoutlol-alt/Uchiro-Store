-- ==============================================================================
-- UCHIRO STORE V3 — COMPLETE STANDALONE SUPABASE DATABASE SETUP
-- ==============================================================================
-- TARGET: Supabase PostgreSQL (Dashboard -> SQL Editor -> New Query -> Run)
-- ENVIRONMENT: Standalone, Idempotent, Safe for Fresh and Existing Databases
-- SAFETY GUARANTEE:
--   - NO DROP DATABASE, NO DROP SCHEMA
--   - NO TRUNCATE of production tables
--   - NO DELETION of customer orders, inventory, coupons, or gacha data
--   - Uses CREATE TABLE IF NOT EXISTS, ALTER TABLE ADD COLUMN IF NOT EXISTS,
--     CREATE INDEX IF NOT EXISTS, and ON CONFLICT safe operations.
-- ==============================================================================

-- ==============================================================================
-- 1. EXTENSIONS
-- ==============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. CORE TABLES (CREATE TABLE IF NOT EXISTS)
-- ==============================================================================

-- 2.1 TELEGRAM CUSTOMERS & PROFILES
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
    telegram_id BIGINT UNIQUE NOT NULL REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
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

-- 2.2 STORE CATEGORIES
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

-- 2.3 PRODUCTS & MEDIA & VARIANTS
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
    media JSONB DEFAULT '[]'::jsonb,
    games JSONB DEFAULT '[]'::jsonb,
    video_url TEXT,
    views_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
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

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    sku VARCHAR(64) UNIQUE,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    attributes JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.4 INVENTORY & RESERVATIONS (ACCOUNT VAULT & TOTP AUTHENTICATOR CONFIG)
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
    authenticator_algorithm VARCHAR(16) DEFAULT 'SHA1',
    authenticator_digits INTEGER DEFAULT 6,
    authenticator_period INTEGER DEFAULT 30,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    inventory_item_id UUID REFERENCES inventory_items(id) ON DELETE SET NULL,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE RESTRICT,
    order_id UUID NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.5 COUPONS & REDEMPTIONS (WALLET, TIERS & OWNERSHIP)
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10, 2) DEFAULT 0.00 CHECK (min_order_amount >= 0),
    max_discount_amount NUMERIC(10, 2),
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    customer_telegram_id BIGINT,
    points_cost INTEGER DEFAULT 0 CHECK (points_cost >= 0),
    status VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'USED', 'EXPIRED', 'REVOKED')),
    used_in_order_id UUID,
    used_in_order_number VARCHAR(32),
    used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL CHECK (discount_amount >= 0),
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.6 ORDERS & ORDER ITEMS & WARRANTY
CREATE TABLE IF NOT EXISTS orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_number VARCHAR(32) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE RESTRICT,
    telegram_id BIGINT NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'draft' CHECK (
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
    delivery_mode VARCHAR(30) NOT NULL CHECK (delivery_mode IN ('auto_account', 'manual_service', 'trade_item', 'digital_code')),
    delivery_credentials JSONB,
    fulfillment_notes TEXT,
    warranty_days INTEGER DEFAULT 14 CHECK (warranty_days >= 0),
    warranty_status VARCHAR(20) DEFAULT 'pending' CHECK (warranty_status IN ('pending', 'active', 'warning', 'expired', 'invalidated')),
    warranty_starts_at TIMESTAMPTZ,
    warranty_expires_at TIMESTAMPTZ,
    warranty_notes TEXT,
    warranty_invalidation_reason TEXT,
    invalidated_at TIMESTAMPTZ,
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
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    delivery_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.7 PAYMENTS (KHPAY / KHQR / BAKONG) & ATTEMPTS & EVENTS
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE RESTRICT,
    provider VARCHAR(30) DEFAULT 'khpay',
    currency VARCHAR(10) DEFAULT 'USD',
    amount NUMERIC(10, 2) NOT NULL CHECK (amount >= 0),
    qr_payload TEXT,
    qr_image_url TEXT,
    md5_hash VARCHAR(64),
    bakong_deep_link TEXT,
    aba_deep_link TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'paid', 'expired', 'failed')),
    transaction_reference TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL,
    raw_response JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID REFERENCES payments(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    payload JSONB NOT NULL,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.8 POINTS LEDGER (TRANSACTION-SAFE DOUBLE-ENTRY ECONOMY)
CREATE TABLE IF NOT EXISTS point_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES telegram_users(id) ON DELETE SET NULL,
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

-- 2.9 DAILY REWARDS & STREAKS (TIMEZONE ASIA/PHNOM_PENH UTC+7)
CREATE TABLE IF NOT EXISTS daily_rewards (
    telegram_id BIGINT PRIMARY KEY REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
    last_claimed_at TIMESTAMPTZ NOT NULL,
    claim_date DATE NOT NULL DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Phnom_Penh')::date,
    streak INTEGER DEFAULT 1 CHECK (streak >= 1),
    longest_streak INTEGER DEFAULT 1 CHECK (longest_streak >= 1),
    total_claimed_points INTEGER DEFAULT 0 CHECK (total_claimed_points >= 0),
    last_streak_bonus_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.10 GACHA SYSTEM (POOLS, PRIZES, SPINS, CLAIMS)
CREATE TABLE IF NOT EXISTS gacha_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    spin_price NUMERIC(10, 2) NOT NULL DEFAULT 0.00 CHECK (spin_price >= 0),
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
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE RESTRICT,
    telegram_id BIGINT NOT NULL,
    pool_id UUID NOT NULL REFERENCES gacha_pools(id) ON DELETE RESTRICT,
    prize_id UUID NOT NULL REFERENCES gacha_prizes(id) ON DELETE RESTRICT,
    rarity VARCHAR(20) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL DEFAULT 0.00,
    tickets_consumed INTEGER DEFAULT 1 CHECK (tickets_consumed >= 0),
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gacha_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spin_id UUID NOT NULL REFERENCES gacha_spins(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    prize_id UUID NOT NULL REFERENCES gacha_prizes(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'pending_review', 'fulfilled', 'rejected')),
    delivery_data JSONB,
    admin_notes TEXT,
    resolved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.11 AUDIT & DELIVERY TELEMETRY LOGS
-- STRICT PRIVACY: NEVER stores passwords, raw TOTP secrets, or temporary codes.
CREATE TABLE IF NOT EXISTS delivery_access_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    telegram_id BIGINT,
    customer_id UUID REFERENCES telegram_users(id) ON DELETE SET NULL,
    action VARCHAR(64) NOT NULL CHECK (action IN (
        'delivery_viewed',
        'totp_requested',
        'totp_refresh',
        'authenticator_qr_requested'
    )),
    success BOOLEAN NOT NULL DEFAULT TRUE,
    ip_address TEXT,
    user_agent TEXT,
    failure_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_telegram_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_entity VARCHAR(64) NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.12 REFERRALS, NOTIFICATIONS, SUPPORT & SETTINGS
CREATE TABLE IF NOT EXISTS referrals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referrer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    referred_user_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE UNIQUE,
    referral_code VARCHAR(32) NOT NULL,
    converted_at TIMESTAMPTZ,
    reward_status VARCHAR(20) DEFAULT 'pending' CHECK (reward_status IN ('pending', 'rewarded')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS referral_rewards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id UUID NOT NULL REFERENCES referrals(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    reward_type VARCHAR(20) NOT NULL,
    reward_amount NUMERIC(10, 2) NOT NULL CHECK (reward_amount >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_telegram_id BIGINT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    metadata JSONB DEFAULT '{}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    sent_via_bot BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    first_name TEXT NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'manager' CHECK (role IN ('superadmin', 'manager', 'support')),
    is_active BOOLEAN DEFAULT TRUE,
    permissions JSONB DEFAULT '["all"]'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    subject TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    priority VARCHAR(10) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(64) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS system_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_type VARCHAR(64) NOT NULL,
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error', 'critical')),
    message TEXT NOT NULL,
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==============================================================================
-- 3. SCHEMA ENHANCEMENTS & IDEMPOTENT COLUMN ADDITIONS
-- Safe migration for existing databases: ensures all required fields exist
-- ==============================================================================

-- Profiles: Gacha Tickets & Roll Timestamps
ALTER TABLE profiles
    ADD COLUMN IF NOT EXISTS gacha_tickets INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_gacha_roll_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS next_gacha_roll_at TIMESTAMPTZ;

-- Products: Type, Warranty & Protection Flags
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS product_type VARCHAR(32) DEFAULT 'account',
    ADD COLUMN IF NOT EXISTS warranty_notes TEXT DEFAULT 'Warranty valid for 14 days provided original email and authenticator are not removed.',
    ADD COLUMN IF NOT EXISTS require_email_protection BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS require_authenticator_protection BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS video_url TEXT;

ALTER TABLE products ALTER COLUMN warranty_days SET DEFAULT 14;

-- Inventory: Full Credentials & RFC 6238 TOTP Configuration
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS encrypted_email_password TEXT,
    ADD COLUMN IF NOT EXISTS encrypted_backup_codes TEXT,
    ADD COLUMN IF NOT EXISTS account_notes TEXT,
    ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb,
    ADD COLUMN IF NOT EXISTS authenticator_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS authenticator_secret_ciphertext TEXT,
    ADD COLUMN IF NOT EXISTS authenticator_algorithm VARCHAR(16) DEFAULT 'SHA1',
    ADD COLUMN IF NOT EXISTS authenticator_digits INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS authenticator_period INTEGER DEFAULT 30;

-- Backfill authenticator ciphertext from encrypted_account_2fa if needed
UPDATE inventory_items
SET
    authenticator_enabled = TRUE,
    authenticator_secret_ciphertext = encrypted_account_2fa
WHERE
    authenticator_secret_ciphertext IS NULL
    AND encrypted_account_2fa IS NOT NULL
    AND LENGTH(encrypted_account_2fa) > 0;

-- Orders: Live Warranty Status & Lifecycle Timestamps
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 14,
    ADD COLUMN IF NOT EXISTS warranty_status VARCHAR(20) DEFAULT 'pending',
    ADD COLUMN IF NOT EXISTS warranty_starts_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS warranty_notes TEXT,
    ADD COLUMN IF NOT EXISTS warranty_invalidation_reason TEXT,
    ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ;

-- Coupons: Customer Wallet, Points Cost, & Usage Attribution
ALTER TABLE coupons
    ADD COLUMN IF NOT EXISTS customer_telegram_id BIGINT,
    ADD COLUMN IF NOT EXISTS points_cost INTEGER DEFAULT 0,
    ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'AVAILABLE',
    ADD COLUMN IF NOT EXISTS used_in_order_id UUID,
    ADD COLUMN IF NOT EXISTS used_in_order_number VARCHAR(32),
    ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;

-- Daily Rewards: Longest Streak, Milestone Bonus & Claim Date
ALTER TABLE daily_rewards
    ADD COLUMN IF NOT EXISTS claim_date DATE DEFAULT (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Phnom_Penh')::date,
    ADD COLUMN IF NOT EXISTS longest_streak INTEGER DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_streak_bonus_at TIMESTAMPTZ;

-- Gacha Spins: Ticket Tracking
ALTER TABLE gacha_spins
    ADD COLUMN IF NOT EXISTS tickets_consumed INTEGER DEFAULT 1;

-- Point Ledger: Customer ID & Metadata
ALTER TABLE point_ledger
    ADD COLUMN IF NOT EXISTS customer_id UUID,
    ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- ==============================================================================
-- 4. PERFORMANCE & INTEGRITY INDEXES
-- ==============================================================================

-- Telegram Users & Profiles
CREATE INDEX IF NOT EXISTS idx_telegram_users_tgid ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username);
CREATE INDEX IF NOT EXISTS idx_profiles_tgid ON profiles(telegram_id);
CREATE INDEX IF NOT EXISTS idx_profiles_refcode ON profiles(referral_code);

-- Catalog: Categories & Products
CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(sort_order);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_instock ON products(is_active, is_draft, stock);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured) WHERE is_featured = TRUE;
CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);

-- Inventory & Reservations
CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_items(product_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory_items(status);
CREATE INDEX IF NOT EXISTS idx_inventory_order ON inventory_items(order_id);
CREATE INDEX IF NOT EXISTS idx_inventory_authenticator_enabled ON inventory_items(authenticator_enabled) WHERE authenticator_enabled = TRUE;
CREATE INDEX IF NOT EXISTS idx_reservations_status_expires ON inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_order ON inventory_reservations(order_id);
CREATE INDEX IF NOT EXISTS idx_reservations_product ON inventory_reservations(product_id);

-- Orders & Order Items
CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_telegram ON orders(telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_warranty_status ON orders(warranty_status);
CREATE INDEX IF NOT EXISTS idx_orders_warranty_expires ON orders(warranty_expires_at) WHERE warranty_expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_product ON order_items(product_id);

-- Payments
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_customer ON payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_payments_md5 ON payments(md5_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status_expires ON payments(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_payment_attempts_payment ON payment_attempts(payment_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_payment ON payment_events(payment_id);

-- Coupons & Wallet
CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);
CREATE INDEX IF NOT EXISTS idx_coupons_customer ON coupons(customer_telegram_id, status);
CREATE INDEX IF NOT EXISTS idx_coupons_active ON coupons(is_active);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(coupon_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_order ON coupon_redemptions(order_id);

-- Points Ledger & Daily Rewards
CREATE INDEX IF NOT EXISTS idx_point_ledger_tgid ON point_ledger(telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_point_ledger_type ON point_ledger(type);
-- Unique idempotency index: prevents duplicate reward entries per reference (e.g. order purchase point rewards)
CREATE UNIQUE INDEX IF NOT EXISTS idx_point_ledger_idempotent_ref ON point_ledger(telegram_id, type, reference_id) WHERE reference_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_daily_rewards_claim_date ON daily_rewards(claim_date);

-- Gacha System
CREATE INDEX IF NOT EXISTS idx_gacha_pools_slug ON gacha_pools(slug);
CREATE INDEX IF NOT EXISTS idx_gacha_prizes_pool ON gacha_prizes(pool_id, is_active);
CREATE INDEX IF NOT EXISTS idx_gacha_spins_customer ON gacha_spins(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gacha_spins_telegram ON gacha_spins(telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gacha_spins_idempotency ON gacha_spins(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_gacha_claims_customer ON gacha_claims(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_gacha_claims_status ON gacha_claims(status);

-- Audit & Telemetry
CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_order ON delivery_access_logs(order_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_telegram ON delivery_access_logs(telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_created ON delivery_access_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin ON admin_audit_logs(admin_telegram_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action, created_at DESC);

-- Referrals & Notifications & Support
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_code ON referrals(referral_code);
CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_telegram_id, is_read);
CREATE INDEX IF NOT EXISTS idx_support_tickets_customer ON support_tickets(customer_id, status);
CREATE INDEX IF NOT EXISTS idx_support_tickets_telegram ON support_tickets(telegram_id, status);

-- ==============================================================================
-- 5. DATABASE FUNCTIONS & ATOMIC STORED PROCEDURES
-- ==============================================================================

-- 5.1 UPDATED_AT TRIGGER FUNCTION
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5.2 ATOMIC INVENTORY RESERVATION (Prevents overselling & race conditions)
CREATE OR REPLACE FUNCTION reserve_inventory_atomic(
    p_product_id UUID,
    p_customer_id UUID,
    p_order_id UUID,
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_inventory_item RECORD;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Lock product row to prevent race conditions
    SELECT * INTO v_product
    FROM products
    WHERE id = p_product_id AND is_active = TRUE AND is_draft = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND_OR_INACTIVE';
    END IF;

    IF v_product.stock <= 0 THEN
        RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK';
    END IF;

    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    -- 2. Handle specific item reservation for automatic delivery modes
    IF v_product.delivery_mode IN ('auto_account', 'digital_code') THEN
        SELECT * INTO v_inventory_item
        FROM inventory_items
        WHERE product_id = p_product_id AND status = 'available'
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_SPECIFIC_INVENTORY_ITEM_AVAILABLE';
        END IF;

        -- Update inventory item to reserved
        UPDATE inventory_items
        SET status = 'reserved',
            reserved_until = v_expires_at,
            order_id = p_order_id,
            updated_at = NOW()
        WHERE id = v_inventory_item.id;

        -- Create formal reservation record
        INSERT INTO inventory_reservations (
            product_id,
            inventory_item_id,
            customer_id,
            order_id,
            expires_at,
            status
        ) VALUES (
            p_product_id,
            v_inventory_item.id,
            p_customer_id,
            p_order_id,
            v_expires_at,
            'active'
        ) RETURNING id INTO v_reservation_id;
    ELSE
        -- Manual service mode reservation
        INSERT INTO inventory_reservations (
            product_id,
            customer_id,
            order_id,
            expires_at,
            status
        ) VALUES (
            p_product_id,
            p_customer_id,
            p_order_id,
            v_expires_at,
            'active'
        ) RETURNING id INTO v_reservation_id;
    END IF;

    -- 3. Decrement available product stock
    UPDATE products
    SET stock = stock - 1,
        updated_at = NOW()
    WHERE id = p_product_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'product_id', p_product_id,
        'order_id', p_order_id,
        'reservation_id', v_reservation_id,
        'inventory_item_id', v_inventory_item.id,
        'expires_at', v_expires_at
    );
END;
$$;

-- 5.3 RELEASE EXPIRED RESERVATIONS
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT ir.id AS res_id, ir.inventory_item_id, ir.product_id, ir.order_id
        FROM inventory_reservations ir
        WHERE ir.status = 'active' AND ir.expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- 1. Mark reservation as released
        UPDATE inventory_reservations
        SET status = 'released'
        WHERE id = r.res_id;

        -- 2. Release inventory item back to available
        IF r.inventory_item_id IS NOT NULL THEN
            UPDATE inventory_items
            SET status = 'available',
                reserved_until = NULL,
                order_id = NULL,
                updated_at = NOW()
            WHERE id = r.inventory_item_id;
        END IF;

        -- 3. Restore product stock count
        UPDATE products
        SET stock = stock + 1,
            updated_at = NOW()
        WHERE id = r.product_id;

        -- 4. Mark associated order as expired if still pending
        UPDATE orders
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = r.order_id AND status IN ('draft', 'pending_payment');

        -- 5. Mark payment as expired
        UPDATE payments
        SET status = 'expired',
            updated_at = NOW()
        WHERE order_id = r.order_id AND status = 'pending';

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- 5.4 CONSUME RESERVATION ATOMICALLY WITH 14-DAY WARRANTY & POINT REWARD
CREATE OR REPLACE FUNCTION consume_reservation_atomic(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_res RECORD;
    v_item RECORD;
    v_credentials JSONB := '[]'::jsonb;
    v_points_earned INTEGER;
    v_warranty_days INTEGER := 14;
    v_warranty_starts TIMESTAMPTZ := NOW();
    v_warranty_expires TIMESTAMPTZ;
    v_current_points INTEGER;
BEGIN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND';
    END IF;

    -- Calculate warranty duration (default 14 days)
    IF v_order.warranty_days IS NOT NULL AND v_order.warranty_days > 0 THEN
        v_warranty_days := v_order.warranty_days;
    END IF;
    v_warranty_expires := v_warranty_starts + (v_warranty_days || ' days')::INTERVAL;

    -- Process active reservations
    FOR v_res IN
        SELECT * FROM inventory_reservations
        WHERE order_id = p_order_id AND status = 'active'
        FOR UPDATE
    LOOP
        -- Mark reservation consumed
        UPDATE inventory_reservations
        SET status = 'consumed'
        WHERE id = v_res.id;

        -- Mark inventory item consumed
        IF v_res.inventory_item_id IS NOT NULL THEN
            UPDATE inventory_items
            SET status = 'consumed',
                updated_at = NOW()
            WHERE id = v_res.inventory_item_id
            RETURNING * INTO v_item;

            IF FOUND THEN
                v_credentials := v_credentials || jsonb_build_object(
                    'item_type', v_item.item_type,
                    'account_username', v_item.account_username,
                    'encrypted_password', v_item.encrypted_account_password,
                    'encrypted_2fa', v_item.encrypted_account_2fa,
                    'email', v_item.email,
                    'digital_code', v_item.digital_code,
                    'authenticator_enabled', v_item.authenticator_enabled,
                    'warranty_days', v_warranty_days
                );
            END IF;
        END IF;
    END LOOP;

    -- Update order status, warranty, and delivery credentials
    UPDATE orders
    SET status = 'delivered',
        delivery_credentials = v_credentials,
        delivered_at = NOW(),
        warranty_status = 'active',
        warranty_days = v_warranty_days,
        warranty_starts_at = v_warranty_starts,
        warranty_expires_at = v_warranty_expires,
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Increment product sales count
    UPDATE products
    SET sales_count = sales_count + 1
    WHERE id IN (SELECT product_id FROM order_items WHERE order_id = p_order_id);

    -- Calculate Points Reward: 10 Uchiro Points per $1
    v_points_earned := FLOOR(v_order.total_amount * 10)::INTEGER;

    -- Update customer stats & award points
    UPDATE profiles
    SET total_spent = total_spent + v_order.total_amount,
        total_orders = total_orders + 1,
        points = points + v_points_earned,
        updated_at = NOW()
    WHERE telegram_id = v_order.telegram_id
    RETURNING points INTO v_current_points;

    -- Record in Point Ledger (Idempotent: unique on telegram_id, type, reference_id)
    IF v_points_earned > 0 THEN
        INSERT INTO point_ledger (
            telegram_id,
            customer_id,
            amount,
            type,
            description,
            reference_id,
            balance_after,
            metadata
        ) VALUES (
            v_order.telegram_id,
            v_order.customer_id,
            v_points_earned,
            'order_purchase',
            '+' || v_points_earned || ' points for Order #' || v_order.order_number,
            v_order.order_number,
            COALESCE(v_current_points, v_points_earned),
            jsonb_build_object('order_id', p_order_id, 'order_number', v_order.order_number, 'amount_usd', v_order.total_amount)
        )
        ON CONFLICT (telegram_id, type, reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'status', 'delivered',
        'points_earned', v_points_earned,
        'warranty_days', v_warranty_days,
        'warranty_expires_at', v_warranty_expires,
        'credentials_count', jsonb_array_length(v_credentials)
    );
END;
$$;

-- 5.5 SERVER-AUTHORITATIVE GACHA ROLL (1 Ticket, 1-Hour Cooldown, Authoritative RNG)
CREATE OR REPLACE FUNCTION spin_gacha_atomic(
    p_pool_id UUID,
    p_customer_id UUID,
    p_telegram_id BIGINT,
    p_idempotency_key VARCHAR(128) DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_spin RECORD;
    v_pool RECORD;
    v_profile RECORD;
    v_total_weight NUMERIC := 0;
    v_random_point NUMERIC;
    v_cumulative NUMERIC := 0;
    v_selected_prize RECORD;
    v_prize_cursor RECORD;
    v_spin_id UUID;
    v_claim_id UUID;
    v_claim_status VARCHAR(20);
    v_next_roll TIMESTAMPTZ;
BEGIN
    -- 1. Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT gs.*, gp.title AS prize_title, gp.rarity AS prize_rarity, gp.delivery_mode, gp.reward_data, gp.icon_url
        INTO v_existing_spin
        FROM gacha_spins gs
        JOIN gacha_prizes gp ON gp.id = gs.prize_id
        WHERE gs.idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'already_spun', TRUE,
                'spin_id', v_existing_spin.id,
                'prize_id', v_existing_spin.prize_id,
                'prize_title', v_existing_spin.prize_title,
                'rarity', v_existing_spin.prize_rarity,
                'delivery_mode', v_existing_spin.delivery_mode,
                'reward_data', v_existing_spin.reward_data,
                'icon_url', v_existing_spin.icon_url
            );
        END IF;
    END IF;

    -- 2. Lock profile & verify ticket balance and cooldown
    SELECT * INTO v_profile
    FROM profiles
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    IF COALESCE(v_profile.gacha_tickets, 0) < 1 THEN
        RAISE EXCEPTION 'INSUFFICIENT_GACHA_TICKETS';
    END IF;

    IF v_profile.next_gacha_roll_at IS NOT NULL AND NOW() < v_profile.next_gacha_roll_at THEN
        RAISE EXCEPTION 'GACHA_COOLDOWN_ACTIVE';
    END IF;

    -- 3. Lock pool
    SELECT * INTO v_pool
    FROM gacha_pools
    WHERE id = p_pool_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'GACHA_POOL_NOT_FOUND_OR_INACTIVE';
    END IF;

    -- 4. Calculate total probability weight of active prizes in stock
    SELECT COALESCE(SUM(probability_percent), 0) INTO v_total_weight
    FROM gacha_prizes
    WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0;

    IF v_total_weight <= 0 THEN
        RAISE EXCEPTION 'NO_AVAILABLE_GACHA_PRIZES_IN_STOCK';
    END IF;

    -- 5. Secure Random Roll
    v_random_point := (random() * v_total_weight);

    FOR v_prize_cursor IN
        SELECT *
        FROM gacha_prizes
        WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0
        ORDER BY probability_percent ASC
        FOR UPDATE
    LOOP
        v_cumulative := v_cumulative + v_prize_cursor.probability_percent;
        IF v_random_point <= v_cumulative THEN
            v_selected_prize := v_prize_cursor;
            EXIT;
        END IF;
    END LOOP;

    -- Fallback safety to highest probability prize
    IF v_selected_prize.id IS NULL THEN
        SELECT * INTO v_selected_prize
        FROM gacha_prizes
        WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0
        ORDER BY probability_percent DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- 6. Decrement prize stock & increment pool spins
    UPDATE gacha_prizes
    SET stock = stock - 1,
        updated_at = NOW()
    WHERE id = v_selected_prize.id;

    UPDATE gacha_pools
    SET total_spins = total_spins + 1,
        updated_at = NOW()
    WHERE id = p_pool_id;

    -- 7. Deduct 1 Ticket and set 1-Hour Cooldown on Profile
    v_next_roll := NOW() + INTERVAL '1 hour';

    UPDATE profiles
    SET gacha_tickets = gacha_tickets - 1,
        gacha_spins_count = gacha_spins_count + 1,
        last_gacha_roll_at = NOW(),
        next_gacha_roll_at = v_next_roll,
        updated_at = NOW()
    WHERE telegram_id = p_telegram_id;

    -- 8. Record spin
    INSERT INTO gacha_spins (
        customer_id,
        telegram_id,
        pool_id,
        prize_id,
        rarity,
        cost,
        tickets_consumed,
        idempotency_key
    ) VALUES (
        p_customer_id,
        p_telegram_id,
        p_pool_id,
        v_selected_prize.id,
        v_selected_prize.rarity,
        0.00,
        1,
        p_idempotency_key
    ) RETURNING id INTO v_spin_id;

    -- 9. Create claim record
    IF v_selected_prize.delivery_mode = 'instant_code' THEN
        v_claim_status := 'claimed';
    ELSE
        v_claim_status := 'pending_review';
    END IF;

    INSERT INTO gacha_claims (
        spin_id,
        customer_id,
        prize_id,
        status,
        delivery_data
    ) VALUES (
        v_spin_id,
        p_customer_id,
        v_selected_prize.id,
        v_claim_status,
        v_selected_prize.reward_data
    ) RETURNING id INTO v_claim_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'spin_id', v_spin_id,
        'claim_id', v_claim_id,
        'prize_id', v_selected_prize.id,
        'prize_title', v_selected_prize.title,
        'rarity', v_selected_prize.rarity,
        'delivery_mode', v_selected_prize.delivery_mode,
        'claim_status', v_claim_status,
        'reward_data', v_selected_prize.reward_data,
        'icon_url', v_selected_prize.icon_url,
        'tickets_remaining', (v_profile.gacha_tickets - 1),
        'next_roll_at', v_next_roll
    );
END;
$$;

-- 5.6 ATOMIC DAILY REWARD & STREAK CLAIM (Asia/Phnom_Penh Timezone UTC+7)
CREATE OR REPLACE FUNCTION claim_daily_reward_atomic(
    p_telegram_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_today_date DATE;
    v_rec RECORD;
    v_new_streak INTEGER := 1;
    v_base_reward INTEGER := 5;
    v_streak_bonus INTEGER := 10;
    v_total_points INTEGER := 5;
    v_is_milestone BOOLEAN := FALSE;
    v_new_balance INTEGER;
BEGIN
    -- Current date in Phnom Penh timezone (UTC+7)
    v_today_date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Phnom_Penh')::date;

    SELECT * INTO v_rec
    FROM daily_rewards
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF FOUND THEN
        -- Prevent duplicate daily claim
        IF v_rec.claim_date = v_today_date THEN
            RETURN jsonb_build_object(
                'success', FALSE,
                'error', 'ALREADY_CLAIMED_TODAY',
                'streak', v_rec.streak
            );
        END IF;

        -- Check consecutive day
        IF v_rec.claim_date = (v_today_date - 1) THEN
            v_new_streak := v_rec.streak + 1;
        ELSE
            -- Missed day: streak resets to 1 (previously earned points remain untouched)
            v_new_streak := 1;
        END IF;
    END IF;

    -- Check 7-Day Milestone Streak Bonus (Days 7, 14, 21, 28, 35...)
    IF (v_new_streak % 7) = 0 THEN
        v_total_points := v_base_reward + v_streak_bonus;
        v_is_milestone := TRUE;
    ELSE
        v_total_points := v_base_reward;
    END IF;

    -- Upsert daily_rewards record
    INSERT INTO daily_rewards (
        telegram_id,
        last_claimed_at,
        claim_date,
        streak,
        longest_streak,
        total_claimed_points,
        last_streak_bonus_at,
        updated_at
    ) VALUES (
        p_telegram_id,
        NOW(),
        v_today_date,
        v_new_streak,
        v_new_streak,
        v_total_points,
        CASE WHEN v_is_milestone THEN NOW() ELSE NULL END,
        NOW()
    )
    ON CONFLICT (telegram_id) DO UPDATE SET
        last_claimed_at = NOW(),
        claim_date = v_today_date,
        streak = v_new_streak,
        longest_streak = GREATEST(daily_rewards.longest_streak, v_new_streak),
        total_claimed_points = daily_rewards.total_claimed_points + v_total_points,
        last_streak_bonus_at = CASE WHEN v_is_milestone THEN NOW() ELSE daily_rewards.last_streak_bonus_at END,
        updated_at = NOW();

    -- Credit Points to Profile
    UPDATE profiles
    SET points = points + v_total_points,
        updated_at = NOW()
    WHERE telegram_id = p_telegram_id
    RETURNING points INTO v_new_balance;

    -- Record Base Daily Reward in Ledger
    INSERT INTO point_ledger (
        telegram_id,
        amount,
        type,
        description,
        reference_id,
        balance_after,
        metadata
    ) VALUES (
        p_telegram_id,
        v_base_reward,
        'daily_reward',
        '+' || v_base_reward || ' Daily Check-in (Day ' || v_new_streak || ')',
        'daily:' || p_telegram_id || ':' || v_today_date::text,
        COALESCE(v_new_balance, v_base_reward),
        jsonb_build_object('streak', v_new_streak, 'date', v_today_date)
    )
    ON CONFLICT (telegram_id, type, reference_id) WHERE reference_id IS NOT NULL DO NOTHING;

    -- Record Streak Milestone Bonus in Ledger if applicable
    IF v_is_milestone THEN
        INSERT INTO point_ledger (
            telegram_id,
            amount,
            type,
            description,
            reference_id,
            balance_after,
            metadata
        ) VALUES (
            p_telegram_id,
            v_streak_bonus,
            'streak_bonus',
            '+' || v_streak_bonus || ' Streak Milestone Bonus (Day ' || v_new_streak || ')',
            'streak:' || p_telegram_id || ':' || v_today_date::text,
            COALESCE(v_new_balance, v_total_points),
            jsonb_build_object('milestone_day', v_new_streak, 'date', v_today_date)
        )
        ON CONFLICT (telegram_id, type, reference_id) WHERE reference_id IS NOT NULL DO NOTHING;
    END IF;

    RETURN jsonb_build_object(
        'success', TRUE,
        'points_awarded', v_total_points,
        'new_balance', v_new_balance,
        'streak', v_new_streak,
        'is_milestone', v_is_milestone
    );
END;
$$;

-- 5.7 ATOMIC COUPON REDEMPTION (50, 100, 200 Points Tiers)
CREATE OR REPLACE FUNCTION redeem_coupon_atomic(
    p_telegram_id BIGINT,
    p_tier_points INTEGER DEFAULT 100
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_cost INTEGER := 100;
    v_discount NUMERIC(10, 2) := 1.00;
    v_min_order NUMERIC(10, 2) := 3.00;
    v_code VARCHAR(32);
    v_coupon_id UUID;
    v_new_points INTEGER;
BEGIN
    -- Validate Tier Configurations
    IF p_tier_points = 50 THEN
        v_cost := 50;
        v_discount := 0.50;
        v_min_order := 1.50;
    ELSEIF p_tier_points = 200 THEN
        v_cost := 200;
        v_discount := 2.00;
        v_min_order := 5.00;
    ELSE
        v_cost := 100;
        v_discount := 1.00;
        v_min_order := 3.00;
    END IF;

    -- Lock Profile & Validate Points
    SELECT * INTO v_profile
    FROM profiles
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    IF v_profile.points < v_cost THEN
        RAISE EXCEPTION 'INSUFFICIENT_POINTS';
    END IF;

    -- Deduct points
    UPDATE profiles
    SET points = points - v_cost,
        updated_at = NOW()
    WHERE telegram_id = p_telegram_id
    RETURNING points INTO v_new_points;

    -- Generate Unique Secure Coupon Code
    v_code := 'PTS-' || v_cost || '-' || UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4)) || '-' || TO_HEX(p_telegram_id);

    -- Create Coupon in Customer Wallet
    INSERT INTO coupons (
        code,
        discount_type,
        discount_value,
        min_order_amount,
        usage_limit,
        per_user_limit,
        is_active,
        customer_telegram_id,
        points_cost,
        status
    ) VALUES (
        v_code,
        'fixed',
        v_discount,
        v_min_order,
        1,
        1,
        TRUE,
        p_telegram_id,
        v_cost,
        'AVAILABLE'
    ) RETURNING id INTO v_coupon_id;

    -- Record in Point Ledger
    INSERT INTO point_ledger (
        telegram_id,
        amount,
        type,
        description,
        reference_id,
        balance_after,
        metadata
    ) VALUES (
        p_telegram_id,
        -v_cost,
        'coupon_redemption',
        '-' || v_cost || ' Points Coupon Redemption ($' || v_discount || ')',
        v_code,
        v_new_points,
        jsonb_build_object('coupon_id', v_coupon_id, 'coupon_code', v_code, 'discount', v_discount, 'min_order', v_min_order)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'coupon_id', v_coupon_id,
        'code', v_code,
        'discount_value', v_discount,
        'min_order_amount', v_min_order,
        'points_spent', v_cost,
        'new_balance', v_new_points
    );
END;
$$;

-- 5.8 ATOMIC GACHA TICKET EXCHANGE (100 Points = 1 Gacha Ticket)
CREATE OR REPLACE FUNCTION exchange_points_for_gacha_tickets_atomic(
    p_telegram_id BIGINT,
    p_ticket_count INTEGER DEFAULT 1
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_profile RECORD;
    v_total_cost INTEGER;
    v_new_points INTEGER;
    v_new_tickets INTEGER;
BEGIN
    IF p_ticket_count <= 0 THEN
        RAISE EXCEPTION 'INVALID_TICKET_COUNT';
    END IF;

    v_total_cost := p_ticket_count * 100;

    SELECT * INTO v_profile
    FROM profiles
    WHERE telegram_id = p_telegram_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PROFILE_NOT_FOUND';
    END IF;

    IF v_profile.points < v_total_cost THEN
        RAISE EXCEPTION 'INSUFFICIENT_POINTS';
    END IF;

    -- Deduct points and credit tickets
    UPDATE profiles
    SET points = points - v_total_cost,
        gacha_tickets = COALESCE(gacha_tickets, 0) + p_ticket_count,
        updated_at = NOW()
    WHERE telegram_id = p_telegram_id
    RETURNING points, gacha_tickets INTO v_new_points, v_new_tickets;

    -- Record in Point Ledger
    INSERT INTO point_ledger (
        telegram_id,
        amount,
        type,
        description,
        reference_id,
        balance_after,
        metadata
    ) VALUES (
        p_telegram_id,
        -v_total_cost,
        'gacha_ticket',
        '-' || v_total_cost || ' Points exchanged for ' || p_ticket_count || ' Gacha Ticket(s)',
        NULL,
        v_new_points,
        jsonb_build_object('tickets_purchased', p_ticket_count, 'new_ticket_balance', v_new_tickets)
    );

    RETURN jsonb_build_object(
        'success', TRUE,
        'tickets_purchased', p_ticket_count,
        'total_tickets', v_new_tickets,
        'points_spent', v_total_cost,
        'new_balance', v_new_points
    );
END;
$$;

-- ==============================================================================
-- 6. TRIGGERS (AUTOMATIC UPDATED_AT MAINTENANCE)
-- ==============================================================================

DROP TRIGGER IF EXISTS trg_telegram_users_updated_at ON telegram_users;
CREATE TRIGGER trg_telegram_users_updated_at
    BEFORE UPDATE ON telegram_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_profiles_updated_at ON profiles;
CREATE TRIGGER trg_profiles_updated_at
    BEFORE UPDATE ON profiles
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_categories_updated_at ON categories;
CREATE TRIGGER trg_categories_updated_at
    BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_products_updated_at ON products;
CREATE TRIGGER trg_products_updated_at
    BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_inventory_items_updated_at ON inventory_items;
CREATE TRIGGER trg_inventory_items_updated_at
    BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_coupons_updated_at ON coupons;
CREATE TRIGGER trg_coupons_updated_at
    BEFORE UPDATE ON coupons
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_orders_updated_at ON orders;
CREATE TRIGGER trg_orders_updated_at
    BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_payments_updated_at ON payments;
CREATE TRIGGER trg_payments_updated_at
    BEFORE UPDATE ON payments
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_daily_rewards_updated_at ON daily_rewards;
CREATE TRIGGER trg_daily_rewards_updated_at
    BEFORE UPDATE ON daily_rewards
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_gacha_pools_updated_at ON gacha_pools;
CREATE TRIGGER trg_gacha_pools_updated_at
    BEFORE UPDATE ON gacha_pools
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_gacha_prizes_updated_at ON gacha_prizes;
CREATE TRIGGER trg_gacha_prizes_updated_at
    BEFORE UPDATE ON gacha_prizes
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_admin_users_updated_at ON admin_users;
CREATE TRIGGER trg_admin_users_updated_at
    BEFORE UPDATE ON admin_users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_support_tickets_updated_at ON support_tickets;
CREATE TRIGGER trg_support_tickets_updated_at
    BEFORE UPDATE ON support_tickets
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS trg_app_settings_updated_at ON app_settings;
CREATE TRIGGER trg_app_settings_updated_at
    BEFORE UPDATE ON app_settings
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ==============================================================================
-- 7. ROW LEVEL SECURITY (RLS) & POLICIES
-- ==============================================================================

-- Enable RLS across all tables
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE point_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE delivery_access_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_events ENABLE ROW LEVEL SECURITY;

-- 7.1 SERVICE ROLE FULL ACCESS (Backend API operates with Service Role Key)
DO $$
BEGIN
    -- Telegram Users & Profiles
    DROP POLICY IF EXISTS "Service role full access telegram_users" ON telegram_users;
    CREATE POLICY "Service role full access telegram_users" ON telegram_users FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access profiles" ON profiles;
    CREATE POLICY "Service role full access profiles" ON profiles FOR ALL USING (auth.role() = 'service_role');

    -- Catalog
    DROP POLICY IF EXISTS "Service role full access categories" ON categories;
    CREATE POLICY "Service role full access categories" ON categories FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access products" ON products;
    CREATE POLICY "Service role full access products" ON products FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access product_media" ON product_media;
    CREATE POLICY "Service role full access product_media" ON product_media FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access product_variants" ON product_variants;
    CREATE POLICY "Service role full access product_variants" ON product_variants FOR ALL USING (auth.role() = 'service_role');

    -- Inventory & Reservations
    DROP POLICY IF EXISTS "Service role full access inventory_items" ON inventory_items;
    CREATE POLICY "Service role full access inventory_items" ON inventory_items FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access inventory_reservations" ON inventory_reservations;
    CREATE POLICY "Service role full access inventory_reservations" ON inventory_reservations FOR ALL USING (auth.role() = 'service_role');

    -- Orders & Payments
    DROP POLICY IF EXISTS "Service role full access orders" ON orders;
    CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access order_items" ON order_items;
    CREATE POLICY "Service role full access order_items" ON order_items FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access payments" ON payments;
    CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access payment_attempts" ON payment_attempts;
    CREATE POLICY "Service role full access payment_attempts" ON payment_attempts FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access payment_events" ON payment_events;
    CREATE POLICY "Service role full access payment_events" ON payment_events FOR ALL USING (auth.role() = 'service_role');

    -- Coupons & Redemptions
    DROP POLICY IF EXISTS "Service role full access coupons" ON coupons;
    CREATE POLICY "Service role full access coupons" ON coupons FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access coupon_redemptions" ON coupon_redemptions;
    CREATE POLICY "Service role full access coupon_redemptions" ON coupon_redemptions FOR ALL USING (auth.role() = 'service_role');

    -- Points & Daily Rewards
    DROP POLICY IF EXISTS "Service role full access point_ledger" ON point_ledger;
    CREATE POLICY "Service role full access point_ledger" ON point_ledger FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access daily_rewards" ON daily_rewards;
    CREATE POLICY "Service role full access daily_rewards" ON daily_rewards FOR ALL USING (auth.role() = 'service_role');

    -- Gacha System
    DROP POLICY IF EXISTS "Service role full access gacha_pools" ON gacha_pools;
    CREATE POLICY "Service role full access gacha_pools" ON gacha_pools FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access gacha_prizes" ON gacha_prizes;
    CREATE POLICY "Service role full access gacha_prizes" ON gacha_prizes FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access gacha_spins" ON gacha_spins;
    CREATE POLICY "Service role full access gacha_spins" ON gacha_spins FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access gacha_claims" ON gacha_claims;
    CREATE POLICY "Service role full access gacha_claims" ON gacha_claims FOR ALL USING (auth.role() = 'service_role');

    -- Audit, Telemetry & Admin
    DROP POLICY IF EXISTS "Service role full access delivery_access_logs" ON delivery_access_logs;
    CREATE POLICY "Service role full access delivery_access_logs" ON delivery_access_logs FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access admin_audit_logs" ON admin_audit_logs;
    CREATE POLICY "Service role full access admin_audit_logs" ON admin_audit_logs FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access admin_users" ON admin_users;
    CREATE POLICY "Service role full access admin_users" ON admin_users FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access referrals" ON referrals;
    CREATE POLICY "Service role full access referrals" ON referrals FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access referral_rewards" ON referral_rewards;
    CREATE POLICY "Service role full access referral_rewards" ON referral_rewards FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access notifications" ON notifications;
    CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access support_tickets" ON support_tickets;
    CREATE POLICY "Service role full access support_tickets" ON support_tickets FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access app_settings" ON app_settings;
    CREATE POLICY "Service role full access app_settings" ON app_settings FOR ALL USING (auth.role() = 'service_role');

    DROP POLICY IF EXISTS "Service role full access system_events" ON system_events;
    CREATE POLICY "Service role full access system_events" ON system_events FOR ALL USING (auth.role() = 'service_role');
END $$;

-- 7.2 PUBLIC READ ACCESS FOR STORE CATALOG (ACTIVE ITEMS ONLY)
DROP POLICY IF EXISTS "Public read active categories" ON categories;
CREATE POLICY "Public read active categories" ON categories
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read active products" ON products;
CREATE POLICY "Public read active products" ON products
    FOR SELECT USING (is_active = TRUE AND is_draft = FALSE);

DROP POLICY IF EXISTS "Public read product media" ON product_media;
CREATE POLICY "Public read product media" ON product_media
    FOR SELECT USING (TRUE);

DROP POLICY IF EXISTS "Public read product variants" ON product_variants;
CREATE POLICY "Public read product variants" ON product_variants
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read active gacha pools" ON gacha_pools;
CREATE POLICY "Public read active gacha pools" ON gacha_pools
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read active gacha prizes" ON gacha_prizes;
CREATE POLICY "Public read active gacha prizes" ON gacha_prizes
    FOR SELECT USING (is_active = TRUE);

DROP POLICY IF EXISTS "Public read active public coupons" ON coupons;
CREATE POLICY "Public read active public coupons" ON coupons
    FOR SELECT USING (is_active = TRUE AND customer_telegram_id IS NULL);

DROP POLICY IF EXISTS "Public read app settings" ON app_settings;
CREATE POLICY "Public read app settings" ON app_settings
    FOR SELECT USING (TRUE);

-- 7.3 CUSTOMER DATA ISOLATION (BOUND TO TELEGRAM ID CLAIM)
DROP POLICY IF EXISTS "Customer read own user" ON telegram_users;
CREATE POLICY "Customer read own user" ON telegram_users
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own profile" ON profiles;
CREATE POLICY "Customer read own profile" ON profiles
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own orders" ON orders;
CREATE POLICY "Customer read own orders" ON orders
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own order items" ON order_items;
CREATE POLICY "Customer read own order items" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

DROP POLICY IF EXISTS "Customer read own payments" ON payments;
CREATE POLICY "Customer read own payments" ON payments
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = payments.order_id
        AND orders.telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

DROP POLICY IF EXISTS "Customer read own wallet coupons" ON coupons;
CREATE POLICY "Customer read own wallet coupons" ON coupons
    FOR SELECT USING (customer_telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own point ledger" ON point_ledger;
CREATE POLICY "Customer read own point ledger" ON point_ledger
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own daily rewards" ON daily_rewards;
CREATE POLICY "Customer read own daily rewards" ON daily_rewards
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own gacha spins" ON gacha_spins;
CREATE POLICY "Customer read own gacha spins" ON gacha_spins
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own gacha claims" ON gacha_claims;
CREATE POLICY "Customer read own gacha claims" ON gacha_claims
    FOR SELECT USING (customer_id IN (
        SELECT id FROM telegram_users
        WHERE telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

DROP POLICY IF EXISTS "Customer read own notifications" ON notifications;
CREATE POLICY "Customer read own notifications" ON notifications
    FOR SELECT USING (recipient_telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

DROP POLICY IF EXISTS "Customer read own support tickets" ON support_tickets;
CREATE POLICY "Customer read own support tickets" ON support_tickets
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

-- ==============================================================================
-- 8. SEED CONFIGURATION & CATALOG DATA (IDEMPOTENT & SAFE UPSERTS)
-- Note: NO real customer data, NO real bot tokens, NO real credentials seeded.
-- ==============================================================================

-- 8.1 APP SETTINGS (Point Economy, Cooldowns, Tiers & Warranty)
INSERT INTO app_settings (key, value, description)
VALUES
    ('points_per_dollar', '10'::jsonb, 'Uchiro points awarded per $1 spent on qualifying purchase'),
    ('daily_reward_points', '5'::jsonb, 'Base points awarded per daily claim in Asia/Phnom_Penh'),
    ('streak_interval_days', '7'::jsonb, 'Consecutive claim interval required for milestone bonus'),
    ('streak_bonus_points', '10'::jsonb, 'Bonus points awarded on streak milestones (Day 7, 14, 21, etc.)'),
    ('gacha_ticket_points_cost', '100'::jsonb, 'Points required to exchange for 1 Gacha Ticket'),
    ('gacha_cooldown_seconds', '3600'::jsonb, 'Server-authoritative gacha cooldown duration (1 hour)'),
    ('default_warranty_days', '14'::jsonb, 'Default account warranty duration (14 days from payment)'),
    ('coupon_redemption_enabled', 'true'::jsonb, 'Whether customers can redeem points for coupons'),
    ('coupon_tier_50', '{"cost": 50, "value": 0.50, "min_order": 1.50}'::jsonb, 'Tier 1: 50 points -> $0.50 coupon (min order $1.50)'),
    ('coupon_tier_100', '{"cost": 100, "value": 1.00, "min_order": 3.00}'::jsonb, 'Tier 2: 100 points -> $1.00 coupon (min order $3.00)'),
    ('coupon_tier_200', '{"cost": 200, "value": 2.00, "min_order": 5.00}'::jsonb, 'Tier 3: 200 points -> $2.00 coupon (min order $5.00)'),
    ('low_stock_threshold', '2'::jsonb, 'Inventory threshold for admin low stock notification'),
    ('three_order_counter', '{"current_count": 0, "threshold": 3}'::jsonb, 'Order batch counter for admin review prompts')
ON CONFLICT (key) DO UPDATE SET
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    updated_at = NOW();

-- 8.2 STANDARD STORE CATEGORIES
INSERT INTO categories (name, slug, icon, description, sort_order, is_active)
VALUES
    ('Roblox Accounts', 'accounts', 'UserCheck', 'High level Blox Fruits, MM2, and stacked gaming accounts with 14-day warranty', 1, TRUE),
    ('Game Items & Codes', 'items-codes', 'Gift', 'Instant digital redeem codes, gamepasses, and high-value game items', 2, TRUE),
    ('Blox Fruits', 'blox-fruits', 'Sword', 'Max level Kitsune, Leopard, Dragon fruits and godly accounts', 3, TRUE),
    ('Murder Mystery 2', 'mm2', 'Skull', 'Godly weapons, Chroma sets, and rare collectables', 4, TRUE),
    ('Blade Ball', 'blade-ball', 'Zap', 'Exclusive explosion effects, swords, and VIP ranks', 5, TRUE),
    ('Evade', 'evade', 'Ghost', 'Rare cosmetics, audio passes, and custom badges', 6, TRUE),
    ('Steal Egg', 'steal-egg', 'Egg', 'Mythical eggs, pets, and fast hatch multipliers', 7, TRUE),
    ('Other Games', 'other-games', 'Gamepad2', 'Trending Roblox game accessories, currency, and VIP passes', 8, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 8.3 DEFAULT GACHA POOL
INSERT INTO gacha_pools (id, title, slug, description, spin_price, is_active, banner_url)
VALUES (
    'a1000000-0000-0000-0000-000000000001'::uuid,
    'Uchiro Mythical Gear Gacha',
    'uchiro-mythical-gacha',
    'Spin to win exclusive Blox Fruits accounts, godly MM2 items, and free store balance vouchers! 1 Ticket per spin.',
    0.00,
    TRUE,
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=800&auto=format&fit=crop&q=80'
)
ON CONFLICT (slug) DO NOTHING;

-- 8.4 DEFAULT GACHA PRIZES (CONFIGURABLE PROBABILITIES & RARITIES)
INSERT INTO gacha_prizes (pool_id, title, description, rarity, probability_percent, delivery_mode, reward_type, reward_data, stock, is_active)
SELECT
    'a1000000-0000-0000-0000-000000000001'::uuid,
    v.title,
    v.description,
    v.rarity,
    v.probability_percent,
    v.delivery_mode,
    v.reward_type,
    v.reward_data,
    v.stock,
    TRUE
FROM (
    VALUES
        ('50 Uchiro Points Bonus', 'Instant point rebate to roll again or redeem coupons', 'COMMON', 55.000, 'instant_code', 'points', '{"points": 50}'::jsonb, 9999),
        ('$1.00 Store Balance Coupon', 'Valid for any purchase over $3.00', 'RARE', 25.000, 'instant_code', 'code', '{"coupon_value": 1.00, "min_order": 3.00}'::jsonb, 500),
        ('$3.00 VIP Store Voucher', 'Valid for any digital account or item order', 'EPIC', 12.000, 'instant_code', 'code', '{"coupon_value": 3.00, "min_order": 8.00}'::jsonb, 100),
        ('Godly MM2 Chroma Weapon Key', 'Rare digital voucher redeemable for Chroma Godly', 'LEGENDARY', 6.500, 'manual_review', 'item', '{"item_name": "MM2 Chroma Fang"}'::jsonb, 20),
        ('Max Level Kitsune Account Grand Prize', 'Full Access Account with 14-Day Warranty & Authenticator Vault', 'MYTHICAL', 1.500, 'manual_review', 'item', '{"item_name": "Blox Fruits Max Level Kitsune Account"}'::jsonb, 5)
) AS v(title, description, rarity, probability_percent, delivery_mode, reward_type, reward_data, stock)
WHERE EXISTS (SELECT 1 FROM gacha_pools WHERE id = 'a1000000-0000-0000-0000-000000000001'::uuid)
ON CONFLICT DO NOTHING;

-- 8.5 SAMPLE PUBLIC WELCOME COUPON
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, usage_limit, per_user_limit, is_active, status)
VALUES ('UCHIROV3', 'fixed', 1.00, 5.00, 1000, 1, TRUE, 'AVAILABLE')
ON CONFLICT (code) DO NOTHING;

-- ==============================================================================
-- 9. READ-ONLY VERIFICATION QUERIES
-- Verify schema readiness, column additions, RLS status, and app configuration.
-- ==============================================================================

-- 9.1 Verify Table Count & Names (Expect 30 Core Tables)
SELECT
    COUNT(*) AS total_uchiro_tables,
    ARRAY_AGG(table_name ORDER BY table_name) AS uchiro_table_list
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'telegram_users', 'profiles', 'categories', 'products', 'product_media',
    'product_variants', 'inventory_items', 'inventory_reservations', 'orders',
    'order_items', 'payments', 'payment_attempts', 'payment_events', 'coupons',
    'coupon_redemptions', 'point_ledger', 'daily_rewards', 'gacha_pools',
    'gacha_prizes', 'gacha_spins', 'gacha_claims', 'delivery_access_logs',
    'admin_audit_logs', 'referrals', 'referral_rewards', 'notifications',
    'admin_users', 'support_tickets', 'app_settings', 'system_events'
);

-- 9.2 Verify Critical Delivery & Authenticator & Warranty Columns
SELECT
    table_name,
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_schema = 'public'
AND (
    (table_name = 'inventory_items' AND column_name IN ('authenticator_enabled', 'authenticator_secret_ciphertext', 'email', 'encrypted_email_password'))
    OR (table_name = 'orders' AND column_name IN ('warranty_days', 'warranty_status', 'warranty_starts_at', 'warranty_expires_at'))
    OR (table_name = 'profiles' AND column_name IN ('gacha_tickets', 'last_gacha_roll_at', 'next_gacha_roll_at'))
    OR (table_name = 'coupons' AND column_name IN ('customer_telegram_id', 'points_cost', 'status'))
    OR (table_name = 'daily_rewards' AND column_name IN ('claim_date', 'streak', 'longest_streak'))
)
ORDER BY table_name, column_name;

-- 9.3 Verify App Settings Economy Configuration
SELECT
    key,
    value,
    description
FROM app_settings
ORDER BY key;

-- 9.4 Verify Row Level Security (RLS) is Active on All Tables
SELECT
    tablename,
    rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'telegram_users', 'profiles', 'categories', 'products', 'inventory_items',
    'orders', 'payments', 'coupons', 'point_ledger', 'daily_rewards',
    'gacha_pools', 'gacha_prizes', 'gacha_spins', 'gacha_claims',
    'delivery_access_logs', 'admin_audit_logs', 'admin_users'
)
ORDER BY tablename;

-- ==============================================================================
-- 10. BATCH STOCK ANNOUNCEMENTS TABLES (PROMPT 5)
-- ==============================================================================

CREATE TABLE IF NOT EXISTS registered_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chat_id TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    chat_type VARCHAR(32) NOT NULL DEFAULT 'supergroup' CHECK (chat_type IN ('group', 'supergroup', 'channel')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    bot_can_post BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_registered_groups_active ON registered_groups(is_active);

CREATE TABLE IF NOT EXISTS stock_announcement_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id TEXT NOT NULL,
    event_type VARCHAR(32) NOT NULL DEFAULT 'restock' CHECK (event_type IN ('new_product', 'restock', 'manual')),
    stock_at_event INTEGER NOT NULL DEFAULT 1 CHECK (stock_at_event >= 0),
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'batched', 'published', 'cancelled')),
    batch_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    published_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stock_announcement_events_status ON stock_announcement_events(status);
CREATE INDEX IF NOT EXISTS idx_stock_announcement_events_product ON stock_announcement_events(product_id);

CREATE TABLE IF NOT EXISTS stock_announcement_batches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status VARCHAR(32) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'preview', 'publishing', 'succeeded', 'partial', 'failed', 'cancelled')),
    created_by_admin TEXT NOT NULL,
    idempotency_key TEXT UNIQUE,
    total_groups INTEGER NOT NULL DEFAULT 0,
    succeeded_groups INTEGER NOT NULL DEFAULT 0,
    failed_groups INTEGER NOT NULL DEFAULT 0,
    total_products INTEGER NOT NULL DEFAULT 0,
    published_products INTEGER NOT NULL DEFAULT 0,
    skipped_products INTEGER NOT NULL DEFAULT 0,
    snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_stock_announcement_batches_status ON stock_announcement_batches(status);
CREATE INDEX IF NOT EXISTS idx_stock_announcement_batches_idempotency ON stock_announcement_batches(idempotency_key);

CREATE TABLE IF NOT EXISTS stock_batch_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    batch_id UUID NOT NULL REFERENCES stock_announcement_batches(id) ON DELETE CASCADE,
    chat_id TEXT NOT NULL,
    group_title TEXT NOT NULL,
    chunk_index INTEGER NOT NULL DEFAULT 0,
    total_chunks INTEGER NOT NULL DEFAULT 1,
    status VARCHAR(32) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'succeeded', 'failed', 'skipped')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    telegram_message_id BIGINT,
    error_code VARCHAR(64),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    CONSTRAINT uq_stock_batch_deliveries_chunk UNIQUE (batch_id, chat_id, chunk_index)
);
CREATE INDEX IF NOT EXISTS idx_stock_batch_deliveries_batch ON stock_batch_deliveries(batch_id);
CREATE INDEX IF NOT EXISTS idx_stock_batch_deliveries_status ON stock_batch_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_stock_batch_deliveries_chat ON stock_batch_deliveries(chat_id);

ALTER TABLE registered_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_announcement_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_announcement_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_batch_deliveries ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'registered_groups' AND policyname = 'Service role full access registered_groups') THEN
        CREATE POLICY "Service role full access registered_groups" ON registered_groups FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_announcement_events' AND policyname = 'Service role full access stock_announcement_events') THEN
        CREATE POLICY "Service role full access stock_announcement_events" ON stock_announcement_events FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_announcement_batches' AND policyname = 'Service role full access stock_announcement_batches') THEN
        CREATE POLICY "Service role full access stock_announcement_batches" ON stock_announcement_batches FOR ALL USING (auth.role() = 'service_role');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'stock_batch_deliveries' AND policyname = 'Service role full access stock_batch_deliveries') THEN
        CREATE POLICY "Service role full access stock_batch_deliveries" ON stock_batch_deliveries FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ==============================================================================
-- END OF UCHIRO STORE V3 SUPABASE SETUP SCRIPT
-- ==============================================================================



