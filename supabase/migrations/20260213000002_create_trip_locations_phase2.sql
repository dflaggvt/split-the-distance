-- ============================================================
-- Collaborative Group Trips — Phase 2: Location Voting
-- ============================================================

-- ============================================================
-- TRIP_LOCATIONS table
-- ============================================================
CREATE TABLE trip_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  proposed_by UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  place_id TEXT,
  category TEXT,
  notes TEXT,
  is_midpoint BOOLEAN NOT NULL DEFAULT false,
  is_confirmed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_locations_trip ON trip_locations(trip_id);
CREATE INDEX idx_trip_locations_confirmed ON trip_locations(trip_id, is_confirmed) WHERE is_confirmed = true;

-- ============================================================
-- TRIP_LOCATION_VOTES table
-- ============================================================
CREATE TABLE trip_location_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES trip_locations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, member_id)
);

CREATE INDEX idx_trip_location_votes_location ON trip_location_votes(location_id);
CREATE INDEX idx_trip_location_votes_member ON trip_location_votes(member_id);

-- ============================================================
-- TRIP_LOCATION_DISTANCES — cached drive times from each member to each location
-- ============================================================
CREATE TABLE trip_location_distances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id UUID NOT NULL REFERENCES trip_locations(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  duration_seconds INT,
  duration_text TEXT,
  distance_meters INT,
  distance_text TEXT,
  travel_mode TEXT NOT NULL DEFAULT 'DRIVING',
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(location_id, member_id, travel_mode)
);

CREATE INDEX idx_trip_location_distances_location ON trip_location_distances(location_id);

-- ============================================================
-- RLS: TRIP_LOCATIONS
-- ============================================================
ALTER TABLE trip_locations ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_locations_select ON trip_locations FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_locations_insert ON trip_locations FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY trip_locations_update ON trip_locations FOR UPDATE TO authenticated
  USING (
    proposed_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

CREATE POLICY trip_locations_delete ON trip_locations FOR DELETE TO authenticated
  USING (
    proposed_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

-- ============================================================
-- RLS: TRIP_LOCATION_VOTES
-- ============================================================
ALTER TABLE trip_location_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_location_votes_select ON trip_location_votes FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_locations l
      WHERE l.id = location_id
        AND is_trip_member(l.trip_id)
    )
  );

CREATE POLICY trip_location_votes_insert ON trip_location_votes FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY trip_location_votes_update ON trip_location_votes FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

-- ============================================================
-- RLS: TRIP_LOCATION_DISTANCES
-- ============================================================
ALTER TABLE trip_location_distances ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_location_distances_select ON trip_location_distances FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_locations l
      WHERE l.id = location_id
        AND is_trip_member(l.trip_id)
    )
  );

CREATE POLICY trip_location_distances_insert ON trip_location_distances FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM trip_locations l
      WHERE l.id = location_id
        AND is_trip_member(l.trip_id)
    )
  );

CREATE POLICY trip_location_distances_update ON trip_location_distances FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM trip_locations l
      WHERE l.id = location_id
        AND is_trip_member(l.trip_id)
    )
  );

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trip_locations;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_location_votes;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_location_distances;

-- ============================================================
-- Add confirmed_location_id FK to trips (deferred from Phase 1)
-- ============================================================
ALTER TABLE trips ADD COLUMN IF NOT EXISTS confirmed_location_id UUID REFERENCES trip_locations(id) ON DELETE SET NULL;
