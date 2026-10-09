-- ============================================================
-- UCHIRO STORE V3 — ROW LEVEL SECURITY POLICIES
-- ============================================================

-- Enable RLS on core tables
ALTER TABLE telegram_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_media ENABLE ROW LEVEL SECURITY;
ALTER TABLE product_variants ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_reservations ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupons ENABLE ROW LEVEL SECURITY;
ALTER TABLE coupon_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_prizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_spins ENABLE ROW LEVEL SECURITY;
ALTER TABLE gacha_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE support_tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- 1. PUBLIC READ ACCESS FOR STORE CATALOG (ACTIVE ONLY)
CREATE POLICY "Public read active categories" ON categories
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Public read active products" ON products
    FOR SELECT USING (is_active = TRUE AND is_draft = FALSE);

CREATE POLICY "Public read product media" ON product_media
    FOR SELECT USING (TRUE);

CREATE POLICY "Public read product variants" ON product_variants
    FOR SELECT USING (TRUE);

CREATE POLICY "Public read active gacha pools" ON gacha_pools
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Public read active gacha prizes" ON gacha_prizes
    FOR SELECT USING (is_active = TRUE);

CREATE POLICY "Public read active coupons" ON coupons
    FOR SELECT USING (is_active = TRUE);

-- 2. SERVICE ROLE FULL ACCESS (Backend API operates with Service Role)
CREATE POLICY "Service role full access telegram_users" ON telegram_users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access profiles" ON profiles FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access categories" ON categories FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access products" ON products FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access product_media" ON product_media FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access product_variants" ON product_variants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inventory_items" ON inventory_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access inventory_reservations" ON inventory_reservations FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access orders" ON orders FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access order_items" ON order_items FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access payments" ON payments FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access coupons" ON coupons FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access coupon_redemptions" ON coupon_redemptions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access gacha_pools" ON gacha_pools FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access gacha_prizes" ON gacha_prizes FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access gacha_spins" ON gacha_spins FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access gacha_claims" ON gacha_claims FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access referrals" ON referrals FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access referral_rewards" ON referral_rewards FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access notifications" ON notifications FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access admin_users" ON admin_users FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access admin_audit_logs" ON admin_audit_logs FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access support_tickets" ON support_tickets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access app_settings" ON app_settings FOR ALL USING (auth.role() = 'service_role');

-- 3. CUSTOMER DATA ISOLATION (By Telegram ID in JWT claim if Supabase JWT used)
CREATE POLICY "Customer read own user" ON telegram_users
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

CREATE POLICY "Customer read own profile" ON profiles
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

CREATE POLICY "Customer read own orders" ON orders
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

CREATE POLICY "Customer read own order items" ON order_items
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = order_items.order_id
        AND orders.telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

CREATE POLICY "Customer read own payments" ON payments
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM orders
        WHERE orders.id = payments.order_id
        AND orders.telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

CREATE POLICY "Customer read own notifications" ON notifications
    FOR SELECT USING (recipient_telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);

CREATE POLICY "Customer read own gacha claims" ON gacha_claims
    FOR SELECT USING (EXISTS (
        SELECT 1 FROM telegram_users
        WHERE telegram_users.id = gacha_claims.customer_id
        AND telegram_users.telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint
    ));

CREATE POLICY "Customer read own support tickets" ON support_tickets
    FOR SELECT USING (telegram_id = ((current_setting('request.jwt.claims', true)::jsonb)->>'telegram_id')::bigint);
