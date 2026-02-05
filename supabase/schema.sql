-- Searches table
CREATE TABLE searches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  from_name TEXT,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_name TEXT,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION,
  distance_miles DOUBLE PRECISION,
  duration_seconds INTEGER,
  active_filters TEXT[], -- array of active filter names
  places_found INTEGER,
  user_agent TEXT,
  referrer TEXT
);

-- Place clicks table
CREATE TABLE place_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  place_name TEXT,
  place_category TEXT,
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,
  place_rating DOUBLE PRECISION,
  from_search_route TEXT,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION
);

-- Enable Row Level Security but allow anonymous inserts
ALTER TABLE searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE place_clicks ENABLE ROW LEVEL SECURITY;

-- Allow anonymous inserts (public/anon key can write)
CREATE POLICY "Allow anonymous inserts" ON searches FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow anonymous inserts" ON place_clicks FOR INSERT WITH CHECK (true);

-- Only authenticated users (admin) can read
CREATE POLICY "Admin read searches" ON searches FOR SELECT USING (auth.role() = 'authenticated');
CREATE POLICY "Admin read clicks" ON place_clicks FOR SELECT USING (auth.role() = 'authenticated');

-- Create indexes for common queries
CREATE INDEX idx_searches_created_at ON searches(created_at);
CREATE INDEX idx_searches_from_name ON searches(from_name);
CREATE INDEX idx_searches_to_name ON searches(to_name);
CREATE INDEX idx_place_clicks_created_at ON place_clicks(created_at);
CREATE INDEX idx_place_clicks_place_name ON place_clicks(place_name);
