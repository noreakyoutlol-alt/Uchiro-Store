# UCHIRO STORE V3 — Final Targeted Repair & Feature Completion Prompt

Work on my **existing** UCHIRO STORE V3 monorepo (`@uchiro/server`, `@uchiro/client-store`, `@uchiro/client-admin`). This document replaces the scattered fix requests in this task. **Do not rebuild from scratch. Work efficiently to conserve tokens: inspect Git status and only relevant files; do not reread the whole repository or repeat unrelated audits.**

## Critical working rules

1. Start with `git status --short`, the current branch, and diffs for the target files. Preserve all unrelated work. Do not use `git reset --hard`, `git clean -fd`, force-push, database resets, or destructive migrations.
2. The recent edit to `server/src/bots/store-bot/handlers/rules.ts` reportedly removed 803 lines and introduced malformed/duplicate handlers. **Inspect this file and its diff first.** Back up the current file outside the repository; recover the last known-good version from Git/history or available backup, preserve valid uncommitted changes, then apply small targeted edits. Never rewrite the whole file from scratch. If safe recovery is uncertain, stop and explain before changing it further.
3. Do not invent products, payment methods, emails, live chat, customer-support hours, response guarantees, warranty promises, refunds, API credentials, or Telegram IDs. Use only real features/configuration in this repository. Support URL: `https://t.me/uchirosupport`.
4. My Telegram Premium Emoji IDs and downloaded emoji assets already exist in the project. Reuse those exact IDs/files; do not ask me to upload them again or invent replacements. Robux custom emoji ID: `5406705291213417505`.
5. My Railway environment variables already include `STORE_BOT_WEBHOOK_SECRET`, `ADMIN_BOT_TOKEN`, `ADMIN_BOT_WEBHOOK_SECRET`, `ADMIN_TELEGRAM_IDS`, `KHPAY_BASE_URL`, `KHPAY_API_KEY`, `TELEGRAM_CHANNEL_USERNAME`, `TELEGRAM_SUPPORT_USERNAME`, `ADMIN_BASE_PATH`, `ADMIN_BOT_USERNAME`, `ADMIN_SECRET_PATH`, `ADMIN_SECRET_PIN`, `DATABASE_URL`, `STORE_BOT_USERNAME`, and `STORE_URL`, according to my provided list. Do not print secrets, change my existing Admin PIN, or hardcode secrets. Audit variable names against code; identify only genuine missing/mismatched settings.
6. Implement safely, run tests, typechecks, and builds. Do not claim success without actual results. Do not push/deploy until critical checks pass and the diff has been reviewed for secrets.

## Priority 0 — Restore Admin access and repair corrupted code

### A. Admin Bot and Admin Mini App

- Restore the previous working Admin Bot and Admin Mini App behavior. Currently the Admin Mini App may open the Store instead of the Admin Dashboard, and the Admin Bot's admin functions may be inaccessible.
- Inspect relevant Admin Bot startup/menu/auth/callback handlers, `ADMIN_TELEGRAM_IDS` enforcement, admin URL generation, admin slug/base-path settings, Vite base path/build output, and static routes (including `server/src/static-routes.ts`, `server/src/config/admin-slug.ts`, `client-admin/vite.config.ts`, and the admin bot entry point, if those paths still match the repo).
- Ensure Admin Mini App links open the Admin Dashboard, not the Store; both `/admin` (if intended by current setup) and the configured secret path must resolve to the right built app without route collisions.
- Ensure authorized admins can use the old working admin functions and unauthorized users cannot. Do not remove existing Admin Bot capabilities.
- Check runtime/static-route behavior as well as TypeScript. Do not merely change the visible link while leaving the backend route wrong.

### B. Recover Rules & Policies safely

- Recover the last known-good `rules.ts` before doing anything else in this module. Remove duplicate function definitions and malformed strings/braces, but preserve every still-used handler such as store rules, warranty, Gacha rules, daily streak rules, and the new policy pages.
- Never invent policy facts. Keep the existing 14-day warranty terms where they are actually specified. Payment guidance must describe only the configured KHQR/KHPay/Bakong flow or other payment methods actually implemented. Do not claim Visa/Mastercard, crypto, email support, live chat, 24/7 service, or specific response times unless verified in the code/config and business requirements.

## Priority 1 — Robux stock, paid orders, username checks, and KHQR

### A. Correct stock accounting

Keep separate durable figures in PostgreSQL:
- `total_stock`: total Robux the admin has added/configured. It must remain 500 when an order for 100 is paid; selling must not overwrite total stock with 400.
- `sold_robux`: Robux amount from **verified paid orders only**.
- `reserved_robux`: valid, unexpired reservations for pending orders; reservations are not sold.
- `available_robux`: stock available to allocate, calculated from total stock minus sold and valid active reservations.

An unpaid order, button click, username confirmation, or QR creation must not increase `sold_robux` or permanently reduce `total_stock`. A valid temporary reservation may reduce the amount available for *new allocations*, but show it separately from Sold. Expired/cancelled unpaid reservations must be released idempotently. On verified payment, atomically transition the order and move that amount from pending/reserved to sold exactly once. Payment callbacks/retries must not double-count stock. Preserve a ledger/audit trail. Use PostgreSQL transactions, constraints, and row locking or equivalent concurrency controls; do not use in-memory state as the durable source of truth.

Admin Robux view must clearly show `Total`, `Sold`, `Reserved/Pending`, and `Available`. If admin adds 500 and a verified 100-Robux purchase is made, Total remains 500, Sold becomes 100, and Available becomes 400 assuming no other active reservations.

### B. Package display and sales counts

- Keep denominations from 100 to 10,000 Robux subject to configured rules and availability.
- Compute each price from the configured USD rate per 1,000 Robux using integer cents/decimal arithmetic; do not hardcode display prices. Example at $3.50/1,000: 100=$0.35, 200=$0.70, 500=$1.75, 1,000=$3.50, 10,000=$35.00.
- For each package show amount, calculated price, paid sales count (e.g. `120 sold`), and remaining purchasable packs/stock. Distinguish **packs sold** from **Robux sold** so the counts are not misleading. Only verified paid orders contribute to sold counts. Show `SOLD OUT` when insufficient available stock remains for one complete pack.
- Use custom emoji ID `5406705291213417505` for the Buy Robux button where Telegram supports it.

### C. Username not found and confirmation

- Ask for Roblox username only; never request passwords, cookies, session tokens, or private credentials.
- Resolve through the existing legitimate public-profile flow. Show available avatar, display name, canonical username, and user ID.
- If not found, reply clearly: `Username not found. Check the spelling or try another username.` Show working `Try Another Username`, `Cancel`, and Back navigation.
- Require explicit confirmation of the selected username before proceeding. Do not claim username confirmation proves ownership.

### D. Age/eligibility gate

- Before creating the payment QR, require the customer's explicit age/eligibility acknowledgement. If the user selects/declares **under 13**, or leaves a required checkbox unchecked, block the purchase and do not create a payment order/QR. Provide a clear message and safe Back/Cancel path.
- Users who meet the permitted eligibility rules may proceed. Where the workflow distinguishes child/restricted Roblox account types from normal eligible accounts, enforce this only using a legitimate, reliable signal or explicit supported process. Do not pretend the public Roblox profile or account creation date proves the real person's age or verifies parental restrictions. If reliable verification is unavailable, be transparent and use an appropriate compliant confirmation/manual review rather than fabricating verification.
- Enforce eligibility server-side, not only by hiding a frontend button.
- Verify the proposed Robux delivery/sales method against current official Roblox and payment-provider rules before enabling real fulfillment. If authorization is uncertain, keep direct fulfillment disabled while preserving safe admin configuration/tests.

### E. QR must be real and match the Store payment flow

- Reuse the **actual existing Store KHQR/KHPay/Bakong payment service** and its verified QR-generation method; do not create a decorative/fake QR or an unrelated new payment implementation.
- Create a real invoice/order with a unique order reference and exact amount, show the generated provider QR, then verify payment via the existing trusted webhook/API.
- Never mark paid based only on a screenshot or client request. Use idempotency so duplicate callbacks cannot double-count stock or fulfill twice. If QR generation/provider setup fails, show an error and keep the order unpaid; do not invent a QR.
- Notify Admin Bot about verified paid Robux orders. Admin fulfillment controls must update status idempotently and only mark Delivered when actually delivered.

## Priority 2 — Premium emoji rendering and English buttons across the full project

- Scan relevant button builders, keyboards, callback menus, message-formatting middleware, and Mini App icon components in Store Bot, Admin Bot, client-store, and client-admin.
- Fix the root cause of duplicate emojis. When a button uses Telegram `icon_custom_emoji_id`, its label must not also prepend the same Unicode emoji. In fallback mode display exactly one fallback. Never put `<tg-emoji>` HTML inside inline-button text.
- Reuse all existing emoji IDs and local downloaded assets. Check the custom Robux ID above. Where Telegram cannot display a custom icon, use one appropriate existing fallback; do not invent IDs.
- In the Mini App, use existing local assets with the correct renderer for their actual format (animated formats only animate where supported). Fix missing mappings/assets and loading failures without replacing the user's asset collection.
- All visible button labels across the **entire project** must be English, including Store Bot, Admin Bot, Store Mini App, Admin Dashboard, every submenu, profile, vault, rewards, Robux, admin settings, broadcast, and Back controls. The language-choice screen is the deliberate exception in content, but its button labels must remain clean English labels such as `Khmer` and `English`.
- All user-facing **message bodies** that have translations must support Khmer and English based on the user's saved preference. New/changed policy messages should have both locales if the locale architecture supports it. Do not make buttons Khmer to translate the messages.
- First-time `/start` must show the Khmer/English language-selection screen. Persist selection reliably. Returning users go straight to their saved-language main menu. Ensure language callbacks and Back Home work.

## Priority 3 — Main menu and every button/callback

- Audit all buttons in both bots and both Mini Apps. For each callback button, verify there is exactly one valid handler and that it leads to the intended feature; fix orphan callbacks, stale callback IDs, dead-end screens, and Back buttons that hang or do nothing.
- Preserve working features and the prior intended Store main-menu functions: Open Store, Buy Robux, Get 2FA Code, How to Buy & Pay, My Orders & Vault, Claim Free Points, Chat with Admin / Support, and one `Rules & Policies` button. Keep Back Home in relevant submenus.
- `Rules & Policies` is one main-menu button that opens a submenu with individual working buttons: `Store Rules`, `Warranty Policy`, `Payment & Delivery`, `Refund Policy`, `Points & Coupons`, `FAQ & Help`, `Contact Support`, and `Back Home`. Each page needs a working Back to Rules and/or Back Home path.
- Official Support link is `https://t.me/uchirosupport`. Do not replace it with invented support accounts or email addresses.
- Keep `pattern.svg` as the requested space-doodle background reference and change only the Store Mini App background/pattern integration. Preserve existing colors, cards, and layout unless a specific bug requires a small change. Keep the pattern subtle, seamless, responsive, and lightweight.

## Priority 4 — Correct reward prices and policy text

The actual exchange costs must agree in UI, bot handlers, API/backend validation, and tests:
- 1 Gacha Ticket = **100 Points** (not 50).
- $0.50 off coupon = **50 Points**.
- $1.00 off coupon = **100 Points**.
- $2.00 off coupon = **200 Points**.

Do not globally replace all instances of `50`; that would break the $0.50 coupon. Validate sufficient balance, atomically deduct points/issue reward, write the points ledger, and prevent double redemption. Do not reset balances or invalidate existing valid coupons. Coupon rules displayed to users must match real checkout eligibility and expiry logic; do not invent minimum order values or expiry rules.

## Priority 5 — `/broadcast` MUST be Telegram Admin Bot-only

The broadcast feature must be operated **only through the Telegram Admin Bot**; do not move the broadcast wizard into the Admin Mini App. Enforce admin authorization on every step and callback.

### Required button-driven conversation

When an authorized admin sends `/broadcast`, the Admin Bot must reply with a message such as `Choose a broadcast type:` and show inline buttons for:
1. `Send Text Only`
2. `Send Text with Buy Now Button`
3. `Send Text with Custom URL Button` (only if safe custom URL buttons are supported by the existing implementation)
4. `Cancel Broadcast`

Every choice is a button; do not require the admin to type a mode/command.

- If the admin clicks `Send Text Only`, the bot must reply: `Send the text you want to broadcast.` Then wait for that authorized admin's next message, capture it as the draft, and show a preview with `Confirm & Send`, `Edit Text`, and `Cancel Broadcast` buttons.
- If the admin clicks `Send Text with Buy Now Button`, prompt for the message text first, then provide the existing supported product/store selection flow for the Buy Now button. Do not invent a product ID or broken link. Show a final preview containing the message and button before asking for confirmation.
- If the admin clicks `Send Text with Custom URL Button`, prompt for message text, button label, and URL in separate steps. Validate the label length and URL scheme (HTTPS preferred); reject unsafe schemes and malformed URLs. If this mode is not supported by the current architecture, omit this option rather than showing a broken button.
- Include media only if the existing bot actually supports it; never claim unsupported upload modes work.
- The draft must be associated with the initiating authorized admin and expire safely. Another admin's messages must not complete that draft. Handle cancel, edit, timeout, double-clicks, Telegram rate limits, and retry without sending duplicate broadcasts.
- On `Confirm & Send`, send only to the eligible recipients already collected by the existing Store Bot system, obey Telegram API/rate limits, and summarize succeeded/failed/blocked recipient counts. Do not message people who never started the bot or bypass Telegram restrictions.
- Ensure `Buy Now` deep links target the correct existing Store Bot/product route. Use Premium Emoji button icons where supported, without duplicate Unicode prefixes.
- Test the full wizard end-to-end, including Text Only (prompt then capture text), Buy Now selection, preview, cancel, confirmation, authorization failures, and duplicate-click prevention.

## Focused verification and release

Work efficiently; inspect only the affected files and their direct dependencies. Avoid broad unrelated refactors. Use the current test/build scripts and add targeted regression tests where needed.

Required checks:
1. `rules.ts` parses cleanly and has no duplicate/malformed handlers.
2. Gacha/coupon pricing matches exactly in display and backend.
3. Robux stock/paid/sold/reserved counts behave correctly, including unpaid, paid, expired, cancelled, duplicate webhook and concurrent-order cases.
4. QR is generated through the existing provider service and payment verification is authoritative.
5. Under-13 or unchecked eligibility is blocked before QR/order; eligible users can proceed if the permitted flow is configured.
6. Admin Bot and Admin Mini App open/authorize correctly.
7. `/broadcast` button-driven flow works only in the Admin Telegram Bot.
8. All callback buttons work; Back navigation has no stuck/dead paths; buttons have English labels and no duplicate emoji icons.
9. First-time language selection works; returning users see their saved language; translated message bodies work where supported.
10. Run the actual full server tests, relevant client tests, all three TypeScript checks, and all three production builds. Report exact counts and failures; do not fabricate results.

After critical checks pass, inspect `git status`, the full diff, staged file names, and secrets. Do not include `.env`, tokens, PINs, payment credentials, or other secrets. Preserve unrelated user changes. Commit/push only if the current user has authorized release in the current session; push without force to the verified production branch and report the actual push and Railway deployment status. Never claim Railway deploy succeeded without verification.

## Final report format

Briefly report:
- Damaged file recovery status (especially `rules.ts`).
- Admin Bot/Admin Mini App status.
- Robux stock/payment/eligibility status.
- Emoji/language/buttons status.
- Reward prices and Rules & Policies status.
- `/broadcast` wizard status.
- Tests, typechecks, and builds with exact results.
- Remaining manual configuration or unresolved limitations.
- Git commit/push and Railway deployment only if actually performed and verified.
