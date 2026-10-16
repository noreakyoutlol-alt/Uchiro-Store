# ⚡ UCHIRO STORE V3 — Production Architecture & Deployment Guide

> **Enterprise E-Commerce Engine for Digital Gaming & Account Fulfillment**  
> *Engineered with One Piece Gear 5 Joy Boy cyber gaming aesthetics, real-time Bakong KHQR settlement, automated credential delivery, server-authoritative gacha, and dual Telegram bots.*

---

## 🌟 System Overview

Uchiro Store V3 is a full-stack, enterprise-grade digital marketplace platform built for ultra-high conversion, instant delivery of gaming accounts/codes, and automated Telegram bot integration.

### Core Ecosystem Components:
1. **`server/`** — Node.js / Express / TypeScript backend running on port `5000`:
   - Dual Telegram Bots:
     - `@UchiroStore_BOT`: Customer catalog browsing, order notifications, live KHQR payment links, instant credential delivery, and support ticket relay.
     - `@uchiro_v2_admin_bot`: Real-time purchase alerts, manual order fulfillment notifications, low-stock warnings, and direct WebApp launcher.
   - Genuine Bakong KHQR generation with deep linking for ABA Mobile and Bakong App.
   - Real-time payment verification with mock test mode simulation.
   - Server-authoritative Gacha engine with transparent probability tables.
   - Comprehensive rate limiting, idempotency protection, and security headers.
2. **`client-store/`** — Customer Telegram WebApp (React + Vite + Tailwind CSS + Framer Motion) on port `3000`:
   - **One Piece Gear 5 Joy Boy theme**: Dynamic energy halos, floating cloud motifs, and comic burst accents.
   - **Home Tab**: Displays **ALL currently in-stock products** ready for immediate purchase.
   - **Shop Tab**: Advanced search, category filters, and sorting.
   - **Gacha Tab**: Mythical wheel/chest with animation, sound cues, and drop rates.
   - **Orders & Profile**: One-click credential copying (`username`, `password`, `code`, 2FA keys) and warranty support.
3. **`client-admin/`** — Operational Control Center (React + Vite + Tailwind CSS) on port `3001`:
   - Live revenue, order metrics, low-stock alerts, and pending gacha claims.
   - Manual order dispatch and fulfillment tool.
   - Product catalog editor & inventory manager.
   - Mass Telegram broadcast dispatch via Store Bot.
   - Complete audit trail logging.

---

## 🚀 Quick Start & Development Setup

### 1. Prerequisites
- **Node.js** v18+ or v20+
- **npm** v9+

### 2. Installation
From the root directory, install dependencies across all three workspaces:
```bash
npm install
npm --prefix server install
npm --prefix client-store install
npm --prefix client-admin install
```

### 3. Environment Configuration
Copy `.env.example` in `server/` or configure `server/.env`:
```env
PORT=5000
NODE_ENV=development
APP_URL=http://localhost:5000
CLIENT_STORE_URL=http://localhost:3000
CLIENT_ADMIN_URL=http://localhost:3001
STORE_WEBAPP_URL=http://localhost:3000
ADMIN_WEBAPP_URL=http://localhost:3001

# Telegram Bots
STORE_BOT_TOKEN=your_telegram_store_bot_token
STORE_BOT_USERNAME=UchiroStore_BOT
ADMIN_BOT_TOKEN=your_telegram_admin_bot_token
ADMIN_BOT_USERNAME=uchiro_v2_admin_bot
ADMIN_TELEGRAM_IDS=123456789,987654321

# Bakong KHQR
BAKONG_MERCHANT_ID=uchiro_store@abaa
BAKONG_MERCHANT_NAME=UCHIRO STORE V3
BAKONG_MERCHANT_CITY=Phnom Penh
BAKONG_CURRENCY=USD
```

### 4. Running the Complete Suite
Start all services concurrently with one command:
```bash
npm run dev
```
Or start each service individually:
```bash
# Terminal 1: Backend API & Telegram Bots
npm --prefix server run dev

# Terminal 2: Customer Store WebApp
npm --prefix client-store run dev

# Terminal 3: Admin WebApp
npm --prefix client-admin run dev
```

### 5. Running Automated Backend Tests
```bash
npm --prefix server test
```

---

## 🛡️ Security & Delivery Architecture
- **Automatic Account Delivery**: Upon KHQR confirmation, accounts are atomically claimed from the encrypted inventory queue and delivered directly into the customer's order receipt and Telegram DM.
- **Warranty Tracking**: Every product is backed by guaranteed warranty coverage (7–30 days) with dedicated customer dispute management.
- **Idempotency Protection**: Order creation requests enforce unique idempotency keys to eliminate double-charges.

---

## 🔒 Automated IP Security & Brute-Force Defense Architecture

### 1. Configuration & Thresholds
The security subsystem (`server/src/security/ip-security.service.ts`) protects administrative endpoints and authentication gates against brute-force attacks, credential stuffing, and abusive clients.

| Variable | Default | Purpose / How to Adjust |
| :--- | :--- | :--- |
| `SECURITY_MAX_LOGIN_ATTEMPTS` | `5` | Maximum failed admin PIN/login attempts within the tracking window before an IP is blocked. **To change the threshold to 3 attempts**, set `SECURITY_MAX_LOGIN_ATTEMPTS=3` in your `.env` or Railway Variables. |
| `SECURITY_WINDOW_MINUTES` | `15` | Sliding time window (in minutes) for counting failed attempts. |
| `SECURITY_BLOCK_DURATION_HOURS` | `1` | Automatic lockout duration (in hours) applied when an IP exceeds the attempt threshold. |

### 2. Auto-Block & Ban Semantics
- **Automated Blocks**: When an IP exceeds `SECURITY_MAX_LOGIN_ATTEMPTS` within `SECURITY_WINDOW_MINUTES`, it is blocked automatically for `SECURITY_BLOCK_DURATION_HOURS`. The client receives a `403 Forbidden` response with `{ success: false, error: "IP_BLOCKED", retryAfter: <seconds> }` and a standard `Retry-After` header.
- **Auto-Block Expiration**: Once the lockout duration expires, requests from the IP are accepted again without manual intervention.
- **Permanent Bans**: Administrators can apply non-expiring permanent bans via the Admin Security Portal or `/api/admin/security/block-ip`. Permanent bans never expire and remain active until explicitly lifted.
- **Successful Authentication**: Entering a valid Admin PIN resets the failed attempt counter for that IP address immediately.
- **Health Check Exemption**: Monitoring and infrastructure health probes (`/health` and `/api/health`) bypass the IP firewall to ensure uptime checks succeed.

### 3. Proxy & Client IP Assumptions
In production on Railway / Cloudflare / reverse proxies:
- Express is configured with `app.set('trust proxy', true)`.
- Client IP extraction prioritizes:
  1. `CF-Connecting-IP` (Cloudflare edge header)
  2. `X-Forwarded-For` (first non-private/external IP)
  3. Direct connection remote address (`req.socket.remoteAddress`)
- Addresses are normalized to standard IPv4 or IPv6 notation (e.g. `::ffff:192.168.1.1` is cleanly normalized to `192.168.1.1`).

### 4. Audit Log & Incident Retention
- Every failed attempt, automated block, manual block, and unban action is recorded with timestamp, origin IP, user agent, and event type (`FAILED_ADMIN_LOGIN`, `AUTOMATIC_IP_BLOCK`, `MANUAL_IP_BLOCK`, `MANUAL_IP_UNBAN`).
- When PostgreSQL is configured, records persist in `security_incidents` and `blocked_ips` with indexes on `ip_address` and `created_at`.
- Full audit history and real-time metrics are accessible in the Admin Security Dashboard (`/noreakyoutadmindashboard -> Security & IP`).

### 5. Emergency Operator Lockout Recovery
If an administrator is accidentally locked out due to repeated wrong PIN entries:
1. **Option A (Alternate Network)**: Connect via mobile data or VPN with a different IP address, log in with the correct PIN, navigate to the Security tab, and unban the original IP.
2. **Option B (Direct Database Query)**: Execute the following SQL query on your PostgreSQL instance:
   ```sql
   DELETE FROM blocked_ips WHERE ip_address = '<YOUR_IP_ADDRESS>';
   ```
3. **Option C (Server Restart)**: In-memory fallback counters are cleared upon process restart.

---

## 💎 Shared Robux Stock Pool Semantics

### 1. Unified Robux Inventory Model
Robux is managed as a **single shared pool measured in Robux**, not independent counts per pack tier.
- Available Robux is dynamically computed as:
  $$\text{available\_robux} = \max(0, \text{total\_balance} - \text{reserved\_balance})$$
- Pack tier availability is derived directly from the current pool:
  $$\text{available\_packs}(\text{denomination}) = \lfloor \text{available\_robux} / \text{denomination} \rfloor$$
- When $\text{available\_packs} \le 0$, the pack is marked **SOLD OUT**. Callbacks re-verify availability server-side to reject stale or forged selections.

### 2. Reservation & Fulfillment Model
1. **Checkout Reservation**: When a buyer selects a pack and confirms their Roblox username, stock is reserved for 15 minutes (`robux_reservations`). This prevents overselling during simultaneous checkouts.
2. **Cancellation / Expiry**: If the order expires or the buyer cancels, `releaseReservation()` restores the reserved balance to the available pool.
3. **Fulfillment**: When an administrator fulfills the order via Roblox group payout or gamepass, `commitFulfillment()` permanently deducts the amount from `total_balance` and records an entry in `robux_stock_ledger`. Stock is deducted exactly once.

### 3. Safe Roblox User Resolution
The buyer enters only their public Roblox username (never passwords, cookies, or credentials). The server calls public Roblox endpoints (`https://users.roblox.com/v1/usernames/users`, `https://thumbnails.roblox.com/v1/users/avatar-headshot`, and `https://users.roblox.com/v1/users/<id>`) to show their avatar, canonical username, display name, and account age for verification before payment.

---

## 📢 Telegram Store Group Announcements

Automated announcements can be published to an authorized Telegram group (`TELEGRAM_ANNOUNCEMENT_GROUP_ID`):
- **New Products**: Sent when an item is added or activated.
- **Restocks**: Published when stock is replenished.
- **Verified Purchases**: Published with privacy-masked customer names (e.g. `Nor####`) to protect buyer identity.
- **Stock Updates / Sold Out**: Updates existing announcements or notifies the group when inventory is exhausted.
- **Buy Here Deep Link**: Features a high-visibility button opening the Store Bot directly at the selected item.

---

## ⚙️ Railway Deployment Checklist & Variables

The following environment variables should be configured in your Railway project dashboard:

| Variable | Description | Example / Recommended Value |
| :--- | :--- | :--- |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:password@host:port/railway` |
| `ADMIN_PANEL_PIN` | 6-digit numeric PIN for Admin Portal | `849201` |
| `ADMIN_TELEGRAM_IDS` | Comma-separated authorized Telegram User IDs | `12345678,87654321` |
| `STORE_BOT_TOKEN` | Customer Store Bot API Token from @BotFather | `7123456789:AA...` |
| `ADMIN_BOT_TOKEN` | Admin Management Bot API Token | `7987654321:BB...` |
| `TELEGRAM_ANNOUNCEMENT_GROUP_ID` | Telegram chat ID for announcements | `-1001234567890` |
| `SECURITY_MAX_LOGIN_ATTEMPTS` | Brute-force threshold (default 5, set to 3 for strict) | `5` (or `3`) |
| `SECURITY_WINDOW_MINUTES` | Failed login tracking window in minutes | `15` |
| `SECURITY_BLOCK_DURATION_HOURS` | Automated IP block duration in hours | `1` |
| `BUTTON_CUSTOM_EMOJI` | Telegram Premium custom emoji support | `'on'` |
