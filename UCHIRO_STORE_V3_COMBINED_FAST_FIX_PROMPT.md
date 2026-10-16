# UCHIRO STORE V3 — Combined Fast Fix Prompt

## Goal and working rules

Fix the existing UCHIRO STORE V3 monorepo in place. This prompt combines the emoji/button/start/admin-routing fixes and the space-doodle background update. **Work efficiently:** do not reread the entire repository, re-review unrelated modules, or repeat earlier broad audits. Inspect Git status first, then use focused searches and read only files relevant to the issues below. Make a short internal checklist, implement the fixes in this session, and test once after the grouped changes. Do not stop at recommendations.

My Telegram Premium Emoji IDs and downloaded emoji assets already exist in the project. Screenshots and `emoji(1).txt` are references for inspecting the current behavior/mappings, not replacement UI assets. Do not ask me to upload files again, invent emoji IDs, or replace working assets. The space-doodle reference image is visual guidance only; do not use the screenshot itself as the production background. The background pattern is the only intended visual-design change; otherwise preserve the current UI, theme, product screens, existing features, and user changes.

Never use destructive Git commands, reset production data, print/commit secrets, or overwrite unrelated work.

## 1. Remove duplicate Premium Emojis everywhere

Reproduce and fix duplicate/missing emoji rendering in Store Bot, Admin Bot, message bodies, inline buttons, group announcements, Store Mini App, and Admin Mini App. Focus on these likely locations and nearby helpers only:
- `shared/config/emoji.ts`
- `server/src/config/telegram-emojis.ts` (or the actual registry path)
- `renderTgEmoji`, `tgEmoji`, `enrichWithTgEmojis`, Telegram outbound guards
- keyboard/button builders such as `makeButton` and `createEmojiInlineButton`
- `client-store/src/components/common/TgEmoji.tsx`, `client-admin/src/components/common/TgEmoji.tsx`, emoji asset resolver/registry

Rules:
- Reuse the exact IDs and downloaded files already present; do not generate new IDs.
- If a button uses Telegram's `icon_custom_emoji_id`, its label must be plain English text without the same Unicode emoji prefix. If custom icons are unavailable, show exactly one fallback emoji, not both.
- Never put `<tg-emoji>` HTML in inline-button text.
- For message bodies, the fallback glyph inside `<tg-emoji>` is expected; do not add another standalone copy. Make enrichment safe to run twice, with no nested tags or duplicate rendering.
- Fix confirmed missing/incorrect aliases (including `EMOJI.HOME` versus `TELEGRAM_EMOJIS.HOUSE`) using an existing valid mapping. Do not blindly replace unrelated IDs.
- Preserve the existing custom Robux emoji ID `5406705291213417505` for Buy Robux if supported by the actual Telegram API path; use one fallback if not supported.
- In the Mini Apps, use the renderer suited to each asset's actual format. Existing animated assets should animate where their format and renderer support it; do not claim static files are animated.

## 2. Restore first-time language selection and fix every button

`/start` must show language selection for a first-time user who has no saved language. The two language buttons must be English labels: `Khmer` and `English`. After selection, save the choice in the existing user/profile database and show the main menu. Returning users with a saved preference should go straight to their menu. Localize message bodies where supported, but **all visible button labels in both bots and all submenus must be English**.

Fix the actual callback/handler causes—not just the appearance. For every active button, verify its callback ID/URL, registration, correct bot ownership, actual handler action, prompt callback answer, and error/empty/loading handling. Ensure Back Home returns to the canonical menu. Fix duplicate/missing callback registrations and orphan callbacks. Audit legacy menu definitions and remove obsolete active buttons/handlers only when focused reference searches show they are unused. Keep required Store features, Orders/Vault, 2FA, rewards/Gacha, Robux, admin controls, and support.

At minimum verify: Open Store; Buy Robux; Get 2FA Code; How to Buy & Pay; My Orders & Vault; Claim Free Points; Chat with Admin / Support; Step-by-Step Guide; KHQR Payment Guide; Open Store Now; Back Home; and relevant order/vault/2FA/reward/Gacha/profile/Robux confirmation/payment/error states. Buttons must not get stuck without feedback.

## 3. Fix Admin Mini App opening the Store

Trace the real routing/build/URL issue with focused inspection of `client-admin`, `client-store`, entry points/routers, Vite config/package scripts, launch URLs, route fallbacks, and relevant settings (`ADMIN_BASE_PATH`, `ADMIN_SECRET_PATH`, `ADMIN_SECRET_SLUG`, `STORE_URL`). Fix the underlying cause so Admin URLs render the Admin Dashboard and Store URLs render the Store. Keep build outputs and service routing separate. Do not guess or hardcode production URLs; if Railway service settings cannot be inspected, state exactly what needs manual verification. Add a suitable regression check.

## 4. Change only the Mini App background to the space-doodle pattern

Update the existing `pattern.svg` and its integration (including `client-store/src/components/background/GamingDoodlePattern.tsx` if applicable) to resemble the supplied reference: near-black/deep-navy base, thin outline-only space doodles (planets/rings, stars, rockets, astronauts, UFOs, satellites, orbital paths), restrained muted blue/indigo/lavender strokes, subtle and evenly scattered, seamless/repeating.

- The screenshot is visual guidance only; do not ship the screenshot as the background. Modify/use the existing SVG asset. Do not add new design assets unnecessarily.
- Change only the background pattern and the minimal integration needed. Keep the current Uchiro brand palette, components, layout, cards, buttons, theme and navigation otherwise unchanged.
- Make tiling seamless on mobile, desktop, and Telegram WebApp; keep contrast low enough for legible content; avoid visible seams, large empty zones, excessive filters, heavy animation, huge embedded images, or lag. Respect reduced-motion preferences.
- Use/modify the existing asset at the actual path used by the app (likely `client-store/public/pattern.svg`); avoid introducing duplicate root/public assets unless the code needs them.

## 5. Support link and existing Robux behavior

Use only the official support URL `https://t.me/uchirosupport`, with English labels such as `Contact Support` or `Chat with Admin / Support`, wherever support links already appear (bot, Mini App, profile, receipt/delivery, and Robux screens).

Preserve and repair the existing Admin Bot Robux controls so admins can set the rate and add/view the shared stock through the bot, without editing source code. Default rate, only when no persisted rate is configured: `$3.50 per 1,000 Robux`. Use integer cents or safe decimal arithmetic. Display current rate, total/reserved/available stock, price and available package count consistently from persisted data. Shared inventory must not oversell under concurrent reservations; expirations/releases and order/payment transitions must be safe and idempotent. Customers enter only a Roblox username, view resolved public profile details, and confirm the intended account; never request Roblox passwords/cookies/session tokens. Keep direct sale/delivery disabled unless the exact method is verified as permitted under applicable Roblox rules. Never claim payment or delivery without verification.

## 6. Protect data and secrets

Keep PostgreSQL as the durable source of truth. Critical writes must not silently fall back to memory-only state when PostgreSQL is unavailable. Use appropriate transactions, uniqueness constraints and idempotency. Preserve all users, points, tickets, products, inventory, orders, receipts, Robux records and security events. Do not reset or destructively migrate data. Reuse existing Railway variables; only flag truly missing or mismatched names. Never hardcode or print Admin PINs, bot tokens, database URLs, JWT/session secrets, encryption keys, or payment credentials.

## 7. Fast, focused verification

Do not run duplicate checks after every edit. After the grouped fixes, run:
1. Focused tests for emoji de-duplication/idempotency, missing mappings, English button labels, first-time language choice persistence, callback registration/handling, Admin-vs-Store routing, background path/tiling integration, support URL, and Robux price/stock/reservation safety.
2. Existing test suite once, if feasible, and report exact actual counts.
3. Typechecks and production builds for server, client-store, and client-admin.

Fix relevant failures and rerun only failed/affected checks, then give exact results. Do not claim animation, Telegram runtime behavior, or Railway routing is verified unless actually checked. If a live Telegram/Railway check is unavailable, identify it as a manual verification item.

## 8. GitHub and Railway release

After critical checks pass, inspect `git status`, focused diff, staged files, and secrets. Preserve unrelated changes. Stage only intended files, including the existing background asset if required. Do not blindly use `git add -A`. Never force-push or use destructive Git commands. Confirm the intended Railway deployment branch (previously reported as `main`) and configured remote before committing/pushing. If the user's working tree contains unrelated changes, secrets, failed critical checks, or an ambiguous branch, stop and report the blocker. Otherwise commit the intended changes and push without force. Report changed files, test/build results, commit hash, push result, and Railway deployment status. A successful push is not proof of successful deployment.

**Start now:** quickly inspect Git status and only the relevant files above, reproduce the duplicate emoji, broken callback, and Admin routing symptoms, implement the fixes plus the background pattern change, then run the focused checks and release process. Keep analysis and final reporting concise to conserve tokens.
