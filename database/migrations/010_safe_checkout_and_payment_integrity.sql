-- ==============================================================================
-- 010_safe_checkout_and_payment_integrity.sql
-- Safe Checkout and Payment Integrity:
--   - Scoped idempotency constraints per customer
--   - Positive quantity and amount invariants
--   - Indexes for fast payment & idempotency lookups
--   - Customer isolation RLS policies for orders & payments
-- Safe and idempotent for both fresh setup and existing production
-- ==============================================================================

-- 1. Ensure idempotency key index exists on orders table
CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_customer_idempotency
ON orders(customer_id, idempotency_key)
WHERE idempotency_key IS NOT NULL;

-- 2. Index for fast payment lookup by transaction reference and order_id
CREATE INDEX IF NOT EXISTS idx_payments_order_id
ON payments(order_id);

CREATE INDEX IF NOT EXISTS idx_payments_transaction_ref
ON payments(transaction_reference)
WHERE transaction_reference IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payments_md5_hash
ON payments(md5_hash)
WHERE md5_hash IS NOT NULL;

-- 3. Quantity and amount safety checks
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_quantity_positive'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_quantity_positive CHECK (quantity > 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_orders_total_non_negative'
    ) THEN
        ALTER TABLE orders ADD CONSTRAINT chk_orders_total_non_negative CHECK (total_amount >= 0);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_amount_positive'
    ) THEN
        ALTER TABLE payments ADD CONSTRAINT chk_payments_amount_positive CHECK (amount >= 0);
    END IF;
END $$;

-- 4. Customer Isolation RLS Policies
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    -- Customers can only read their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customers read own orders') THEN
        CREATE POLICY "Customers read own orders" ON orders
            FOR SELECT USING (
                auth.uid() = customer_id OR
                auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role')
            );
    END IF;

    -- Customers can only insert their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'orders' AND policyname = 'Customers insert own orders') THEN
        CREATE POLICY "Customers insert own orders" ON orders
            FOR INSERT WITH CHECK (
                auth.uid() = customer_id OR
                auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role')
            );
    END IF;

    -- Payments isolation: customers view payments for their own orders
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'payments' AND policyname = 'Customers read own payments') THEN
        CREATE POLICY "Customers read own payments" ON payments
            FOR SELECT USING (
                EXISTS (
                    SELECT 1 FROM orders
                    WHERE orders.id = payments.order_id AND orders.customer_id = auth.uid()
                ) OR
                auth.jwt() ->> 'role' IN ('admin', 'superadmin', 'service_role')
            );
    END IF;
END $$;
