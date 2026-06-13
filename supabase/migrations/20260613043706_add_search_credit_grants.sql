-- Make credit tables explicitly reachable to the roles that need them.
-- RLS policies still control row-level access for authenticated users.

REVOKE ALL ON TABLE stripe_customers FROM anon, authenticated;
REVOKE ALL ON TABLE user_search_credits FROM anon, authenticated;
REVOKE ALL ON TABLE credit_transactions FROM anon, authenticated;

GRANT SELECT ON TABLE stripe_customers TO authenticated;
GRANT SELECT ON TABLE user_search_credits TO authenticated;
GRANT SELECT ON TABLE credit_transactions TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE stripe_customers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_search_credits TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE credit_transactions TO service_role;
