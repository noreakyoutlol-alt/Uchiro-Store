import { pgPool, isPostgresConfigured } from '../database/postgres';
import { v4 as uuidv4 } from 'uuid';

export interface RobuxStockConfig {
  id?: string;
  total_balance: number;
  reserved_balance: number;
  rate_per_1000: number; // e.g. 3.5000 USD
  min_order_robux: number;
  max_order_robux: number;
  is_active: boolean;
  updated_at?: string;
}

export interface RobuxPackTier {
  denomination: number;
  price_usd: number;
  available_packs: number;
  is_sold_out: boolean;
  display_text: string;
}

export interface RobloxAccountInfo {
  userId: number;
  username: string;
  displayName: string;
  avatarUrl?: string;
  accountAgeDays?: number;
  createdDate?: string;
  isBanned?: boolean;
}

export interface RobuxOrder {
  id: string;
  order_code: string;
  telegram_id: string;
  roblox_username: string;
  roblox_user_id?: string;
  robux_amount: number;
  price_usd: number;
  rate_per_1000: number;
  status: 'pending' | 'reserved' | 'paid' | 'completed' | 'cancelled' | 'refunded';
  payment_id?: string;
  payment_ref?: string;
  created_at: string;
  updated_at: string;
  fulfilled_at?: string | null;
  notes?: string;
}

export class RobuxService {
  // Canonical supported Robux denominations
  public static readonly DENOMINATIONS: number[] = [
    100, 200, 400, 500, 800, 1000, 1700, 2000, 4500, 10000,
  ];

  // In-memory state for development / test harness
  private static memStock: RobuxStockConfig = {
    total_balance: 0,
    reserved_balance: 0,
    rate_per_1000: 3.50,
    min_order_robux: 100,
    max_order_robux: 10000,
    is_active: true,
  };
  private static memOrders = new Map<string, RobuxOrder>();
  private static memReservations = new Map<string, { orderCode: string; amount: number; expiresAt: number }>();
  private static memLedger: any[] = [];

  /**
   * Reset in-memory state (for tests)
   */
  static _resetForTesting(initialBalance: number = 0, rate: number = 3.50): void {
    this.memStock = {
      total_balance: initialBalance,
      reserved_balance: 0,
      rate_per_1000: rate,
      min_order_robux: 100,
      max_order_robux: 10000,
      is_active: true,
    };
    this.memOrders.clear();
    this.memReservations.clear();
    this.memLedger = [];
  }

  /**
   * Get current stock config from PostgreSQL or memory
   */
  static async getStockConfig(): Promise<RobuxStockConfig> {
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1`
        );
        if (rows.length > 0) {
          const r = rows[0];
          return {
            id: r.id,
            total_balance: Number(r.total_balance),
            reserved_balance: Number(r.reserved_balance),
            rate_per_1000: Number(r.rate_per_1000),
            min_order_robux: Number(r.min_order_robux),
            max_order_robux: Number(r.max_order_robux),
            is_active: Boolean(r.is_active),
            updated_at: r.updated_at,
          };
        }

        // Initialize default row if table is empty
        const initRes = await pgPool.query(
          `INSERT INTO robux_stock (total_balance, reserved_balance, rate_per_1000, min_order_robux, max_order_robux, is_active, updated_at)
           VALUES (0, 0, 3.5000, 100, 50000, true, NOW())
           RETURNING *`
        );
        const r = initRes.rows[0];
        return {
          id: r.id,
          total_balance: Number(r.total_balance),
          reserved_balance: Number(r.reserved_balance),
          rate_per_1000: Number(r.rate_per_1000),
          min_order_robux: Number(r.min_order_robux),
          max_order_robux: Number(r.max_order_robux),
          is_active: Boolean(r.is_active),
          updated_at: r.updated_at,
        };
      } catch (err: any) {
        console.warn('[RobuxService] getStockConfig DB error, using memory fallback:', err?.message);
      }
    }

    return { ...this.memStock };
  }

  /**
   * Calculate shared pool availability across all denominations.
   * available_packs(denomination) = floor(available_robux / denomination)
   */
  static calculateTiers(stock: RobuxStockConfig): RobuxPackTier[] {
    const availableRobux = Math.max(0, stock.total_balance - stock.reserved_balance);

    return this.DENOMINATIONS.map((denomination) => {
      // Calculate price using exact integer cents to eliminate JavaScript floating-point errors
      const price_cents = Math.round((denomination * stock.rate_per_1000 * 100) / 1000);
      const price_usd = price_cents / 100;
      const available_packs = Math.floor(availableRobux / denomination);
      const is_sold_out = available_packs <= 0;

      const display_text = is_sold_out
        ? `${denomination} R$ — SOLD OUT`
        : `${denomination} R$ — $${price_usd.toFixed(2)} (${available_packs} left)`;

      return {
        denomination,
        price_usd,
        available_packs,
        is_sold_out,
        display_text,
      };
    });
  }

  /**
   * Set or adjust total stock pool with audit ledger entry.
   */
  static async setStock(
    adminId: string,
    newTotal: number,
    reason: string
  ): Promise<RobuxStockConfig> {
    if (newTotal < 0 || !Number.isInteger(newTotal)) {
      throw new Error('INVALID_STOCK_AMOUNT: Total Robux must be a non-negative integer');
    }

    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`
        );

        let oldTotal = 0;
        let configId = '';

        if (rows.length > 0) {
          oldTotal = Number(rows[0].total_balance);
          configId = rows[0].id;
          await client.query(
            `UPDATE robux_stock SET total_balance = $1, updated_at = NOW() WHERE id = $2`,
            [newTotal, configId]
          );
        } else {
          const insertRes = await client.query(
            `INSERT INTO robux_stock (total_balance, reserved_balance, rate_per_1000, updated_at)
             VALUES ($1, 0, 3.5000, NOW()) RETURNING id`,
            [newTotal]
          );
          configId = insertRes.rows[0].id;
        }

        const delta = newTotal - oldTotal;
        await client.query(
          `INSERT INTO robux_stock_ledger (admin_id, delta_amount, old_total, new_total, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [adminId, delta, oldTotal, newTotal, reason]
        );

        await client.query('COMMIT');
        return this.getStockConfig();
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory update
    const oldTotal = this.memStock.total_balance;
    const delta = newTotal - oldTotal;
    this.memStock.total_balance = newTotal;
    this.memLedger.push({
      adminId,
      delta,
      oldTotal,
      newTotal,
      reason,
      createdAt: new Date().toISOString(),
    });

    return { ...this.memStock };
  }

  /**
   * Atomically add Robux stock to pool with audit ledger entry.
   */
  static async addStock(
    adminId: string,
    deltaAmount: number,
    reason: string
  ): Promise<RobuxStockConfig> {
    if (deltaAmount <= 0 || !Number.isInteger(deltaAmount)) {
      throw new Error('INVALID_DELTA: Added stock must be a positive integer');
    }

    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`
        );

        let newTotal = deltaAmount;
        let oldTotal = 0;
        let stockId = '';
        if (rows.length > 0) {
          stockId = rows[0].id;
          oldTotal = Number(rows[0].total_balance);
          newTotal = oldTotal + deltaAmount;
          await client.query(
            `UPDATE robux_stock SET total_balance = $1, updated_at = NOW() WHERE id = $2`,
            [newTotal, stockId]
          );
        } else {
          const insertRes = await client.query(
            `INSERT INTO robux_stock (total_balance, reserved_balance, rate_per_1000, is_active, updated_at)
             VALUES ($1, 0, 3.50, false, NOW()) RETURNING *`,
            [newTotal]
          );
          stockId = insertRes.rows[0].id;
        }

        await client.query(
          `INSERT INTO robux_stock_ledger (admin_id, delta_amount, old_total, new_total, reason, created_at)
           VALUES ($1, $2, $3, $4, $5, NOW())`,
          [adminId, deltaAmount, oldTotal, newTotal, reason]
        );

        await client.query('COMMIT');
        return this.getStockConfig();
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    const oldTotal = this.memStock.total_balance;
    this.memStock.total_balance += deltaAmount;
    this.memStock.updated_at = new Date().toISOString();
    this.memLedger.push({
      adminId,
      delta: deltaAmount,
      oldTotal,
      newTotal: this.memStock.total_balance,
      reason,
      createdAt: new Date().toISOString(),
    });
    return { ...this.memStock };
  }

  /**
   * Set Robux rate per 1,000 Robux with audit ledger entry.
   */
  static async setRate(
    adminId: string,
    newRate: number,
    reason: string
  ): Promise<RobuxStockConfig> {
    if (newRate <= 0 || isNaN(newRate)) {
      throw new Error('INVALID_RATE: Rate per 1000 Robux must be a positive number');
    }

    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`
        );

        if (rows.length > 0) {
          await client.query(
            `UPDATE robux_stock SET rate_per_1000 = $1, updated_at = NOW() WHERE id = $2`,
            [newRate, rows[0].id]
          );
        } else {
          await client.query(
            `INSERT INTO robux_stock (total_balance, reserved_balance, rate_per_1000, is_active, updated_at)
             VALUES (0, 0, $1, false, NOW())`,
            [newRate]
          );
        }

        await client.query(
          `INSERT INTO robux_stock_ledger (admin_id, delta_amount, old_total, new_total, reason, created_at)
           VALUES ($1, 0, 0, 0, $2, NOW())`,
          [adminId, `RATE_CHANGE_TO_${newRate}_REASON_${reason}`]
        );

        await client.query('COMMIT');
        return this.getStockConfig();
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    this.memStock.rate_per_1000 = newRate;
    this.memStock.updated_at = new Date().toISOString();
    this.memLedger.push({
      adminId,
      delta: 0,
      oldTotal: 0,
      newTotal: 0,
      reason: `RATE_CHANGE_TO_${newRate}_REASON_${reason}`,
      createdAt: new Date().toISOString(),
    });
    return { ...this.memStock };
  }

  /**
   * Update Robux settings (is_active, min_order_robux, max_order_robux).
   */
  static async updateSettings(
    adminId: string,
    settings: { is_active?: boolean; min_order_robux?: number; max_order_robux?: number },
    reason: string = 'ADMIN_SETTINGS_UPDATE'
  ): Promise<RobuxStockConfig> {
    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const { rows } = await client.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`
        );
        if (rows.length > 0) {
          const updates: string[] = [];
          const values: any[] = [];
          let idx = 1;

          if (typeof settings.is_active === 'boolean') {
            updates.push(`is_active = $${idx++}`);
            values.push(settings.is_active);
          }
          if (typeof settings.min_order_robux === 'number') {
            updates.push(`min_order_robux = $${idx++}`);
            values.push(settings.min_order_robux);
          }
          if (typeof settings.max_order_robux === 'number') {
            updates.push(`max_order_robux = $${idx++}`);
            values.push(settings.max_order_robux);
          }

          if (updates.length > 0) {
            updates.push(`updated_at = NOW()`);
            values.push(rows[0].id);
            await client.query(
              `UPDATE robux_stock SET ${updates.join(', ')} WHERE id = $${idx}`,
              values
            );
          }
        }

        await client.query(
          `INSERT INTO robux_stock_ledger (admin_id, delta_amount, old_total, new_total, reason, created_at)
           VALUES ($1, 0, 0, 0, $2, NOW())`,
          [adminId, reason]
        );

        await client.query('COMMIT');
        return this.getStockConfig();
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    if (typeof settings.is_active === 'boolean') this.memStock.is_active = settings.is_active;
    if (typeof settings.min_order_robux === 'number') this.memStock.min_order_robux = settings.min_order_robux;
    if (typeof settings.max_order_robux === 'number') this.memStock.max_order_robux = settings.max_order_robux;
    return { ...this.memStock };
  }

  /**
   * Get recent Robux orders for admin view.
   */
  static async getRecentOrders(limit: number = 10): Promise<RobuxOrder[]> {
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `SELECT * FROM robux_orders ORDER BY created_at DESC LIMIT $1`,
          [limit]
        );
        return rows as RobuxOrder[];
      } catch (err: any) {
        console.warn('[RobuxService] getRecentOrders DB error:', err?.message);
      }
    }
    return Array.from(this.memOrders.values())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  }

  /**
   * Atomic reservation of Robux stock during checkout.
   */
  static async reserveStock(
    orderCode: string,
    robuxAmount: number,
    ttlMinutes: number = 15
  ): Promise<boolean> {
    if (robuxAmount <= 0) return false;

    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');

        // Clean expired reservations first
        const expiredRes = await client.query(
          `DELETE FROM robux_reservations WHERE expires_at < NOW() RETURNING order_code, robux_amount`
        );
        for (const exp of expiredRes.rows) {
          await client.query(
            `UPDATE robux_stock SET reserved_balance = GREATEST(0, reserved_balance - $1), updated_at = NOW()`,
            [Number(exp.robux_amount)]
          );
        }

        const { rows } = await client.query(
          `SELECT * FROM robux_stock ORDER BY updated_at DESC LIMIT 1 FOR UPDATE`
        );
        if (rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        const total = Number(rows[0].total_balance);
        const reserved = Number(rows[0].reserved_balance);
        const available = total - reserved;

        if (available < robuxAmount) {
          await client.query('ROLLBACK');
          return false; // Insufficient stock
        }

        await client.query(
          `UPDATE robux_stock SET reserved_balance = reserved_balance + $1, updated_at = NOW() WHERE id = $2`,
          [robuxAmount, rows[0].id]
        );

        await client.query(
          `INSERT INTO robux_reservations (order_code, robux_amount, expires_at, created_at)
           VALUES ($1, $2, NOW() + ($3 || ' minutes')::INTERVAL, NOW())
           ON CONFLICT (order_code) DO NOTHING`,
          [orderCode, robuxAmount, ttlMinutes]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory reservation
    const now = Date.now();
    for (const [code, res] of Array.from(this.memReservations.entries())) {
      if (res.expiresAt < now) {
        this.memStock.reserved_balance = Math.max(0, this.memStock.reserved_balance - res.amount);
        this.memReservations.delete(code);
      }
    }

    const available = this.memStock.total_balance - this.memStock.reserved_balance;
    if (available < robuxAmount) {
      return false;
    }

    this.memStock.reserved_balance += robuxAmount;
    this.memReservations.set(orderCode, {
      orderCode,
      amount: robuxAmount,
      expiresAt: now + ttlMinutes * 60 * 1000,
    });
    return true;
  }

  /**
   * Release reserved stock if checkout is cancelled or expires.
   */
  static async releaseReservation(orderCode: string): Promise<void> {
    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');
        const res = await client.query(
          `DELETE FROM robux_reservations WHERE order_code = $1 RETURNING robux_amount`,
          [orderCode]
        );
        if (res.rows.length > 0) {
          const amount = Number(res.rows[0].robux_amount);
          await client.query(
            `UPDATE robux_stock SET reserved_balance = GREATEST(0, reserved_balance - $1), updated_at = NOW()`,
            [amount]
          );
        }
        await client.query('COMMIT');
      } catch (err) {
        await client.query('ROLLBACK');
        console.warn('[RobuxService] Error releasing reservation:', err);
      } finally {
        client.release();
      }
      return;
    }

    const res = this.memReservations.get(orderCode);
    if (res) {
      this.memStock.reserved_balance = Math.max(0, this.memStock.reserved_balance - res.amount);
      this.memReservations.delete(orderCode);
    }
  }

  /**
   * Commit deduction upon verified fulfillment by admin.
   */
  static async commitFulfillment(orderCode: string, adminId: string): Promise<boolean> {
    if (isPostgresConfigured()) {
      const client = await pgPool.connect();
      try {
        await client.query('BEGIN');

        // Check order
        const orderRes = await client.query(
          `SELECT * FROM robux_orders WHERE order_code = $1 FOR UPDATE`,
          [orderCode]
        );
        if (orderRes.rows.length === 0) {
          await client.query('ROLLBACK');
          return false;
        }

        const order = orderRes.rows[0];
        if (order.status === 'completed') {
          await client.query('COMMIT');
          return true; // Already fulfilled (idempotent)
        }

        const robuxAmount = Number(order.robux_amount);

        // Check if there was an active reservation
        const resRes = await client.query(
          `DELETE FROM robux_reservations WHERE order_code = $1 RETURNING robux_amount`,
          [orderCode]
        );
        const wasReserved = resRes.rows.length > 0;

        // Deduct from total balance, and from reserved balance if it was reserved
        if (wasReserved) {
          await client.query(
            `UPDATE robux_stock
             SET total_balance = GREATEST(0, total_balance - $1),
                 reserved_balance = GREATEST(0, reserved_balance - $1),
                 updated_at = NOW()`,
            [robuxAmount]
          );
        } else {
          await client.query(
            `UPDATE robux_stock
             SET total_balance = GREATEST(0, total_balance - $1),
                 updated_at = NOW()`,
            [robuxAmount]
          );
        }

        // Update order status
        await client.query(
          `UPDATE robux_orders
           SET status = 'completed', fulfilled_at = NOW(), updated_at = NOW()
           WHERE order_code = $1`,
          [orderCode]
        );

        // Ledger entry
        await client.query(
          `INSERT INTO robux_stock_ledger (admin_id, delta_amount, old_total, new_total, reason, created_at)
           VALUES ($1, $2, 0, 0, $3, NOW())`,
          [adminId, -robuxAmount, `FULFILLMENT_ORDER_${orderCode}`]
        );

        await client.query('COMMIT');
        return true;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    }

    // In-memory fulfillment
    const order = this.memOrders.get(orderCode);
    if (!order) return false;
    if (order.status === 'completed') return true;

    const amount = order.robux_amount;
    const res = this.memReservations.get(orderCode);
    if (res) {
      this.memStock.reserved_balance = Math.max(0, this.memStock.reserved_balance - amount);
      this.memReservations.delete(orderCode);
    }
    this.memStock.total_balance = Math.max(0, this.memStock.total_balance - amount);
    order.status = 'completed';
    order.fulfilled_at = new Date().toISOString();
    order.updated_at = new Date().toISOString();

    return true;
  }

  /**
   * Resolve public Roblox account information using Roblox's public API.
   * Safe public lookups only. Fails gracefully if user is not found or API is rate-limited.
   */
  static async resolveRobloxUser(username: string): Promise<RobloxAccountInfo | null> {
    const cleanUsername = username.trim();
    if (!cleanUsername) return null;

    try {
      // 1. Resolve Username to User ID via public endpoint
      const res = await fetch('https://users.roblox.com/v1/usernames/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ usernames: [cleanUsername], excludeBannedUsers: false }),
      });

      if (!res.ok) {
        console.warn(`[RobuxService] Roblox API lookup returned status: ${res.status}`);
        return null;
      }

      const data = (await res.json()) as any;
      const userObj = data?.data?.[0];
      if (!userObj || !userObj.id) {
        return null;
      }

      const userId = Number(userObj.id);
      const canonicalUsername = String(userObj.name);
      const displayName = String(userObj.displayName || canonicalUsername);

      // 2. Fetch Avatar Thumbnail
      let avatarUrl = '';
      try {
        const thumbRes = await fetch(
          `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=150x150&format=Png&isCircular=false`
        );
        if (thumbRes.ok) {
          const thumbData = (await thumbRes.json()) as any;
          avatarUrl = thumbData?.data?.[0]?.imageUrl || '';
        }
      } catch (err) {
        // Thumbnail failure is non-blocking
      }

      // 3. Fetch User Profile Details (Account Creation Date)
      let accountAgeDays = 0;
      let createdDate = '';
      try {
        const profileRes = await fetch(`https://users.roblox.com/v1/users/${userId}`);
        if (profileRes.ok) {
          const profileData = (await profileRes.json()) as any;
          if (profileData?.created) {
            createdDate = profileData.created;
            const createdMs = new Date(profileData.created).getTime();
            accountAgeDays = Math.max(0, Math.floor((Date.now() - createdMs) / (1000 * 60 * 60 * 24)));
          }
        }
      } catch (err) {
        // Profile detail failure is non-blocking
      }

      return {
        userId,
        username: canonicalUsername,
        displayName,
        avatarUrl,
        accountAgeDays,
        createdDate,
      };
    } catch (err: any) {
      console.warn('[RobuxService] Failed to resolve Roblox user:', err?.message);
      return null;
    }
  }

  /**
   * Create Robux Order with reservation
   */
  static async createOrder(params: {
    telegramId: string;
    robloxUsername: string;
    robloxUserId?: string;
    robuxAmount: number;
  }): Promise<{ success: boolean; order?: RobuxOrder; error?: string }> {
    const stock = await this.getStockConfig();
    const price_usd = Number(((params.robuxAmount / 1000) * stock.rate_per_1000).toFixed(2));
    const orderCode = `RBX-${Date.now().toString(36).toUpperCase()}-${Math.floor(1000 + Math.random() * 9000)}`;

    const reserved = await this.reserveStock(orderCode, params.robuxAmount, 15);
    if (!reserved) {
      return { success: false, error: 'INSUFFICIENT_ROBUX_STOCK' };
    }

    const order: RobuxOrder = {
      id: uuidv4(),
      order_code: orderCode,
      telegram_id: String(params.telegramId),
      roblox_username: params.robloxUsername,
      roblox_user_id: params.robloxUserId,
      robux_amount: params.robuxAmount,
      price_usd,
      rate_per_1000: stock.rate_per_1000,
      status: 'pending',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    if (isPostgresConfigured()) {
      try {
        await pgPool.query(
          `INSERT INTO robux_orders (id, order_code, telegram_id, roblox_username, robux_amount, price_usd, rate_per_1000, status, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW(), NOW())`,
          [
            order.id,
            order.order_code,
            order.telegram_id,
            order.roblox_username,
            order.robux_amount,
            order.price_usd,
            order.rate_per_1000,
            order.status,
          ]
        );
      } catch (err: any) {
        await this.releaseReservation(orderCode);
        return { success: false, error: 'DATABASE_ERROR' };
      }
    }

    this.memOrders.set(orderCode, order);
    return { success: true, order };
  }

  /**
   * Mark order paid after verified transaction
   */
  static async markOrderPaid(orderCode: string, paymentRef: string): Promise<RobuxOrder | null> {
    if (isPostgresConfigured()) {
      try {
        const { rows } = await pgPool.query(
          `UPDATE robux_orders
           SET status = 'paid', payment_ref = $2, updated_at = NOW()
           WHERE order_code = $1 AND status = 'pending'
           RETURNING *`,
          [orderCode, paymentRef]
        );
        if (rows.length > 0) {
          return rows[0] as RobuxOrder;
        }
      } catch (err: any) {
        console.warn('[RobuxService] markOrderPaid DB error:', err?.message);
      }
    }

    const order = this.memOrders.get(orderCode);
    if (order && order.status === 'pending') {
      order.status = 'paid';
      order.payment_ref = paymentRef;
      order.updated_at = new Date().toISOString();
      return order;
    }

    return null;
  }
}
