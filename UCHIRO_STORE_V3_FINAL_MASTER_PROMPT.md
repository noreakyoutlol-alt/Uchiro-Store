# UCHIRO STORE V3 — Final Master Implementation Prompt

## Mission

Continue improving my **existing UCHIRO STORE V3 monorepo**. Do not rebuild the project from scratch, create a replacement application, or redesign unrelated parts of the UI. Inspect the current repository first, preserve working features and existing user changes, then make only the changes described below.

My main goals are:
1. Change **only the Store Mini App background** to use my existing `pattern.svg` design.
2. Fix all broken, missing, or duplicated Telegram Premium Emoji rendering by reusing the emoji IDs and downloaded emoji assets that are **already present in the project**.
3. Make the Store Mini App cleaner, faster, more responsive, and smoother without an unnecessary redesign.
4. Simplify the Store Bot `/start` flow and use the requested English-only main menu.
5. Make Robux price and stock configurable in the Admin Bot and ensure all stock calculations are accurate and concurrency-safe.
6. Keep the official support link available throughout the Bot and Mini App.
7. Keep existing store, order, payment, security, PostgreSQL, and group-announcement features working.
8. Verify changes with real tests and builds, then safely publish the intended changes to the confirmed GitHub deployment branch so the existing Railway auto-deploy integration can run.

## 1. Important interpretation of my supplied files and screenshots

I have already supplied the Premium Emoji IDs, emoji asset files, `emoji(1).txt`, `pattern.svg`, and screenshots/examples in this project/conversation.

**These supplied files and screenshots are primarily references for inspection. They are not a request to upload, recreate, or replace all assets.** The project already contains the emoji IDs and files. Do not ask me to upload them again, do not ask me to move them manually, and do not create replacement emoji IDs.

- Locate and inspect the emoji IDs, downloaded assets, existing emoji registry, renderers, and fallback logic in the current repository.
- Locate `pattern.svg` or the corresponding pattern asset already supplied. If there is a copy in the repository, use the existing project copy. Do not create an unrelated new pattern.
- Use screenshots only to understand the current problems and the example message/button layout. Do not reproduce the screenshot as a static UI or redesign the whole application to look exactly like a screenshot.
- The **only visual design asset I specifically want changed is the Store Mini App background pattern**. Other changes should repair functionality, emoji display, responsiveness, speed, and movement/transition quality while retaining the current overall design, brand, colors, pages, and working layout.
- Do not replace or regenerate my existing emoji assets just because some of them are not currently rendering. Fix the registry, paths, asset resolution, rendering pipeline, or fallback behavior.

## 2. Repository-first and safe-change rules

Before modifying code:

1. Inspect the current Git branch, working tree, remotes, recent commit history, monorepo structure, package scripts, and current diffs.
2. Locate the Store Bot, Admin Bot, Store Mini App, Admin Dashboard, PostgreSQL schema/migrations, payment/order services, emoji registry/assets, and existing tests.
3. Establish a baseline by running the relevant existing diagnostics/tests/typechecks/builds where practical.
4. Keep unrelated user changes. Never use destructive commands such as `git reset --hard`, `git clean -fd`, force push, or database reset.
5. Never commit `.env` files, tokens, Admin PINs, JWT/encryption secrets, database credentials, payment keys, customer credentials, or other private data.
6. Do not remove a callback or legacy implementation until you have searched for all references and confirmed it is genuinely unused.

Implement changes in the existing architecture. Prefer small, targeted fixes over large rewrites.

## 3. Store Mini App background pattern — the only requested design-asset change

Use my existing `pattern.svg` as the Store Mini App's background pattern.

Requirements:
- Apply it only to the Store Mini App background or the intended background layer. Do not automatically apply it to the Admin Dashboard, Telegram messages, unrelated pages, or every card.
- Preserve the current overall Store Mini App appearance, content hierarchy, brand identity, colors, product cards, buttons, navigation, and layout.
- Keep foreground text, prices, stock status, product imagery, and buttons easy to read against the pattern.
- Use the pattern in an efficient, responsive way. Avoid stretching that distorts its geometry, excessive tiling that creates visual noise, or oversized unoptimized assets.
- Avoid unnecessary layout shifts while the background loads. Ensure the background works across supported mobile and desktop viewport sizes.
- Respect reduced-motion preferences for UI movement; a static background pattern itself should not create distracting motion.
- If a required asset path is missing, search the repository for the already supplied pattern before reporting a blocker. Do not silently substitute a different design.

## 4. Fix Premium Emoji rendering using my existing IDs and assets

All my emoji IDs and emoji files are already supplied/in the project. Do not ask for them again or invent replacements.

Audit and fix emoji rendering across:
- Store Telegram Bot message bodies and inline buttons.
- Admin Telegram Bot messages and inline buttons.
- Store Mini App.
- Admin Dashboard where the shared emoji component is used.
- Any common emoji registry, renderer, asset manifest, or outbound Telegram formatting guard.

### 4.1 Correct asset resolution and animation
- Find the existing emoji asset directories and manifests; inspect file naming, ID-to-file mapping, extensions, and actual formats.
- Resolve each registered emoji to its correct existing asset where possible.
- Use a compatible renderer for the actual supplied file type: for example WebM/video for supported animated assets, WebP or another valid image format for images, SVG for compatible vector icons, and Unicode fallback only when needed.
- For animated emojis, use the appropriate playback strategy and ensure animations initialize correctly when an item mounts, re-enters the viewport, or is displayed inside a reused component.
- Do not claim an emoji is animated merely because its filename or ID exists. Verify the underlying asset is animated and supported by the renderer.
- Do not try to force animation on inherently static assets. Keep static assets static and render them cleanly.
- Handle loading, failed decoding, unsupported formats, missing mappings, and reduced-motion preferences without broken icons, layout jumps, or console-error loops.
- Avoid loading the same large assets repeatedly; cache/memoize appropriately and lazy-load offscreen assets where useful.

### 4.2 Fix broken mappings and duplicates
- Check every referenced emoji key/ID and corresponding asset path.
- In the supplied registry excerpt, `EMOJI.HOME` references `TELEGRAM_EMOJIS.HOUSE`, but the excerpt did not show a `HOUSE` entry. Check the real repository and fix this or other missing mappings using the intended existing emoji ID/asset. Do not invent an ID.
- Check duplicate aliases that intentionally share the same fallback/ID and ensure aliases do not cause double insertion.
- Fix any Unicode variation-selector, surrogate-pair, or string-replacement bugs that stop an emoji from being recognized.
- Do not globally replace already-rendered `<tg-emoji>` tags with nested or duplicated tags.
- Never put Telegram HTML `<tg-emoji>` markup directly into inline-button text. Use the correct custom-emoji button field if supported by the current Bot API/client and existing bot implementation; otherwise use exactly one safe Unicode fallback.
- If an inline button has a custom emoji icon, do not also prepend the same visible Unicode emoji to the label unless a deliberate compatibility rule requires it. A fallback must never appear alongside a duplicate custom icon.
- Keep the existing IDs intact; only correct invalid references if repository evidence shows the mapping is wrong.

### 4.3 Add validation
- Add or improve a diagnostic that compares registry entries, referenced IDs, and local asset files.
- It should identify missing files, orphan assets, invalid IDs/mappings, duplicate rendering patterns, and assets that cannot animate in the selected renderer.
- The diagnostic must not expose secrets or delete files.
- Test representative static and animated emoji in Mini App and Telegram Bot output, including fallback cases.

## 5. Store Mini App performance, responsiveness, and movement

Improve the Store Mini App's speed and polish without making an unnecessary visual redesign.

Inspect and fix measurable problems such as:
- Excessive React renders or effects that repeat unexpectedly.
- Duplicate API requests, stale async requests, unnecessary polling, and state updates after a component is unmounted.
- Expensive list rendering or image/emoji loading.
- Large assets that can be safely optimized or lazy-loaded.
- Navigation and button transitions that are inconsistent, jittery, or delayed.
- Layout shifts, overflowing cards, broken responsive behavior, and text that becomes difficult to read.
- Slow database/API paths only when profiling or inspection shows they affect Mini App behavior.

Requirements:
- Keep existing working routes, product functionality, account/receipt/order pages, rewards, and navigation intact.
- Keep transitions smooth and purposeful, with quick feedback for taps and navigation. Do not add unnecessary animations to everything.
- Avoid heavy animation loops, excessive shadows/filters, or effects that cause lag on lower-end phones.
- Respect `prefers-reduced-motion` and provide appropriate touch/mobile behavior.
- Do not trade away data correctness, payment integrity, or accessibility for visual effects.
- Where possible, record a before/after measurement or clear evidence for any claimed performance improvement. Do not claim “zero lag” without measurement.

## 6. Store Bot `/start` and English-only main menu

When a customer opens the Store Bot or sends `/start`, show the English welcome message and main menu directly.

Requirements:
- Do not display an initial language-selection screen or require a language-selection step.
- Set English as the default for new users and use English labels on all visible Store Bot inline/reply keyboard buttons.
- Existing stored user records and required data must be preserved. Do not reset users or database tables to change the default UI language.
- Remove old language-selection UI from the active `/start` flow. Remove related handlers only after confirming they have no other valid uses.
- Remove genuinely obsolete/duplicate buttons from the active main menu, but preserve features still required by customers and admins.
- Do not leave orphan callback IDs, dead buttons, duplicate main-menu definitions, or broken Back Home navigation.
- All customer-facing buttons should use short, clear English labels.

The active Store Bot main menu should contain these features (use the existing layout/keyboard style where possible):

1. `Open Store` — prominent first row/button.
2. `Buy Robux` and `Get 2FA Code`.
3. `How to Buy & Pay` and `My Orders & Vault`.
4. `Claim Free Points` and `Chat with Admin / Support`.

Use the existing appropriate emoji IDs/assets and ensure no icon is doubled. Preserve working 2FA, Vault, order history/tracking, daily rewards/streaks, support, store, and payment features. Keep `Back Home` in relevant submenu screens.

## 7. How to Buy & Pay guide — use the screenshot as a reference only

Use the supplied Telegram screenshot as a reference for clear formatting, numbered steps, button grouping, separators, and concise instructions. It is not a request to create a static copy of the screenshot.

The guide should explain in clean English:
1. Open Store to browse products.
2. Select the intended product/account/item and choose Buy Now.
3. Follow the displayed KHQR/Bakong payment instructions.
4. After payment is independently verified, the bot delivers the eligible product details through the intended private flow and shows the order in My Orders & Vault.

Keep buttons in English, for example:
- `Step-by-Step Guide`
- `KHQR Payment Guide`
- `Open Store Now`
- `Back Home`

Fix emoji duplication and spacing. Keep payment claims accurate; never claim delivery within a fixed number of seconds unless that behavior is verified in the actual workflow.

## 8. Official support link

Use this exact support URL in the existing support entry points:

`https://t.me/uchirosupport`

Use a clear English button label such as `Contact Support` or `Chat with Admin / Support` in the appropriate Bot and Mini App location. Validate the URL string and do not invent an alternate support handle. Do not remove the existing admin-support workflow; keep it if it is still used.

## 9. Configurable Robux pricing and shared stock in Admin Bot

I want to manage the Robux rate and stock from my existing Admin Bot rather than editing source code for routine price/stock updates.

The initial desired rate is **USD 3.50 per 1,000 Robux**. Store the rate as a persistent setting in PostgreSQL; do not hardcode the displayed price as the only source of truth.

### Admin controls
Add or complete English-only authorized Admin Bot controls for:
- `Set Robux Rate`
- `Add Robux Stock`
- `View Available Stock`
- `View Robux Orders`
- `Manage Robux Settings`

Only verified, authorized administrators can change the price, add stock, alter settings, or manage order fulfillment. Persist every rate/stock change and record an audit entry.

### Pricing
At USD 3.50 per 1,000 Robux, expected examples are:
- 100 Robux = $0.35
- 200 Robux = $0.70
- 500 Robux = $1.75
- 1,000 Robux = $3.50
- 10,000 Robux = $35.00

Use integer cents or a reliable decimal/money implementation. Avoid JavaScript floating-point errors. Compute displayed prices from the current persisted rate and package amount, not from hardcoded text.

### Shared stock model
Use one coherent source of truth for the shared Robux pool. Define clearly whether the durable table stores total stock or remaining stock; do not subtract sold stock twice.

If the table tracks total stock added, the conceptual available value is:

`available_robux = total_added_robux - fulfilled_robux - active_reserved_robux`

If the table instead stores a remaining balance, calculate available stock from that remaining balance minus active reservations. Use one model consistently in every query and UI.

The number of complete available packages is:

`available_packs = floor(available_robux / denomination)`

Examples when 1,000 Robux is available:
- 100 Robux: 10 packs.
- 200 Robux: 5 packs.
- 500 Robux: 2 packs.
- 1,000 Robux: 1 pack.
- 2,000 Robux: sold out.

After 100 Robux is successfully fulfilled, 900 remain available:
- 100 Robux: 9 packs.
- 200 Robux: 4 packs.
- 1,000 Robux: sold out.

Support the intended denominations from 100 through 10,000 Robux according to the existing package rules. Display the rate, actual available Robux, package amount, package price, and available package count separately and clearly.

### Transactions and buyer flow
- Revalidate stock on the server when a customer selects a package; never trust the button's displayed stock.
- Use PostgreSQL transactions/locking and idempotent order operations to prevent concurrent overselling or duplicate fulfillment.
- Reserve stock for a configured time window only when the order is actually created; safely release expired/cancelled reservations.
- Ask only for the customer's Roblox username, resolve public profile details when available, show the avatar/canonical username, and require explicit confirmation.
- Never request Roblox passwords, cookies, session tokens, or private credentials.
- Verify payment from the real payment integration; a screenshot or button click is not proof of payment.
- Admin must confirm actual permitted fulfillment before marking an order delivered. Never falsely show an order as paid or delivered.
- **Compliance gate:** before enabling direct Robux resale or payment-for-transfer, verify that the exact sales/delivery model is permitted by current Roblox rules. If authorization cannot be verified, keep that direct transaction/fulfillment path disabled and report the blocker; do not silently activate a potentially unauthorized flow. Preserve reusable admin stock/settings and order-management functionality where appropriate.

## 10. Telegram announcement group

Keep or implement group announcements using the existing architecture and PostgreSQL-backed event deduplication.

Support these event types when the corresponding real event occurs:
- New product published.
- Restock received.
- Verified purchase succeeded (with partial customer-name masking).
- Stock changed where a group edit is appropriate.
- Product sold out.

Requirements:
- Each suitable announcement includes a `Buy Here` deep link to the correct product in the Store Bot.
- Use existing valid emoji IDs/assets without duplicates; use clean English button labels.
- Never publish passwords, 2FA codes, inventory credentials, payment secrets, private profile details, or other sensitive data.
- Send purchase announcements only after independent payment verification.
- Deduplicate events across retries/restarts using durable event/order IDs so the group is not spammed.
- Where supported, edit the previously announced message for stock changes/sold-out updates instead of flooding the group.
- The group should be announcement-only for ordinary members; only the owner/authorized staff and the bot should be able to post as configured. Do not remove unrelated admin permissions without review.
- Check that the correct bot has permission to post/edit messages and that the configured chat ID is available. Do not invent the chat ID.

## 11. Security, PostgreSQL reliability, and Railway environment variables

Preserve the existing security and persistence work while verifying it against the real code:
- PostgreSQL is the durable source of truth for users, points, products, stock/inventory, orders, reservations, coupons/rewards, and security events.
- Critical production writes must not silently succeed in memory if PostgreSQL is unavailable. Fail safely for critical transactions and provide retry/recovery behavior that cannot create duplicates.
- Use additive, non-destructive migrations. Do not use `DROP TABLE`, `TRUNCATE`, destructive resets, or production demo resets.
- Check table-name consistency throughout migrations, repositories, and service queries.
- Ensure startup does not claim readiness if required database/security initialization failed.
- Verify admin authorization server-side, IP-block persistence, proper trusted-proxy configuration, input validation, and audit logs.
- Application-level rate limits are not a complete network DDoS solution; do not claim otherwise.

### Railway variables I have reported as already configured

Treat these names as already present according to my report, but do not claim their values or validity are verified unless authorized Railway access confirms it:

- `STORE_BOT_WEBHOOK_SECRET`
- `ADMIN_BOT_TOKEN`
- `ADMIN_BOT_WEBHOOK_SECRET`
- `ADMIN_TELEGRAM_IDS`
- `KHPAY_BASE_URL`
- `KHPAY_API_KEY`
- `TELEGRAM_CHANNEL_USERNAME`
- `TELEGRAM_SUPPORT_USERNAME`
- `ADMIN_BASE_PATH`
- `ADMIN_BOT_USERNAME`
- `ADMIN_SECRET_PATH`
- `ADMIN_SECRET_PIN`
- `DATABASE_URL`
- `STORE_BOT_USERNAME`
- `STORE_URL`

My Admin PIN is already configured in Railway. **Do not print it, hardcode it, change it, or ask me to enter it again.**

Compare the actual environment-variable names expected by code with the names above. In particular, check whether the app reads `ADMIN_SECRET_PIN` or `ADMIN_PANEL_PIN`, and identify the actual Store Bot token variable. Do not confuse `STORE_BOT_USERNAME` with a bot token.

Check whether the application genuinely requires other variables, such as:
- `STORE_BOT_TOKEN` or the existing equivalent.
- `ADMIN_SESSION_SECRET` and/or `JWT_SECRET`.
- `ENCRYPTION_KEY` if existing credential encryption requires it.
- `TELEGRAM_ANNOUNCEMENT_GROUP_ID` for group announcements.
- Relevant webhook/public URL and security settings.

These are audit candidates, **not an instruction to blindly add all of them**. Inspect the current configuration code and identify the exact required names, defaults, and service scope. If authorized Railway access exists, compare configured variable names without exposing secret values. Do not overwrite existing valid settings. Generate a new secret only if required, safe to rotate, and supported by the actual config. If access is unavailable, produce an exact manual checklist and do not pretend that variables were added.

## 12. Verification requirements

Run the actual project commands available in `package.json` and report exact results. Do not invent passing test results.

At minimum verify:
- Existing complete test suite, plus new/affected tests.
- TypeScript checks for `@uchiro/server`, `@uchiro/client-store`, and `@uchiro/client-admin`.
- Production builds for server, Store Mini App, and Admin Dashboard.
- The project diagnostic scripts, including callback/emoji checks if present.
- `/start` opens the main menu directly and no longer shows language selection.
- All active buttons are English and every callback is handled.
- No duplicate emoji appears in messages/buttons; valid custom emoji IDs and fallbacks behave correctly.
- Supplied local emoji files are mapped and loaded; animated assets actually animate in the intended Mini App renderer.
- The Mini App uses the existing `pattern.svg` background while keeping the rest of the design intact.
- Store navigation, payment flow, orders/vault, 2FA, rewards, and support still work.
- Robux rate/stock math, reservations, sold-out behavior, concurrency, payment idempotency, and the compliance gate behave correctly.
- Announcement formatting, privacy masking, deep links, duplicate-event handling, and stock/sold-out updates behave correctly.
- PostgreSQL outage/restart behavior does not lose critical writes or create duplicate orders.

If live Telegram, KHPay, or Railway checks cannot be run safely, label them `not verified live` rather than claiming success. Never use production money or customer data for destructive tests.

## 13. Final release, GitHub push, and Railway deployment

I want the finished, verified changes pushed to GitHub so the existing Railway GitHub integration can auto-deploy.

After implementation and tests:
1. Inspect `git status`, branch, remotes, staged/unstaged diffs, and recent commits.
2. Verify the intended deployment branch. The previously reported production branch is `main`, but confirm the actual target instead of guessing.
3. Inspect the staged diff and ensure no secrets, `.env` files, customer credentials, generated database files, or unrelated user changes are included.
4. Commit only intended changes and push without force. Never use destructive Git commands.
5. If critical checks fail, the branch is unclear, or a secret would be exposed, do not push until the blocker is resolved; explain it precisely.
6. After pushing, check GitHub's actual push result and Railway deployment status/logs if authorized access is available.
7. Distinguish a successful commit, successful push, deployment started, and deployment succeeded. Do not claim Railway deployment succeeded unless verified.

## 14. Final report format

When done, give me a concise but complete report with:
- Which code paths/files were changed and why.
- Confirmation that the original IDs and assets were reused and not replaced.
- The exact background change made using `pattern.svg`.
- Which emoji assets are animated versus static, which are fixed, and any unresolved mappings.
- Mini App performance changes and evidence/tests.
- Final Store Bot menu and support-link status.
- Robux admin rate/stock implementation status and any compliance blocker.
- Group announcement implementation status.
- Environment-variable names already present, variables actually added (if any), variables still missing, and manual steps. Never show secret values.
- Exact test/typecheck/build pass/fail results.
- Current branch, commit hash, push result, and verified Railway deployment status.

Do not stop at a plan if safe implementation work can be completed. Do not claim a feature is done unless the code and relevant checks support that claim. Preserve the existing project and all unrelated working functionality.
