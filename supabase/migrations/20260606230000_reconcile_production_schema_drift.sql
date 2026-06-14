-- Reconcile schema that exists in production but was not represented in repo migrations.
-- This migration is idempotent and contains no production data.

ALTER TABLE IF EXISTS public.sessions
  ADD COLUMN IF NOT EXISTS page_views INTEGER DEFAULT 1,
  ADD COLUMN IF NOT EXISTS searches_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS place_clicks_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS landing_page TEXT,
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS source_detail TEXT,
  ADD COLUMN IF NOT EXISTS utm_source TEXT,
  ADD COLUMN IF NOT EXISTS utm_medium TEXT,
  ADD COLUMN IF NOT EXISTS utm_campaign TEXT,
  ADD COLUMN IF NOT EXISTS utm_content TEXT,
  ADD COLUMN IF NOT EXISTS utm_term TEXT,
  ADD COLUMN IF NOT EXISTS referrer_url TEXT,
  ADD COLUMN IF NOT EXISTS referrer_domain TEXT;

ALTER TABLE IF EXISTS public.searches
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS cache_hit BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.place_clicks
  ADD COLUMN IF NOT EXISTS is_internal BOOLEAN DEFAULT FALSE;

ALTER TABLE IF EXISTS public.shares
  ADD COLUMN IF NOT EXISTS midpoint_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS midpoint_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS share_id TEXT,
  ADD COLUMN IF NOT EXISTS share_method TEXT,
  ADD COLUMN IF NOT EXISTS route_from_name TEXT,
  ADD COLUMN IF NOT EXISTS route_to_name TEXT,
  ADD COLUMN IF NOT EXISTS route_from_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS route_from_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS route_to_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS route_to_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS click_count INTEGER DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.share_clicks (
  id BIGSERIAL PRIMARY KEY,
  share_id TEXT NOT NULL,
  visitor_session_id TEXT,
  referrer_url TEXT,
  referrer_domain TEXT,
  device_type TEXT,
  user_agent TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.attribution_logs (
  id BIGSERIAL PRIMARY KEY,
  event_type TEXT NOT NULL,
  session_id TEXT,
  share_id TEXT,
  source TEXT,
  source_detail TEXT,
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  referrer_url TEXT,
  error_message TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.user_events (
  id BIGSERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  session_id TEXT,
  event_type TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.route_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key TEXT NOT NULL UNIQUE,
  route_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  hit_count INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_visitor_created
  ON public.sessions(visitor_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_sessions_landing_created
  ON public.sessions(landing_page, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shares_share_id
  ON public.shares(share_id);
CREATE INDEX IF NOT EXISTS idx_share_clicks_share_created
  ON public.share_clicks(share_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_logs_created
  ON public.attribution_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_attribution_logs_session_created
  ON public.attribution_logs(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_user_created
  ON public.user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_session_created
  ON public.user_events(session_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_route_cache_key
  ON public.route_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_route_cache_expires
  ON public.route_cache(expires_at);

ALTER TABLE public.share_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attribution_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_cache ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_share_clicks" ON public.share_clicks;
CREATE POLICY "anon_insert_share_clicks"
  ON public.share_clicks FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_share_clicks" ON public.share_clicks;
CREATE POLICY "anon_select_share_clicks"
  ON public.share_clicks FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "anon_insert_attribution_logs" ON public.attribution_logs;
CREATE POLICY "anon_insert_attribution_logs"
  ON public.attribution_logs FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "anon_select_attribution_logs" ON public.attribution_logs;
CREATE POLICY "anon_select_attribution_logs"
  ON public.attribution_logs FOR SELECT
  TO anon
  USING (true);

DROP POLICY IF EXISTS "user_events_anon_insert" ON public.user_events;
CREATE POLICY "user_events_anon_insert"
  ON public.user_events FOR INSERT
  WITH CHECK (user_id IS NULL);

DROP POLICY IF EXISTS "user_events_insert" ON public.user_events;
CREATE POLICY "user_events_insert"
  ON public.user_events FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_events_select_own" ON public.user_events;
CREATE POLICY "user_events_select_own"
  ON public.user_events FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "user_events_admin_select" ON public.user_events;
CREATE POLICY "user_events_admin_select"
  ON public.user_events FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Allow all on route_cache" ON public.route_cache;
CREATE POLICY "Allow all on route_cache"
  ON public.route_cache FOR ALL
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.increment_share_clicks(p_share_id TEXT)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE public.shares
  SET click_count = COALESCE(click_count, 0) + 1
  WHERE share_id = p_share_id;
END;
$$;

GRANT SELECT, INSERT ON public.share_clicks TO anon, authenticated;
GRANT SELECT, INSERT ON public.attribution_logs TO anon, authenticated;
GRANT SELECT, INSERT ON public.user_events TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.route_cache TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.share_clicks_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.attribution_logs_id_seq TO anon, authenticated;
GRANT USAGE, SELECT ON SEQUENCE public.user_events_id_seq TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_share_clicks(TEXT) TO anon, authenticated, service_role;
