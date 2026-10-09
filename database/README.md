# UCHIRO STORE V3 — DATABASE SPECIFICATION

This directory contains the complete V3 PostgreSQL schema, Row-Level Security (RLS) policies, atomic functions, and seed data for Supabase.

## Structure

```
database/
├── migrations/
│   ├── 001_initial_schema.sql     # 28 Core Tables, Indexes & Foreign Keys
│   ├── 002_rls_policies.sql       # Complete Row-Level Security Rules
│   └── 003_atomic_functions.sql   # reserve_inventory_atomic, release_expired, spin_gacha_atomic
└── seeds/
    └── 001_seed_products_gacha.sql# Initial Categories, Products, Inventory, Gacha & Coupons
```

## How to Apply on Supabase

1. Open your Supabase Project Dashboard -> **SQL Editor**.
2. Run `migrations/001_initial_schema.sql`.
3. Run `migrations/002_rls_policies.sql`.
4. Run `migrations/003_atomic_functions.sql`.
5. Run `seeds/001_seed_products_gacha.sql` to populate the store with initial gaming items.

## Key Design Principles

- **Zero Customer Passwords**: Customers are authenticated via Telegram cryptographic validation (`initData`). No passwords or login credentials are stored for customers.
- **Atomic Stock Reservation**: `reserve_inventory_atomic` prevents overselling and race conditions under heavy load using PostgreSQL `FOR UPDATE SKIP LOCKED`.
- **10-Minute Cart Expiration**: `release_expired_reservations` automatically returns reserved stock to the inventory pool if payment is not verified within 10 minutes.
- **Server-Authoritative Gacha RNG**: The customer frontend NEVER calculates gacha spin results. `spin_gacha_atomic` executes secure server-side probability calculations, decrements prize stock, and handles claim delivery modes atomically.
