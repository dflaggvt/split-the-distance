-- Tighten analytics session reads.
--
-- The browser must be able to create anonymous session rows, but anonymous
-- visitors should not be able to read all session rows. Admin dashboard reads
-- remain covered by the sessions_admin_read policy.

DROP POLICY IF EXISTS "Allow anonymous reads" ON public.sessions;
DROP POLICY IF EXISTS "anon_select_sessions" ON public.sessions;
