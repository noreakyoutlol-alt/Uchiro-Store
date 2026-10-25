-- ==============================================================================
-- 009_seasonal_themes.sql
-- Seasonal Themes: Centralized configuration and persistence for Store themes
-- Supported themes: 'gaming', 'halloween', 'christmas', 'angkor-khmer'
-- Safe and idempotent for both fresh setup and existing production
-- ==============================================================================

-- 1. Ensure app_settings table exists
CREATE TABLE IF NOT EXISTS app_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    key VARCHAR(64) UNIQUE NOT NULL,
    value JSONB NOT NULL,
    description TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_settings_key ON app_settings(key);

-- 2. Seed or update active_seasonal_theme setting with safe fallback 'gaming'
INSERT INTO app_settings (key, value, description)
VALUES (
    'active_seasonal_theme',
    jsonb_build_object(
        'active_theme', 'gaming',
        'updated_at', NOW(),
        'updated_by', 'system'
    ),
    'Active global seasonal theme for customer Store Mini App: gaming, halloween, christmas, angkor-khmer'
)
ON CONFLICT (key) DO NOTHING;

-- 3. Row Level Security Policies
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Public read active app_settings') THEN
        CREATE POLICY "Public read active app_settings" ON app_settings
            FOR SELECT USING (true);
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'app_settings' AND policyname = 'Service role full access app_settings') THEN
        CREATE POLICY "Service role full access app_settings" ON app_settings
            FOR ALL USING (auth.role() = 'service_role');
    END IF;
END $$;
