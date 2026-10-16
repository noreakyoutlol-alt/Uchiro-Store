import { pgPool, isPostgresConfigured } from '../database/postgres';
import { env } from '../config/env';

export interface IpBlockRecord {
  id: string;
  ip_address: string;
  reason: string;
  blocked_until: string | null;
  is_permanent: boolean;
  failed_attempts: number;
  created_at: string;
  updated_at: string;
  unbanned_at: string | null;
  unbanned_by: string | null;
}

export interface SecurityIncident {
  id: string;
  ip_address: string;
  event_type: string;
  details: Record<string, any>;
  user_agent: string | null;
  created_at: string;
}

interface AttemptTracker {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
}

export class IpSecurityService {
  private static MAX_ATTEMPTS = Number(process.env.ADMIN_LOGIN_MAX_ATTEMPTS || 5);
  private static WINDOW_SECONDS = Number(process.env.ADMIN_LOGIN_WINDOW_SECONDS || 900); // 15 mins
  private static BLOCK_SECONDS = Number(process.env.ADMIN_IP_BLOCK_SECONDS || 3600); // 1 hour

  // Ultra-fast in-memory lookup cache
  private static activeBlocksCache = new Map<string, IpBlockRecord>();
  private static attemptCache = new Map<string, AttemptTracker>();
  private static inMemoryIncidents: SecurityIncident[] = [];
  private static isInitialized = false;

  private static isProduction(): boolean {
    return process.env.NODE_ENV === 'production' || env.NODE_ENV === 'production';
  }

  /**
   * Normalize IP addresses for consistent matching across IPv4, IPv6, proxies, and localhost.
   */
  static normalizeIp(ip: string | undefined): string {
    if (!ip) return '127.0.0.1';
    let clean = ip.trim();

    // If forwarded header has comma-separated list, take the first client IP
    if (clean.includes(',')) {
      clean = clean.split(',')[0].trim();
    }

    // Convert IPv6 loopback and mapped IPv4 to standard IPv4
    if (clean === '::1' || clean === '::ffff:127.0.0.1') {
      return '127.0.0.1';
    }
    if (clean.startsWith('::ffff:')) {
      clean = clean.replace('::ffff:', '');
    }

    return clean;
  }

  /**
   * Initialize in-memory cache from PostgreSQL on startup.
   */
  static async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    if (!isPostgresConfigured()) {
      if (this.isProduction()) {
        console.error('[IpSecurity] CRITICAL: DATABASE_URL not set in production! Security state requires PostgreSQL.');
        throw new Error('SECURITY_STORAGE_UNAVAILABLE: DATABASE_URL must be configured in production');
      }
      console.log('[IpSecurity] Initialized with in-memory storage (development/test mode)');
      return;
    }

    try {
      const now = new Date().toISOString();
      const { rows } = await pgPool.query(
        `SELECT * FROM ip_blocks
         WHERE unbanned_at IS NULL
           AND (is_permanent = true OR blocked_until > $1)`,
        [now]
      );

      for (const row of rows) {
        this.activeBlocksCache.set(row.ip_address, row);
      }
      console.log(`[IpSecurity] Loaded ${rows.length} active IP blocks from PostgreSQL`);
    } catch (err: any) {
      console.error('[IpSecurity] Failed to load blocks from PostgreSQL:', err?.message);
      if (this.isProduction()) {
        throw new Error(`SECURITY_STORAGE_FAILED: Cannot initialize security state from PostgreSQL: ${err?.message}`);
      }
    }
  }

  /**
   * Synchronous check for blocked status (uses activeBlocksCache).
   */
  static isIpBlocked(rawIp: string): {
    blocked: boolean;
    reason?: string;
    blockedUntil?: string | null;
    isPermanent?: boolean;
    retryAfterSeconds?: number;
  } {
    const ip = this.normalizeIp(rawIp);
    const record = this.activeBlocksCache.get(ip);

    if (!record) {
      return { blocked: false };
    }

    if (record.unbanned_at) {
      this.activeBlocksCache.delete(ip);
      return { blocked: false };
    }

    if (record.is_permanent) {
      return {
        blocked: true,
        reason: record.reason,
        blockedUntil: null,
        isPermanent: true,
        retryAfterSeconds: 86400,
      };
    }

    if (record.blocked_until) {
      const expiresAt = new Date(record.blocked_until).getTime();
      const now = Date.now();
      if (now < expiresAt) {
        const retryAfterSeconds = Math.max(1, Math.ceil((expiresAt - now) / 1000));
        return {
          blocked: true,
          reason: record.reason,
          blockedUntil: record.blocked_until,
          isPermanent: false,
          retryAfterSeconds,
        };
      } else {
        // Expired block
        this.activeBlocksCache.delete(ip);
      }
    }

    return { blocked: false };
  }

  /**
   * Asynchronous check for blocked status.
   * Checks local cache first; if not found, queries PostgreSQL for cross-instance consistency.
   */
  static async isIpBlockedAsync(rawIp: string): Promise<{
    blocked: boolean;
    reason?: string;
    blockedUntil?: string | null;
    isPermanent?: boolean;
    retryAfterSeconds?: number;
  }> {
    const ip = this.normalizeIp(rawIp);
    const cached = this.isIpBlocked(ip);
    if (cached.blocked) {
      return cached;
    }

    // If PostgreSQL configured, check database for blocks placed by other server instances
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT * FROM ip_blocks
           WHERE ip_address = $1
             AND unbanned_at IS NULL
             AND (is_permanent = true OR blocked_until > NOW())
           LIMIT 1`,
          [ip]
        );

        if (rows.length > 0) {
          const row = rows[0] as IpBlockRecord;
          this.activeBlocksCache.set(ip, row);
          return this.isIpBlocked(ip);
        }
      } catch (err: any) {
        console.warn('[IpSecurity] PostgreSQL isIpBlocked query error:', err?.message);
        if (this.isProduction()) {
          // In production, when database error occurs during security verification, fail safely
          return {
            blocked: true,
            reason: 'Security verification temporarily degraded. Please try again shortly.',
            retryAfterSeconds: 30,
          };
        }
      }
    }

    return { blocked: false };
  }

  /**
   * Record a failed admin login attempt. Automatically bans IP if threshold is reached.
   * Persists attempts in PostgreSQL when available so counters survive restarts and sync across instances.
   */
  static async recordFailedAttempt(
    rawIp: string,
    userAgent?: string,
    reason: string = 'INVALID_PIN'
  ): Promise<{ blocked: boolean; attempts: number; maxAttempts: number; remainingAttempts: number }> {
    const ip = this.normalizeIp(rawIp);
    const now = Date.now();
    const windowMs = this.WINDOW_SECONDS * 1000;
    let attemptCount = 1;

    // 1. In-memory tracking
    let tracker = this.attemptCache.get(ip);
    if (!tracker || now - tracker.firstAttemptAt > windowMs) {
      tracker = { count: 1, firstAttemptAt: now, lastAttemptAt: now };
    } else {
      tracker.count += 1;
      tracker.lastAttemptAt = now;
    }
    this.attemptCache.set(ip, tracker);
    attemptCount = tracker.count;

    // 2. Durable PostgreSQL tracking (cross-instance & restart safe)
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `INSERT INTO ip_login_attempts (ip_address, attempt_count, first_attempt_at, last_attempt_at, updated_at)
           VALUES ($1, 1, NOW(), NOW(), NOW())
           ON CONFLICT (ip_address)
           DO UPDATE SET
             attempt_count = CASE
               WHEN NOW() - ip_login_attempts.first_attempt_at > ($2 || ' seconds')::interval THEN 1
               ELSE ip_login_attempts.attempt_count + 1
             END,
             first_attempt_at = CASE
               WHEN NOW() - ip_login_attempts.first_attempt_at > ($2 || ' seconds')::interval THEN NOW()
               ELSE ip_login_attempts.first_attempt_at
             END,
             last_attempt_at = NOW(),
             updated_at = NOW()
           RETURNING attempt_count`,
          [ip, this.WINDOW_SECONDS]
        );

        if (rows.length > 0 && rows[0].attempt_count !== undefined) {
          attemptCount = Number(rows[0].attempt_count);
          tracker.count = attemptCount;
          this.attemptCache.set(ip, tracker);
        }
      } catch (err: any) {
        console.error('[IpSecurity] Failed to persist login attempt to PostgreSQL:', err?.message);
        if (this.isProduction()) {
          throw new Error('SECURITY_STORAGE_ERROR: Failed to persist failed login counter');
        }
      }
    } else if (this.isProduction()) {
      throw new Error('SECURITY_STORAGE_UNAVAILABLE: Durable storage required in production');
    }

    // 3. Record incident
    await this.logIncident({
      ip_address: ip,
      event_type: 'FAILED_ADMIN_LOGIN',
      details: { attempts: attemptCount, reason },
      user_agent: userAgent || null,
    });

    // 4. Check threshold
    const remainingAttempts = Math.max(0, this.MAX_ATTEMPTS - attemptCount);
    if (attemptCount >= this.MAX_ATTEMPTS) {
      const blockUntil = new Date(now + this.BLOCK_SECONDS * 1000).toISOString();
      const blockReason = `Exceeded maximum failed attempts (${attemptCount}/${this.MAX_ATTEMPTS})`;

      await this.applyBlock({
        ip,
        reason: blockReason,
        blockedUntil: blockUntil,
        isPermanent: false,
        failedAttempts: attemptCount,
      });

      return { blocked: true, attempts: attemptCount, maxAttempts: this.MAX_ATTEMPTS, remainingAttempts: 0 };
    }

    return { blocked: false, attempts: attemptCount, maxAttempts: this.MAX_ATTEMPTS, remainingAttempts };
  }

  /**
   * Record a successful login and clear failed attempts for this IP.
   */
  static async recordSuccessfulLogin(rawIp: string, userAgent?: string): Promise<void> {
    const ip = this.normalizeIp(rawIp);
    this.attemptCache.delete(ip);

    if (isPostgresConfigured()) {
      try {
        await pgPool.query('DELETE FROM ip_login_attempts WHERE ip_address = $1', [ip]);
      } catch (err: any) {
        console.warn('[IpSecurity] Failed to clear login attempts in PostgreSQL:', err?.message);
      }
    }

    await this.logIncident({
      ip_address: ip,
      event_type: 'SUCCESSFUL_ADMIN_LOGIN',
      details: { timestamp: new Date().toISOString() },
      user_agent: userAgent || null,
    });
  }

  /**
   * Apply an IP block (persisted to PostgreSQL and updated in cache).
   */
  static async applyBlock(params: {
    ip: string;
    reason: string;
    blockedUntil?: string | null;
    isPermanent?: boolean;
    failedAttempts?: number;
    adminUser?: string;
  }): Promise<IpBlockRecord> {
    const ip = this.normalizeIp(params.ip);
    const nowIso = new Date().toISOString();
    const id = `block-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const record: IpBlockRecord = {
      id,
      ip_address: ip,
      reason: params.reason,
      blocked_until: params.isPermanent ? null : (params.blockedUntil || new Date(Date.now() + this.BLOCK_SECONDS * 1000).toISOString()),
      is_permanent: Boolean(params.isPermanent),
      failed_attempts: params.failedAttempts || 0,
      created_at: nowIso,
      updated_at: nowIso,
      unbanned_at: null,
      unbanned_by: null,
    };

    // Update memory cache immediately
    this.activeBlocksCache.set(ip, record);

    // Persist to PostgreSQL
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `INSERT INTO ip_blocks (ip_address, reason, blocked_until, is_permanent, failed_attempts, created_at, updated_at, unbanned_at, unbanned_by)
           VALUES ($1, $2, $3, $4, $5, NOW(), NOW(), NULL, NULL)
           ON CONFLICT (ip_address) DO UPDATE SET
             reason = $2,
             blocked_until = $3,
             is_permanent = $4,
             failed_attempts = $5,
             updated_at = NOW(),
             unbanned_at = NULL,
             unbanned_by = NULL
           RETURNING *`,
          [
            ip,
            record.reason,
            record.blocked_until,
            record.is_permanent,
            record.failed_attempts,
          ]
        );

        if (rows[0]) {
          const persisted = rows[0] as IpBlockRecord;
          this.activeBlocksCache.set(ip, persisted);
        }
      } catch (err: any) {
        console.error('[IpSecurity] Failed to persist block to PostgreSQL:', err?.message);
        if (this.isProduction()) {
          throw new Error(`SECURITY_STORAGE_FAILED: Cannot persist IP block to PostgreSQL: ${err?.message}`);
        }
      }
    } else if (this.isProduction()) {
      throw new Error('SECURITY_STORAGE_UNAVAILABLE: Durable storage required in production');
    }

    // Log security incident
    await this.logIncident({
      ip_address: ip,
      event_type: params.isPermanent ? 'IP_PERMANENTLY_BANNED' : 'IP_TEMPORARILY_BLOCKED',
      details: {
        reason: record.reason,
        blockedUntil: record.blocked_until,
        adminUser: params.adminUser || 'SYSTEM',
        failedAttempts: record.failed_attempts,
      },
      user_agent: null,
    });

    return record;
  }

  /**
   * Unban an IP address.
   */
  static async unbanIp(rawIp: string, adminUser: string = 'admin'): Promise<boolean> {
    const ip = this.normalizeIp(rawIp);
    const existing = this.activeBlocksCache.get(ip);
    this.activeBlocksCache.delete(ip);
    this.attemptCache.delete(ip);

    if (isPostgresConfigured()) {
      try {
        await pgPool.query(
          `UPDATE ip_blocks
           SET unbanned_at = NOW(),
               unbanned_by = $2,
               updated_at = NOW()
           WHERE ip_address = $1`,
          [ip, adminUser]
        );
        await pgPool.query('DELETE FROM ip_login_attempts WHERE ip_address = $1', [ip]);
      } catch (err: any) {
        console.error('[IpSecurity] Failed to unban IP in PostgreSQL:', err?.message);
        if (this.isProduction()) {
          throw new Error(`SECURITY_STORAGE_FAILED: Cannot unban IP in PostgreSQL: ${err?.message}`);
        }
      }
    } else if (this.isProduction()) {
      throw new Error('SECURITY_STORAGE_UNAVAILABLE: Durable storage required in production');
    }

    await this.logIncident({
      ip_address: ip,
      event_type: 'IP_UNBANNED',
      details: { adminUser, previousReason: existing?.reason },
      user_agent: null,
    });

    return true;
  }

  /**
   * Log a security incident to PostgreSQL and memory.
   */
  static async logIncident(incident: {
    ip_address: string;
    event_type: string;
    details: Record<string, any>;
    user_agent: string | null;
  }): Promise<void> {
    const fullIncident: SecurityIncident = {
      id: `sec-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      ip_address: incident.ip_address,
      event_type: incident.event_type,
      details: incident.details,
      user_agent: incident.user_agent,
      created_at: new Date().toISOString(),
    };

    this.inMemoryIncidents.unshift(fullIncident);
    if (this.inMemoryIncidents.length > 500) {
      this.inMemoryIncidents.pop();
    }

    if (isPostgresConfigured()) {
      try {
        await pgPool.query(
          `INSERT INTO security_incidents (ip_address, event_type, details, user_agent, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [
            incident.ip_address,
            incident.event_type,
            JSON.stringify(incident.details),
            incident.user_agent,
          ]
        );
      } catch (err: any) {
        console.warn('[IpSecurity] Failed to write incident to PostgreSQL:', err?.message);
      }
    }
  }

  /**
   * List all IP blocks with filtering and pagination.
   */
  static async listBans(filter?: {
    status?: 'all' | 'active' | 'expired' | 'unbanned';
    search?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ blocks: IpBlockRecord[]; total: number }> {
    const limit = Math.min(Math.max(1, filter?.limit || 50), 200);
    const offset = Math.max(0, filter?.offset || 0);

    if (isPostgresConfigured()) {
      try {
        let whereClause = '1=1';
        const params: any[] = [];
        let pIdx = 1;

        if (filter?.status === 'active') {
          whereClause += ` AND unbanned_at IS NULL AND (is_permanent = true OR blocked_until > NOW())`;
        } else if (filter?.status === 'expired') {
          whereClause += ` AND unbanned_at IS NULL AND is_permanent = false AND blocked_until <= NOW()`;
        } else if (filter?.status === 'unbanned') {
          whereClause += ` AND unbanned_at IS NOT NULL`;
        }

        if (filter?.search) {
          whereClause += ` AND (ip_address ILIKE $${pIdx} OR reason ILIKE $${pIdx})`;
          params.push(`%${filter.search}%`);
          pIdx++;
        }

        const countRes = await pgPool.query(`SELECT COUNT(*) FROM ip_blocks WHERE ${whereClause}`, params);
        const total = parseInt(countRes.rows[0]?.count || '0', 10);

        params.push(limit);
        params.push(offset);
        const { rows } = await pgPool.query(
          `SELECT * FROM ip_blocks WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
          params
        );

        return { blocks: rows as IpBlockRecord[], total };
      } catch (err: any) {
        console.warn('[IpSecurity] PostgreSQL listBans query failed:', err?.message);
      }
    }

    // In-memory fallback for test environments
    let list = Array.from(this.activeBlocksCache.values());
    if (filter?.search) {
      const q = filter.search.toLowerCase();
      list = list.filter((b) => b.ip_address.includes(q) || b.reason.toLowerCase().includes(q));
    }
    const total = list.length;
    const blocks = list.slice(offset, offset + limit);
    return { blocks, total };
  }

  /**
   * List recent security incidents with pagination.
   */
  static async listIncidents(params?: {
    ip?: string;
    eventType?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ incidents: SecurityIncident[]; total: number }> {
    const limit = Math.min(Math.max(1, params?.limit || 50), 200);
    const offset = Math.max(0, params?.offset || 0);

    if (isPostgresConfigured()) {
      try {
        let whereClause = '1=1';
        const qParams: any[] = [];
        let pIdx = 1;

        if (params?.ip) {
          whereClause += ` AND ip_address = $${pIdx}`;
          qParams.push(this.normalizeIp(params.ip));
          pIdx++;
        }
        if (params?.eventType) {
          whereClause += ` AND event_type = $${pIdx}`;
          qParams.push(params.eventType);
          pIdx++;
        }

        const countRes = await pgPool.query(`SELECT COUNT(*) FROM security_incidents WHERE ${whereClause}`, qParams);
        const total = parseInt(countRes.rows[0]?.count || '0', 10);

        qParams.push(limit);
        qParams.push(offset);
        const { rows } = await pgPool.query(
          `SELECT * FROM security_incidents WHERE ${whereClause} ORDER BY created_at DESC LIMIT $${pIdx} OFFSET $${pIdx + 1}`,
          qParams
        );

        return { incidents: rows as SecurityIncident[], total };
      } catch (err: any) {
        console.warn('[IpSecurity] PostgreSQL listIncidents query failed:', err?.message);
      }
    }

    let filtered = this.inMemoryIncidents;
    if (params?.ip) {
      filtered = filtered.filter((i) => i.ip_address === this.normalizeIp(params.ip));
    }
    if (params?.eventType) {
      filtered = filtered.filter((i) => i.event_type === params.eventType);
    }
    return {
      incidents: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  }

  /**
   * Alias for listIncidents used by admin route handlers.
   */
  static async getAuditLogs(params?: { limit?: number; offset?: number }): Promise<{ logs: SecurityIncident[]; total: number }> {
    const res = await this.listIncidents(params);
    return { logs: res.incidents, total: res.total };
  }

  /**
   * Return high-level security stats.
   */
  static async getStats(): Promise<{
    activeBlocks: number;
    totalBlocks: number;
    totalIncidents: number;
    maxAttempts: number;
    windowMinutes: number;
    blockHours: number;
  }> {
    let activeBlocks = this.activeBlocksCache.size;
    let totalBlocks = activeBlocks;
    let totalIncidents = this.inMemoryIncidents.length;

    if (isPostgresConfigured()) {
      try {
        const aRes = await pgPool.query(
          `SELECT COUNT(*) FROM ip_blocks WHERE unbanned_at IS NULL AND (is_permanent = true OR blocked_until > NOW())`
        );
        const bRes = await pgPool.query('SELECT COUNT(*) FROM ip_blocks');
        const iRes = await pgPool.query('SELECT COUNT(*) FROM security_incidents');
        activeBlocks = parseInt(aRes.rows[0]?.count || '0', 10);
        totalBlocks = parseInt(bRes.rows[0]?.count || '0', 10);
        totalIncidents = parseInt(iRes.rows[0]?.count || '0', 10);
      } catch {}
    }

    return {
      activeBlocks,
      totalBlocks,
      totalIncidents,
      maxAttempts: this.MAX_ATTEMPTS,
      windowMinutes: Math.round(this.WINDOW_SECONDS / 60),
      blockHours: Math.round(this.BLOCK_SECONDS / 3600),
    };
  }

  /**
   * Reset all in-memory caches and state (used in testing).
   */
  static _resetForTesting(): void {
    this.activeBlocksCache.clear();
    this.attemptCache.clear();
    this.inMemoryIncidents = [];
    this.isInitialized = false;
  }
}
