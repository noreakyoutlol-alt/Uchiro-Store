-- ==============================================================================
-- 008_batch_stock_announcements.sql
-- Batch Stock Announcements: Registered Groups, Pending Stock Events, Batches & Group Deliveries
-- Safe and idempotent for both fresh setup and existing production
-- ==============================================================================

-- 1. Registered & Authorized Telegram Groups for Announcements
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

-- 2. Pending Stock Announcement Events (New Product / Restock tracking)
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

-- 3. Stock Announcement Batches (Batch record & snapshot)
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

-- 4. Per-Group Batch Deliveries (Per-group & per-chunk delivery records with deduplication)
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

-- 5. Row Level Security Policies
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

