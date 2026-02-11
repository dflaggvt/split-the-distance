-- =============================================================
-- Add admin role-based RLS policies for feature flag management
-- Replaces the service-role-only approach with proper user authentication.
-- Admin users are identified by app_metadata.role = 'admin'.
-- =============================================================

-- Drop the old service-role-only modify policy on feature_flags
DROP POLICY IF EXISTS "feature_flags_modify_service" ON feature_flags;

-- Admin users can manage feature flags (CRUD)
CREATE POLICY "feature_flags_admin_manage" ON feature_flags
  FOR ALL USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Keep a service role policy for programmatic use (e.g. future CI/CD, scripts)
CREATE POLICY "feature_flags_service_manage" ON feature_flags
  FOR ALL USING (auth.role() = 'service_role');

-- Drop old service-only read policy on feature_waitlist
DROP POLICY IF EXISTS "feature_waitlist_select_service" ON feature_waitlist;

-- Admin users can read all waitlist entries
CREATE POLICY "feature_waitlist_admin_read" ON feature_waitlist
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
  );

-- Keep service role read for programmatic use
CREATE POLICY "feature_waitlist_service_read" ON feature_waitlist
  FOR SELECT USING (auth.role() = 'service_role');

-- =============================================================
-- Helper: promote a user to admin by email
-- Usage: SELECT promote_to_admin('you@example.com');
-- =============================================================
CREATE OR REPLACE FUNCTION promote_to_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = target_email;
  
  IF target_id IS NULL THEN
    RETURN 'User not found: ' || target_email;
  END IF;

  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = target_id;

  RETURN 'Promoted ' || target_email || ' to admin';
END;
$$;
