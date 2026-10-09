-- ==============================================================================
-- UCHIRO STORE V3 — DELIVERY AUTHENTICATOR & AUDIT MIGRATION
-- Standalone SQL Script for Supabase Dashboard -> SQL Editor
--
-- Description:
-- 1. Extends inventory_items with RFC 6238 TOTP authenticator configuration
--    and encrypted secret ciphertext storage.
-- 2. Creates the delivery_access_logs audit table to securely record
--    customer delivery views, TOTP requests, and QR generations without
--    logging any passwords, raw secrets, or temporary codes.
-- 3. Configures Row Level Security (RLS) policies to protect credentials.
--
-- Note: Safe to re-run (fully idempotent). No existing tables or data are dropped.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. EXTEND INVENTORY ITEMS WITH TOTP AUTHENTICATOR CONFIGURATION
-- ------------------------------------------------------------------------------
ALTER TABLE inventory_items
    ADD COLUMN IF NOT EXISTS authenticator_enabled BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS authenticator_secret_ciphertext TEXT,
    ADD COLUMN IF NOT EXISTS authenticator_algorithm VARCHAR(16) DEFAULT 'SHA1',
    ADD COLUMN IF NOT EXISTS authenticator_digits INTEGER DEFAULT 6,
    ADD COLUMN IF NOT EXISTS authenticator_period INTEGER DEFAULT 30;

-- Backfill authenticator_secret_ciphertext from existing encrypted_account_2fa if present
UPDATE inventory_items
SET
    authenticator_enabled = TRUE,
    authenticator_secret_ciphertext = encrypted_account_2fa
WHERE
    authenticator_secret_ciphertext IS NULL
    AND encrypted_account_2fa IS NOT NULL
    AND LENGTH(encrypted_account_2fa) > 0;

-- Create index on inventory authenticator status
CREATE INDEX IF NOT EXISTS idx_inventory_authenticator_enabled
    ON inventory_items(authenticator_enabled)
    WHERE authenticator_enabled = TRUE;

-- ------------------------------------------------------------------------------
-- 2. CREATE DELIVERY ACCESS AUDIT TABLE
-- ------------------------------------------------------------------------------
-- Stores non-sensitive telemetry for security monitoring and fraud prevention.
-- STRICT REQUIREMENT: Passwords, TOTP secrets, and TOTP codes are NEVER stored.
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

-- Performance Indexes for Audit Log Queries
CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_order
    ON delivery_access_logs(order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_telegram
    ON delivery_access_logs(telegram_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_delivery_access_logs_created
    ON delivery_access_logs(created_at DESC);

-- ------------------------------------------------------------------------------
-- 3. ROW LEVEL SECURITY (RLS) POLICIES
-- ------------------------------------------------------------------------------
-- Enable RLS on audit logs
ALTER TABLE delivery_access_logs ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if present for clean idempotent re-run
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'delivery_access_logs'
        AND policyname = 'Service role full access delivery_access_logs'
    ) THEN
        DROP POLICY "Service role full access delivery_access_logs" ON delivery_access_logs;
    END IF;
END $$;

-- Only trusted backend service_role can read or write delivery audit logs
CREATE POLICY "Service role full access delivery_access_logs"
    ON delivery_access_logs
    FOR ALL
    USING (auth.role() = 'service_role');

-- Ensure inventory_items remains strictly accessible only by service_role
-- (Public/anonymous users MUST NEVER select raw credentials or secrets)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'inventory_items'
        AND policyname = 'Service role full access inventory_items'
    ) THEN
        CREATE POLICY "Service role full access inventory_items"
            ON inventory_items
            FOR ALL
            USING (auth.role() = 'service_role');
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 4. VERIFICATION QUERY (For manual execution check in Supabase)
-- ------------------------------------------------------------------------------
-- SELECT column_name, data_type, column_default
-- FROM information_schema.columns
-- WHERE table_name = 'inventory_items'
--   AND column_name LIKE 'authenticator_%';
