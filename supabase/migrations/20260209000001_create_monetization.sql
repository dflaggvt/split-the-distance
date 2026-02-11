-- =============================================================
-- Monetization System: Feature Flags, Auth Profiles, Subscriptions
-- =============================================================

-- 1. Feature Flags — remote-togglable feature configuration
-- Each feature has a tier (who can access) and status (lifecycle stage)
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

-- 2. Feature Waitlist — "Notify Me" interest capture for coming_soon features
CREATE TABLE IF NOT EXISTS feature_waitlist (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  feature_key TEXT NOT NULL REFERENCES feature_flags(key) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (feature_key, email)
);

-- 3. User Profiles — extends Supabase Auth users with plan info
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT,
  avatar_url TEXT,
  email TEXT,
  plan TEXT NOT NULL DEFAULT 'free' CHECK (plan IN ('free', 'premium', 'enterprise')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Subscriptions — Stripe subscription state
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

-- =============================================================
-- Indexes
-- =============================================================

CREATE INDEX IF NOT EXISTS idx_feature_flags_status ON feature_flags(status);
CREATE INDEX IF NOT EXISTS idx_feature_flags_tier ON feature_flags(tier);
CREATE INDEX IF NOT EXISTS idx_feature_flags_sort ON feature_flags(sort_order);
CREATE INDEX IF NOT EXISTS idx_feature_waitlist_feature ON feature_waitlist(feature_key);
CREATE INDEX IF NOT EXISTS idx_feature_waitlist_email ON feature_waitlist(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);

-- =============================================================
-- Row Level Security (RLS)
-- =============================================================

ALTER TABLE feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE feature_waitlist ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

-- feature_flags: everyone can read (needed for client-side feature checks)
CREATE POLICY "feature_flags_select_all" ON feature_flags
  FOR SELECT USING (true);

-- feature_flags: only service role can modify (admin dashboard uses service key)
CREATE POLICY "feature_flags_modify_service" ON feature_flags
  FOR ALL USING (auth.role() = 'service_role');

-- feature_waitlist: anyone can insert (anonymous Notify Me signups)
CREATE POLICY "feature_waitlist_insert_all" ON feature_waitlist
  FOR INSERT WITH CHECK (true);

-- feature_waitlist: authenticated users can read their own rows
CREATE POLICY "feature_waitlist_select_own" ON feature_waitlist
  FOR SELECT USING (auth.uid() = user_id OR email = (SELECT email FROM auth.users WHERE id = auth.uid()));

-- feature_waitlist: service role can read all (admin dashboard)
CREATE POLICY "feature_waitlist_select_service" ON feature_waitlist
  FOR SELECT USING (auth.role() = 'service_role');

-- user_profiles: users can read their own profile
CREATE POLICY "user_profiles_select_own" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

-- user_profiles: users can insert/update their own profile
CREATE POLICY "user_profiles_upsert_own" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "user_profiles_update_own" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

-- user_profiles: service role can do anything (webhook updates)
CREATE POLICY "user_profiles_service" ON user_profiles
  FOR ALL USING (auth.role() = 'service_role');

-- subscriptions: users can read their own
CREATE POLICY "subscriptions_select_own" ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

-- subscriptions: service role can do anything (webhook creates/updates)
CREATE POLICY "subscriptions_service" ON subscriptions
  FOR ALL USING (auth.role() = 'service_role');

-- =============================================================
-- Auto-update updated_at trigger
-- =============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER subscriptions_updated_at
  BEFORE UPDATE ON subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- =============================================================
-- Seed Feature Flags
-- =============================================================

-- Anonymous tier, LIVE (already built and working today)
INSERT INTO feature_flags (key, label, description, tier, status, emoji, sort_order) VALUES
  ('basic_search',       'Basic Search',       'Search for midpoint between two locations',           'anonymous', 'live', '📍', 1),
  ('alternative_routes', 'Route Options',      'View and select alternative routes',                  'anonymous', 'live', '🔀', 2),
  ('category_filters',   'Place Categories',   'Browse nearby Food, Coffee, Parks, and more',         'anonymous', 'live', '🗂️', 3),
  ('share',              'Share Routes',       'Share your split via link',                           'anonymous', 'live', '🔗', 4),
  ('travel_modes',       'Travel Modes',       'Switch between Drive, Bike, and Walk',                'anonymous', 'live', '🚗', 5),

  -- Free tier, LIVE (already built, just needs login gate)
  ('local_only',         'Local Only',         'Filter out chain restaurants and brands',             'free', 'live', '⭐', 10),

  -- Free tier, COMING SOON (not yet built)
  ('group_gravity_3',    'Group (3 People)',   'Find the fairest meeting point for 3 friends',        'free', 'coming_soon', '👥', 11),
  ('roulette',           'Midpoint Roulette',  'Feeling adventurous? Let us pick a random spot',      'free', 'coming_soon', '🎲', 12),
  ('fair_swap_zones',    'Fair Swap Zones',    'Safe public meeting spots for marketplace trades',    'free', 'coming_soon', '🤝', 13),

  -- Premium tier, COMING SOON (not yet built)
  ('drift_radius',       'Drift Radius',       'See a fairness zone instead of a single point',      'premium', 'coming_soon', '🎯', 20),
  ('group_gravity_4plus','Group (4+ People)',  'Optimal meeting point for 4-10 people',               'premium', 'coming_soon', '👥', 21),
  ('commute_equalizer',  'Commute Equalizer',  'Find neighborhoods where both commutes are balanced', 'premium', 'coming_soon', '🏠', 22),
  ('date_night',         'Date Night',         'Multi-stop evening itineraries at your midpoint',     'premium', 'coming_soon', '🌙', 23),
  ('recurring_midpoints','Recurring Midpoints','Save a pair and get fresh suggestions every week',    'premium', 'coming_soon', '🔄', 24),
  ('roulette_unlimited', 'Unlimited Roulette', 'Unlimited random place picks with re-rolls',         'premium', 'coming_soon', '🎰', 25);
