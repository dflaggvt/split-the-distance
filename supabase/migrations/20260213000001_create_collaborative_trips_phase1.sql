-- ============================================================
-- Collaborative Group Trips — Phase 1: Trips, Members, Date Voting
-- ============================================================

-- ============================================================
-- TRIPS table
-- ============================================================
CREATE TABLE trips (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'planning' CHECK (status IN ('planning', 'confirmed', 'active', 'completed', 'canceled')),
  confirmed_date TIMESTAMPTZ,
  midpoint_lat DOUBLE PRECISION,
  midpoint_lng DOUBLE PRECISION,
  midpoint_label TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  max_members INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trips_creator ON trips(creator_id);
CREATE INDEX idx_trips_invite_code ON trips(invite_code);
CREATE INDEX idx_trips_status ON trips(status);

-- ============================================================
-- TRIP_MEMBERS table
-- ============================================================
CREATE TABLE trip_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  email TEXT,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('creator', 'member')),
  origin_lat DOUBLE PRECISION,
  origin_lng DOUBLE PRECISION,
  origin_name TEXT,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'joined', 'declined')),
  joined_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_members_trip ON trip_members(trip_id);
CREATE INDEX idx_trip_members_user ON trip_members(user_id);
CREATE UNIQUE INDEX idx_trip_members_trip_user ON trip_members(trip_id, user_id) WHERE user_id IS NOT NULL;
CREATE UNIQUE INDEX idx_trip_members_trip_email ON trip_members(trip_id, email) WHERE email IS NOT NULL;

-- ============================================================
-- TRIP_DATE_OPTIONS table
-- ============================================================
CREATE TABLE trip_date_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  date_start DATE NOT NULL,
  date_end DATE,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_date_options_trip ON trip_date_options(trip_id);

-- ============================================================
-- TRIP_DATE_VOTES table
-- ============================================================
CREATE TABLE trip_date_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date_option_id UUID NOT NULL REFERENCES trip_date_options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('yes', 'maybe', 'no')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(date_option_id, member_id)
);

CREATE INDEX idx_trip_date_votes_option ON trip_date_votes(date_option_id);
CREATE INDEX idx_trip_date_votes_member ON trip_date_votes(member_id);

-- ============================================================
-- Helper functions (tables must exist first)
-- ============================================================
CREATE OR REPLACE FUNCTION is_trip_member(trip_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trip_members
    WHERE trip_id = trip_uuid
      AND user_id = auth.uid()
      AND status = 'joined'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION is_trip_creator(trip_uuid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.trips
    WHERE id = trip_uuid
      AND creator_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public;

-- ============================================================
-- RLS: TRIPS
-- ============================================================
ALTER TABLE trips ENABLE ROW LEVEL SECURITY;

CREATE POLICY trips_insert ON trips FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = creator_id);

CREATE POLICY trips_select ON trips FOR SELECT TO authenticated
  USING (is_trip_member(id) OR creator_id = auth.uid());

CREATE POLICY trips_update ON trips FOR UPDATE TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY trips_delete ON trips FOR DELETE TO authenticated
  USING (creator_id = auth.uid());

CREATE POLICY trips_anon_select ON trips FOR SELECT TO anon
  USING (true);

-- ============================================================
-- RLS: TRIP_MEMBERS
-- ============================================================
ALTER TABLE trip_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_members_select ON trip_members FOR SELECT TO authenticated
  USING (is_trip_member(trip_id) OR is_trip_creator(trip_id));

CREATE POLICY trip_members_insert ON trip_members FOR INSERT TO authenticated
  WITH CHECK (is_trip_creator(trip_id) OR auth.uid() = user_id);

CREATE POLICY trip_members_update ON trip_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_trip_creator(trip_id));

CREATE POLICY trip_members_delete ON trip_members FOR DELETE TO authenticated
  USING (is_trip_creator(trip_id));

CREATE POLICY trip_members_anon_select ON trip_members FOR SELECT TO anon
  USING (true);

-- ============================================================
-- RLS: TRIP_DATE_OPTIONS
-- ============================================================
ALTER TABLE trip_date_options ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_date_options_select ON trip_date_options FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_date_options_insert ON trip_date_options FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY trip_date_options_delete ON trip_date_options FOR DELETE TO authenticated
  USING (
    proposed_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

-- ============================================================
-- RLS: TRIP_DATE_VOTES
-- ============================================================
ALTER TABLE trip_date_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_date_votes_select ON trip_date_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_date_options o
      WHERE o.id = date_option_id
        AND is_trip_member(o.trip_id)
    )
  );

CREATE POLICY trip_date_votes_insert ON trip_date_votes FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY trip_date_votes_update ON trip_date_votes FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- Enable Realtime for trip tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trip_members;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_date_options;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_date_votes;

-- ============================================================
-- Updated_at triggers
-- ============================================================
CREATE OR REPLACE FUNCTION update_trips_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER trips_updated_at
  BEFORE UPDATE ON trips
  FOR EACH ROW EXECUTE FUNCTION update_trips_updated_at();

CREATE TRIGGER trip_date_votes_updated_at
  BEFORE UPDATE ON trip_date_votes
  FOR EACH ROW EXECUTE FUNCTION update_trips_updated_at();
