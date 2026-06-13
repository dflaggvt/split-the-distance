-- Search credits: prepaid usage model for midpoint searches.
-- Additive only; preserves existing subscriptions for grandfathered premium users.

CREATE TABLE IF NOT EXISTS stripe_customers (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS user_search_credits (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  lifetime_purchased INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_purchased >= 0),
  lifetime_used INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_used >= 0),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_type TEXT NOT NULL CHECK (
    transaction_type IN (
      'purchase',
      'search_debit',
      'refund',
      'admin_adjustment',
      'subscription_grant'
    )
  ),
  amount INTEGER NOT NULL CHECK (amount <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0),
  stripe_checkout_session_id TEXT UNIQUE,
  stripe_payment_intent_id TEXT,
  stripe_price_id TEXT,
  description TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stripe_customers_customer
  ON stripe_customers(stripe_customer_id);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_created
  ON credit_transactions(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_checkout_session
  ON credit_transactions(stripe_checkout_session_id)
  WHERE stripe_checkout_session_id IS NOT NULL;

ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_search_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "stripe_customers_select_own"
  ON stripe_customers FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "stripe_customers_service"
  ON stripe_customers FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "user_search_credits_select_own"
  ON user_search_credits FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "user_search_credits_service"
  ON user_search_credits FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "credit_transactions_select_own"
  ON credit_transactions FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "credit_transactions_service"
  ON credit_transactions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

DROP TRIGGER IF EXISTS stripe_customers_updated_at ON stripe_customers;
CREATE TRIGGER stripe_customers_updated_at
  BEFORE UPDATE ON stripe_customers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_search_credits_updated_at ON user_search_credits;
CREATE TRIGGER user_search_credits_updated_at
  BEFORE UPDATE ON user_search_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION grant_search_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_transaction_type TEXT DEFAULT 'purchase',
  p_stripe_checkout_session_id TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_stripe_price_id TEXT DEFAULT NULL,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  granted BOOLEAN,
  balance INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  next_balance INTEGER;
BEGIN
  IF p_user_id IS NULL THEN
    RAISE EXCEPTION 'p_user_id is required';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'p_amount must be positive';
  END IF;

  IF p_transaction_type NOT IN ('purchase', 'admin_adjustment', 'subscription_grant') THEN
    RAISE EXCEPTION 'invalid credit grant transaction type';
  END IF;

  IF p_stripe_checkout_session_id IS NOT NULL AND EXISTS (
    SELECT 1
    FROM credit_transactions
    WHERE stripe_checkout_session_id = p_stripe_checkout_session_id
  ) THEN
    SELECT usc.balance INTO current_balance
    FROM user_search_credits usc
    WHERE usc.user_id = p_user_id;

    granted := false;
    balance := COALESCE(current_balance, 0);
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO user_search_credits (user_id, balance, lifetime_purchased)
  VALUES (p_user_id, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT usc.balance INTO current_balance
  FROM user_search_credits usc
  WHERE usc.user_id = p_user_id
  FOR UPDATE;

  next_balance := current_balance + p_amount;

  UPDATE user_search_credits
  SET
    balance = next_balance,
    lifetime_purchased = lifetime_purchased + p_amount,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    stripe_checkout_session_id,
    stripe_payment_intent_id,
    stripe_price_id,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    p_transaction_type,
    p_amount,
    next_balance,
    p_stripe_checkout_session_id,
    p_stripe_payment_intent_id,
    p_stripe_price_id,
    p_description,
    COALESCE(p_metadata, '{}'::jsonb)
  );

  granted := true;
  balance := next_balance;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION consume_search_credit(
  p_user_id UUID,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS TABLE (
  allowed BOOLEAN,
  balance INTEGER,
  reason TEXT,
  grandfathered BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  current_balance INTEGER;
  next_balance INTEGER;
  has_active_subscription BOOLEAN;
BEGIN
  IF p_user_id IS NULL THEN
    allowed := false;
    balance := 0;
    reason := 'auth_required';
    grandfathered := false;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM subscriptions s
    WHERE s.user_id = p_user_id
      AND s.plan IN ('premium', 'enterprise')
      AND s.status IN ('active', 'trialing', 'past_due')
  ) INTO has_active_subscription;

  IF has_active_subscription THEN
    SELECT usc.balance INTO current_balance
    FROM user_search_credits usc
    WHERE usc.user_id = p_user_id;

    allowed := true;
    balance := COALESCE(current_balance, 0);
    reason := 'active_subscription';
    grandfathered := true;
    RETURN NEXT;
    RETURN;
  END IF;

  INSERT INTO user_search_credits (user_id, balance, lifetime_purchased, lifetime_used)
  VALUES (p_user_id, 0, 0, 0)
  ON CONFLICT (user_id) DO NOTHING;

  SELECT usc.balance INTO current_balance
  FROM user_search_credits usc
  WHERE usc.user_id = p_user_id
  FOR UPDATE;

  IF current_balance <= 0 THEN
    allowed := false;
    balance := current_balance;
    reason := 'no_credits';
    grandfathered := false;
    RETURN NEXT;
    RETURN;
  END IF;

  next_balance := current_balance - 1;

  UPDATE user_search_credits
  SET
    balance = next_balance,
    lifetime_used = lifetime_used + 1,
    updated_at = now()
  WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    'search_debit',
    -1,
    next_balance,
    'Midpoint search',
    COALESCE(p_metadata, '{}'::jsonb)
  );

  allowed := true;
  balance := next_balance;
  reason := 'credit_used';
  grandfathered := false;
  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION grant_search_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION grant_search_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION grant_search_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION grant_search_credits(UUID, INTEGER, TEXT, TEXT, TEXT, TEXT, TEXT, JSONB) TO service_role;

REVOKE ALL ON FUNCTION consume_search_credit(UUID, JSONB) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION consume_search_credit(UUID, JSONB) FROM anon;
REVOKE EXECUTE ON FUNCTION consume_search_credit(UUID, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION consume_search_credit(UUID, JSONB) TO service_role;
