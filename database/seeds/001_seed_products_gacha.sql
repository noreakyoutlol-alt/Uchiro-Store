-- ============================================================
-- UCHIRO STORE V3 — SEED DATA
-- CATEGORIES, PRODUCTS, INVENTORY, GACHA & COUPONS
-- ============================================================

-- 1. CATEGORIES
INSERT INTO categories (id, name, slug, icon, description, sort_order, is_active) VALUES
('11111111-1111-1111-1111-111111111101', 'Accounts', 'accounts', 'UserCheck', 'High-tier verified gaming accounts with full warranty', 1, TRUE),
('11111111-1111-1111-1111-111111111102', 'Items & Codes', 'items', 'KeyRound', 'Instant digital vouchers, gamepasses & codes', 2, TRUE),
('11111111-1111-1111-1111-111111111103', 'Blox Fruits', 'blox-fruits', 'Flame', 'Permanent fruits, mythical weapons, max accounts', 3, TRUE),
('11111111-1111-1111-1111-111111111104', 'MM2', 'mm2', 'Sword', 'Murder Mystery 2 godlies, ancients, and vintage sets', 4, TRUE),
('11111111-1111-1111-1111-111111111105', 'Blade Ball', 'blade-ball', 'Shield', 'Exclusive abilities, swords, and explosion effects', 5, TRUE),
('11111111-1111-1111-1111-111111111106', 'Evade', 'evade', 'Zap', 'VIP access, custom radios, and legendary emotes', 6, TRUE),
('11111111-1111-1111-1111-111111111107', 'Steal Egg', 'steal-egg', 'Egg', 'Rare dragon eggs, multipliers, and power-up packs', 7, TRUE),
('11111111-1111-1111-1111-111111111108', 'Other Games', 'other', 'Gamepad2', 'Robux gift cards, discord perks, and miscellaneous rewards', 8, TRUE)
ON CONFLICT (slug) DO NOTHING;

-- 2. PRODUCTS
INSERT INTO products (
    id, category_id, title, slug, description, short_description, price, compare_at_price,
    stock, is_active, is_draft, is_featured, delivery_mode, warranty_days, requires_roblox_username,
    badge, specifications
) VALUES
(
    '22222222-2222-2222-2222-222222222201',
    '11111111-1111-1111-1111-111111111103',
    'Blox Fruits Max Level Kitsune Account',
    'blox-fruits-max-kitsune-account',
    'Complete powerhouse account ready for competitive PvP. Includes Max Level 2550, fully awakened Kitsune Fruit, Godhuman fighting style, Soul Guitar, and Cursed Dual Katana. Clean email unverified, 100% safe transfer.',
    'Max Level 2550 • Awakened Kitsune • Godhuman • CDK • Unverified Email',
    12.50,
    18.00,
    3,
    TRUE,
    FALSE,
    TRUE,
    'auto_account',
    7,
    FALSE,
    'BESTSELLER',
    '{"Level": "2550 (MAX)", "Fruit": "Kitsune (Full Mastery)", "Fighting Style": "Godhuman (600 Mastery)", "Weapons": ["Cursed Dual Katana", "Soul Guitar"], "Beli": "50,000,000+", "Fragments": "35,000+"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222202',
    '11111111-1111-1111-1111-111111111103',
    'Blox Fruits Permanent Buddha Gamepass Code',
    'blox-fruits-permanent-buddha-code',
    'Official instant redeem digital code for Permanent Buddha fruit in Blox Fruits. Grants unlimited transformations forever across any server.',
    'Instant Digital Voucher • Permanent Buddha • Works on Any Device',
    15.00,
    20.00,
    5,
    TRUE,
    FALSE,
    TRUE,
    'digital_code',
    30,
    FALSE,
    'MYTHICAL',
    '{"Item": "Permanent Buddha", "Platform": "Roblox", "Redemption": "Instant In-Game Gift Code"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222203',
    '11111111-1111-1111-1111-111111111104',
    'MM2 Harvester + Corrupt Ancient Weapon Set',
    'mm2-harvester-corrupt-ancient-set',
    'The pinnacle Murder Mystery 2 collection: 1x Corrupt (Ancient Knife) and 1x Harvester (Ancient Gun). Traded directly to your Roblox avatar via secure in-game trade server within 5 minutes.',
    'Corrupt Knife + Harvester Gun • Delivered via Roblox Trade',
    14.50,
    22.00,
    4,
    TRUE,
    FALSE,
    TRUE,
    'manual_service',
    3,
    TRUE,
    'HOT',
    '{"Game": "Murder Mystery 2", "Items": ["1x Corrupt Knife", "1x Harvester Gun"], "Delivery Method": "In-Game Trade"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222204',
    '11111111-1111-1111-1111-111111111104',
    'MM2 Bat Gun Godly Ancient',
    'mm2-bat-gun-godly',
    'Exclusive high-tier Halloween Ancient Bat Gun in Murder Mystery 2. One of the cleanest gun animations in the game.',
    'Ancient Bat Gun • Fast In-Game Delivery',
    8.00,
    11.50,
    6,
    TRUE,
    FALSE,
    FALSE,
    'manual_service',
    3,
    TRUE,
    'POPULAR',
    '{"Game": "Murder Mystery 2", "Item": "Bat Gun (Ancient)"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222205',
    '11111111-1111-1111-1111-111111111105',
    'Blade Ball Infinity Ability Voucher Code',
    'blade-ball-infinity-ability-code',
    'Redeemable digital voucher code for the coveted Infinity Ability in Blade Ball. Teleports the ball directly to opposing players on demand.',
    'Digital Code • Instant Delivery • Unlock Infinity Ability',
    7.50,
    10.00,
    8,
    TRUE,
    FALSE,
    FALSE,
    'digital_code',
    14,
    FALSE,
    'NEW',
    '{"Game": "Blade Ball", "Ability": "Infinity", "Redemption": "Code"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222206',
    '11111111-1111-1111-1111-111111111106',
    'Evade VIP Lifetime Gamepass Key',
    'evade-vip-lifetime-pass-key',
    'Official key for Evade VIP pass. Receive 2x Cash and EXP boosts, special chat tags, custom radio streaming, and exclusive golden trail.',
    '2x Cash/EXP • Custom Radio • Golden Trail • Instant Key',
    4.99,
    7.00,
    10,
    TRUE,
    FALSE,
    FALSE,
    'digital_code',
    30,
    FALSE,
    'SPECIAL',
    '{"Game": "Evade", "Tier": "Lifetime VIP", "Delivery": "Instant Key"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222207',
    '11111111-1111-1111-1111-111111111107',
    'Steal Egg Legendary Golden Dragon Egg Pack',
    'steal-egg-golden-dragon-egg-pack',
    'Package containing 3x Golden Dragon Eggs with guaranteed 10x hatchery luck boost. Delivered directly in-game.',
    '3x Golden Dragon Eggs • 10x Hatchery Luck • Fast Trade',
    5.00,
    7.50,
    7,
    TRUE,
    FALSE,
    FALSE,
    'manual_service',
    3,
    TRUE,
    'HOT',
    '{"Game": "Steal Egg", "Items": "3x Golden Dragon Eggs"}'::jsonb
),
(
    '22222222-2222-2222-2222-222222222208',
    '11111111-1111-1111-1111-111111111108',
    '1,000 Robux Official Gift Code',
    '1000-robux-official-gift-code',
    'Official Roblox digital voucher code for 1,000 clean Robux. Redeemable on any Roblox account worldwide instantly.',
    '1,000 Clean Robux • Global Digital PIN • Instant Delivery',
    10.00,
    12.50,
    15,
    TRUE,
    FALSE,
    TRUE,
    'digital_code',
    30,
    FALSE,
    'INSTANT',
    '{"Currency": "1,000 Robux", "Region": "Global / All Countries", "Type": "Digital PIN"}'::jsonb
)
ON CONFLICT (slug) DO NOTHING;

-- 3. INVENTORY ITEMS (DEV SEED)
INSERT INTO inventory_items (
    product_id, item_type, account_username, encrypted_account_password, encrypted_account_2fa, digital_code, notes, status
) VALUES
('22222222-2222-2222-2222-222222222201', 'account', 'uchiro_master_01', 'UchiroPass2025!Kitsune', 'BACKUP-CODE-8921-3301', NULL, 'Clean email unverified. 7-day store warranty.', 'available'),
('22222222-2222-2222-2222-222222222201', 'account', 'uchiro_master_02', 'UchiroDragon#9914', 'BACKUP-CODE-4412-8876', NULL, 'Clean email unverified. 7-day store warranty.', 'available'),
('22222222-2222-2222-2222-222222222201', 'account', 'uchiro_master_03', 'UchiroGodhuman*773', 'BACKUP-CODE-1120-9943', NULL, 'Clean email unverified. 7-day store warranty.', 'available'),
('22222222-2222-2222-2222-222222222202', 'code', NULL, NULL, NULL, 'UCH-BUDDHA-9932-8812-7741', 'Redeem via Roblox in-game gifts', 'available'),
('22222222-2222-2222-2222-222222222202', 'code', NULL, NULL, NULL, 'UCH-BUDDHA-4410-6623-1190', 'Redeem via Roblox in-game gifts', 'available'),
('22222222-2222-2222-2222-222222222208', 'code', NULL, NULL, NULL, 'RBX-1000-UCH-9934-1182', 'Roblox official redeem page PIN', 'available'),
('22222222-2222-2222-2222-222222222208', 'code', NULL, NULL, NULL, 'RBX-1000-UCH-8821-4493', 'Roblox official redeem page PIN', 'available');

-- 4. GACHA POOLS & PRIZES
INSERT INTO gacha_pools (id, title, slug, description, spin_price, is_active, banner_url) VALUES
('33333333-3333-3333-3333-333333333301', 'Mythical Gear Chest', 'mythical-gear-chest', 'Unleash Gear 5 divine energy! Win max level accounts, ancients, robux vouchers, and legendary in-game loot.', 1.50, TRUE, 'https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&auto=format&fit=crop&q=80'),
('33333333-3333-3333-3333-333333333302', 'Blox Fruits Divine Reel', 'blox-fruits-divine-reel', 'Spin the reels for Permanent Dragon fruits, Godhuman accounts, and gamepass vouchers!', 2.00, TRUE, 'https://images.unsplash.com/photo-1550745165-9bc0b252726f?w=800&auto=format&fit=crop&q=80')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO gacha_prizes (pool_id, title, description, rarity, probability_percent, delivery_mode, reward_type, reward_data, stock, is_active) VALUES
('33333333-3333-3333-3333-333333333301', 'Blox Fruits Kitsune Max Account', 'Full Kitsune Mastery + Godhuman fighting style', 'MYTHICAL', 2.000, 'manual_review', 'item', '{"product_slug": "blox-fruits-max-kitsune-account", "type": "account"}'::jsonb, 5, TRUE),
('33333333-3333-3333-3333-333333333301', 'MM2 Corrupt Ancient Knife', 'Rare vintage ancient knife in Murder Mystery 2', 'LEGENDARY', 8.000, 'manual_review', 'item', '{"item": "MM2 Corrupt Knife", "type": "in_game_trade"}'::jsonb, 15, TRUE),
('33333333-3333-3333-3333-333333333301', '500 Robux Voucher Code', 'Clean redeemable Robux gift code', 'EPIC', 15.000, 'instant_code', 'code', '{"code_prefix": "RBX-500", "code": "RBX-500-UCHIRO-GEAR5-WIN"}'::jsonb, 50, TRUE),
('33333333-3333-3333-3333-333333333301', '100 Uchiro Reward Points', 'Convertible to store discounts and checkout credit', 'RARE', 30.000, 'instant_code', 'points', '{"points": 100}'::jsonb, 9999, TRUE),
('33333333-3333-3333-3333-333333333301', '25 Uchiro Reward Points', 'Bonus points for your customer profile', 'COMMON', 45.000, 'instant_code', 'points', '{"points": 25}'::jsonb, 9999, TRUE),
('33333333-3333-3333-3333-333333333302', 'Permanent Dragon Fruit Code', 'Permanent Mythical Dragon Fruit gift voucher', 'MYTHICAL', 1.500, 'manual_review', 'item', '{"item": "Permanent Dragon", "type": "gift_code"}'::jsonb, 3, TRUE),
('33333333-3333-3333-3333-333333333302', 'Blox Fruits Leopard Account', 'High tier Leopard user account', 'LEGENDARY', 8.500, 'manual_review', 'item', '{"item": "Leopard Account", "type": "account"}'::jsonb, 10, TRUE),
('33333333-3333-3333-3333-333333333302', 'Dark Blade Gamepass Key', 'Legendary Yoru / Dark Blade weapon pass', 'EPIC', 15.000, 'instant_code', 'code', '{"code": "UCH-DARKBLADE-REEL-7721"}'::jsonb, 25, TRUE),
('33333333-3333-3333-3333-333333333302', '2x Mastery Gamepass Key', 'Double mastery boost for Blox Fruits', 'RARE', 35.000, 'instant_code', 'code', '{"code": "UCH-2XMASTERY-8832-1102"}'::jsonb, 100, TRUE),
('33333333-3333-3333-3333-333333333302', '50 Uchiro Store Points', 'Credit for future orders', 'COMMON', 40.000, 'instant_code', 'points', '{"points": 50}'::jsonb, 9999, TRUE);

-- 5. COUPONS
INSERT INTO coupons (code, discount_type, discount_value, min_order_amount, max_discount_amount, usage_limit, is_active) VALUES
('UCHIRO10', 'percentage', 10.00, 5.00, 15.00, 1000, TRUE),
('GEAR5', 'percentage', 15.00, 10.00, 25.00, 500, TRUE),
('WELCOME', 'fixed', 1.00, 3.00, 1.00, 5000, TRUE)
ON CONFLICT (code) DO NOTHING;

-- 6. APP SETTINGS
INSERT INTO app_settings (key, value, description) VALUES
('store_info', '{"name": "UCHIRO STORE V3", "version": "3.0.0", "status": "online", "currency": "USD"}'::jsonb, 'Global store status'),
('announcements', '[{"id": 1, "text": "🔥 Gear 5 Energy Gacha is live! Spin now for mythical accounts.", "active": true}]'::jsonb, 'Active store banner announcements'),
('bakong_config', '{"merchant_id": "uchiro_bakong", "currency": "USD", "qr_validity_minutes": 10}'::jsonb, 'KHPay & Bakong payment parameters')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;
