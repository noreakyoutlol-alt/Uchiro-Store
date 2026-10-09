-- ============================================================
-- UCHIRO STORE V3 — MIGRATION 005: 4 DISTINCT DELIVERY MODES
-- ============================================================
-- Exact Delivery Modes:
-- 1. "Instant Account Delivery" -> 'auto_account'
-- 2. "Roblox Gift Delivery"     -> 'manual_service'
-- 3. "In-Game Trade"            -> 'trade_item'
-- 4. "Instant Digital Key"      -> 'digital_code'

ALTER TABLE products
    DROP CONSTRAINT IF EXISTS products_delivery_mode_check;

ALTER TABLE products
    ADD CONSTRAINT products_delivery_mode_check
    CHECK (delivery_mode IN ('auto_account', 'manual_service', 'trade_item', 'digital_code'));

ALTER TABLE products
    ADD COLUMN IF NOT EXISTS requires_roblox_verification BOOLEAN DEFAULT FALSE;

-- Ensure existing manual_service products have requires_roblox_verification set
UPDATE products
SET requires_roblox_verification = TRUE
WHERE delivery_mode = 'manual_service';
