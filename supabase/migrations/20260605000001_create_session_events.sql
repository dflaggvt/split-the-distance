-- Session Events: ordered product activity timeline for anonymous and logged-in visitors.

CREATE TABLE IF NOT EXISTS session_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  visitor_id TEXT,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  event_group TEXT DEFAULT 'interaction',
  event_label TEXT,
  sequence_number INTEGER,
  page_path TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_created
  ON session_events(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_session_events_visitor_created
  ON session_events(visitor_id, created_at);

CREATE INDEX IF NOT EXISTS idx_session_events_user_created
  ON session_events(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_session_events_type_created
  ON session_events(event_type, created_at);

CREATE INDEX IF NOT EXISTS idx_session_events_created_at
  ON session_events(created_at DESC);

ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sessions_admin_read" ON sessions;
CREATE POLICY "sessions_admin_read" ON sessions
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );

DROP POLICY IF EXISTS "session_events_insert_all" ON session_events;
CREATE POLICY "session_events_insert_all" ON session_events
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "session_events_admin_read" ON session_events;
CREATE POLICY "session_events_admin_read" ON session_events
  FOR SELECT USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR auth.role() = 'service_role'
  );
