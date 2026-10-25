-- ============================================================
-- UCHIRO STORE V3 — MIGRATION 006: PRODUCT MEDIA GALLERY (UP TO 5 IMAGES)
-- ============================================================
-- Safe, idempotent migration for product images & Supabase Storage:
-- 1. Adds `media` JSONB column to `products` table
-- 2. Backfills from existing `product_media` records if any exist
-- 3. Creates the `product-images` Supabase Storage bucket (public)
-- ============================================================

-- 1. Add `media` JSONB column to products
ALTER TABLE products
    ADD COLUMN IF NOT EXISTS media JSONB DEFAULT '[]'::jsonb;

-- 2. Backfill `media` from `product_media` if table exists and has rows
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_media'
    ) THEN
        UPDATE products p
        SET media = sub.media_json
        FROM (
            SELECT
                product_id,
                jsonb_agg(
                    jsonb_build_object(
                        'id', id,
                        'product_id', product_id,
                        'url', url,
                        'alt_text', alt_text,
                        'is_primary', is_primary,
                        'sort_order', sort_order,
                        'created_at', created_at
                    ) ORDER BY sort_order ASC, created_at ASC
                ) AS media_json
            FROM product_media
            GROUP BY product_id
        ) sub
        WHERE p.id = sub.product_id
          AND (p.media IS NULL OR p.media = '[]'::jsonb);
    END IF;
END $$;

-- 3. Supabase Storage: Create 'product-images' bucket if storage schema exists
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'buckets'
    ) THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'product-images',
            'product-images',
            TRUE,
            5242880, -- 5 MB
            ARRAY['image/jpeg', 'image/png', 'image/webp']
        )
        ON CONFLICT (id) DO UPDATE
        SET public = TRUE,
            file_size_limit = 5242880,
            allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp'];
    END IF;
END $$;

-- 4. RLS for storage.objects: public can read, authenticated/service role can manage
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'storage' AND table_name = 'objects'
    ) THEN
        -- Allow public read access to product-images
        IF NOT EXISTS (
            SELECT 1 FROM pg_policies
            WHERE schemaname = 'storage'
              AND tablename = 'objects'
              AND policyname = 'Public read product-images'
        ) THEN
            CREATE POLICY "Public read product-images"
                ON storage.objects FOR SELECT
                USING (bucket_id = 'product-images');
        END IF;
    END IF;
END $$;
