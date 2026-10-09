# UCHIRO STORE V3 — Supabase SQL Editor Deployment Guide
## Delivery Authenticator & Access Audit Schema Update

This document provides step-by-step instructions to deploy the delivery authenticator schema enhancements and audit logging table into your Supabase database.

---

### Prerequisites
- Access to your **Supabase Dashboard** (Project Administrator or Developer).
- No downtime is required; this script uses `IF NOT EXISTS` and does not drop existing tables or data.

---

### Step-by-Step Instructions

1. **Open Supabase Dashboard**
   Navigate to [https://supabase.com/dashboard](https://supabase.com/dashboard) and sign in.

2. **Open the UCHIRO Database Project**
   Select your **Uchiro Store V3** project from your organization list.

3. **Navigate to SQL Editor**
   In the left-hand navigation sidebar, click on the **SQL Editor** icon (represented by the `>_` terminal/query icon).

4. **Click "New query"**
   Click the **+ New query** button at the top to create a blank SQL script editor tab.

5. **Open `supabase/sql/uchiro_delivery_authenticator.sql`**
   In your repository, open the file:
   `supabase/sql/uchiro_delivery_authenticator.sql`

6. **Copy All SQL**
   Copy the entire contents of the SQL file to your clipboard.

7. **Paste into Supabase SQL Editor**
   Paste the copied SQL directly into the SQL Editor query window.

8. **Run the Script**
   Click the green **Run** button (or press `Ctrl + Enter` / `Cmd + Enter`).

9. **Verify Successful Execution**
   - Supabase will display `Success. No rows returned` or a successful confirmation message.
   - You can verify the newly created columns by running:
     ```sql
     SELECT column_name, data_type 
     FROM information_schema.columns 
     WHERE table_name = 'inventory_items' 
       AND column_name LIKE 'authenticator_%';
     ```
   - You should see `authenticator_enabled`, `authenticator_secret_ciphertext`, `authenticator_algorithm`, `authenticator_digits`, and `authenticator_period`.

10. **Restart UCHIRO Backend**
    Restart your Node.js backend server (`npm --prefix server run start` or via your hosting process manager like PM2 / Docker) to begin utilizing the updated schema.

---

### Security Note
- The SQL file contains **no hardcoded encryption keys, passwords, or secrets**.
- Authenticator secrets are encrypted and decrypted at the application layer using `AES-256-GCM` before persisting to `authenticator_secret_ciphertext`.
- The `delivery_access_logs` table stores only non-sensitive audit metadata (order ID, user ID, timestamp, action, success/failure). Passwords and TOTP secrets are strictly excluded from logging.
