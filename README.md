# ⚡ UCHIRO STORE V3 — Production Architecture & Deployment Guide

> **Enterprise E-Commerce Engine for Digital Gaming & Account Fulfillment**  
> *Engineered with One Piece Gear 5 Joy Boy cyber gaming aesthetics, real-time Bakong KHQR settlement, automated credential delivery, server-authoritative gacha, and dual Telegram bots.*

---

## 🌟 System Overview

Uchiro Store V3 is a full-stack, enterprise-grade digital marketplace platform built for ultra-high conversion, instant delivery of gaming accounts/codes, and automated Telegram bot integration.

### Core Ecosystem Components:
1. **`server/`** — Node.js / Express / TypeScript backend running on port `5000`:
   - Dual Telegram Bots:
     - `@UchiroStoreBot`: Customer catalog browsing, order notifications, live KHQR payment links, instant credential delivery, and support ticket relay.
     - `@UchiroAdminBot`: Real-time purchase alerts, manual order fulfillment notifications, low-stock warnings, and direct WebApp launcher.
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
STORE_BOT_USERNAME=UchiroStoreBot
ADMIN_BOT_TOKEN=your_telegram_admin_bot_token
ADMIN_BOT_USERNAME=UchiroAdminBot
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
