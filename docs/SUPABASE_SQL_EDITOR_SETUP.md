# Supabase SQL Editor Deployment Guide — Uchiro Store V3

This guide provides step-by-step instructions for deploying or updating the complete database schema for **Uchiro Store V3** using the Supabase Web Dashboard's SQL Editor.

The consolidated script is located at:
`supabase/SQL_EDITOR_UCHIRO_V3.sql`

---

## 1. Safety & Idempotency Guarantees

Before running the script, review these production safety characteristics:

* **Zero Destructive Actions**: The script **does NOT** run `DROP DATABASE`, `DROP SCHEMA`, or `TRUNCATE`.
* **Data Preservation**: Existing customer profiles, orders, inventory items, coupon wallets, and gacha records are completely preserved.
* **Full Idempotency**: All tables use `CREATE TABLE IF NOT EXISTS`, all columns use `ALTER TABLE ... ADD COLUMN IF NOT EXISTS`, and all indexes use `CREATE INDEX IF NOT EXISTS`.
* **Safe Trigger & Policy Updates**: Replaces triggers and Row Level Security (RLS) policies cleanly without table locks or data loss.
* **Safe Configuration Upserts**: Default settings and categories use `ON CONFLICT DO UPDATE` or `ON CONFLICT DO NOTHING`.
* **Zero Real Secrets**: The file contains no real bot tokens, no real Telegram API secrets, no real KHPay keys, and no real account credentials.

---

## 2. Step-by-Step Deployment Instructions

### Step 1: Log in to Supabase Dashboard
1. Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard) in your browser.
2. Sign in with your Supabase credentials.

### Step 2: Open Your Uchiro Store V3 Project
1. In the **Projects** list, click on your **Uchiro Store V3** project.
2. Ensure you are in the correct environment (Production, Staging, or Development).

### Step 3: Open the SQL Editor
1. In the left navigation sidebar, click on the **SQL Editor** icon (represented by the `>_` or terminal/query icon).

### Step 4: Create a New Query
1. At the top of the SQL Editor screen, click the **+ New query** button.
2. Name the query tab (optional, e.g., `Uchiro V3 Complete Schema Setup`).

### Step 5: Copy the Script Contents
1. On your local machine, open `supabase/SQL_EDITOR_UCHIRO_V3.sql`.
2. Select the entire contents of the file (`Ctrl + A` or `Cmd + A`) and copy it (`Ctrl + C` or `Cmd + C`).

### Step 6: Paste into Supabase SQL Editor
1. Click into the query editor text area in your browser.
2. Paste the script contents (`Ctrl + V` or `Cmd + V`).

### Step 7: Execute the Query
1. Click the green **Run** button (or press `Ctrl + Enter` / `Cmd + Enter`).
2. Wait for the query to finish executing (typically 5 to 15 seconds).

### Step 8: Check Query Output & Results
1. In the bottom results pane, verify that Supabase displays **Success** with query results.
2. The bottom of the script executes 4 read-only verification queries:
   * **Table Count**: Confirms all 30 Uchiro Store V3 tables exist.
   * **Column Verification**: Confirms delivery, authenticator vault, warranty, and points columns.
   * **App Settings**: Displays current point economy, cooldowns, and tier configurations.
   * **Row Level Security (RLS)**: Verifies that RLS is `true` across all sensitive tables.

### Step 9: Restart the Backend Server
Once the SQL script has executed successfully in Supabase:
1. If running locally or in development:
   ```bash
   npm run dev:server
   ```
2. If running via PM2 or Docker in production:
   ```bash
   pm2 restart uchiro-server
   # or
   docker compose restart server
   ```
3. Check the server startup logs to confirm healthy database connection:
   ```
   [Database] Supabase connected successfully
   [Uchiro Server] Listening on port 5000
   ```

---

## 3. Database Schema Overview (30 Core Tables)

The script provisions and harmonizes all 30 tables used by Uchiro Store V3:

| # | Table Name | Purpose | Key Security Rules |
|---|---|---|---|
| 1 | `telegram_users` | Customer Telegram identity records | Customer isolated (Telegram ID claim) |
| 2 | `profiles` | Points, tickets, total spent, stats | Customer isolated (Telegram ID claim) |
| 3 | `categories` | Product categories with icons & sort | Public read (active only) |
| 4 | `products` | Accounts, items, warranties, pricing | Public read (active & non-draft) |
| 5 | `product_media` | Image and banner gallery URLs | Public read |
| 6 | `product_variants` | Product SKU variations | Public read |
| 7 | `inventory_items` | Digital account credentials & TOTP | **RESTRICTED** (Service Role only) |
| 8 | `inventory_reservations` | 10-minute cart reservation locks | **RESTRICTED** (Service Role only) |
| 9 | `coupons` | General discount codes & user wallet | Public general / Customer own wallet |
| 10 | `coupon_redemptions` | Usage log of redeemed coupons | Customer isolated |
| 11 | `orders` | Order lifecycle, warranty, credentials | Customer isolated (Telegram ID claim) |
| 12 | `order_items` | Line items per order | Customer isolated via order ownership |
| 13 | `payments` | KHQR / Bakong / KHPay payment records | Customer isolated via order ownership |
| 14 | `payment_attempts` | Raw transaction callback logs | **RESTRICTED** (Service Role only) |
| 15 | `payment_events` | Webhook verification event history | **RESTRICTED** (Service Role only) |
| 16 | `point_ledger` | Double-entry point transaction audit | Customer isolated (Telegram ID claim) |
| 17 | `daily_rewards` | Daily claim check-ins & streaks | Customer isolated (Telegram ID claim) |
| 18 | `gacha_pools` | Gacha banner definitions | Public read (active only) |
| 19 | `gacha_prizes` | Gacha prizes with weighted chances | Public read (active only) |
| 20 | `gacha_spins` | Authoritative gacha spin outcomes | Customer isolated (Telegram ID claim) |
| 21 | `gacha_claims` | Customer prize claim redemption log | Customer isolated |
| 22 | `delivery_access_logs` | Audit trail for credential view & TOTP | **RESTRICTED** (Service Role only) |
| 23 | `admin_audit_logs` | Administrative action audit history | **RESTRICTED** (Service Role only) |
| 24 | `referrals` | Referral link mapping | Customer isolated |
| 25 | `referral_rewards` | Referral bonus distribution history | Customer isolated |
| 26 | `notifications` | In-app customer notifications | Customer isolated (Telegram ID claim) |
| 27 | `admin_users` | Telegram-based admin user roles | **RESTRICTED** (Service Role only) |
| 28 | `support_tickets` | Customer support ticket threads | Customer isolated (Telegram ID claim) |
| 29 | `app_settings` | Economy rules, cooldowns, thresholds | Public read / Service Role write |
| 30 | `system_events` | System health and error logs | **RESTRICTED** (Service Role only) |

---

## 4. Key Business Logic Stored Procedures

The SQL script installs atomic, race-condition-safe stored procedures:

1. `reserve_inventory_atomic(product_id, customer_id, order_id, duration_minutes)`
   * Locks the product row with `FOR UPDATE`.
   * Reserves an available inventory item using `FOR UPDATE SKIP LOCKED`.
   * Automatically decrements available stock.

2. `release_expired_reservations()`
   * Sweeps active reservations older than 10 minutes.
   * Releases reserved inventory items back to `available`.
   * Restores product stock and marks unpaid orders expired.

3. `consume_reservation_atomic(order_id)`
   * Confirms payment and consumes reserved inventory.
   * Assembles encrypted account credentials and RFC 6238 TOTP metadata.
   * Initiates the **14-day warranty** (`warranty_status = 'active'`, `warranty_starts_at = NOW()`).
   * Credits customer with **10 Uchiro Points per $1 spent** and writes an idempotent entry to `point_ledger`.

4. `spin_gacha_atomic(pool_id, customer_id, telegram_id, idempotency_key)`
   * Verifies ticket balance (`gacha_tickets >= 1`) and checks the **1-hour cooldown**.
   * Consumes 1 ticket, updates `last_gacha_roll_at`, and sets `next_gacha_roll_at = NOW() + 1 hour`.
   * Runs authoritative weighted RNG to pick a prize and creates a claim.

5. `claim_daily_reward_atomic(telegram_id)`
   * Validates claim once per calendar day in **Asia/Phnom_Penh (UTC+7)**.
   * Credits **+5 base points** on consecutive check-ins.
   * Awards **+10 bonus points** on 7-day milestones (Days 7, 14, 21, 28, etc.).
   * Resets streak to 1 if a day was missed (without deducting past points).

6. `redeem_coupon_atomic(telegram_id, tier_points)`
   * Redeems customer points for wallet coupons across 3 tiers:
     * **Tier 1 (50 Points)**: $0.50 discount (min order $1.50)
     * **Tier 2 (100 Points)**: $1.00 discount (min order $3.00)
     * **Tier 3 (200 Points)**: $2.00 discount (min order $5.00)
   * Writes the deduction to `point_ledger` and creates the coupon with status `AVAILABLE`.

7. `exchange_points_for_gacha_tickets_atomic(telegram_id, ticket_count)`
   * Exchanges **100 Uchiro Points per ticket**.
   * Deducts points from profile, adds tickets, and logs transaction in `point_ledger`.

---

## 5. Economy & Configuration Defaults in `app_settings`

The script seeds the store configuration table with production defaults:

| Setting Key | Default Value | Description |
|---|---|---|
| `points_per_dollar` | `10` | 10 Uchiro Points awarded per $1 spent |
| `daily_reward_points` | `5` | Base points for daily check-in |
| `streak_interval_days` | `7` | Consecutive days required for streak bonus |
| `streak_bonus_points` | `10` | Milestone bonus awarded every 7 days |
| `gacha_ticket_points_cost` | `100` | Points required per 1 Gacha Ticket |
| `gacha_cooldown_seconds` | `3600` | 1-hour cooldown between gacha rolls |
| `default_warranty_days` | `14` | Default warranty period for digital accounts |
| `coupon_tier_50` | `{"cost": 50, "value": 0.50, "min_order": 1.50}` | Tier 1 coupon |
| `coupon_tier_100` | `{"cost": 100, "value": 1.00, "min_order": 3.00}` | Tier 2 coupon |
| `coupon_tier_200` | `{"cost": 200, "value": 2.00, "min_order": 5.00}` | Tier 3 coupon |
| `low_stock_threshold` | `2` | Inventory alert threshold |

---

## 6. Troubleshooting & FAQs

### Q: Can I run this script multiple times?
**Yes.** The script is fully idempotent. Running it a second time will not cause errors, duplicate records, or overwrite existing customer data.

### Q: Will running this erase our inventory or customer orders?
**No.** The script does not contain any `DROP TABLE`, `TRUNCATE`, or `DELETE` statements. It only creates missing objects, adds missing columns, and updates settings safely.

### Q: Why do the inventory tables have RLS enabled with only Service Role access?
Digital accounts contain encrypted passwords, backup codes, and RFC 6238 TOTP secrets. They must **never** be directly queryable from client applications. The Uchiro Node.js backend handles all credential decryption, sanitization, and delivery using the `SUPABASE_SERVICE_ROLE_KEY`.

### Q: How do I verify that everything worked?
In the Supabase SQL Editor, run query 9.1 from the script:
```sql
SELECT
    COUNT(*) AS total_uchiro_tables,
    ARRAY_AGG(table_name ORDER BY table_name) AS uchiro_table_list
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'telegram_users', 'profiles', 'categories', 'products', 'product_media',
    'product_variants', 'inventory_items', 'inventory_reservations', 'orders',
    'order_items', 'payments', 'payment_attempts', 'payment_events', 'coupons',
    'coupon_redemptions', 'point_ledger', 'daily_rewards', 'gacha_pools',
    'gacha_prizes', 'gacha_spins', 'gacha_claims', 'delivery_access_logs',
    'admin_audit_logs', 'referrals', 'referral_rewards', 'notifications',
    'admin_users', 'support_tickets', 'app_settings', 'system_events'
);
```
Expected result: `total_uchiro_tables = 30`.
