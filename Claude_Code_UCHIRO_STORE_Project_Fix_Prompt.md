# Claude Code — Existing UCHIRO STORE Project Fix Prompt

## Mission and scope

You are working inside my **existing project repository**. Your job is to inspect, fix, and improve the current code so it implements the requirements in the source specification below. **Do not create a new project from scratch, replace the whole application, rename the project, or rewrite working systems unnecessarily.** Make the smallest safe changes that fit the repository's current framework, architecture, naming conventions, and dependencies.

The source specification below is the authoritative scope for this task. Implement the requested bot messages, bilingual user experience, English-only inline button labels, Telegram Premium custom-emoji handling, admin broadcast flow, user rewards/vault/orders behavior, and durable PostgreSQL persistence for Railway. **Do not add unrelated features** or invent business rules, payment providers, products, callbacks, table fields, prices, or reward values that are not specified or already present in the codebase.

If the repository does not appear to be the UCHIRO STORE Telegram bot described in this specification, inspect it and report that mismatch before changing unrelated code. Do not assume this is a different project merely because its internal names differ; verify by reading the project files.

## Required workflow — follow in order

1. **Audit before editing.** Read the project instructions (`CLAUDE.md` if present), `README`, package/dependency manifests, directory layout, environment-variable examples, bot handlers, callback/query routing, database models/repositories/migrations, store/admin code, tests, and deployment configuration. Identify the language/framework and the actual entry points. Do not rely on assumptions or the snippets in the specification alone.
2. **Create a concise implementation map.** Match each requirement in the source specification to the actual file(s), handler(s), schema/model(s), and tests. Reuse existing implementations when sound. Do not duplicate handlers or create a second competing database/store layer.
3. **Protect current data and code.** Inspect `git status` before changes and preserve the user's uncommitted work. Never delete or overwrite existing user files, `.env` values, database records, or working features as a shortcut. Do not run destructive database commands. Do not run a production migration, alter a live Railway database, deploy, push commits, or change live secrets as part of this task.
4. **Implement in the existing architecture.** Make real code changes rather than returning only a plan. Keep the patch focused on this spec. Use the project's existing dependency and migration tools where possible. Avoid adding dependencies unless necessary; explain any necessary dependency.
5. **Keep the database durable.** Railway PostgreSQL, accessed through the project's configured `DATABASE_URL` or existing database configuration, must be the persistent source of truth for all listed user, points, product, inventory, order, Gacha, and coupon data. Do not rely on process memory or a local JSON file as the only persistent copy. If an in-memory cache is already part of the architecture, it must be rebuildable from PostgreSQL and must never overwrite real database data with empty defaults.
6. **Migrations must be non-destructive.** The source spec requests `CREATE TABLE IF NOT EXISTS` for safe initialization. Also inspect whether existing tables need additive migrations: `CREATE TABLE IF NOT EXISTS` does not update an already-existing table's columns. Use the existing migration framework or additive, reviewed migrations that preserve records. **Never use `DROP TABLE`, `TRUNCATE`, destructive reset scripts, or automatic database recreation.** Do not silently rename/drop existing columns or tables. If an unavoidable incompatible migration is found, do not run it; prepare a safe migration and explain the manual backup/approval needed.
7. **Correctness for purchases and rewards.** Use database transactions and the project's supported locking/constraint patterns where needed so a single stock item cannot be sold twice, order and inventory status cannot diverge, daily rewards cannot be claimed multiple times in the same 24-hour window, and a repeated payment/callback cannot deliver or award twice. Preserve the current payment-verification mechanism; do not treat merely opening or scanning a QR code as proof that a payment succeeded. Do not invent a new payment API.
8. **Handle secrets safely.** Never hardcode or print bot tokens, database credentials, raw account passwords, 2FA seeds, or other secrets in logs, tests, source control, or user-facing errors. Use existing environment configuration. Only show delivered account credentials to the correct authorized purchaser (and authorized admin paths already in the project). Preserve the spoiler requirement for account passwords.
9. **Telegram Premium emoji rules.** Inspect the existing Telegram library and current custom-emoji ID mappings. Use valid, real `custom_emoji_id` values already supplied by the project/configuration; do not invent IDs or emit malformed `<tg-emoji>` HTML. Centralize the conversion so it is maintainable, process only message-body text where appropriate, and preserve correct Telegram HTML escaping/parsing. The request is to render body emojis as `<tg-emoji emoji-id="...">` wherever a valid mapping exists. For an emoji without a known valid ID, use a safe Unicode fallback and clearly list the missing mapping instead of fabricating an ID. **Inline button labels remain English-only as specified and should not be broken by the message-body converter.**
10. **Initialization and failure behavior.** Ensure PostgreSQL connectivity, migrations, and required data loading complete before the bot/Mini App starts accepting operations. If the database is unavailable or initialization fails, fail visibly and safely; do not start with empty data and later save that empty state over the database. Do not promise an exact startup duration unless measured and demonstrated.
11. **Verify the work.** Run relevant existing tests, lint/type checks, and build checks available in the repository. Add or update focused tests for the changes. Use a local/test database or mocks; never run destructive test setup against production. Check message HTML, callback wiring, English-only button labels, language persistence, reward cooldown/ledger consistency, inventory uniqueness, order delivery idempotency, and PostgreSQL persistence across restart/reinitialization.
12. **Review the final diff.** Re-check `git diff` and `git status`. Remove accidental unrelated changes and secrets. Do not claim something passed unless you actually ran the check. If a check could not run, say why and give the exact command the user can run.

## Specific implementation requirements

### A. Bilingual message bodies and button labels

- Support the language choices `km` (Khmer) and `en` (English), persist the selected language in the user's PostgreSQL record, and render each specified body in that language. `/start` shows the bilingual language-selection message.
- Match the message text and placeholders in the source specification below. Preserve formatting tags and the exact stated labels, reward amounts, cooldown wording, product names, warranty wording, and callback names where present. Do not silently rewrite or omit copy.
- All inline keyboard button labels must stay **100% English** except the initial language-selection buttons explicitly shown as `🇰🇭 Khmer` and `🇬🇧 English`. The inline buttons may retain their emoji but their textual labels must be English. Do not translate inline button labels based on the user's language.
- Use safe Telegram HTML rendering. Escape user-supplied placeholders such as names, usernames, titles, order codes, and product names before inserting them into HTML, while preserving the intended message formatting. Verify message length and callback-data limits using the project's actual Telegram library.
- `/start`, main menu, How to Buy & Pay, KHQR guide, Get 2FA Code (both branches), daily points claim/cooldown, My Orders & Vault, delivered accounts, and admin broadcast must be wired into real existing handlers/callbacks rather than added as disconnected example strings.
- The named callback identifiers in the source (`cb_how_to_buy`, `cb_guide_khqr`, `cb_vault_2fa`, `cb_claim_daily`, `cb_orders_menu`, `cb_vault_accounts`) should be preserved if they exist; if the repository uses a different routing convention, connect equivalent routes without creating duplicate or dead callbacks.

### B. Admin broadcast flow

- Make `/broadcast` accept the admin's message with supported text formatting, images, and Telegram Premium custom emoji where the current bot framework/API supports it.
- Show the specified choice between normal text and the “Buy Now”/“Buy Products” button mode, then show a confirmation preview including recipient count and format, with confirm and cancel actions.
- Check that the sender is an authorized admin using the project's existing permission model. A non-admin must not be able to initiate or confirm a broadcast.
- Require explicit confirmation before sending to all users. Cancellation must not send any messages. Handle Telegram rate limits and per-user delivery failures using the project's existing patterns; report accurate success/failure totals and do not claim every recipient received the broadcast when delivery fails.

### C. Railway PostgreSQL persistence and data safety

- Store and retrieve the following logical data groups in PostgreSQL: users, points ledger, products, inventory, orders, Gacha pools/prizes, and coupons. The source calls these “seven” groups but names eight physical tables because `gacha_pools` and `gacha_prizes` are separate tables. Keep the two Gacha tables distinct unless the existing schema already represents the same data safely in another established way.
- Preserve and use all fields listed in the source specification, adapting names only when the existing schema consistently uses different names and a safe mapping is documented.
- All create/update operations must write to PostgreSQL, not just mutate `DataStore` memory or `data/store.json`. On startup, restore required data from PostgreSQL; never treat local JSON or empty arrays as the source of truth. If an existing JSON store contains real records that have not been migrated, do not discard them: inspect, plan a safe one-time import/migration, avoid duplicates, and report any manual step necessary.
- Make product create/update persist as the equivalent of `INSERT ... ON CONFLICT ... DO UPDATE`, using the project's ORM/repository conventions and safe field updates.
- Make inventory deposits persistent immediately. Do not store account secrets in public product data or broad application logs.
- On a confirmed successful purchase, atomically create/order the record, reserve/mark the exact inventory item sold, associate the buyer/order, and persist the delivered payload. Prevent duplicate fulfillment on payment retries, Telegram callback retries, concurrent buyers, or process restarts.
- Daily points, streak, cooldown timestamps, Gacha tickets/purchases/redemptions, language, and coupons must persist and use transactionally consistent balances and ledger entries. Honor the source's specified `+5 Pts`, 100-point exchange text, and 24-hour claim rule; do not invent unspecified prize odds, multipliers, or other reward rules. Where the source mentions a detailed “Streak Rules & Multipliers” page but does not specify the rules, preserve existing project rules and do not invent new ones.
- Configure runtime database use through existing environment variables. Do not commit `.env` or secrets. Verify that the Railway application is configured to reference the Railway PostgreSQL service's connection URL at deployment time, but do not change live Railway settings or deploy without explicit authorization.
- Treat backups and database restore procedures as an operational safeguard where supported. No software can honestly guarantee absolute zero data loss under every possible failure; implement durable persistence, safe migrations, idempotent transactions, and document the backup/restore assumptions. Never describe unverified absolute guarantees as proven.

### D. Delivery and final response from Claude Code

After making changes, report:

1. The high-level findings from the initial project audit.
2. The exact files changed and what changed in each.
3. Database migrations/schema changes, including how existing records are preserved and whether any manual migration/backup action is required. Explicitly call out the seven-logical-group/eight-physical-table wording above if it affects implementation.
4. Which tests/checks were run and their real results; clearly mark checks not run and why.
5. Any custom-emoji IDs missing from the current mapping and the safe fallback used.
6. Any remaining blockers or manual Railway environment setup, without claiming that deployment was performed.

Start by inspecting the repository, then implement the in-scope fixes. Do not stop at a plan if the repo is accessible and the work can be safely completed. If a specific step could destroy data or requires production access, do not perform that step; implement the safe code-side portion and clearly explain the remaining manual action.

---

# Source specification from the user (preserve all requirements and copy below)

The following is the full user-provided specification. Treat it as the source of truth for the exact message copy, labels, buttons, table fields, and behaviors described above. Do not omit any of it during implementation.

---

នេះគឺជាឯកសារលម្អិតបន្ថែមពេញលេញទាំង **២ ផ្នែកសំខាន់បំផុត** ដែលអ្នកបានស្នើសុំ៖

1. **អត្ថបទសារ (Message Text Body) សម្រាប់គ្រប់ប៊ូតុងទាំងអស់** (ដែលបង្ហាញនៅក្នុងប្រអប់ឆាតពីលើប៊ូតុង ទាំងភាសាខ្មែរ និងអង់គ្លេស អមដោយ Telegram Premium Emojis `<tg-emoji>` ខណៈដែលប៊ូតុងខាងក្រោមរក្សាជាភាសាអង់គ្លេស ១០០%)។
2. **ប្រព័ន្ធការពារទិន្នន័យ ១០០% លើ Railway PostgreSQL (Zero Data Loss on Redeploy)** ដែលធានាថារាល់ការ Deploy ថ្មី ឬ Restart Server គឺ**គ្មានថ្ងៃបាត់បង់** ពិន្ទុ, Streak, គណនីហ្គេម, ស្តុកទំនិញ, ឬប្រវត្តិបញ្ជាទិញរបស់អតិថិជនឡើយ។

# ផ្នែកទី ១៖ អត្ថបទសារ (Message Text) សម្រាប់គ្រប់ប៊ូតុងទាំងអស់ក្នុង Bot

> **ច្បាប់នៃការបង្ហាញ៖**
>
> - **តួសារខាងលើ (Message Body)៖** បង្ហាញជាភាសា **ខ្មែរ (`km`)** ឬ **អង់គ្លេស (`en`)** ទៅតាមភាសាដែល User បានជ្រើសរើស ហើយរាល់រូប Emoji ក្នុងតួសារត្រូវបំប្លែងទៅជា `<tg-emoji emoji-id="...">` ដោយស្វ័យប្រវត្តិ។
> - **ប៊ូតុងខាងក្រោម (Inline Buttons)៖** រក្សាជា **ភាសាអង់គ្លេស ១០០%** គ្រប់ពេលវេលា។

### ១. ពេលវាយ `/start` ដំបូង (Language Selection Message)

- **អត្ថបទសារ (បង្ហាញទាំង ២ ភាសារួមគ្នា)៖**

  HTML
  ```
  🌐 <b>WELCOME TO UCHIRO STORE</b>
  សូមស្វាគមន៍មកកាន់ហាង <b>Uchiro Store</b>!

  🇬🇧 Please select your preferred language below:
  🇰🇭 សូមជ្រើសរើសភាសាដែលអ្នកចង់ប្រើប្រាស់ខាងក្រោម៖

  ```
- **ប៊ូតុងខាងក្រោម៖** `[ 🇰🇭 Khmer ]` | `[ 🇬🇧 English ]`

### ២. ផ្ទាំងមេ (Main Menu Message — ក្រោយពេលរើសភាសា ឬចុច `🔙 Back Home`)

- **បើ User រើសភាសាខ្មែរ (`km`) — អត្ថបទសារ៖**

  HTML
  ```
  ⚡ <b>សូមស្វាគមន៍មកកាន់ UCHIRO STORE</b> ⚡
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 <b>អតិថិជន:</b> <code>{first_name}</code>
  💎 <b>ពិន្ទុសន្សំ:</b> <code>{points} Pts</code> | 🔥 <b>Streak:</b> <code>{streak} ថ្ងៃ</code>
  🎟️ <b>សំបុត្រ Gacha:</b> <code>{tickets} សន្លឹក</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  🔥 <b>សេវាកម្មចម្បងរបស់យើង៖</b>
  • 📦 ទិញភ្លាម ទទួលបានគណនី និងកូដភ្លាមៗ (Auto-Delivery ២ វិនាទី)
  • 🎮 មានលក់គណនី Blox Fruits, MM2, Blade Ball &amp; Evade
  • 💵 បង់ប្រាក់ងាយស្រួលតាម <b>Bakong KHQR</b> (ABA, Wing, ACLEDA...)
  • 🛡️ ធានាសុវត្ថិភាព ១០០% និងមានការធានាជូន ១៤ ថ្ងៃ

  👇 <i>សូមចុចជ្រើសរើសប៊ូតុងខាងក្រោមដើម្បីប្រើប្រាស់៖</i>

  ```
- **បើ User រើសភាសាអង់គ្លេស (`en`) — អត្ថបទសារ៖**

  HTML
  ```
  ⚡ <b>WELCOME TO UCHIRO STORE</b> ⚡
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 <b>Customer:</b> <code>{first_name}</code>
  💎 <b>Points:</b> <code>{points} Pts</code> | 🔥 <b>Streak:</b> <code>{streak} Days</code>
  🎟️ <b>Gacha Tickets:</b> <code>{tickets} Tickets</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  🔥 <b>Why Shop With Us:</b>
  • 📦 Instant Auto-Delivered Accounts &amp; Codes in 2 Seconds
  • 🎮 Blox Fruits, MM2, Blade Ball &amp; Evade
  • 💵 Instant <b>Bakong KHQR</b> Payments (ABA, Wing, ACLEDA...)
  • 🛡️ 100% Verified Safe with 14-Day Warranty

  👇 <i>Select an option below to get started:</i>

  ```
- **ប៊ូតុងទាំង ៦ ខាងក្រោម (English 100%)៖**
  - Row 1: `[ 🛍️ Open Store (Shop Now) ]`
  - Row 2: `[ 🇰🇭 How to Buy & Pay ]` | `[ 🔑 Get 2FA Code ]`
  - Row 3: `[ 🎁 Claim Free Points ]` *(ឬ `⏳ Cooldown (Wait 24h)`)* | `[ 📦 My Orders & Vault ]`
  - Row 4: `[ 💬 Chat with Admin / Support (24/7) ]`

### ៣. ពេលចុចប៊ូតុង `🇰🇭 How to Buy & Pay` និងប៊ូតុងរង

#### ៣.១ ផ្ទាំងមេនៃ `🇰🇭 How to Buy & Pay` (`cb_how_to_buy`)

- **អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

  HTML
  ```
  🇰🇭 <b>របៀបទិញទំនិញ និងបង់ប្រាក់នៅ UCHIRO STORE</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  ការទិញគណនីហ្គេម និងផ្លែឈើនៅហាងយើងខ្ញុំ គឺធ្វើឡើងដោយស្វ័យប្រវត្តិ ១០០% (២៤ ម៉ោង)៖

  1️⃣ <b>ជំហានទី ១៖</b> ចុចប៊ូតុង <b>🛍️ Open Store</b> ដើម្បីចូលមើលទំនិញ។
  2️⃣ <b>ជំហានទី ២៖</b> ជ្រើសរើសគណនី ឬទំនិញដែលអ្នកពេញចិត្ត រួចចុច <b>Buy Now</b>។
  3️⃣ <b>ជំហានទី ៣៖</b> ស្កេន <b>Bakong KHQR</b> តាមរយៈកម្មវិធីធនាគារ (ABA, ACLEDA, Wing, TrueMoney...)។
  4️⃣ <b>ជំហានទី ៤៖</b> ក្រោយបង់ប្រាក់រួច ២ វិនាទី ប្រព័ន្ធនឹងផ្ញើ <b>Username, Password និងកូដ 2FA</b> ចូលក្នុងឆាតនេះ និងក្នុង <b>📦 My Orders &amp; Vault</b> ភ្លាមៗ!
  ━━━━━━━━━━━━━━━━━━━━━━
  👇 <i>សូមជ្រើសរើសមើលការណែនាំលម្អិតខាងក្រោម៖</i>

  ```
- **អត្ថបទសារ (ភាសាអង់គ្លេស `en`)៖**

  HTML
  ```
  🇰🇭 <b>HOW TO BUY &amp; PAY AT UCHIRO STORE</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  Purchasing accounts and items is 100% automated 24/7:

  1️⃣ <b>Step 1:</b> Tap <b>🛍️ Open Store</b> to browse our catalog.
  2️⃣ <b>Step 2:</b> Pick your desired account or item and tap <b>Buy Now</b>.
  3️⃣ <b>Step 3:</b> Scan the <b>Bakong KHQR</b> using ABA, ACLEDA, Wing, or any banking app.
  4️⃣ <b>Step 4:</b> Within 2 seconds of payment, your <b>Username, Password &amp; Live 2FA</b> are delivered right here in chat and inside <b>📦 My Orders &amp; Vault</b>!
  ━━━━━━━━━━━━━━━━━━━━━━
  👇 <i>Select a detailed guide below:</i>

  ```
- **ប៊ូតុងរងខាងក្រោម៖**
  - `[ 📖 Step-by-Step Guide ]`
  - `[ 💳 KHQR Payment Guide ]`
  - `[ 🛍️ Open Store Now ]`
  - `[ 🔙 Back Home ]`

#### ៣.២ ពេលចុច `💳 KHQR Payment Guide` (`cb_guide_khqr`)

- **អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

  HTML
  ```
  💳 <b>របៀបស្កេនបង់ប្រាក់តាម BAKONG KHQR លើទូរស័ព្ទតែមួយ</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  ប្រសិនបើអ្នកប្រើទូរស័ព្ទតែមួយ អ្នកមិនចាំបាច់យកទូរស័ព្ទមួយទៀតមកថតស្កេនឡើយ៖

  • 📸 <b>វិធីទី ១៖</b> ថតអេក្រង់ (Screenshot) រូប QR Code ទុក។
  • 📲 <b>វិធីទី ២៖</b> បើកកម្មវិធីធនាគាររបស់អ្នក (ABA / ACLEDA / Wing) រួចចុចកន្លែង <b>Scan QR</b>។
  • 🖼️ <b>វិធីទី ៣៖</b> ចុចប៊ូតុងជ្រើសរើសរូបភាពពី Gallery រួចរើសរូប Screenshot QR នោះ។
  • ✅ <b>វិធីទី ៤៖</b> បញ្ជាក់ការបង់ប្រាក់ រួចត្រឡប់មកវិញ ប្រព័ន្ធនឹងបញ្ជូនទំនិញជូនភ្លាមៗដោយស្វ័យប្រវត្តិ!

  ```

### ៤. ពេលចុចប៊ូតុង `🔑 Get 2FA Code` (`cb_vault_2fa`)

- **ករណីទី ១៖ បើ User មានគណនីដែលបានទិញរួច (មាន 2FA ក្នុង PostgreSQL)៖**
  - **អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

    HTML
    ```
    🔑 <b>ប្រព័ន្ធបង្កើតកូដសុវត្ថិភាព LIVE 2FA AUTHENTICATOR</b>
    ━━━━━━━━━━━━━━━━━━━━━━
    📦 <b>ទំនិញ:</b> <code>{product_title}</code>
    👤 <b>Username:</b> <code>{account_username}</code>
    🔢 <b>កូដ 2FA បច្ចុប្បន្ន (6 ខ្ទង់):</b> <code>{totp_code}</code>
    ⏱️ <b>ផុតកំណត់ក្នុងរយៈពេល:</b> <code>{seconds_left} វិនាទី</code>
    ━━━━━━━━━━━━━━━━━━━━━━
    💡 <i>ចុចលើលេខកូដ 6 ខ្ទង់ខាងលើដើម្បី Copy យកទៅដាក់ក្នុង Roblox ភ្លាមៗ!</i>

    ```
  - **អត្ថបទសារ (ភាសាអង់គ្លេស `en`)៖**

    HTML
    ```
    🔑 <b>LIVE 2FA AUTHENTICATOR CODE</b>
    ━━━━━━━━━━━━━━━━━━━━━━
    📦 <b>Product:</b> <code>{product_title}</code>
    👤 <b>Username:</b> <code>{account_username}</code>
    🔢 <b>Current 6-Digit Code:</b> <code>{totp_code}</code>
    ⏱️ <b>Refreshes in:</b> <code>{seconds_left}s</code>
    ━━━━━━━━━━━━━━━━━━━━━━
    💡 <i>Tap the 6-digit code above to copy and paste it into your game login!</i>

    ```
  - **ប៊ូតុងខាងក្រោម៖** `[ 🔄 Refresh 2FA Code ]` | `[ 🔙 Back Home ]`
- **ករណីទី ២៖ បើ User មិនទាន់ធ្លាប់ទិញគណនីសោះ៖**
  - **អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

    HTML
    ```
    🔑 <b>មិនទាន់មានគណនីក្នុងប្រព័ន្ធនៅឡើយទេ</b>
    ━━━━━━━━━━━━━━━━━━━━━━
    អ្នកមិនទាន់មានគណនីហ្គេមដែលភ្ជាប់កូដ 2FA នៅឡើយទេ។
    នៅពេលអ្នកទិញគណនីពីហាងយើងខ្ញុំ អ្នកនឹងអាចចុចប៊ូតុងនេះដើម្បីយកកូដ 2FA 6 ខ្ទង់បានភ្លាមៗគ្រប់ពេលវេលា!

    ```
  - **អត្ថបទសារ (ភាសាអង់គ្លេស `en`)៖**

    HTML
    ```
    🔑 <b>NO DELIVERED ACCOUNTS FOUND</b>
    ━━━━━━━━━━━━━━━━━━━━━━
    You do not have any delivered accounts with 2FA yet.
    Once you purchase an account from our store, you can generate your live 6-digit login codes right here anytime!

    ```
  - **ប៊ូតុងខាងក្រោម៖** `[ 🛍️ Open Store (Shop Now) ]` | `[ 🔙 Back Home ]`

### ៥. ពេលចុចប៊ូតុង `🎁 Claim Free Points` (`cb_claim_daily`)

- **ពេលចុច Claim ជោគជ័យ — អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

  HTML
  ```
  🎁 <b>អបអរសាទរ! អ្នកទទួលបានពិន្ទុប្រចាំថ្ងៃជោគជ័យ</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  ✨ <b>ពិន្ទុទទួលបានថ្ងៃនេះ:</b> <code>+5 Pts</code>
  💎 <b>ពិន្ទុសន្សំសរុបរបស់អ្នក:</b> <code>{total_points} Pts</code>
  🔥 <b>Streak បច្ចុប្បន្ន:</b> <code>{streak} ថ្ងៃជាប់គ្នា</code>
  ⏳ <b>ទទួលបានម្តងទៀតក្នុង:</b> <code>23:59:59</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  💡 <i>សន្សំគ្រប់ 100 Pts អាចប្តូរយកសំបុត្រ Gacha ឬប័ណ្ណបញ្ចុះតម្លៃក្នុងហាងបាន!</i>

  ```
- **ពេលចុច Claim ជោគជ័យ — អត្ថបទសារ (ភាសាអង់គ្លេស `en`)៖**

  HTML
  ```
  🎁 <b>DAILY REWARD CLAIMED SUCCESSFULLY!</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  ✨ <b>Points Awarded:</b> <code>+5 Pts</code>
  💎 <b>New Total Balance:</b> <code>{total_points} Pts</code>
  🔥 <b>Current Streak:</b> <code>{streak} Days</code>
  ⏳ <b>Next Claim Available In:</b> <code>23:59:59</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  💡 <i>Collect 100 Pts to exchange for Gacha Tickets or discount coupons in the store!</i>

  ```
- **ប៊ូតុងខាងក្រោម៖**
  - `[ ⏳ Cooldown (Wait 24h) ]`
  - `[ 📜 Streak Rules & Multipliers ]`
  - `[ 🔙 Back Home ]`

### ៦. ពេលចុចប៊ូតុង `📦 My Orders & Vault` (`cb_orders_menu`) និងប៊ូតុងរង

- **ផ្ទាំងមេនៃ `📦 My Orders & Vault` — អត្ថបទសារ (ភាសាខ្មែរ `km`)៖**

  HTML
  ```
  📦 <b>កាបូបទំនិញ និងប្រវត្តិបញ្ជាទិញរបស់អ្នក (MY VAULT &amp; ORDERS)</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 <b>អតិថិជន:</b> <code>{first_name}</code> (ID: <code>{telegram_id}</code>)
  🧾 <b>ការបញ្ជាទិញសរុប:</b> <code>{total_orders} វិក្កយបត្រ</code>
  💵 <b>ចំណាយសរុប:</b> <code>${total_spent}</code>
  🔐 <b>គណនីក្នុង Vault:</b> <code>{accounts_count} គណនី</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  👇 <i>សូមជ្រើសរើសមុខងារខាងក្រោមដើម្បីមើលគណនី ឬវិក្កយបត្រ៖</i>

  ```
- **ផ្ទាំងមេនៃ `📦 My Orders & Vault` — អត្ថបទសារ (ភាសាអង់គ្លេស `en`)៖**

  HTML
  ```
  📦 <b>MY ORDERS &amp; DIGITAL VAULT</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  👤 <b>Customer:</b> <code>{first_name}</code> (ID: <code>{telegram_id}</code>)
  🧾 <b>Completed Orders:</b> <code>{total_orders} Orders</code>
  💵 <b>Total Spent:</b> <code>${total_spent}</code>
  🔐 <b>Delivered Accounts:</b> <code>{accounts_count} Accounts</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  👇 <i>Select an option below to inspect your accounts or order receipts:</i>

  ```
- **ប៊ូតុងរងខាងក្រោម៖**
  - `[ 📜 Order History ]`
  - `[ 🔑 Get Live 2FA Code ]`
  - `[ 🎒 View Delivered Accounts ]`
  - `[ 🔍 Track Order ID ]`
  - `[ 🔙 Back Home ]`
- **ពេលចុច `🎒 View Delivered Accounts` (`cb_vault_accounts`)៖** បង្ហាញបញ្ជីគណនីទាំងអស់ដែល User បានទិញ (ទាញចេញពី PostgreSQL)៖

  HTML
  ```
  🔐 <b>គណនីហ្គេមរបស់អ្នក (DELIVERED ACCOUNTS)</b>
  ━━━━━━━━━━━━━━━━━━━━━━
  1️⃣ <b>{product_title}</b>
  • 👤 <b>Username:</b> <code>{account_username}</code>
  • 🔑 <b>Password:</b> <tg-spoiler><code>{account_password}</code></tg-spoiler>
  • 🛡️ <b>2FA Status:</b> <code>Active (Use Get 2FA Code button)</code>
  • 📅 <b>Date:</b> <code>{created_at}</code>
  ━━━━━━━━━━━━━━━━━━━━━━
  💡 <i>ចុចលើអក្សរព្រាលៗ (Spoiler) ដើម្បីមើល និង Copy លេខសម្ងាត់!</i>

  ```

### ៧. ពេល Admin ប្រើ `/broadcast` ក្នុង Admin Bot

1. **ពេល Admin វាយ `/broadcast`៖**

   HTML
   ```
   📢 <b>ADMIN BROADCAST STUDIO</b>
   ━━━━━━━━━━━━━━━━━━━━━━
   សូមផ្ញើសារដែលអ្នកចង់ប្រកាស (អាចដាក់អក្សរដិត, រូបភាព, ឬ <b>Telegram Premium Emojis</b> គ្រប់ប្រភេទពីលើ Keyboard របស់អ្នក)៖

   ```
2. **ក្រោយពេល Admin ផ្ញើសារចូល Bot សួរឱ្យរើសទម្រង់ប៊ូតុង៖**

   HTML
   ```
   ✨ <b>សាររបស់អ្នកត្រូវបានទទួល!</b>
   សូមជ្រើសរើសទម្រង់នៃការផ្ញើខាងក្រោម៖

   ```
   - ប៊ូតុង៖ `[ 📝 Send Normal Text ]` | `[ 🛍️ Send with "Buy Now" Button ]`
3. **ផ្ទាំងបញ្ជាក់ចុងក្រោយ (Confirmation Preview)៖**

   HTML
   ```
   📡 <b>ត្រៀមបញ្ជូនសារទៅកាន់អតិថិជនសរុប៖ {user_count} នាក់</b>
   • <b>ទម្រង់:</b> {Normal Text / With "🛒 Buy Products" Button}
   សូមចុច Confirm ខាងក្រោមដើម្បីបាញ់សារឥឡូវនេះ៖

   ```
   - ប៊ូតុង៖ `[ ✅ Confirm & Send to All ]` | `[ ❌ Cancel Broadcast ]`

# ផ្នែកទី ២៖ ប្រព័ន្ធការពារទិន្នន័យ ១០០% លើ Railway PostgreSQL (មិនឱ្យបាត់បង់ពេល Redeploy)

### មូលហេតុដែលកាលពីមុនឱ្យតែ Deploy ថ្មី បាត់ទិន្នន័យអស់៖

កាលពីមុន កូដបានរក្សាទុកទំនិញ (Products), ស្តុកគណនី (Inventory), និងការបញ្ជាទិញ (Orders) នៅក្នុង **JavaScript Memory (`DataStore.products = []`)** ឬក្នុង **Local File (`data/store.json`)**។ នៅលើ Railway រាល់ពេលអ្នកធ្វើការ `git push` ឬ Redeploy ប្រព័ន្ធ Railway នឹងលុប Container ចាស់ចោល ហើយបង្កើត Container ថ្មីស្រឡាង ដែលធ្វើឱ្យ Local File និង Memory ត្រូវរលុបបាត់អស់ ១០០%!

### ដំណោះស្រាយដាច់ខាត៖ ទិន្នន័យទាំង ៧ ប្រភេទត្រូវរក្សាទុកក្នុង Railway PostgreSQL (`DATABASE_URL`)

នៅលើ Railway សេវាកម្ម **PostgreSQL Database** គឺស្ថិតនៅលើប្រព័ន្ធផ្ទុកទិន្នន័យដាច់ដោយឡែក (Persistent Volume) ដែល**មិនត្រូវបានលុបឡើយ ទោះបីជាអ្នក Redeploy កម្មវិធី Node.js ១,០០០ ដងក៏ដោយ**។

ដើម្បីធានាថា **គ្មានអ្វីបាត់បង់សូម្បីតែ ១ ពិន្ទុ ឬ ១ គណនី** ប្រព័ន្ធត្រូវអនុវត្តច្បាប់ ៣ ខាងក្រោម៖

#### ច្បាប់ទី ១៖ បង្កើតតារាងទាំង ៧ ក្នុង PostgreSQL ដោយប្រើ `CREATE TABLE IF NOT EXISTS` (ហាមប្រើ `DROP TABLE` ដាច់ខាត)

នៅក្នុង `initDatabase()` ពេល Server ចាប់ផ្តើមដំណើរការ វានឹងឆែក និងរក្សាតារាងទាំង ៧ នេះទុកជានិច្ច៖

| ល.រ   | ឈ្មោះតារាងក្នុង PostgreSQL         | ទិន្នន័យដែលរក្សាទុកជាអចិន្ត្រៃយ៍ (មិនបាត់ពេល Redeploy)                                                                                                                                                                |
| ----- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1** | **`users`**                        | `telegram_id`, `username`, `first_name`, **`points`** (ពិន្ទុសរុប), **`streak_count`** (ចំនួនថ្ងៃចូល), **`last_daily_claim_at`** (ម៉ោង Cooldown), **`gacha_tickets`**, **`language_code`** (`'km'` / `'en'`), `role`. |
| **2** | **`points_ledger`**                | ប្រវត្តិគ្រប់ប្រតិបត្តិការបូក/ដកពិន្ទុទាំងអស់ (`amount`, `type`, `balance_after`, `description`, `created_at`).                                                                                                       |
| **3** | **`products`**                     | រាល់ទំនិញទាំងអស់ដែល Admin បានបង្កើត (`id`, `title`, `category_id`, `price`, `product_type` [`account` ឬ `item`], `delivery_mode`, `stock`, `images`, `is_active`, `is_draft`).                                        |
| **4** | **`inventory`**                    | រាល់ស្តុកគណនីហ្គេម និងកូដទាំងអស់ (`id`, `product_id`, `account_username`, `raw_password`, `raw_2fa`, `status` [`available` ឬ `sold`], `buyer_telegram_id`, `order_id`).                                               |
| **5** | **`orders`**                       | រាល់វិក្កយបត្របញ្ជាទិញទាំងអស់របស់អតិថិជន (`id`, `order_code`, `telegram_id`, `product_id`, `product_title`, `total_amount`, `status`, `payment_ref`, `delivered_payload`, `created_at`).                              |
| **6** | **`gacha_pools` & `gacha_prizes`** | រាល់ប្រអប់ Gacha, រង្វាន់ និងអត្រាឈ្នះដែល Admin បានកំណត់។                                                                                                                                                             |
| **7** | **`coupons`**                      | រាល់កូដបញ្ចុះតម្លៃដែល User បានប្តូរពីពិន្ទុ ឬ Admin បានបង្កើត។                                                                                                                                                        |

#### ច្បាប់ទី ២៖ រាល់សកម្មភាពទាំងអស់ត្រូវសរសេរចូល PostgreSQL ភ្លាមៗ (Write-Through to PostgreSQL)

1. **ពេល Admin បន្ថែម ឬកែទំនិញ (`saveProduct`)៖**
   - រត់ `INSERT INTO products ... ON CONFLICT (id) DO UPDATE ...` ចូលក្នុង PostgreSQL ភ្លាមៗ។
2. **ពេល Admin ដាក់ស្តុកគណនីចូល (`addInventoryItem` / `depositAccountCredentials`)៖**
   - រត់ `INSERT INTO inventory (id, product_id, account_username, raw_password, raw_2fa, status) VALUES ...` ចូលក្នុង PostgreSQL ភ្លាមៗ។
3. **ពេលអតិថិជនទិញទំនិញ និងបង់ប្រាក់ជោគជ័យ (`createOrder` & `fulfillOrder`)៖**
   - កាត់ស្តុកក្នុងតារាង `inventory` (`UPDATE inventory SET status = 'sold', buyer_telegram_id = $1, order_id = $2 WHERE id = $3`)។
   - កត់ត្រាទុកក្នុងតារាង `orders` (`INSERT INTO orders ...`) ជាមួយព័ត៌មានគណនីដែលបានប្រគល់ជូន។
4. **ពេលអតិថិជនចុច Claim ពិន្ទុ, ប្តូរសំបុត្រ Gacha, ឬប្តូរភាសា៖**
   - រត់ `UPDATE users SET ... WHERE telegram_id = $1` ចូលក្នុង PostgreSQL ភ្លាមៗ។

#### ច្បាប់ទី ៣៖ ទាញទិន្នន័យទាំងអស់ពី PostgreSQL មកវិញដោយស្វ័យប្រវត្តិពេល Server បើក (`hydrateFromPostgresOnBoot`)

នៅពេលដែលអ្នកធ្វើការ Redeploy ឬ Push កូដថ្មីឡើងទៅ Railway៖

- គ្រាន់តែ Server ចាប់ផ្តើមដំណើរការភ្លាម មុខងារ `await DataStore.hydrateFromPostgres()` នឹងរត់ទៅទាញយក៖
  - បញ្ជី `users` ទាំងអស់ (រួមទាំង Points, Streak, Tickets, Language)
  - បញ្ជី `products` ទាំងអស់ដែល Admin បានដាក់លក់
  - បញ្ជី `inventory` (ស្តុកគណនីដែលនៅសល់ និងគណនីដែលលក់រួច)
  - បញ្ជី `orders` (ប្រវត្តិទិញរបស់អតិថិជនគ្រប់រូប)
- យកមកបញ្ចូលក្នុងប្រព័ន្ធវិញទាំងអស់ក្នុងរយៈពេល 0.5 វិនាទី មុនពេល Bot និង Mini App បើកទទួលអតិថិជន!

**លទ្ធផល៖** ទោះបីជាអ្នក Deploy កូដថ្មីប៉ុន្មានដងក៏ដោយ៖

- ទំនិញដែល Admin បានផុស នៅតែបង្ហាញក្នុង Store ដដែល។
- គណនីដែលអតិថិជនធ្លាប់ទិញ នៅតែស្ថិតក្នុង Vault និងអាចចុចយកកូដ 2FA បានជានិច្ច។
- ពិន្ទុ និង Streak របស់អតិថិជន នៅរក្សាទុកដដែល ១០០% គ្មានការ Reset ទៅ 0 ទៀតឡើយ!

---

End of source specification. Follow the mission, workflow, scope, and safety instructions at the top of this prompt.
