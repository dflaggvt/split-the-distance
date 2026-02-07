
-- Add visitor_id column for return visitor tracking (run this migration)
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS visitor_id TEXT;
CREATE INDEX IF NOT EXISTS idx_sessions_visitor_id ON sessions(visitor_id);
