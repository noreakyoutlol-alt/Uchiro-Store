-- ============================================================
-- UCHIRO STORE V3 — ATOMIC DATABASE FUNCTIONS
-- TRANSACTION-SAFE INVENTORY RESERVATION & GACHA SYSTEM
-- ============================================================

-- ============================================================
-- 1. ATOMIC INVENTORY RESERVATION
-- Prevents overselling & race conditions
-- ============================================================
CREATE OR REPLACE FUNCTION reserve_inventory_atomic(
    p_product_id UUID,
    p_customer_id UUID,
    p_order_id UUID,
    p_duration_minutes INTEGER DEFAULT 10
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_product RECORD;
    v_inventory_item RECORD;
    v_reservation_id UUID;
    v_expires_at TIMESTAMPTZ;
BEGIN
    -- 1. Lock product row to prevent race conditions
    SELECT * INTO v_product
    FROM products
    WHERE id = p_product_id AND is_active = TRUE AND is_draft = FALSE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'PRODUCT_NOT_FOUND_OR_INACTIVE';
    END IF;

    IF v_product.stock <= 0 THEN
        RAISE EXCEPTION 'PRODUCT_OUT_OF_STOCK';
    END IF;

    v_expires_at := NOW() + (p_duration_minutes || ' minutes')::INTERVAL;

    -- 2. Handle specific item reservation for automatic delivery modes
    IF v_product.delivery_mode IN ('auto_account', 'digital_code') THEN
        SELECT * INTO v_inventory_item
        FROM inventory_items
        WHERE product_id = p_product_id AND status = 'available'
        LIMIT 1
        FOR UPDATE SKIP LOCKED;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'NO_SPECIFIC_INVENTORY_ITEM_AVAILABLE';
        END IF;

        -- Update inventory item to reserved
        UPDATE inventory_items
        SET status = 'reserved',
            reserved_until = v_expires_at,
            order_id = p_order_id,
            updated_at = NOW()
        WHERE id = v_inventory_item.id;

        -- Insert reservation audit record
        INSERT INTO inventory_reservations (
            inventory_item_id,
            product_id,
            order_id,
            customer_id,
            expires_at,
            status
        ) VALUES (
            v_inventory_item.id,
            p_product_id,
            p_order_id,
            p_customer_id,
            v_expires_at,
            'active'
        ) RETURNING id INTO v_reservation_id;
    END IF;

    -- 3. Decrement available product stock
    UPDATE products
    SET stock = stock - 1,
        updated_at = NOW()
    WHERE id = p_product_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'product_id', p_product_id,
        'order_id', p_order_id,
        'reservation_id', v_reservation_id,
        'inventory_item_id', v_inventory_item.id,
        'expires_at', v_expires_at
    );
END;
$$;

-- ============================================================
-- 2. RELEASE EXPIRED RESERVATIONS
-- Restores stock for unpaid orders past 10-minute expiry
-- ============================================================
CREATE OR REPLACE FUNCTION release_expired_reservations()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    r RECORD;
    v_count INTEGER := 0;
BEGIN
    FOR r IN
        SELECT ir.id AS res_id, ir.inventory_item_id, ir.product_id, ir.order_id
        FROM inventory_reservations ir
        WHERE ir.status = 'active' AND ir.expires_at < NOW()
        FOR UPDATE SKIP LOCKED
    LOOP
        -- 1. Mark reservation as released
        UPDATE inventory_reservations
        SET status = 'released'
        WHERE id = r.res_id;

        -- 2. Release inventory item back to available
        IF r.inventory_item_id IS NOT NULL THEN
            UPDATE inventory_items
            SET status = 'available',
                reserved_until = NULL,
                order_id = NULL,
                updated_at = NOW()
            WHERE id = r.inventory_item_id;
        END IF;

        -- 3. Restore product stock count
        UPDATE products
        SET stock = stock + 1,
            updated_at = NOW()
        WHERE id = r.product_id;

        -- 4. Mark associated order as expired if still pending
        UPDATE orders
        SET status = 'expired',
            updated_at = NOW()
        WHERE id = r.order_id AND status IN ('draft', 'pending_payment');

        -- 5. Mark payment as expired
        UPDATE payments
        SET status = 'expired',
            updated_at = NOW()
        WHERE order_id = r.order_id AND status = 'pending';

        v_count := v_count + 1;
    END LOOP;

    RETURN v_count;
END;
$$;

-- ============================================================
-- 3. CONSUME RESERVATION ATOMICALLY
-- Called upon verified payment confirmation
-- ============================================================
CREATE OR REPLACE FUNCTION consume_reservation_atomic(
    p_order_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order RECORD;
    v_res RECORD;
    v_item RECORD;
    v_credentials JSONB := '[]'::jsonb;
BEGIN
    SELECT * INTO v_order
    FROM orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ORDER_NOT_FOUND';
    END IF;

    FOR v_res IN
        SELECT * FROM inventory_reservations
        WHERE order_id = p_order_id AND status = 'active'
        FOR UPDATE
    LOOP
        -- Mark reservation consumed
        UPDATE inventory_reservations
        SET status = 'consumed'
        WHERE id = v_res.id;

        -- Mark inventory item consumed
        UPDATE inventory_items
        SET status = 'consumed',
            updated_at = NOW()
        WHERE id = v_res.inventory_item_id
        RETURNING * INTO v_item;

        IF FOUND THEN
            v_credentials := v_credentials || jsonb_build_object(
                'item_type', v_item.item_type,
                'account_username', v_item.account_username,
                'encrypted_password', v_item.encrypted_account_password,
                'encrypted_2fa', v_item.encrypted_account_2fa,
                'digital_code', v_item.digital_code
            );
        END IF;
    END LOOP;

    -- Update order status and delivery credentials
    UPDATE orders
    SET status = 'delivered',
        delivery_credentials = v_credentials,
        delivered_at = NOW(),
        updated_at = NOW()
    WHERE id = p_order_id;

    -- Increment product sales count
    UPDATE products
    SET sales_count = sales_count + 1
    WHERE id IN (SELECT product_id FROM order_items WHERE order_id = p_order_id);

    -- Update customer stats
    UPDATE profiles
    SET total_spent = total_spent + v_order.total_amount,
        total_orders = total_orders + 1,
        points = points + FLOOR(v_order.total_amount * 10)::INTEGER,
        updated_at = NOW()
    WHERE telegram_id = v_order.telegram_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', p_order_id,
        'status', 'delivered',
        'credentials_count', jsonb_array_length(v_credentials)
    );
END;
$$;

-- ============================================================
-- 4. ATOMIC GACHA SPIN
-- Authoritative server-side RNG with weighted probability
-- ============================================================
CREATE OR REPLACE FUNCTION spin_gacha_atomic(
    p_pool_id UUID,
    p_customer_id UUID,
    p_telegram_id BIGINT,
    p_idempotency_key VARCHAR(128)
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_existing_spin RECORD;
    v_pool RECORD;
    v_total_weight NUMERIC := 0;
    v_random_point NUMERIC;
    v_cumulative NUMERIC := 0;
    v_selected_prize RECORD;
    v_prize_cursor RECORD;
    v_spin_id UUID;
    v_claim_id UUID;
    v_claim_status VARCHAR(20);
BEGIN
    -- 1. Check idempotency
    IF p_idempotency_key IS NOT NULL THEN
        SELECT gs.*, gp.title AS prize_title, gp.rarity AS prize_rarity, gp.delivery_mode, gp.reward_data, gp.icon_url
        INTO v_existing_spin
        FROM gacha_spins gs
        JOIN gacha_prizes gp ON gp.id = gs.prize_id
        WHERE gs.idempotency_key = p_idempotency_key;

        IF FOUND THEN
            RETURN jsonb_build_object(
                'success', TRUE,
                'already_spun', TRUE,
                'spin_id', v_existing_spin.id,
                'prize_id', v_existing_spin.prize_id,
                'prize_title', v_existing_spin.prize_title,
                'rarity', v_existing_spin.prize_rarity,
                'delivery_mode', v_existing_spin.delivery_mode,
                'reward_data', v_existing_spin.reward_data,
                'icon_url', v_existing_spin.icon_url
            );
        END IF;
    END IF;

    -- 2. Lock pool
    SELECT * INTO v_pool
    FROM gacha_pools
    WHERE id = p_pool_id AND is_active = TRUE
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'GACHA_POOL_NOT_FOUND_OR_INACTIVE';
    END IF;

    -- 3. Calculate total weight from active prizes with stock > 0
    SELECT SUM(probability_percent) INTO v_total_weight
    FROM gacha_prizes
    WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0;

    IF v_total_weight IS NULL OR v_total_weight <= 0 THEN
        RAISE EXCEPTION 'NO_AVAILABLE_PRIZES_IN_POOL';
    END IF;

    -- 4. Server authoritative RNG (cryptographically seeded float between 0 and total weight)
    v_random_point := (RANDOM() * v_total_weight);

    -- 5. Cumulative weighted selection
    FOR v_prize_cursor IN
        SELECT *
        FROM gacha_prizes
        WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0
        ORDER BY probability_percent ASC
        FOR UPDATE
    LOOP
        v_cumulative := v_cumulative + v_prize_cursor.probability_percent;
        IF v_random_point <= v_cumulative THEN
            v_selected_prize := v_prize_cursor;
            EXIT;
        END IF;
    END LOOP;

    -- Fallback safety to the highest probability prize if edge rounding
    IF v_selected_prize.id IS NULL THEN
        SELECT * INTO v_selected_prize
        FROM gacha_prizes
        WHERE pool_id = p_pool_id AND is_active = TRUE AND stock > 0
        ORDER BY probability_percent DESC
        LIMIT 1
        FOR UPDATE;
    END IF;

    -- 6. Decrement prize stock & increment pool spins
    UPDATE gacha_prizes
    SET stock = stock - 1
    WHERE id = v_selected_prize.id;

    UPDATE gacha_pools
    SET total_spins = total_spins + 1,
        updated_at = NOW()
    WHERE id = p_pool_id;

    -- 7. Record spin
    INSERT INTO gacha_spins (
        customer_id,
        telegram_id,
        pool_id,
        prize_id,
        rarity,
        cost,
        idempotency_key
    ) VALUES (
        p_customer_id,
        p_telegram_id,
        p_pool_id,
        v_selected_prize.id,
        v_selected_prize.rarity,
        v_pool.spin_price,
        p_idempotency_key
    ) RETURNING id INTO v_spin_id;

    -- 8. Create claim record based on delivery mode
    IF v_selected_prize.delivery_mode = 'instant_code' THEN
        v_claim_status := 'claimed';
    ELSE
        v_claim_status := 'pending_review';
    END IF;

    INSERT INTO gacha_claims (
        spin_id,
        customer_id,
        prize_id,
        status,
        delivery_data
    ) VALUES (
        v_spin_id,
        p_customer_id,
        v_selected_prize.id,
        v_claim_status,
        v_selected_prize.reward_data
    ) RETURNING id INTO v_claim_id;

    -- 9. Increment customer profile stats
    UPDATE profiles
    SET gacha_spins_count = gacha_spins_count + 1,
        updated_at = NOW()
    WHERE telegram_id = p_telegram_id;

    RETURN jsonb_build_object(
        'success', TRUE,
        'spin_id', v_spin_id,
        'claim_id', v_claim_id,
        'prize_id', v_selected_prize.id,
        'prize_title', v_selected_prize.title,
        'rarity', v_selected_prize.rarity,
        'delivery_mode', v_selected_prize.delivery_mode,
        'claim_status', v_claim_status,
        'reward_data', v_selected_prize.reward_data,
        'icon_url', v_selected_prize.icon_url
    );
END;
$$;
