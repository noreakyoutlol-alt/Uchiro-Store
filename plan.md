# Implementation Plan — Uchiro V3: REAL PRODUCTION-QUALITY REBUILD

Based on the 37 requirements from the user's specification, here is the complete implementation plan.

## CURRENT STATE AUDIT FINDINGS

### Fake Data Locations Identified:

1. **DataStore.getLiveActivityData()** (`server/src/database/data-store.ts:2513-2619`):
   - `totalBuyers = Math.max(148, distinctBuyerKeys.size + 135)` — fake 135-person offset
   - `totalViews = this.products.reduce((acc, p) => acc + (p.views_count || 120), 0)` — fake 120 per product
   - `recentSales` seed array at line 2583-2589 with fake entries: "MM2 Harvester + Corrupt Set", "Blox Fruits Max Kitsune Account", etc.
   - `time_ago: `${Math.max(1, (idx + 1) * 3)}m ago`` — fake time values
   - `topBuyers` seeded array at line 2604-2610 with "Uch•••", "Rip•••", etc. and fixed order counts

2. **AuthService demo fallback** (`server/src/services/auth.service.ts:16-24`):
   - Creates demo user "Uchiro Warrior" / "player_uchiro" when `STRICT_TELEGRAM_AUTH` is false
   - This is the source of hardcoded profile names

3. **LiveBuyerFeedWidget** (`client-store/src/components/home/LiveBuyerFeedWidget.tsx`):
   - Displays activity from API, currently seeded with fake data in DataStore

4. **ProfilePage** fake stats:
   - Shows "155 UCHIRO PTS", "0 TOTAL ORDERS", "$0.00 SPENT" — need real data from DB

5. **Gacha UI** — childish design, needs premium rebuild (Requirements 12-16)
6. **Points UI** — needs rebuild per Requirements 17-18
7. **ENV variables** — audit needed per Requirement 26
8. **Product stock display** for Accounts — need to hide numeric stock (Requirement 16)

## IMPLEMENTATION PHASES

### PHASE 1: TELEGRAM AUTH — REAL USER DATA (Req 1, 36)

**Files to modify:**
- `server/src/services/auth.service.ts` — Remove dev fallback demo user; enforce STRICT_TELEGRAM_AUTH or return null
- `client-store/src/services/api.ts` — Ensure getMe uses real auth
- `client-store/src/App.tsx` — Handle null user gracefully

**Data sources:**
- Telegram initData server-side validation (already has validateTelegramInitData)
- DataStore.findOrCreateTelegramUser with real Telegram user fields: first_name, last_name, username, photo_url

**Changes:**
- Remove the demo user creation block (lines 14-37 in auth.service.ts)
- When STRICT_TELEGRAM_AUTH=true and initData is invalid, throw 401
- When STRICT_TELEGRAM_AUTH=false, return null instead of creating demo user
- Profile must use: first_name, last_name when available, username when available, Telegram profile photo when available

### PHASE 2: PROFILE — REAL STATISTICS FROM DATABASE (Req 2, 36)

**Files to modify:**
- `client-store/src/components/profile/ProfilePage.tsx` — Replace hardcoded stats with API calls
- `server/src/routes/store.routes.ts` — Add endpoints for real profile stats
- `server/src/services/order.service.ts` — Calculate real order counts and total_spent
- `server/src/database/data-store.ts` — Implement real getProfile, getPointLedger calculations

**Data sources:**
- Real orders from database: customer's actual order count
- Real payments: total successfully paid amount
- Real point ledger: actual points balance
- Real gacha tickets from user profile

**Changes:**
- Replace "155 UCHIRO PTS" with actual points balance from point ledger
- Replace "0 TOTAL ORDERS" with actual order count from orders table
- Replace "$0.00 SPENT" with actual total paid amount from paid/completed orders
- Show honest 0 / empty state when no data exists

### PHASE 3: REMOVE FAKE ACTIVITY DATA FROM HOME (Req 3, 4, 15, 36)

**Files to modify:**
- `server/src/database/data-store.ts` — Remove ALL fake seed data from getLiveActivityData()
- Remove hardcoded `Math.max(148, distinctBuyerKeys.size + 135)` → use actual count
- Remove hardcoded `+ 120` per product views → use actual p.views_count or 0
- Remove seed arrays for recent_sales → only show real delivered orders
- Remove fake top_buyers seeded array → calculate from real data or show empty state
- `client-store/src/components/home/LiveBuyerFeedWidget.tsx` — Remove or hide activity strip from Home (Requirement 4)
- `client-store/src/components/activity/LiveActivityPage.tsx` — Keep as dedicated page with real data (Requirement 4)

**Changes:**
- Homepage: NO inline fake activity module (Requirement 4)
- Activity page: YES dedicated Live Activity page using real data (Requirement 4)
- all anonymized buyer names must be real buyers, not fake "Rip•••", "Uch•••" seeds

### PHASE 4: ACCOUNT PRODUCT — HIDE NUMERIC STOCK (Req 16, 36)

**Files to modify:**
- `client-store/src/components/product/ProductCard.tsx` — Already shows "⚡ Instant Delivery" for accounts, good. Ensure no numeric stock count is shown publicly.

**Changes:**
- Confirm account products show "Instant Delivery / Available" or "Instant Delivery / Sold Out"
- Never expose numeric stock quantity publicly for account credentials (Requirement 16)
- Internally database may have multiple unique account inventory rows, but public UI hides this

### PHASE 5: LIVE ACTIVITY HUB — REAL DATA ONLY (Req 5, 36)

**Files to modify:**
- `server/src/database/data-store.ts` — Rewrite getLiveActivityData() to use real calculated data
- `client-store/src/components/activity/LiveActivityPage.tsx` — Use real API data, show honest empty states

**Changes:**
- `live_now`: calculate from actual active heartbeats, not `Math.max(16, count + 14)`
- `total_buyers`: actual distinct buyer count from delivered orders, no artificial offsets
- `total_views`: sum of actual product.views_count, no fake 120 per product
- `recent_sales`: only real delivered orders, no seed arrays
- `top_buyers`: calculated from real order data, anonymized from real buyers
- If insufficient real data: show truthful empty/zero states (Requirement 5)

### PHASE 6: POINTS UI — REBUILD (Req 17-18, 36)

**Files to modify:**
- `client-store/src/components/profile/ProfilePage.tsx` — Rewrite points section
- Add new component or rewrite the points area within ProfilePage

**Design requirements (Req 17):**
- CURRENT POINTS: large, highly readable balance
- HOW TO EARN: purchase rewards, daily reward, streaks, other rewards
- HOW TO SPEND: gacha tickets, coupons
- POINT HISTORY: newest first
- Do not hide number inside tiny text
- Clear typography and spacing
- Points experience should feel like a dedicated product feature

**Points rules (Req 18):**
- $1 verified purchase = +10 points (awarded after verified successful payment, idempotent)
- Daily: +5 once per day, timezone: Asia/Phnom_Penh
- Streak: Day 1–6: +5, Day 7: +5 +15 bonus, Every multiple of 7: +15 bonus
- Missed day resets the streak
- Old points remain
- History types: Purchase Reward, Daily Reward, Streak Bonus, Gacha Ticket, Coupon Redemption, Admin Adjustment, Refund/Reversal

### PHASE 7: GACHA COMPLETE REBUILD (Req 12-16, 36)

**Files to modify:**
- `client-store/src/components/gacha/GachaPage.tsx` — Complete visual rebuild
- `server/src/services/gacha.service.ts` — Verify server-authoritative spin logic exists (it does)
- `server/src/routes/gacha.routes.ts` — Verify ticket purchase flow (it does)

**Gacha business rules (Req 13):**
- Gacha is POINTS ONLY
- NO money purchase for Gacha tickets
- 100 UCHIRO points = 1 ticket
- 1 ticket = 1 roll
- 1 hour cooldown
- Unused tickets remain available
- Server selects winning reward, frontend must never decide

**Gacha probabilities (Req 14):**
- COMMON 50%
- RARE 28%
- EPIC 14%
- LEGENDARY 6.5%
- MYTHICAL 1.5%
- Total = exactly 100%

**Gacha current/draft prize (Req 15):**
- Support CURRENT PRIZE and DRAFT / NEXT PRIZE
- When current stock reaches zero: Draft becomes Current
- Admin can edit: name, image, description, rarity, probability, reward type, reward payload, stock, claim mode, active, current/draft state

**Gacha animation (Req 16):**
- Real server-selected target
- Smooth movement, believable deceleration
- 4–5 second presentation
- Clear landing, strong winner reveal
- Rarity-based visual treatment
- Do not use old cheap/short animation

### PHASE 8: GIFT / TRADE FLOW (Req 6-9, 21-22, 36)

**Files to modify:**
- ProductCard — Ensure delivery mode labeling is correct (Req 22)
- Order routes and service — Verify gift/trade flows

**Gift flow (Req 8):**
- Step 1-3: Customer selects Gift Item, enters Roblox username, backend verifies
- Show: avatar, display name, username, Roblox user ID
- Step 4: Customer explicitly confirms "This is the correct Roblox account."
- Step 5: Customer places order
- Step 6: Customer pays through KHPay
- Step 7 AFTER PAYMENT: Auto send Telegram notification to ADMIN with order details
- Step 8: Admin manually sends/gifts item to Roblox recipient
- Step 9: Admin marks order fulfilled
- Step 10: Customer sees status change from "Awaiting Admin Gift Delivery" to "Gift Delivered / Fulfilled"
- DO NOT label as "Instant Delivery"
- DO NOT automatically tell customer gift was delivered before admin fulfills

**Trade flow (Req 10):**
- Customer purchases -> payment confirmed -> order becomes Awaiting Admin Trade
- Admin gets notification -> customer sees Contact Admin + Order ID
- Admin fulfills manually -> admin marks fulfilled -> customer sees completed state
- Trade must never appear as Instant Delivery

### PHASE 9: DIGITAL CODE FLOW (Req 11, 36)

**Files to modify:**
- Verify digital code delivery flow works end-to-end

**Changes:**
- Customer pays successfully -> securely deliver real unused digital code
- Show: code, Copy Code, redemption instructions, redemption URL if applicable, order ID, receipt
- Code must be consumed exactly once
- Verify: Admin inventory -> reservation -> payment -> delivery -> consume -> sold out

### PHASE 10: ENVIRONMENT CLEANUP (Req 26, 36)

**Files to modify:**
- `.env` — Audit and remove dead/unused variables
- `.env.example` — Create with only required variables

**Changes:**
- Search for every environment variable usage: process.env.*, import.meta.env.*, VITE_*
- Build definitive list of variables actually consumed by: server, client-store, client-admin, bots, KHPay, Supabase, Telegram auth, deployment/runtime
- Remove DEAD / UNUSED environment variables
- Do not invent variables
- Do not keep old legacy variables merely because they exist
- Create/update .env.example with ONLY variables actually required
- Keep secrets out of source control
- Production should preferably use minimum required KHPay variables: KHPAY_BASE_URL, KHPAY_API_KEY

### PHASE 11: TELEGRAM SECURITY (Req 27, 36)

**Changes:**
- Set STRICT_TELEGRAM_AUTH=true in production
- Validate Telegram initData server-side (already has validateTelegramInitData)
- Never trust initDataUnsafe for authorization
- Normal browser access to production Store should not bypass Telegram auth
- Admin must require: validated Telegram identity, allowed Telegram admin ID

### PHASE 12: KHPay (Req 28, 36)

**Changes:**
- Payment screen must use real order amount, real QR, real expiration, real waiting state
- "Download QR", "Open ABA"
- Do NOT use old wording: "SCAN WITH ANY BANK APP", "Bakong KHQR"
- Use original project QR template: qr temple.jpg
- Real order QR must be dynamically inserted
- Do not use fake QR or $0.01 placeholder values
- Payment success must only happen after actual provider verification

### PHASE 13: ADMIN NOTIFICATIONS (Req 30, 36)

**Changes:**
- After paid Gift order: ADMIN receives Telegram message automatically
- After paid Trade order: ADMIN receives Telegram message automatically
- Message must include: Order ID, Product name, product/category, paid amount, customer Telegram identity, verified Roblox username/display_name/user_id, timestamp, order status, direct order/admin link
- Provide actionable admin path

### PHASE 14: VISUAL REBUILD (Req 21-25, 35-36)

**Changes:**
- Rework typography hierarchy across entire Mini App (Req 21)
- Large main title, medium section title, readable supporting text, clear CTA labels, strong contrast
- Product card delivery mode labeling (Req 22): ACCOUNT=Instant Delivery, DIGITAL CODE=Instant Digital Delivery, GIFT=Roblox Verification + Admin Gift Delivery, TRADE=Manual Trade + Admin Fulfillment
- Remove raw/placeholder emoji/icons (Req 24)
- Migrate to centralized Telegram Premium Custom Emoji system (Req 23)
- Create shared config: shared/config/telegram-premium-emojis.ts
- Semantic names: HOME, SHOP, GACHA, POINTS, ACTIVITY, PROFILE, GAME, ACCOUNT, GIFT, TRADE, DIGITAL_CODE, PAYMENT, DELIVERY, ORDER, SUCCESS, WARNING, ERROR, SECURITY, COIN, TICKET, SALE, ADMIN, SUPPORT, SETTINGS
- Do not invent fake Telegram custom emoji IDs
- Use clean fallback icons when custom emoji cannot render
- Premium redesign: not school project, not beginner template, not child-made game UI
- Feel like: premium gaming store, clean, polished, modern, mobile-first, strong hierarchy, consistent spacing, readable typography, purposeful motion, minimal but premium effects

### PHASE 15: TESTING AND BUILD (Req 33-34, 36)

**Changes:**
- Run all existing tests
- Add/fix tests where needed
- Run: client-store build, client-admin build, server build/typecheck
- Verify: no TypeScript errors, no broken imports, no route failures, no API failures caused by changes
- Manual flow verification for all 6 product types (Req 34)

## SUCCESS MATRIX

**PASS** when complete requirements are truly implemented and connected to the real app.

**FAIL** if:
- Any hardcoded/demo values remain in customer-facing screens
- Old UI remains as the active renderer
- Fake activity strip remains on Homepage
- Profile uses demo values (Uchiro Warrior, @player_uchiro, 155 pts, 0 orders, $0 spent)
- Numeric stock count exposed for Account products
- Gift/Trade labeled as Instant Delivery
- Gacha has money purchase option
- Points UI uses fake values
- ENV not cleaned
- Telegram auth bypass possible

## FILES MODIFIED TRACKING

To be tracked during implementation with exact file paths, routes, APIs, components, database fields, and tests.