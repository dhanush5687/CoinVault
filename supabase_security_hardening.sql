-- ====================================================================
-- SUPABASE SECURITY HARDENING & COIN HACK PREVENTION MIGRATION
-- Run this script in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/uwpnfnwqluxhzlnewcgp/sql
-- ====================================================================

-- 1. Ensure wallet_balance cannot ever be manipulated into negative
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'wallet_balance_non_negative'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT wallet_balance_non_negative CHECK (wallet_balance >= 0);
  END IF;
END $$;

-- 2. Atomic Reward Function (Caps max reward to 100 per action to prevent coin hacks)
CREATE OR REPLACE FUNCTION reward_user_coins(p_amount INT, p_reason TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_balance INT;
  v_new_balance INT;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  -- Anti-tamper cap: no single client call can grant > 100 coins
  IF p_amount <= 0 OR p_amount > 100 THEN
    RAISE EXCEPTION 'Invalid reward amount. Maximum allowed per event is 100 coins.';
  END IF;

  -- Atomic row lock
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  v_new_balance := v_current_balance + p_amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_user_id;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    created_at
  ) VALUES (
    v_user_id,
    'Reward',
    p_amount,
    v_new_balance,
    p_reason,
    NOW()
  );

  RETURN jsonb_build_object(
    'success', true,
    'new_balance', v_new_balance,
    'added', p_amount
  );
END;
$$;

-- 3. Atomic Withdrawal Function (Row Lock FOR UPDATE Prevents Double-Spend Race Conditions)
CREATE OR REPLACE FUNCTION process_withdrawal(
  p_amount INT,
  p_description TEXT,
  p_metadata JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_current_balance INT;
  v_new_balance INT;
  v_trans_id UUID;
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required.';
  END IF;

  IF p_amount < 500 THEN
    RAISE EXCEPTION 'Minimum withdrawal is 500 coins.';
  END IF;

  -- Atomic row lock FOR UPDATE: Blocks concurrent withdrawals from double-spending
  SELECT COALESCE(wallet_balance, 0) INTO v_current_balance
  FROM profiles
  WHERE id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found.';
  END IF;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient balance: Available % coins, requested % coins.', v_current_balance, p_amount;
  END IF;

  v_new_balance := v_current_balance - p_amount;

  UPDATE profiles
  SET wallet_balance = v_new_balance,
      updated_at = NOW()
  WHERE id = v_user_id;

  INSERT INTO wallet_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    metadata,
    created_at
  ) VALUES (
    v_user_id,
    'Withdrawal',
    -p_amount,
    v_new_balance,
    p_description,
    p_metadata,
    NOW()
  )
  RETURNING id INTO v_trans_id;

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_trans_id,
    'new_balance', v_new_balance,
    'deducted', p_amount
  );
END;
$$;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION reward_user_coins(INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION process_withdrawal(INT, TEXT, JSONB) TO authenticated;
