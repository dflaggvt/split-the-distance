-- Enrich page view analytics while preserving existing rows.

ALTER TABLE public.page_views
  ADD COLUMN IF NOT EXISTS visitor_id TEXT,
  ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS page_url TEXT,
  ADD COLUMN IF NOT EXISTS search TEXT,
  ADD COLUMN IF NOT EXISTS title TEXT,
  ADD COLUMN IF NOT EXISTS device_type TEXT;

CREATE INDEX IF NOT EXISTS idx_page_views_created_at
  ON public.page_views(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_session_created
  ON public.page_views(session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_visitor_created
  ON public.page_views(visitor_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_user_created
  ON public.page_views(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_views_path_created
  ON public.page_views(page_path, created_at DESC);

DROP POLICY IF EXISTS "anon_select_page_views" ON public.page_views;
