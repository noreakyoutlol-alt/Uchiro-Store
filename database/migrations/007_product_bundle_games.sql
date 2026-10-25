-- ============================================================
-- UCHIRO STORE V3 — MIGRATION 007: MULTIPLE GAMES PER PRODUCT / ACCOUNT BUNDLE
-- ============================================================
-- Safe, idempotent migration for multi-game products / account bundles (1-5 games):
-- 1. Adds `games` JSONB column to `products` table
-- 2. Defaults to '[]'::jsonb
-- 3. Ensures existing products remain safe with empty list default
-- ============================================================

-- 1. Add `games` JSONB column to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS games JSONB DEFAULT '[]'::jsonb;

-- 2. Update any NULL games columns to empty jsonb array
UPDATE products
SET games = '[]'::jsonb
WHERE games IS NULL;
