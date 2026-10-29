import { describe, it, expect, vi, beforeEach, afterAll } from 'vitest';
import { DataStore } from '../database/data-store';
import { pgPool, initDatabase } from '../database/postgres';
import { isAuthorizedAdmin } from '../bots/admin-bot/admin-guards';
import { getAdminIds } from '../auth/telegram';

describe('Postgres Deploy No Reset & Durable User/Admin State', () => {
  const origDbUrl = process.env.DATABASE_URL;

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.DATABASE_URL = 'postgresql://localhost:5432/uchiro_test';
  });

  afterAll(() => {
    if (origDbUrl) {
      process.env.DATABASE_URL = origDbUrl;
    } else {
      delete process.env.DATABASE_URL;
    }
  });

  it('syncAllFromPostgres loads all users into memory preserving points and streak', async () => {
    // Mock pgPool query returning persistent users
    const mockUsers = [
      {
        id: 'user-uuid-1',
        telegram_id: '12345678',
        username: 'testcustomer',
        first_name: 'Test Customer',
        last_name: null,
        photo_url: null,
        language_code: 'km',
        language_preference: 'km',
        points: 450,
        streak_count: 5,
        gacha_tickets: 2,
        last_daily_claim_at: new Date(Date.now() - 3600000).toISOString(),
        role: 'customer',
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      {
        id: 'user-uuid-2',
        telegram_id: '87654321',
        username: 'vip_player',
        first_name: 'VIP Player',
        last_name: null,
        photo_url: null,
        language_code: 'en',
        language_preference: 'en',
        points: 1200,
        streak_count: 7,
        gacha_tickets: 5,
        last_daily_claim_at: new Date(Date.now() - 7200000).toISOString(),
        role: 'customer',
        is_blocked: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ];

    const mockAdmins = [
      {
        id: 'admin-uuid-1',
        telegram_id: '999888777',
        username: 'lead_store_admin',
        display_name: 'Lead Store Admin',
        role: 'superadmin',
        is_active: true,
        last_login_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      },
    ];

    vi.spyOn(pgPool, 'query').mockImplementation(async (queryText: any) => {
      const sql = typeof queryText === 'string' ? queryText : queryText?.text || '';
      if (sql.includes('FROM users')) {
        return { rows: mockUsers } as any;
      }
      if (sql.includes('FROM admin_users')) {
        return { rows: mockAdmins } as any;
      }
      if (sql.includes('app_settings')) {
        return { rows: [{ value: { active_theme: 'gaming' } }] } as any;
      }
      return { rows: [] } as any;
    });

    // Run the startup sync
    await DataStore.syncAllFromPostgres();

    // Verify customer 1 is loaded with points intact
    const user1 = DataStore.getTelegramUser(12345678);
    expect(user1).toBeDefined();
    expect(user1?.points).toBe(450);
    expect(user1?.streak_count).toBe(5);
    expect(user1?.gacha_tickets).toBe(2);

    // Verify customer 2 is loaded with points intact
    const user2 = DataStore.getTelegramUser(87654321);
    expect(user2).toBeDefined();
    expect(user2?.points).toBe(1200);
    expect(user2?.streak_count).toBe(7);

    // Verify admin list in admin dashboard
    const allUsersAdmin = DataStore.getAllUsersAdmin();
    expect(allUsersAdmin.some((u) => u.user.telegram_id === 12345678)).toBe(true);
    expect(allUsersAdmin.some((u) => u.user.telegram_id === 87654321)).toBe(true);

    // Verify admin user is preserved
    const adminUsers = DataStore.getAdminUsers();
    expect(adminUsers.some((a) => a.telegram_id === 999888777)).toBe(true);
    expect(isAuthorizedAdmin('999888777')).toBe(true);
    expect(getAdminIds().has('999888777')).toBe(true);
  });

  it('findOrCreateTelegramUser preserves existing points and never overwrites with 0', () => {
    // Existing user in store
    const userBefore = DataStore.getTelegramUser(12345678);
    expect(userBefore?.points).toBe(450);

    // User interacts with bot or store again
    const { user, profile } = DataStore.findOrCreateTelegramUser({
      telegram_id: 12345678,
      first_name: 'Updated Name',
      username: 'testcustomer_updated',
    });

    expect(user.points).toBe(450);
    expect(profile.points).toBe(450);
    expect(user.first_name).toBe('Updated Name');
  });

  it('setUserLanguagePreference updates language and preserves points', () => {
    const updated = DataStore.setUserLanguagePreference(12345678, 'en');
    expect(updated?.language_preference).toBe('en');
    expect(updated?.points).toBe(450);
  });

  it('initDatabase executes additive migrations without dropping tables or wiping data', async () => {
    const executedQueries: string[] = [];
    const mockClient = {
      query: vi.fn(async (sql: string, params?: any[]) => {
        executedQueries.push(sql);
        return { rows: [] };
      }),
      release: vi.fn(),
    };

    vi.spyOn(pgPool, 'connect').mockResolvedValue(mockClient as any);

    process.env.ADMIN_TELEGRAM_USER_IDS = '555666777';
    await initDatabase();

    // Verify connect and release were called cleanly
    expect(mockClient.release).toHaveBeenCalled();

    // Verify all tables use CREATE TABLE IF NOT EXISTS
    const ddl = executedQueries.join('\n');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS users');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS admin_users');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS orders');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS products');
    expect(ddl).toContain('CREATE TABLE IF NOT EXISTS inventory');

    // Verify additive column migrations for users
    expect(ddl).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS last_name TEXT');
    expect(ddl).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS photo_url TEXT');
    expect(ddl).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS language_code TEXT');
    expect(ddl).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS language_preference TEXT');
    expect(ddl).toContain('ALTER TABLE users ADD COLUMN IF NOT EXISTS extra JSONB');

    // Verify ABSOLUTELY NO destructive statements
    expect(ddl).not.toContain('DROP TABLE');
    expect(ddl).not.toContain('TRUNCATE');
    expect(ddl).not.toContain('DELETE FROM users');
    expect(ddl).not.toContain('DELETE FROM admin_users');

    // Verify admin accounts were safely seeded with ON CONFLICT DO UPDATE
    expect(ddl).toContain('INSERT INTO admin_users');
    expect(ddl).toContain('ON CONFLICT (telegram_id) DO UPDATE SET is_active = true');
    expect(ddl).toContain('INSERT INTO users');
    expect(ddl).toContain('ON CONFLICT (telegram_id) DO UPDATE SET role = \'superadmin\'');
  });
});
