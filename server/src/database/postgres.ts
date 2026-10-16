import pg, { Pool } from 'pg';

pg.types.setTypeParser(20, Number);
pg.types.setTypeParser(1700, parseFloat);

const connectionString = process.env.DATABASE_URL || '';
const isInternal = connectionString.includes('railway.internal') || connectionString.includes('localhost');

export const pgPool = new Pool({
  connectionString,
  ssl: isInternal ? false : { rejectUnauthorized: false },
  connectionTimeoutMillis: 4000,
  idleTimeoutMillis: 10000,
  max: 20,
});

export const isPostgresConfigured = (): boolean => Boolean(process.env.DATABASE_URL);

export async function initDatabase(): Promise<void> {
  if (!isPostgresConfigured()) {
    console.log('[Postgres] DATABASE_URL not set, skipping PostgreSQL initDatabase()');
    return;
  }

  try {
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS users (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_id TEXT UNIQUE NOT NULL,
          username TEXT,
          first_name TEXT,
          points BIGINT DEFAULT 0 NOT NULL,
          streak_count INT DEFAULT 0 NOT NULL,
          gacha_tickets INT DEFAULT 0 NOT NULL,
          last_daily_claim_at TIMESTAMPTZ,
          role TEXT DEFAULT 'customer' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS points_ledger (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_id TEXT NOT NULL,
          amount BIGINT NOT NULL,
          type TEXT NOT NULL,
          balance_after BIGINT NOT NULL,
          description TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_code TEXT UNIQUE NOT NULL,
          telegram_id TEXT NOT NULL,
          product_title TEXT NOT NULL,
          amount NUMERIC(10, 2) NOT NULL,
          status TEXT DEFAULT 'completed' NOT NULL,
          account_username TEXT,
          account_password TEXT,
          two_factor_secret TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS products (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          category TEXT NOT NULL,
          price NUMERIC(10, 2) NOT NULL,
          stock_count INT DEFAULT 0 NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Additive column migrations for existing core tables
        ALTER TABLE users ADD COLUMN IF NOT EXISTS gacha_tickets INT DEFAULT 0 NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false NOT NULL;
        ALTER TABLE users ADD COLUMN IF NOT EXISTS blocked_reason TEXT;
        CREATE INDEX IF NOT EXISTS idx_users_telegram_id ON users(telegram_id);

        CREATE INDEX IF NOT EXISTS idx_points_ledger_telegram_id ON points_ledger(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_points_ledger_created_at ON points_ledger(created_at);

        ALTER TABLE orders ADD COLUMN IF NOT EXISTS items JSONB DEFAULT '[]'::jsonb;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS total_amount NUMERIC(10, 2) DEFAULT 0;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_provider TEXT DEFAULT 'khpay';
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_ref TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_id TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS roblox_username TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS roblox_display_name TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS roblox_user_id TEXT;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;
        CREATE INDEX IF NOT EXISTS idx_orders_telegram_id ON orders(telegram_id);
        CREATE INDEX IF NOT EXISTS idx_orders_order_code ON orders(order_code);
        CREATE INDEX IF NOT EXISTS idx_orders_payment_ref ON orders(payment_ref);

        ALTER TABLE products ADD COLUMN IF NOT EXISTS slug TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS description TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS product_type TEXT DEFAULT 'account';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS delivery_mode TEXT DEFAULT 'auto_account';
        ALTER TABLE products ADD COLUMN IF NOT EXISTS image_url TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS original_price NUMERIC(10, 2);
        ALTER TABLE products ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS badge TEXT;
        ALTER TABLE products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
        CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);

        -- 1. Durable Inventory Table
        CREATE TABLE IF NOT EXISTS inventory (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          product_id TEXT NOT NULL,
          data TEXT NOT NULL,
          status TEXT DEFAULT 'available' NOT NULL,
          is_sold BOOLEAN DEFAULT false NOT NULL,
          order_id TEXT,
          reserved_until TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_inventory_product_id ON inventory(product_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_status ON inventory(status);

        -- 2. Durable Coupons Table
        CREATE TABLE IF NOT EXISTS coupons (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          code TEXT UNIQUE NOT NULL,
          discount_type TEXT NOT NULL,
          discount_value NUMERIC(10, 2) NOT NULL,
          min_order_amount NUMERIC(10, 2) DEFAULT 0 NOT NULL,
          max_uses INT DEFAULT 0 NOT NULL,
          used_count INT DEFAULT 0 NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          expires_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_coupons_code ON coupons(code);

        -- 3. Durable Gacha Wheels & Prizes Tables
        CREATE TABLE IF NOT EXISTS gacha_pools (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          title TEXT NOT NULL,
          cost_points INT NOT NULL,
          ticket_cost INT DEFAULT 1 NOT NULL,
          is_active BOOLEAN DEFAULT true NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS gacha_prizes (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          pool_id UUID,
          title TEXT NOT NULL,
          type TEXT NOT NULL,
          value TEXT NOT NULL,
          probability NUMERIC(6, 4) NOT NULL,
          stock INT DEFAULT -1 NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS gacha_spins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_id TEXT NOT NULL,
          pool_id UUID,
          prize_title TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS gacha_claims (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          telegram_id TEXT NOT NULL,
          prize_id UUID,
          prize_title TEXT NOT NULL,
          status TEXT DEFAULT 'pending' NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 4. Durable IP Blocks & Security Incidents Tables
        CREATE TABLE IF NOT EXISTS ip_blocks (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address TEXT UNIQUE NOT NULL,
          reason TEXT NOT NULL,
          blocked_until TIMESTAMPTZ,
          is_permanent BOOLEAN DEFAULT false NOT NULL,
          failed_attempts INT DEFAULT 0 NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          unbanned_at TIMESTAMPTZ,
          unbanned_by TEXT
        );
        CREATE INDEX IF NOT EXISTS idx_ip_blocks_ip ON ip_blocks(ip_address);

        CREATE TABLE IF NOT EXISTS ip_login_attempts (
          ip_address TEXT PRIMARY KEY,
          attempt_count INT DEFAULT 1 NOT NULL,
          first_attempt_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          last_attempt_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_ip_login_attempts_last_at ON ip_login_attempts(last_attempt_at);

        CREATE TABLE IF NOT EXISTS security_incidents (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          ip_address TEXT NOT NULL,
          event_type TEXT NOT NULL,
          details JSONB DEFAULT '{}'::jsonb NOT NULL,
          user_agent TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_security_incidents_ip ON security_incidents(ip_address);
        CREATE INDEX IF NOT EXISTS idx_security_incidents_created_at ON security_incidents(created_at);

        -- 5. Durable Robux Shared Pool, Ledger, Orders, and Reservations
        CREATE TABLE IF NOT EXISTS robux_stock (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          total_balance BIGINT DEFAULT 0 NOT NULL,
          reserved_balance BIGINT DEFAULT 0 NOT NULL,
          rate_per_1000 NUMERIC(10, 4) DEFAULT 3.5000 NOT NULL,
          min_order_robux BIGINT DEFAULT 100 NOT NULL,
          max_order_robux BIGINT DEFAULT 50000 NOT NULL,
          is_active BOOLEAN DEFAULT false NOT NULL,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS robux_stock_ledger (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          admin_id TEXT,
          delta_amount BIGINT NOT NULL,
          old_total BIGINT NOT NULL,
          new_total BIGINT NOT NULL,
          reason TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS robux_orders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_code TEXT UNIQUE NOT NULL,
          telegram_id TEXT NOT NULL,
          roblox_username TEXT NOT NULL,
          robux_amount BIGINT NOT NULL,
          price_usd NUMERIC(10, 2) NOT NULL,
          rate_per_1000 NUMERIC(10, 4) NOT NULL,
          status TEXT DEFAULT 'pending' NOT NULL,
          payment_id TEXT,
          payment_ref TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW(),
          fulfilled_at TIMESTAMPTZ,
          notes TEXT
        );

        CREATE TABLE IF NOT EXISTS robux_reservations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          order_code TEXT UNIQUE NOT NULL,
          robux_amount BIGINT NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- 6. Durable Group Announcements Tracking
        CREATE TABLE IF NOT EXISTS group_announcements (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          chat_id TEXT NOT NULL,
          telegram_message_id BIGINT,
          event_type TEXT NOT NULL,
          event_id TEXT NOT NULL UNIQUE,
          announcement_state TEXT NOT NULL,
          metadata JSONB DEFAULT '{}'::jsonb,
          retry_count INT DEFAULT 0 NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_group_announcements_event_id ON group_announcements(event_id);
      `);
      console.log('[Postgres] Schema verified and initialized successfully');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Postgres] initDatabase error:', err?.message || err);
  }
}
