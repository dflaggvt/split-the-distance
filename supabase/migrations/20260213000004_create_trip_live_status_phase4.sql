-- ============================================================
-- Collaborative Group Trips — Phase 4: Live Trip Mode
-- ============================================================

-- ============================================================
-- TRIP_LIVE_STATUS table — per-member live tracking state
-- ============================================================
CREATE TABLE trip_live_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  heading DOUBLE PRECISION,
  speed DOUBLE PRECISION,
  accuracy DOUBLE PRECISION,
  eta_seconds INT,
  eta_text TEXT,
  distance_remaining_meters INT,
  sharing_location BOOLEAN NOT NULL DEFAULT false,
  arrived BOOLEAN NOT NULL DEFAULT false,
  arrived_at TIMESTAMPTZ,
  last_position_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(trip_id, member_id)
);

CREATE INDEX idx_trip_live_status_trip ON trip_live_status(trip_id);
CREATE INDEX idx_trip_live_status_active ON trip_live_status(trip_id) WHERE sharing_location = true;

-- ============================================================
-- RLS: TRIP_LIVE_STATUS
-- ============================================================
ALTER TABLE trip_live_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_live_status_select ON trip_live_status FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_live_status_insert ON trip_live_status FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY trip_live_status_update ON trip_live_status FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trip_live_status;

-- ============================================================
-- Add started_at and completed_at to trips for lifecycle
-- ============================================================
ALTER TABLE trips ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ;
ALTER TABLE trips ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
