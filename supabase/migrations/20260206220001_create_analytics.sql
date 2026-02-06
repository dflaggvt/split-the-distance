-- Add session_id to existing tables
ALTER TABLE searches ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE place_clicks ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  user_agent TEXT,
  referrer TEXT,
  device_type TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shares table
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  share_type TEXT NOT NULL,
  from_name TEXT,
  to_name TEXT,
  share_url TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound clicks table
CREATE TABLE IF NOT EXISTS outbound_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  click_type TEXT NOT NULL,
  place_name TEXT,
  place_category TEXT,
  destination_url TEXT,
  from_search_route TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_shares" ON shares FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_outbound_clicks" ON outbound_clicks FOR INSERT WITH CHECK (true);
CREATE POLICY "anon_insert_page_views" ON page_views FOR INSERT WITH CHECK (true);
