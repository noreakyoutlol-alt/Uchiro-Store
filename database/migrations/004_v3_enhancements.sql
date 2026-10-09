-- ============================================================
-- UCHIRO STORE V3 — MIGRATION 004: ENHANCEMENTS
-- Points Ledger, Daily Rewards, 14-Day Warranty & Extended Fields
-- ============================================================

-- 1. POINT LEDGER TABLE
CREATE TABLE IF NOT EXISTS point_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    telegram_id BIGINT NOT NULL REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
    customer_id UUID REFERENCES telegram_users(id) ON DELETE CASCADE,
    amount INTEGER NOT NULL, -- positive for credit, negative for debit
    type VARCHAR(32) NOT NULL CHECK (type IN ('order_purchase', 'purchase_reward', 'gacha_spin', 'gacha_ticket', 'gacha_win', 'coupon_redemption', 'daily_reward', 'streak_bonus', 'admin_adjustment', 'referral_bonus', 'refund_reversal')),
    description TEXT NOT NULL,
    reference_id TEXT,
    balance_after INTEGER NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_point_ledger_tgid ON point_ledger(telegram_id, created_at DESC);

-- 2. DAILY REWARDS TABLE
CREATE TABLE IF NOT EXISTS daily_rewards (
    telegram_id BIGINT PRIMARY KEY REFERENCES telegram_users(telegram_id) ON DELETE CASCADE,
    last_claimed_at TIMESTAMPTZ NOT NULL,
    streak INTEGER DEFAULT 1 CHECK (streak >= 1),
    total_claimed_points INTEGER DEFAULT 0 CHECK (total_claimed_points >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EXTEND INVENTORY ITEMS FOR ACCOUNT CREDENTIALS
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS email TEXT,
    ADD COLUMN IF NOT EXISTS encrypted_email_password TEXT,
    ADD COLUMN IF NOT EXISTS encrypted_backup_codes TEXT,
    ADD COLUMN IF NOT EXISTS account_notes TEXT;

-- 4. EXTEND PRODUCTS FOR GAME TYPES & WARRANTY
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS product_type VARCHAR(32) DEFAULT 'account',
    ADD COLUMN IF NOT EXISTS require_email_protection BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS require_authenticator_protection BOOLEAN DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS warranty_notes TEXT DEFAULT 'Warranty valid for 14 days provided original email and authenticator are not removed.';

-- Update default warranty_days to 14 days
ALTER TABLE products ALTER COLUMN warranty_days SET DEFAULT 14;

-- 5. EXTEND ORDERS FOR LIVE WARRANTY STATUS & TIMELINE
ALTER TABLE orders
    ADD COLUMN IF NOT EXISTS warranty_days INTEGER DEFAULT 14,
    ADD COLUMN IF NOT EXISTS warranty_expires_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS warranty_status VARCHAR(20) DEFAULT 'active' CHECK (warranty_status IN ('active', 'warning', 'expired', 'invalidated')),
    ADD COLUMN IF NOT EXISTS warranty_notes TEXT;

-- 6. EXTEND GACHA PRIZES FOR NUMBERED REWARDS & SLOT STATUS
ALTER TABLE gacha_prizes
    ADD COLUMN IF NOT EXISTS reward_number INTEGER,
    ADD COLUMN IF NOT EXISTS slot_number INTEGER,
    ADD COLUMN IF NOT EXISTS slot_status VARCHAR(20) DEFAULT 'current' CHECK (slot_status IN ('current', 'draft', 'archived'));

-- 7. THREE ORDER NOTIFICATION COUNTER & ECONOMY IN APP SETTINGS
INSERT INTO app_settings (key, value, description)
VALUES
    ('points_per_dollar', '10'::jsonb, 'Uchiro points awarded per $1 spent'),
    ('gacha_ticket_points_cost', '100'::jsonb, 'Uchiro points required per gacha ticket'),
    ('gacha_cooldown_seconds', '3600'::jsonb, 'Cooldown duration in seconds after gacha roll'),
    ('coupon_redemption_enabled', 'true'::jsonb, 'Whether customers can redeem points for coupons'),
    ('daily_reward_points', '5'::jsonb, 'Base points awarded for daily claim'),
    ('streak_bonus_points', '15'::jsonb, 'Bonus points awarded on day 7 / streak multiples of 7'),
    ('streak_interval_days', '7'::jsonb, 'Interval days for streak bonus'),
    ('coupon_tier_50_value', '0.50'::jsonb, 'Tier 1 coupon discount value ($0.50)'),
    ('coupon_tier_50_min_order', '1.50'::jsonb, 'Tier 1 coupon minimum order ($1.50)'),
    ('coupon_tier_100_value', '1.00'::jsonb, 'Tier 2 coupon discount value ($1.00)'),
    ('coupon_tier_100_min_order', '3.00'::jsonb, 'Tier 2 coupon minimum order ($3.00)'),
    ('coupon_tier_200_value', '2.00'::jsonb, 'Tier 3 coupon discount value ($2.00)'),
    ('coupon_tier_200_min_order', '5.00'::jsonb, 'Tier 3 coupon minimum order ($5.00)'),
    ('low_stock_threshold', '5'::jsonb, 'Inventory threshold for admin low stock notification'),
    ('three_order_counter', '{"current_count": 0, "threshold": 3}'::jsonb, 'Order batch counter for admin review prompts'),
    ('default_warranty_days', '14'::jsonb, 'Default warranty duration for digital accounts')
ON CONFLICT (key) DO NOTHING;
