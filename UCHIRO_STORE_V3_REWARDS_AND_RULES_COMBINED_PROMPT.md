# UCHIRO STORE V3 — Reward Exchange Fix + Rules & Policies Submenus

Work in the existing UCHIRO STORE V3 repository. Implement the following changes directly and efficiently. Do not rebuild the project, reread unrelated areas, delete unrelated features, reset the database, or discard existing user changes.

## 1. Correct reward exchange prices everywhere

Use these exact exchange costs consistently across the Store Bot, Admin Bot configuration (if applicable), Mini App displays, backend validation, database defaults/seeds, and tests:

- **Gacha Ticket:** `100 Pts` — `1 Spin for Mythical Prizes`
- **Coupon $0.50 Off:** `50 Pts` — `Valid on all games`
- **Coupon $1.00 Off:** `100 Pts` — `Valid on all games`
- **Coupon $2.00 Off:** `200 Pts` — `Valid on all games`

The Gacha Ticket price must be 100 Points, not 50. Do not perform a global replacement of `50`: the $0.50 coupon must continue to cost exactly 50 Points.

Audit every actual redemption path, not just the displayed text. Ensure that displayed costs match server-side validation and persisted settings. Check any old hardcoded default such as `ticket_price_pts = 50` and update it only where it refers to a Gacha Ticket.

### Safe redemption requirements

- Validate the user's current points on the server before redemption.
- Atomically deduct the correct points and issue the ticket/coupon in PostgreSQL using transactions and suitable locking/constraints.
- Record the balance change in the points ledger.
- Prevent duplicate rewards from double-clicks, retries, or concurrent requests.
- Return a clear English success or insufficient-points message.
- Ensure coupons are actually accepted by checkout and apply the stated discount to eligible games; do not show a coupon as redeemable if the existing checkout cannot honor it.
- Preserve existing balances, points ledger entries, tickets, coupon records, and user data. Do not reset users or delete valid existing coupons.
- If a prior already-redeemed ticket or coupon costs 50 Points, do not rewrite historical ledger entries. Correct future redemption behavior and document any necessary non-destructive configuration/migration.

## 2. Add `Rules & Policies` to the Store Bot main menu

Add the English-labeled button `📜 Rules & Policies` to the existing Store Bot main menu as an additional row. Preserve the existing main menu actions and ensure all visible buttons are English, except the intended Khmer/English language-selection buttons.

The `Rules & Policies` button must open a dedicated submenu. It must not display every policy as one very long message.

### Rules & Policies submenu buttons

Provide these separate, working buttons:

1. `Store Rules`
2. `Warranty Policy`
3. `Payment & Delivery`
4. `Refund Policy`
5. `Points & Coupons`
6. `FAQ & Help`
7. `Contact Support`
8. `Back Home`

Each topic button must open its own concise, readable message or screen. Each policy screen should have a working `Back to Rules & Policies` button and a `Back Home` route where appropriate. `Contact Support` must open the existing official support link:

`https://t.me/uchirosupport`

Reuse the current bot framework, keyboard builders, localization architecture, and callback naming patterns. Register every new callback exactly once and verify that callbacks are not orphaned or duplicated. Keep labels in English while allowing message-body localization through the user's saved language when supported by the existing localization system.

## 3. Policy content requirements

Use existing policy text, business configuration, and repository documentation as the source of truth. Do not invent warranties, refunds, guarantees, legal terms, or exclusions. If a material policy is not defined, report that gap instead of making up a promise.

- **Store Rules:** purchase requirements, customer responsibilities, account/item usage conditions, and prohibited misuse based on existing policy.
- **Warranty Policy:** retain the established 14-day warranty only where that remains the actual store policy. Explain its existing scope, claim process, evidence requirements, and exclusions only if supported by the project’s existing terms.
- **Payment & Delivery:** describe the existing KHQR/Bakong flow, payment verification, order status, and delivery expectations. Never claim payment is verified from a screenshot alone.
- **Refund Policy:** display actual existing refund, cancellation, and dispute terms. If terms are absent or inconsistent, flag them for owner review rather than inventing terms.
- **Points & Coupons:** show the exact reward options and costs from Section 1, explain how points are earned and redeemed based on existing behavior, and describe coupon eligibility and checkout application accurately.
- **FAQ & Help:** answer common questions using verified current app behavior and provide the support route.
- **Contact Support:** link to `https://t.me/uchirosupport`.
- **Back Home:** return to the authoritative main menu and preserve the user's flow/language preference.

## 4. Premium Emoji and navigation integrity

- Reuse the existing Telegram Premium Emoji IDs and downloaded assets already in the project. Do not ask the owner to upload them again or invent replacement IDs.
- Prevent duplicate icons. When an inline button uses `icon_custom_emoji_id`, do not also prepend the same Unicode emoji to its label if that causes duplication. If custom emoji is unsupported and a fallback is used, display exactly one fallback icon.
- Do not insert `<tg-emoji>` HTML tags into inline button text.
- Keep all button labels in English, except the intended language-choice buttons.
- Do not break existing Open Store, Buy Robux, Get 2FA Code, How to Buy & Pay, My Orders & Vault, Claim Free Points, support, or admin features.
- Ensure every submenu can return to Rules & Policies or the main menu as specified; no dead buttons, missing callback handlers, or competing main menu definitions.

## 5. Focused verification

Inspect only the relevant menu/keyboard builders, reward and coupon handlers/services, database defaults/configuration, points ledger and checkout coupon validation, localization files, callback registrations, and tests.

Add or update tests for:

- Gacha Ticket costs exactly 100 Points in display and actual redemption.
- Coupons cost exactly 50, 100, and 200 Points respectively.
- A 50-Point coupon price is not accidentally changed by the ticket fix.
- Insufficient points do not award a reward or deduct an incorrect amount.
- Duplicate/concurrent requests cannot double-deduct or grant rewards twice.
- Points ledger remains consistent with the resulting balance.
- Redeemed coupons are accepted/applied correctly in checkout or are accurately reported as unsupported until fixed.
- Every Rules & Policies button opens its correct screen.
- Back to Rules & Policies, Back Home, and Contact Support work.
- All visible button labels are English except language selection, and no duplicate emojis appear.
- No orphaned or duplicate callback registrations are introduced.

Run the focused tests, existing relevant test suites, typechecks, and required production builds. Report exact commands and actual pass/fail results. Do not claim a test passed unless it ran successfully.

## 6. Safe completion

Before finishing, inspect the diff and ensure there are no secrets, environment files, unrelated changes, destructive SQL operations, or accidental data resets. Do not commit, push, or deploy unless separately requested. Report:

1. Files changed.
2. Final reward costs and confirmation they match backend behavior.
3. Rules & Policies submenu and callback results.
4. Test/build results.
5. Any policy text requiring the store owner's confirmation.
6. Remaining bugs or limitations.
