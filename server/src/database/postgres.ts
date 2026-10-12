import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL;
const isRailwayInternal = Boolean(connectionString?.includes('railway.internal'));

export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isRailwayInternal ? false : (connectionString ? { rejectUnauthorized: false } : undefined),
});

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '');
}

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

        INSERT INTO users (telegram_id, username, role, points, streak_count)
        VALUES ('6594079594', 'Noreakyout', 'admin', 500, 1)
        ON CONFLICT (telegram_id) DO UPDATE SET role = 'admin';
      `);
      console.log('[Postgres] Schema verified and initialized successfully');
    } finally {
      client.release();
    }
  } catch (err: any) {
    console.error('[Postgres] initDatabase error:', err?.message || err);
  }
}
