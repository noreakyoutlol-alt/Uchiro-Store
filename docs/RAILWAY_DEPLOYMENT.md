# Railway Production Deployment Guide (Uchiro Store V3)

This guide walks a **beginner** through the exact steps to deploy the entire Uchiro Store V3 application on Railway – a single‑service Node.js deployment that serves the Store mini‑app, Admin portal, full REST API, health endpoint, Telegram bot webhooks, and the background payment worker.

---

## 1. Prerequisites – Railway Account
1. Open https://railway.app and **sign‑up** (or log in) with GitHub, Google, or email.
2. Verify your email address – Railway will ask for this during sign‑up.

---

## 2. Create a Single Railway Project
1. From the Railway dashboard click **"New Project"** → **"Create from Repository"**.
2. Choose the **GitHub** (or any Git) repository that contains this code (the repository you are currently viewing).
3. **Project name** – give it a memorable name, e.g. `uchiro-store-v3`. **Do not create additional projects** – everything runs in this one project.

---

## 3. Connect the Repository
Railway will automatically clone the repository. Ensure the default branch (usually `main` or `master`) is selected. No extra sub‑modules are required.

---

## 4. Define ONE Production Service
1. Inside the project view go to **"Deployments" → "Add Service"**.
2. Choose **"Node.js (Nixpacks)"** – Railway will detect the `package.json` and `nixpacks.toml` that already exist.
3. **Do NOT add a second service** for the API, front‑end, or bots – the single service will serve everything.

---

## 5. Configure the Build Method (Nixpacks) – **keep the defaults**
Railway’s Nixpacks will run:
```bash
npm ci
npm run build   # runs workspace builds for server, client‑store, client‑admin
```
These commands are already defined in the repository's `package.json` scripts, so **no custom Dockerfile is needed**.
If you see a “Custom Build Command” field, leave it **blank** – the default is correct.

---

## 6. Configure the Production Start Command
The service must start the unified production server that we built in `server/src/production.ts`.
Set the **Start Command** (or “Run command”) to:
```bash
node server/dist/production.js
```
Railway will automatically inject the environment variable `PORT` (a random free port) and bind the process to `0.0.0.0`. **Do NOT hard‑code `PORT=5000`** – the app reads `process.env.PORT`.

---

## 7. Generate the Railway HTTPS Domain
After the service is deployed the **"Domain"** section will show a URL like:
```
https://your-project.up.railway.app
```
Copy this URL – you will need it for webhook registration and final verification.

---

## 8. Add Required Environment Variables
Open **"Settings" → "Environment Variables"** in the project dashboard and add the following **keys** (values are examples – replace with your real production secrets):
```
# Core environment
NODE_ENV=production
# URLs – optional if you want custom sub‑domains, otherwise keep defaults
APP_URL=https://your-project.up.railway.app
API_URL=https://your-project.up.railway.app
CLIENT_STORE_URL=https://your-project.up.railway.app    # same domain, serves the Store SPA
CLIENT_ADMIN_URL=https://your-project.up.railway.app/admin

# Supabase (database only – backend only!)
SUPABASE_URL=your-supabase-project-url
SUPABASE_SECRET_KEY=your-supabase-service-role-key   # **backend only**, never exposed to the front‑end

# KHPay production credentials (real payment gateway)
KHPAY_API_KEY=your-live-khpay-api-key
KHPAY_MERCHANT_ID=your-live-merchant-id
KHPAY_WEBHOOK_SECRET=your-khpay-webhook-secret
KHPAY_TEST_MODE=false   # must be false in production

# Telegram bots – generate tokens via BotFather
STORE_BOT_TOKEN=your-store-bot-token
ADMIN_BOT_TOKEN=your-admin-bot-token
STORE_BOT_WEBHOOK_SECRET=your-store-bot-webhook-secret
ADMIN_BOT_WEBHOOK_SECRET=your-admin-bot-webhook-secret
ADMIN_TELEGRAM_USER_IDS=comma‑separated list of admin Telegram IDs (e.g. 123456789,987654321)
```
**Do NOT set `PORT` manually** – Railway injects it automatically.

---

## 9. Important Note About the PORT Variable
- The app reads `process.env.PORT` (default fallback 5000 only for local dev).
- Railway will set `PORT` to a free port and bind to `0.0.0.0`.
- **Never add a manual `PORT=5000`** entry unless you have a special Railway configuration that overrides the automatic port allocation (rare).

---

## 10. Run Supabase SQL Setup
1. Log into your Supabase dashboard.
2. Open **SQL editor**.
3. Copy the content from `supabase/SQL_EDITOR_UCHIRO_V3.sql` (found in the repo) and execute it.
4. This creates the tables (`orders`, `products`, `inventory`, `payments`, `users`, `points_ledger`, etc.) required by the backend.
5. No further schema changes are needed for production.

---

## 11. Deploy the Application
With the environment variables set, Railway will automatically start a build. When the build finishes, the service will be **running** and reachable at the HTTPS domain from step 7.

---

## 12. Verify the Service
Open a browser (or `curl`) and check each endpoint:
- **Health**: `GET https://your-project.up.railway.app/health` → should return JSON with `status: "ok"`.
- **Store SPA**: `GET https://your-project.up.railway.app/` → loads the Store Mini‑App.
- **Admin SPA**: `GET https://your-project.up.railway.app/admin/` → loads the Admin portal.
- **API**: `GET https://your-project.up.railway.app/api/health` (or any other API route) → returns proper JSON.
All must respond with HTTP 200 and no errors.

---

## 13. Register Telegram Bot Webhooks
### Store Bot
```bash
curl -X POST "https://your-project.up.railway.app/api/bots/store/webhook/setup" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://your-project.up.railway.app"}'
```
### Admin Bot
```bash
curl -X POST "https://your-project.up.railway.app/api/bots/admin/webhook/setup" \
  -H "Content-Type: application/json" \
  -d '{"baseUrl":"https://your-project.up.railway.app"}'
```
These calls create the appropriate Telegram webhook URLs using the secret tokens defined above.

---

## 14. Verify Webhook Status
```bash
curl https://your-project.up.railway.app/api/bots/webhook/status
```
The response JSON includes `store_bot.telegram_status` and `admin_bot.telegram_status` with fields like `url`, `has_custom_certificate`, and `status` (`ok`).

---

## 15. Test a Real KHPay Payment (Production)
1. Using the Store mini‑app, place an order for any product.
2. The backend will generate a real KHPay QR payload (check the response JSON for `qr_payload` and `qr_image_url`).
3. Scan the QR with your banking app (Bakong, ABA, etc.) and complete the payment.
4. The webhook from KHPay will be received, the order status will transition to `paid` → `delivered`, and the Telegram Store Bot will notify the customer.

---

## 16. Check Railway Logs
In the Railway dashboard go to **"Logs"** for the service. Look for lines like:
```
✅ [STORE BOT] Running and listening for customers…
⏱️ [PAYMENT WORKER] Background payment monitor started (Interval: 1000ms)
```
Any errors during webhook handling, payment verification, or inventory reservation will appear here.

---

## 17. Final Production QA Checklist
- [ ] Health endpoint returns `ok`.
- [ ] Store and Admin SPAs load without 404.
- [ ] API routes (e.g., `/api/products`) respond correctly.
- [ ] Telegram Store Bot receives order creation messages.
- [ ] Telegram Admin Bot receives admin alerts.
- [ ] Webhook status shows both bots configured.
- [ ] Real KHPay payment processes and order is delivered.
- [ ] No duplicate `PORT` environment variable set.
- [ ] No extra Railway services exist.
- [ ] Supabase keys are **backend‑only** (no `SUPABASE_ANON_KEY` exposed to client builds).

You now have a fully production‑ready Railway deployment for Uchiro Store V3.
