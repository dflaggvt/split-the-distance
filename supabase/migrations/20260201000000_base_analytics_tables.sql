-- Baseline analytics tables that predate the migration folder.
-- This file is idempotent so existing production data is preserved.

CREATE TABLE IF NOT EXISTS public.searches (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
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
  active_filters TEXT[],
  places_found INTEGER,
  user_agent TEXT,
  referrer TEXT
);

CREATE TABLE IF NOT EXISTS public.place_clicks (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT now(),
  place_name TEXT,
  place_category TEXT,
  place_lat DOUBLE PRECISION,
  place_lng DOUBLE PRECISION,
  place_rating DOUBLE PRECISION,
  from_search_route TEXT,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION
);

ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.place_clicks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.searches;
DROP POLICY IF EXISTS "Admin read searches" ON public.searches;
DROP POLICY IF EXISTS "Allow anonymous inserts" ON public.place_clicks;
DROP POLICY IF EXISTS "Admin read clicks" ON public.place_clicks;

DROP POLICY IF EXISTS "Allow public inserts" ON public.searches;
CREATE POLICY "Allow public inserts"
  ON public.searches FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read" ON public.searches;
CREATE POLICY "Allow public read"
  ON public.searches FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role read searches" ON public.searches;
CREATE POLICY "Service role read searches"
  ON public.searches FOR SELECT
  USING (auth.role() = 'service_role');

DROP POLICY IF EXISTS "Allow public inserts" ON public.place_clicks;
CREATE POLICY "Allow public inserts"
  ON public.place_clicks FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

DROP POLICY IF EXISTS "Allow public read" ON public.place_clicks;
CREATE POLICY "Allow public read"
  ON public.place_clicks FOR SELECT
  TO anon, authenticated
  USING (true);

DROP POLICY IF EXISTS "Service role read clicks" ON public.place_clicks;
CREATE POLICY "Service role read clicks"
  ON public.place_clicks FOR SELECT
  USING (auth.role() = 'service_role');

CREATE INDEX IF NOT EXISTS idx_searches_created_at ON public.searches(created_at);
CREATE INDEX IF NOT EXISTS idx_searches_from_name ON public.searches(from_name);
CREATE INDEX IF NOT EXISTS idx_searches_to_name ON public.searches(to_name);
CREATE INDEX IF NOT EXISTS idx_place_clicks_created_at ON public.place_clicks(created_at);
CREATE INDEX IF NOT EXISTS idx_place_clicks_place_name ON public.place_clicks(place_name);
