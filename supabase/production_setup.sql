-- =============================================================
-- PRODUCTION DATABASE SETUP
-- Split The Distance — consolidated migration for production
-- Run this in the Supabase SQL Editor on your PRODUCTION project
-- =============================================================

-- NOTE: If your production database already has 'searches' and 'place_clicks'
-- tables from the old version, the ALTER TABLE lines below will add columns
-- safely with IF NOT EXISTS. If those tables don't exist yet, create them first
-- or skip those ALTER lines.

-- =============================================================
-- Migration 1: Analytics tables (20260206220001)
-- =============================================================

ALTER TABLE IF EXISTS searches ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE IF EXISTS place_clicks ADD COLUMN IF NOT EXISTS session_id TEXT;

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

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE outbound_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_insert_sessions" ON sessions;
CREATE POLICY "anon_insert_sessions" ON sessions FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_shares" ON shares;
CREATE POLICY "anon_insert_shares" ON shares FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_outbound_clicks" ON outbound_clicks;
CREATE POLICY "anon_insert_outbound_clicks" ON outbound_clicks FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "anon_insert_page_views" ON page_views;
CREATE POLICY "anon_insert_page_views" ON page_views FOR INSERT WITH CHECK (true);


-- =============================================================
-- Migration 2: Monetization tables (20260209000001)
-- =============================================================

CREATE TABLE IF NOT EXISTS feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT UNIQUE NOT NULL,
  label TEXT NOT NULL,
  description TEXT DEFAULT '',
  tier TEXT NOT NULL DEFAULT 'anonymous' CHECK (tier IN ('anonymous', 'free', 'premium', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'hidden' CHECK (status IN ('hidden', 'coming_soon', 'live')),
  emoji TEXT DEFAULT '',
  enabled BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS feature_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (feature_key, email)
);

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing', 'incomplete')),
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON feature_flags(status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tier ON feature_flags(tier);
CREATE INDEX IF NOT EXISTS idx_feature_flags_sort ON feature_flags(sort_order);
CREATE INDEX IF NOT EXISTS idx_feature_waitlist_feature ON feature_waitlist(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_waitlist_email ON feature_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_flags_select_all') THEN
    CREATE POLICY "feature_flags_select_all" ON feature_flags FOR SELECT USING (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_flags_admin_manage') THEN
    CREATE POLICY "feature_flags_admin_manage" ON feature_flags FOR ALL USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_flags_service_manage') THEN
    CREATE POLICY "feature_flags_service_manage" ON feature_flags FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_waitlist_insert_all') THEN
    CREATE POLICY "feature_waitlist_insert_all" ON feature_waitlist FOR INSERT WITH CHECK (true);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_waitlist_select_own') THEN
    CREATE POLICY "feature_waitlist_select_own" ON feature_waitlist FOR SELECT USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_waitlist_admin_read') THEN
    CREATE POLICY "feature_waitlist_admin_read" ON feature_waitlist FOR SELECT USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'feature_waitlist_service_read') THEN
    CREATE POLICY "feature_waitlist_service_read" ON feature_waitlist FOR SELECT USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_profiles_select_own') THEN
    CREATE POLICY "user_profiles_select_own" ON user_profiles FOR SELECT USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_profiles_upsert_own') THEN
    CREATE POLICY "user_profiles_upsert_own" ON user_profiles FOR INSERT WITH CHECK (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_profiles_update_own') THEN
    CREATE POLICY "user_profiles_update_own" ON user_profiles FOR UPDATE USING (auth.uid() = id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'user_profiles_service') THEN
    CREATE POLICY "user_profiles_service" ON user_profiles FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_select_own') THEN
    CREATE POLICY "subscriptions_select_own" ON subscriptions FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'subscriptions_service') THEN
    CREATE POLICY "subscriptions_service" ON subscriptions FOR ALL USING (auth.role() = 'service_role');
  END IF;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flags_updated_at ON feature_flags;
CREATE TRIGGER feature_flags_updated_at BEFORE UPDATE ON feature_flags FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS user_profiles_updated_at ON user_profiles;
CREATE TRIGGER user_profiles_updated_at BEFORE UPDATE ON user_profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS subscriptions_updated_at ON subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- =============================================================
-- Migration 3: Admin RLS + promote_to_admin function (20260210000001)
-- =============================================================

CREATE OR REPLACE FUNCTION promote_to_admin(target_email TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  target_id UUID;
BEGIN
  SELECT id INTO target_id FROM auth.users WHERE email = target_email;
  IF target_id IS NULL THEN
    RETURN 'User not found: ' || target_email;
  END IF;
  UPDATE auth.users
  SET raw_app_meta_data = COALESCE(raw_app_meta_data, '{}'::jsonb) || '{"role": "admin"}'::jsonb
  WHERE id = target_id;
  RETURN 'Promoted ' || target_email || ' to admin';
END;
$$;


-- =============================================================
-- Migration 6: Search History table (20260212000001)
-- =============================================================

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

CREATE INDEX IF NOT EXISTS idx_search_history_user_id ON search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_search_history_last_searched ON search_history(user_id, last_searched_at DESC);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users read own history') THEN
    CREATE POLICY "Users read own history" ON search_history FOR SELECT USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users insert own history') THEN
    CREATE POLICY "Users insert own history" ON search_history FOR INSERT WITH CHECK (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users update own history') THEN
    CREATE POLICY "Users update own history" ON search_history FOR UPDATE USING (auth.uid() = user_id);
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'Users delete own history') THEN
    CREATE POLICY "Users delete own history" ON search_history FOR DELETE USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_search_history_route_pair
  ON search_history(user_id, from_lat, from_lng, to_lat, to_lng);


-- =============================================================
-- Feature Flags: Final production state (matching dev exactly)
-- Uses ON CONFLICT to be idempotent — safe to run multiple times
-- =============================================================

-- Anonymous tier (no account needed)
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('basic_search',       'Basic Search',       'Search for midpoint between two locations',           'anonymous', 'live', '📍', 1),
  ('alternative_routes', 'Route Options',      'View and select alternative routes',                  'anonymous', 'live', '🔀', 2),
  ('category_filters',   'Place Categories',   'Browse nearby Food, Coffee, Parks, and more',         'anonymous', 'live', '🗂️', 3),
  ('share',              'Share Routes',       'Share your split via link',                           'anonymous', 'live', '🔗', 4),
  ('travel_modes',       'Travel Modes',       'Switch between Drive, Bike, and Walk',                'anonymous', 'live', '🚗', 5),
  ('distance_toggle',    'Distance Toggle',    'Switch between drive-time and distance-based midpoint','anonymous','live', '📏', 6)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier, status = EXCLUDED.status, label = EXCLUDED.label,
  description = EXCLUDED.description, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order;

-- Free tier (requires account)
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('local_only',       'Local Only',        'Filter out chain restaurants and brands',              'free', 'live', '⭐', 10),
  ('group_gravity_3',  'Group (3 People)',   'Find the fairest meeting point for 3 friends',        'free', 'live', '👥', 11),
  ('roulette',         'Midpoint Roulette',  'Feeling adventurous? Let us pick a random spot',      'free', 'live', '🎲', 12),
  ('search_history',   'Search History',     'View and re-run your recent searches',                'free', 'live', '🕐', 14)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier, status = EXCLUDED.status, label = EXCLUDED.label,
  description = EXCLUDED.description, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order;

-- Free tier, Coming Soon
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('fair_swap_zones',  'Fair Swap Zones',    'Safe public meeting spots for marketplace trades',    'free', 'coming_soon', '🤝', 13)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier, status = EXCLUDED.status, label = EXCLUDED.label,
  description = EXCLUDED.description, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order;

-- Premium tier, Live
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('drift_radius',          'Drift Radius',        'See a fairness zone instead of a single point',        'premium', 'live', '🎯', 20),
  ('group_gravity_4plus',   'Group (4-5 People)',  'Optimal meeting point for 4-5 people',                  'premium', 'live', '👥', 21),
  ('roulette_unlimited',    'Unlimited Roulette',  'Unlimited random place picks with re-rolls',            'premium', 'live', '🎰', 25),
  ('search_history_unlimited','Unlimited History', 'Keep your full search history forever',                 'premium', 'live', '📚', 26),
  ('incremental_stops',     'Road Trip Stops',     'Plan stops along your route at regular intervals',      'premium', 'live', '🛣️', 27)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier, status = EXCLUDED.status, label = EXCLUDED.label,
  description = EXCLUDED.description, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order;

-- Premium tier, Coming Soon
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('commute_equalizer',   'Commute Equalizer',   'Find neighborhoods where both commutes are balanced',  'premium', 'coming_soon', '🏠', 22),
  ('plan_an_outing',      'Plan an Outing',      'Curated multi-stop itineraries at your midpoint',      'premium', 'coming_soon', '🗓️', 23),
  ('recurring_midpoints', 'Recurring Midpoints', 'Save a pair and get fresh suggestions every week',     'premium', 'coming_soon', '🔄', 24)
ON CONFLICT (key) DO UPDATE SET
  tier = EXCLUDED.tier, status = EXCLUDED.status, label = EXCLUDED.label,
  description = EXCLUDED.description, emoji = EXCLUDED.emoji, sort_order = EXCLUDED.sort_order;


-- =============================================================
-- DONE! After running this, also run:
--   SELECT promote_to_admin('your-email@example.com');
-- to promote your admin user.
-- =============================================================
