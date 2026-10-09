-- ============================================================
-- UCHIRO STORE V3 — COMPLETE NEW POSTGRESQL SCHEMA
-- TELEGRAM GAMING MINI APP & DUAL BOT ARCHITECTURE
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. TELEGRAM USERS & PROFILES (NO EMAIL/PASSWORD AUTH)
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_telegram_users_tgid ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_users_username ON telegram_users(username);

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES telegram_users(id) ON DELETE CASCADE,
    telegram_id BIGINT UNIQUE NOT NULL REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
    points INTEGER DEFAULT 0 CHECK (points >= 0),
    total_spent NUMERIC(12, 2) DEFAULT 0.00 CHECK (total_spent >= 0),
    total_orders INTEGER DEFAULT 0 CHECK (total_orders >= 0),
    gacha_spins_count INTEGER DEFAULT 0 CHECK (gacha_spins_count >= 0),
    referral_code VARCHAR(32) UNIQUE,
    referred_by BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_profiles_refcode ON profiles(referral_code);

-- ============================================================
-- 2. CATEGORIES
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_categories_slug ON categories(slug);
CREATE INDEX IF NOT EXISTS idx_categories_order ON categories(sort_order);

-- ============================================================
-- 3. PRODUCTS & MEDIA & VARIANTS
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    category_id UUID NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    short_description TEXT,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    compare_at_price NUMERIC(10, 2) CHECK (compare_at_price >= price),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_draft BOOLEAN NOT NULL DEFAULT FALSE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    delivery_mode VARCHAR(30) NOT NULL CHECK (delivery_mode IN ('auto_account', 'manual_service', 'trade_item', 'digital_code')),
    warranty_days INTEGER DEFAULT 0 CHECK (warranty_days >= 0),
    requires_roblox_username BOOLEAN DEFAULT FALSE,
    requires_roblox_verification BOOLEAN DEFAULT FALSE,
    badge VARCHAR(50),
    specifications JSONB DEFAULT '{}'::jsonb,
    views_count INTEGER DEFAULT 0,
    sales_count INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_products_instock ON products(is_active, is_draft, stock);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_slug ON products(slug);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);

CREATE TABLE IF NOT EXISTS product_media (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url TEXT NOT NULL,
    alt_text TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_media_product ON product_media(product_id, sort_order);

CREATE TABLE IF NOT EXISTS product_variants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL CHECK (price >= 0),
    stock INTEGER NOT NULL DEFAULT 0 CHECK (stock >= 0),
    sku VARCHAR(64),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. INVENTORY & RESERVATIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    item_type VARCHAR(20) NOT NULL CHECK (item_type IN ('account', 'code')),
    account_username TEXT,
    encrypted_account_password TEXT,
    encrypted_account_2fa TEXT,
    digital_code TEXT,
    notes TEXT,
    status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'reserved', 'consumed')),
    reserved_until TIMESTAMPTZ,
    order_id UUID,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_inventory_product_status ON inventory_items(product_id, status);
CREATE INDEX IF NOT EXISTS idx_inventory_order ON inventory_items(order_id);

CREATE TABLE IF NOT EXISTS inventory_reservations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'released', 'consumed')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reservations_status_expires ON inventory_reservations(status, expires_at);
CREATE INDEX IF NOT EXISTS idx_reservations_order ON inventory_reservations(order_id);

-- ============================================================
-- 5. COUPONS & REDEMPTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS coupons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(32) UNIQUE NOT NULL,
    discount_type VARCHAR(20) NOT NULL CHECK (discount_type IN ('percentage', 'fixed')),
    discount_value NUMERIC(10, 2) NOT NULL CHECK (discount_value > 0),
    min_order_amount NUMERIC(10, 2) DEFAULT 0.00,
    max_discount_amount NUMERIC(10, 2),
    usage_limit INTEGER,
    times_used INTEGER DEFAULT 0,
    per_user_limit INTEGER DEFAULT 1,
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

CREATE TABLE IF NOT EXISTS coupon_redemptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    coupon_id UUID NOT NULL REFERENCES coupons(id) ON DELETE RESTRICT,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    order_id UUID NOT NULL,
    discount_amount NUMERIC(10, 2) NOT NULL,
    redeemed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_coupon_redemptions_user ON coupon_redemptions(coupon_id, customer_id);

-- ============================================================
-- 6. ORDERS & ORDER ITEMS
-- ============================================================
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
    delivery_mode VARCHAR(30) NOT NULL CHECK (delivery_mode IN ('auto_account', 'digital_code', 'manual_service')),
    delivery_credentials JSONB,
    fulfillment_notes TEXT,
    delivered_at TIMESTAMPTZ,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_customer ON orders(customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_number ON orders(order_number);
CREATE INDEX IF NOT EXISTS idx_orders_telegram ON orders(telegram_id);

CREATE TABLE IF NOT EXISTS order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
    product_title TEXT NOT NULL,
    price NUMERIC(10, 2) NOT NULL,
    quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
    delivery_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_items_order ON order_items(order_id);

-- ============================================================
-- 7. PAYMENTS (KHPAY / KHQR)
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_md5 ON payments(md5_hash);
CREATE INDEX IF NOT EXISTS idx_payments_status_expires ON payments(status, expires_at);

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

-- ============================================================
-- 8. GACHA SYSTEM
-- ============================================================
CREATE TABLE IF NOT EXISTS gacha_pools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    description TEXT,
    spin_price NUMERIC(10, 2) NOT NULL CHECK (spin_price >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    banner_url TEXT,
    total_spins INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS gacha_prizes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pool_id UUID NOT NULL REFERENCES gacha_pools(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    description TEXT,
    rarity VARCHAR(20) NOT NULL CHECK (rarity IN ('COMMON', 'RARE', 'EPIC', 'LEGENDARY', 'MYTHICAL')),
    probability_percent NUMERIC(6, 3) NOT NULL CHECK (probability_percent > 0),
    delivery_mode VARCHAR(20) NOT NULL CHECK (delivery_mode IN ('instant_code', 'manual_review')),
    reward_type VARCHAR(20) NOT NULL CHECK (reward_type IN ('code', 'points', 'item')),
    reward_data JSONB DEFAULT '{}'::jsonb,
    icon_url TEXT,
    stock INTEGER DEFAULT 9999 CHECK (stock >= 0),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_prizes_pool ON gacha_prizes(pool_id, is_active);

CREATE TABLE IF NOT EXISTS gacha_spins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE RESTRICT,
    telegram_id BIGINT NOT NULL,
    pool_id UUID NOT NULL REFERENCES gacha_pools(id) ON DELETE RESTRICT,
    prize_id UUID NOT NULL REFERENCES gacha_prizes(id) ON DELETE RESTRICT,
    rarity VARCHAR(20) NOT NULL,
    cost NUMERIC(10, 2) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_gacha_spins_customer ON gacha_spins(customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS gacha_claims (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    spin_id UUID NOT NULL REFERENCES gacha_spins(id) ON DELETE CASCADE,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    prize_id UUID NOT NULL REFERENCES gacha_prizes(id) ON DELETE RESTRICT,
    status VARCHAR(20) NOT NULL DEFAULT 'claimed' CHECK (status IN ('claimed', 'pending_review', 'fulfilled', 'rejected')),
    delivery_data JSONB,
    admin_notes TEXT,
    claimed_at TIMESTAMPTZ DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_gacha_claims_status ON gacha_claims(status);

-- ============================================================
-- 9. REFERRALS & REWARDS
-- ============================================================
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
    reward_amount NUMERIC(10, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. NOTIFICATIONS
-- ============================================================
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

CREATE INDEX IF NOT EXISTS idx_notifications_recipient ON notifications(recipient_telegram_id, is_read);

-- ============================================================
-- 11. ADMIN USERS & AUDIT LOGS
-- ============================================================
CREATE TABLE IF NOT EXISTS admin_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT UNIQUE NOT NULL,
    username TEXT,
    display_name TEXT NOT NULL,
    role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('superadmin', 'admin', 'moderator')),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    admin_id UUID REFERENCES admin_users(id) ON DELETE SET NULL,
    telegram_id BIGINT NOT NULL,
    action VARCHAR(64) NOT NULL,
    target_entity VARCHAR(64) NOT NULL,
    target_id TEXT,
    details JSONB DEFAULT '{}'::jsonb,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON admin_audit_logs(action, created_at DESC);

-- ============================================================
-- 12. ROBLOX CACHE, SUPPORT & SETTINGS
-- ============================================================
CREATE TABLE IF NOT EXISTS roblox_profiles_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username TEXT UNIQUE NOT NULL,
    roblox_id BIGINT NOT NULL,
    display_name TEXT NOT NULL,
    avatar_url TEXT,
    is_verified BOOLEAN DEFAULT TRUE,
    cached_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_roblox_username ON roblox_profiles_cache(LOWER(username));

CREATE TABLE IF NOT EXISTS support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ticket_number VARCHAR(32) UNIQUE NOT NULL,
    customer_id UUID NOT NULL REFERENCES telegram_users(id) ON DELETE CASCADE,
    telegram_id BIGINT NOT NULL,
    order_id UUID REFERENCES orders(id) ON DELETE SET NULL,
    category VARCHAR(30) NOT NULL CHECK (category IN ('order', 'payment', 'delivery', 'general')),
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved', 'closed')),
    admin_reply TEXT,
    resolved_at TIMESTAMPTZ,
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
