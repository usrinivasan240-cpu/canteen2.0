-- Esc(Q) Wallet Feature - Database Migration
-- Run this in Supabase SQL Editor

-- ============================================================
-- WALLET TABLES
-- ============================================================

-- Wallets table: One active wallet per user
CREATE TABLE IF NOT EXISTS wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'FROZEN', 'SUSPENDED', 'CLOSED')),
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0,
  UNIQUE(user_id)
);

-- Wallet transactions ledger (audit trail)
CREATE TABLE IF NOT EXISTS wallet_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('TOPUP', 'PURCHASE', 'REFUND', 'REVERSAL', 'ADJUSTMENT')),
  amount BIGINT NOT NULL, -- Stored in paise (1/100 of currency unit)
  direction TEXT NOT NULL CHECK (direction IN ('CREDIT', 'DEBIT')),
  status TEXT DEFAULT 'SUCCESS' CHECK (status IN ('SUCCESS', 'PENDING', 'FAILED', 'REVERSED')),
  reference_type TEXT CHECK (reference_type IN ('ORDER', 'TOPUP', 'REFUND', 'REVERSAL', 'ADJUSTMENT')),
  reference_id TEXT,
  idempotency_key TEXT UNIQUE,
  description TEXT DEFAULT '',
  created_at BIGINT DEFAULT 0
);

-- Wallet top-ups (payment gateway integration)
CREATE TABLE IF NOT EXISTS wallet_topups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  wallet_id UUID NOT NULL REFERENCES wallets(id) ON DELETE CASCADE,
  amount BIGINT NOT NULL, -- Amount in paise
  provider TEXT NOT NULL CHECK (provider IN ('RAZORPAY', 'VYAPAR', 'STRIPE', 'MOCK')),
  provider_order_id TEXT,
  provider_payment_id TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'SUCCESS', 'FAILED', 'CANCELLED', 'REFUNDED')),
  idempotency_key TEXT UNIQUE,
  created_at BIGINT DEFAULT 0,
  updated_at BIGINT DEFAULT 0
);

-- ============================================================
-- INDEXES
-- ============================================================

CREATE INDEX IF NOT EXISTS idx_wallets_user ON wallets(user_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_wallet ON wallet_transactions(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_created ON wallet_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_ref ON wallet_transactions(reference_type, reference_id);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_idempotency ON wallet_transactions(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_wallet ON wallet_topups(wallet_id);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_status ON wallet_topups(status);
CREATE INDEX IF NOT EXISTS idx_wallet_topups_idempotency ON wallet_topups(idempotency_key);

-- ============================================================
-- FUNCTIONS
-- ============================================================

-- Function to get or create wallet for user
CREATE OR REPLACE FUNCTION get_or_create_wallet(p_user_id TEXT)
RETURNS TABLE(id UUID, user_id TEXT, currency TEXT, status TEXT, created_at BIGINT, updated_at BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet RECORD;
BEGIN
  -- Try to find existing wallet
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    -- Create new wallet
    INSERT INTO wallets (user_id, currency, status, created_at, updated_at)
    VALUES (p_user_id, 'INR', 'ACTIVE', EXTRACT(EPOCH FROM NOW()) * 1000, EXTRACT(EPOCH FROM NOW()) * 1000)
    RETURNING id, user_id, currency, status, created_at, updated_at INTO v_wallet;
  END IF;
  
  RETURN QUERY VALUES (v_wallet.id, v_wallet.user_id, v_wallet.currency, v_wallet.status, v_wallet.created_at, v_wallet.updated_at);
END;
$$;

-- Function to get wallet balance from ledger
CREATE OR REPLACE FUNCTION get_wallet_balance(p_wallet_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT := 0;
BEGIN
  SELECT COALESCE(SUM(
    CASE 
      WHEN direction = 'CREDIT' THEN amount
      WHEN direction = 'DEBIT' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_balance
  FROM wallet_transactions
  WHERE wallet_id = p_wallet_id AND status = 'SUCCESS';
  
  RETURN v_balance;
END;
$$;

-- Function to get wallet with balance
CREATE OR REPLACE FUNCTION get_wallet_with_balance(p_user_id TEXT)
RETURNS TABLE(
  id UUID, 
  user_id TEXT, 
  currency TEXT, 
  status TEXT, 
  balance BIGINT,
  created_at BIGINT,
  updated_at BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_wallet RECORD;
  v_balance BIGINT := 0;
BEGIN
  SELECT * INTO v_wallet FROM wallets WHERE user_id = p_user_id;
  
  IF v_wallet IS NULL THEN
    -- Create wallet if not exists
    INSERT INTO wallets (user_id, currency, status, created_at, updated_at)
    VALUES (p_user_id, 'INR', 'ACTIVE', EXTRACT(EPOCH FROM NOW()) * 1000, EXTRACT(EPOCH FROM NOW()) * 1000)
    RETURNING id, user_id, currency, status, created_at, updated_at INTO v_wallet;
  END IF;
  
  SELECT get_wallet_balance(v_wallet.id) INTO v_balance;
  
  RETURN QUERY VALUES (v_wallet.id, v_wallet.user_id, v_wallet.currency, v_wallet.status, v_balance, v_wallet.created_at, v_wallet.updated_at);
END;
$$;

-- ============================================================
-- WALLET TRANSACTION FUNCTIONS
-- ============================================================

-- Function to create wallet transaction (atomic)
CREATE OR REPLACE FUNCTION create_wallet_transaction(
  p_wallet_id UUID,
  p_type TEXT,
  p_amount BIGINT,
  p_direction TEXT,
  p_reference_type TEXT DEFAULT NULL,
  p_reference_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT DEFAULT NULL,
  p_description TEXT DEFAULT ''
)
RETURNS TABLE(id UUID, wallet_id UUID, type TEXT, amount BIGINT, direction TEXT, status TEXT, reference_type TEXT, reference_id TEXT, idempotency_key TEXT, description TEXT, created_at BIGINT)
LANGUAGE plpgsql
AS $$
DECLARE
  v_transaction RECORD;
BEGIN
  -- Check idempotency
  IF p_idempotency_key IS NOT NULL THEN
    SELECT * INTO v_transaction FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
    IF FOUND THEN
      RETURN QUERY SELECT id, wallet_id, type, amount, direction, status, reference_type, reference_id, idempotency_key, description, created_at 
      FROM wallet_transactions WHERE idempotency_key = p_idempotency_key;
      RETURN;
    END IF;
  END IF;
  
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, direction, status, reference_type, reference_id, 
    idempotency_key, description, created_at
  ) VALUES (
    p_wallet_id, p_type, p_amount, p_direction, 'SUCCESS', 
    p_reference_type, p_reference_id, p_idempotency_key, p_description, EXTRACT(EPOCH FROM NOW()) * 1000
  )
  RETURNING id, wallet_id, type, amount, direction, status, reference_type, reference_id, idempotency_key, description, created_at
  INTO v_transaction;
  
  RETURN QUERY VALUES (
    v_transaction.id, v_transaction.wallet_id, v_transaction.type, 
    v_transaction.amount, v_transaction.direction, v_transaction.status,
    v_transaction.reference_type, v_transaction.reference_id, 
    v_transaction.idempotency_key, v_transaction.description, v_transaction.created_at
  );
END;
$$;

-- Function for wallet top-up (server-side verification)
CREATE OR REPLACE FUNCTION process_wallet_topup(
  p_wallet_id UUID,
  p_amount BIGINT,
  p_provider TEXT,
  p_provider_order_id TEXT DEFAULT NULL,
  p_provider_payment_id TEXT DEFAULT NULL,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  topup_id UUID, 
  wallet_id UUID, 
  amount BIGINT, 
  provider TEXT, 
  provider_order_id TEXT, 
  provider_payment_id TEXT, 
  status TEXT, 
  created_at BIGINT, 
  updated_at BIGINT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_topup RECORD;
BEGIN
  -- Check idempotency
  SELECT * INTO v_topup FROM wallet_topups WHERE idempotency_key = p_idempotency_key;
  IF FOUND THEN
    RETURN QUERY SELECT id, wallet_id, amount, provider, provider_order_id, provider_payment_id, status, created_at, updated_at
    FROM wallet_topups WHERE idempotency_key = p_idempotency_key;
    RETURN;
  END IF;
  
  -- Create topup record
  INSERT INTO wallet_topups (
    wallet_id, amount, provider, provider_order_id, provider_payment_id, 
    status, idempotency_key, created_at, updated_at
  ) VALUES (
    p_wallet_id, p_amount, p_provider, p_provider_order_id, p_provider_payment_id,
    'SUCCESS', p_idempotency_key, EXTRACT(EPOCH FROM NOW()) * 1000, EXTRACT(EPOCH FROM NOW()) * 1000
  )
  RETURNING id, wallet_id, amount, provider, provider_order_id, provider_payment_id, status, created_at, updated_at
  INTO v_topup;
  
  -- Create credit transaction
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, direction, status, reference_type, reference_id,
    idempotency_key, description, created_at
  ) VALUES (
    p_wallet_id, 'TOPUP', p_amount, 'CREDIT', 'SUCCESS',
    'TOPUP', v_topup.id, p_idempotency_key, 'Wallet top-up via ' || p_provider,
    EXTRACT(EPOCH FROM NOW()) * 1000
  );
  
  RETURN QUERY VALUES (
    v_topup.id, v_topup.wallet_id, v_topup.amount, v_topup.provider,
    v_topup.provider_order_id, v_topup.provider_payment_id, v_topup.status,
    v_topup.created_at, v_topup.updated_at
  );
END;
$$;

-- Function for wallet purchase (atomic)
CREATE OR REPLACE FUNCTION process_wallet_purchase(
  p_wallet_id UUID,
  p_order_id TEXT,
  p_amount BIGINT,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  transaction_id UUID,
  new_balance BIGINT,
  error TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_balance BIGINT;
  v_txn_id UUID;
BEGIN
  -- Check wallet exists and is active
  IF NOT EXISTS (SELECT 1 FROM wallets WHERE id = p_wallet_id AND status = 'ACTIVE') THEN
    RETURN QUERY VALUES (FALSE, NULL, 0, 'Wallet not found or inactive');
  END IF;
  
  -- Check idempotency
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key AND status = 'SUCCESS') THEN
    RETURN QUERY VALUES (TRUE, NULL, (SELECT get_wallet_balance(p_wallet_id)), 'DUPLICATE_REQUEST');
  END IF;
  
  -- Check balance
  IF (SELECT get_wallet_balance(p_wallet_id)) < p_amount THEN
    RETURN QUERY VALUES (FALSE, NULL, (SELECT get_wallet_balance(p_wallet_id)), 'INSUFFICIENT_BALANCE');
  END IF;
  
  -- Create debit transaction
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, direction, status, reference_type, reference_id,
    idempotency_key, description, created_at
  ) VALUES (
    p_wallet_id, 'PURCHASE', p_amount, 'DEBIT', 'SUCCESS',
    'ORDER', p_order_id, p_idempotency_key, 'Food purchase', EXTRACT(EPOCH FROM NOW()) * 1000
  )
  RETURNING id INTO v_balance;
  
  RETURN QUERY VALUES (
    TRUE, 
    (SELECT id FROM wallet_transactions WHERE idempotency_key = p_idempotency_key AND type = 'PURCHASE'),
    (SELECT get_wallet_balance(p_wallet_id)), 
    NULL
  );
END;
$$;

-- ============================================================
-- REFUND FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION process_refund(
  p_wallet_id UUID,
  p_original_transaction_id UUID,
  p_amount BIGINT,
  p_idempotency_key TEXT
)
RETURNS TABLE(
  success BOOLEAN,
  transaction_id UUID,
  new_balance BIGINT,
  error TEXT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_original_txn RECORD;
BEGIN
  -- Check original transaction exists and is a purchase
  SELECT * INTO v_original_txn 
  FROM wallet_transactions 
  WHERE id = p_original_transaction_id AND wallet_id = p_wallet_id AND type = 'PURCHASE' AND status = 'SUCCESS';
  
  IF NOT FOUND THEN
    RETURN QUERY VALUES (FALSE, NULL, 0, 'Original purchase transaction not found');
  END IF;
  
  -- Check if already refunded
  IF EXISTS (
    SELECT 1 FROM wallet_transactions 
    WHERE reference_id = p_original_transaction_id::TEXT AND type = 'REFUND' AND status = 'SUCCESS'
  ) THEN
    RETURN QUERY VALUES (TRUE, NULL, (SELECT get_wallet_balance(p_wallet_id)), 'DUPLICATE_REFUND');
  END IF;
  
  -- Check idempotency
  IF EXISTS (SELECT 1 FROM wallet_transactions WHERE idempotency_key = p_idempotency_key AND status = 'SUCCESS') THEN
    RETURN QUERY VALUES (TRUE, NULL, (SELECT get_wallet_balance(p_wallet_id)), 'DUPLICATE_REFUND');
  END IF;
  
  -- Create refund transaction
  INSERT INTO wallet_transactions (
    wallet_id, type, amount, direction, status, reference_type, reference_id,
    idempotency_key, description, created_at
  ) VALUES (
    p_wallet_id, 'REFUND', p_amount, 'CREDIT', 'SUCCESS',
    'REFUND', p_original_transaction_id::TEXT, 
    'REFUND_' || gen_random_uuid()::TEXT, 'Refund for order', EXTRACT(EPOCH FROM NOW()) * 1000
  )
  RETURNING id INTO v_balance;
  
  RETURN QUERY VALUES (
    TRUE, 
    (SELECT id FROM wallet_transactions WHERE idempotency_key = 'REFUND_' || p_original_transaction_id::TEXT),
    (SELECT get_wallet_balance(p_wallet_id)),
    NULL
  );
END;
$$;

-- ============================================================
-- RECONCILIATION FUNCTION
-- ============================================================

CREATE OR REPLACE FUNCTION reconcile_wallet(p_wallet_id UUID)
RETURNS TABLE(
  ledger_balance BIGINT,
  calculated_balance BIGINT,
  mismatch BOOLEAN,
  missing_transactions INT
)
LANGUAGE plpgsql
AS $$
DECLARE
  v_ledger_balance BIGINT;
  v_calculated_balance BIGINT;
  v_mismatch BOOLEAN;
  v_missing_count INT;
BEGIN
  SELECT get_wallet_balance(p_wallet_id) INTO v_ledger_balance;
  
  -- Calculate from transactions
  SELECT COALESCE(SUM(
    CASE 
      WHEN direction = 'CREDIT' THEN amount
      WHEN direction = 'DEBIT' THEN -amount
      ELSE 0
    END
  ), 0) INTO v_calculated_balance
  FROM wallet_transactions
  WHERE wallet_id = p_wallet_id AND status = 'SUCCESS';
  
  v_mismatch := (v_ledger_balance != v_calculated_balance);
  
  SELECT COUNT(*) INTO v_missing_count
  FROM wallet_transactions wt
  WHERE wt.wallet_id = p_wallet_id AND wt.status = 'SUCCESS'
  AND NOT EXISTS (
    SELECT 1 FROM wallet_transactions wt2 
    WHERE wt2.wallet_id = p_wallet_id 
    AND wt2.id != wt.id
    AND wt2.amount = wt.amount 
    AND wt2.direction = wt.direction
    AND wt2.created_at = wt.created_at
  );
  
  RETURN QUERY VALUES (v_ledger_balance, v_calculated_balance, v_mismatch, v_missing_count);
END;
$$;

-- ============================================================
-- RLS POLICIES
-- ============================================================

ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallet_topups ENABLE ROW LEVEL SECURITY;

-- Users can only see their own wallet
CREATE POLICY "Users can view own wallet" ON wallets
  FOR SELECT USING (auth.uid()::text = user_id);

-- Users can only see their own transactions
CREATE POLICY "Users can view own transactions" ON wallet_transactions
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets WHERE id = wallet_transactions.wallet_id AND user_id = auth.uid()::text)
  );

-- Users can view own topups
CREATE POLICY "Users can view own topups" ON wallet_topups
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM wallets WHERE id = wallet_topups.wallet_id AND user_id = auth.uid()::text)
  );

-- Service role can do everything (for backend functions)
CREATE POLICY "Service role full access" ON wallets FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON wallet_transactions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON wallet_topups FOR ALL USING (auth.role() = 'service_role');

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON wallets TO authenticated, service_role;
GRANT SELECT, INSERT ON wallet_transactions TO authenticated, service_role;
GRANT SELECT, INSERT ON wallet_topups TO authenticated, service_role;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = EXTRACT(EPOCH FROM NOW()) * 1000;
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_wallets_updated_at BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_wallet_topups_updated_at BEFORE UPDATE ON wallet_topups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================
-- VIEW FOR RECONCILIATION
-- ============================================================

CREATE OR REPLACE VIEW wallet_reconciliation AS
SELECT 
  w.id AS wallet_id,
  w.user_id,
  w.currency,
  w.status,
  get_wallet_balance(w.id) AS ledger_balance,
  COALESCE(SUM(
    CASE 
      WHEN wt.direction = 'CREDIT' THEN wt.amount
      WHEN wt.direction = 'DEBIT' THEN -wt.amount
      ELSE 0
    END
  ), 0) AS calculated_balance,
  (get_wallet_balance(w.id) != COALESCE(SUM(
    CASE 
      WHEN wt.direction = 'CREDIT' THEN wt.amount
      WHEN wt.direction = 'DEBIT' THEN -wt.amount
      ELSE 0
    END
  ), 0)) AS has_mismatch,
  w.created_at,
  w.updated_at
FROM wallets w
LEFT JOIN wallet_transactions wt ON wt.wallet_id = w.id AND wt.status = 'SUCCESS'
GROUP BY w.id, w.user_id, w.currency, w.status, w.created_at, w.updated_at;