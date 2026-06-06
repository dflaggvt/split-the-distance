-- Speed up admin dashboard range/count queries.
-- These are additive indexes only; no existing data is changed.

CREATE INDEX IF NOT EXISTS idx_sessions_internal_created
  ON public.sessions(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_sessions_internal_source_created
  ON public.sessions(is_internal, source, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_searches_internal_created
  ON public.searches(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_place_clicks_internal_created
  ON public.place_clicks(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shares_internal_created
  ON public.shares(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_share_clicks_internal_created
  ON public.share_clicks(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_outbound_clicks_internal_created
  ON public.outbound_clicks(is_internal, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_user_profiles_created
  ON public.user_profiles(created_at DESC);
