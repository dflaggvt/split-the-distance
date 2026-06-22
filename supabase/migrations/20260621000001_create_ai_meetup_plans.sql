-- AI Plan Builder: saved generated meetup plans.

CREATE TABLE IF NOT EXISTS public.ai_meetup_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  vibe TEXT NOT NULL,
  from_name TEXT NOT NULL,
  from_lat DOUBLE PRECISION,
  from_lng DOUBLE PRECISION,
  to_name TEXT NOT NULL,
  to_lat DOUBLE PRECISION,
  to_lng DOUBLE PRECISION,
  midpoint JSONB NOT NULL DEFAULT '{}'::jsonb,
  travel_mode TEXT,
  midpoint_mode TEXT,
  route_summary JSONB NOT NULL DEFAULT '{}'::jsonb,
  places_used JSONB NOT NULL DEFAULT '[]'::jsonb,
  generated_plan JSONB NOT NULL,
  model TEXT,
  prompt_version TEXT NOT NULL DEFAULT 'ai-plan-builder-v1'
);

CREATE INDEX IF NOT EXISTS idx_ai_meetup_plans_user_created
  ON public.ai_meetup_plans(user_id, created_at DESC);

ALTER TABLE public.ai_meetup_plans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ai_meetup_plans_select_own" ON public.ai_meetup_plans;
CREATE POLICY "ai_meetup_plans_select_own"
  ON public.ai_meetup_plans FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_meetup_plans_delete_own" ON public.ai_meetup_plans;
CREATE POLICY "ai_meetup_plans_delete_own"
  ON public.ai_meetup_plans FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);

DROP POLICY IF EXISTS "ai_meetup_plans_service" ON public.ai_meetup_plans;
CREATE POLICY "ai_meetup_plans_service"
  ON public.ai_meetup_plans FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON TABLE public.ai_meetup_plans FROM anon, authenticated;
GRANT SELECT, DELETE ON TABLE public.ai_meetup_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.ai_meetup_plans TO service_role;

DROP TRIGGER IF EXISTS ai_meetup_plans_updated_at ON public.ai_meetup_plans;
CREATE TRIGGER ai_meetup_plans_updated_at
  BEFORE UPDATE ON public.ai_meetup_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

INSERT INTO public.feature_flags (key, tier, status, label, description, emoji, enabled, sort_order)
VALUES (
  'ai_plan_builder',
  'free',
  'live',
  'AI Plan Builder',
  'Turn midpoint results into practical meetup plans',
  '✨',
  true,
  28
)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier,
  status = EXCLUDED.status,
  label = EXCLUDED.label,
  description = EXCLUDED.description,
  emoji = EXCLUDED.emoji,
  enabled = EXCLUDED.enabled,
  sort_order = EXCLUDED.sort_order;
