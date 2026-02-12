-- Search history: stores recent searches for logged-in users
-- Free accounts: capped at 10 (FIFO, enforced client-side)
-- Premium accounts: unlimited
CREATE TABLE IF NOT EXISTS search_history (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  from_name TEXT NOT NULL,
  from_lat DOUBLE PRECISION NOT NULL,
  from_lng DOUBLE PRECISION NOT NULL,
  to_name TEXT NOT NULL,
  to_lat DOUBLE PRECISION NOT NULL,
  to_lng DOUBLE PRECISION NOT NULL,
  midpoint_label TEXT,
  travel_mode TEXT DEFAULT 'DRIVING',
  midpoint_mode TEXT DEFAULT 'time',
  distance_miles DOUBLE PRECISION,
  duration_seconds INTEGER,
  search_count INTEGER DEFAULT 1,
  last_searched_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_search_history_user_id ON search_history(user_id);
CREATE INDEX idx_search_history_last_searched ON search_history(user_id, last_searched_at DESC);

-- Enable RLS
ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

-- Users can only see their own history
CREATE POLICY "Users read own history"
  ON search_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own history
CREATE POLICY "Users insert own history"
  ON search_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own history (for upsert/search_count increment)
CREATE POLICY "Users update own history"
  ON search_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own history
CREATE POLICY "Users delete own history"
  ON search_history FOR DELETE
  USING (auth.uid() = user_id);

-- Unique constraint for upsert: same user + same from/to pair
CREATE UNIQUE INDEX idx_search_history_route_pair
  ON search_history(user_id, from_lat, from_lng, to_lat, to_lng);
