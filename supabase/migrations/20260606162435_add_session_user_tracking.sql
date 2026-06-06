-- Track whether a browser session eventually belongs to a signed-in user.
-- Nullable to preserve existing anonymous session rows and avoid data loss.

ALTER TABLE public.sessions
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_sessions_user_created
  ON public.sessions(user_id, created_at DESC);

-- Allow a signed-in client to associate its current anonymous session row with
-- its own user id. The client also filters by random session_id and visitor_id.
DROP POLICY IF EXISTS "sessions_update_own_user_id" ON public.sessions;
CREATE POLICY "sessions_update_own_user_id" ON public.sessions
  FOR UPDATE TO authenticated
  USING (
    user_id IS NULL
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );

-- Keep pre-sign-in timeline events connected to the signed-in user too.
DROP POLICY IF EXISTS "session_events_update_own_user_id" ON public.session_events;
CREATE POLICY "session_events_update_own_user_id" ON public.session_events
  FOR UPDATE TO authenticated
  USING (
    user_id IS NULL
    OR user_id = (SELECT auth.uid())
  )
  WITH CHECK (
    user_id = (SELECT auth.uid())
  );
