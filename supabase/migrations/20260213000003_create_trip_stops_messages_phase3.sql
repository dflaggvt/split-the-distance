-- ============================================================
-- Collaborative Group Trips — Phase 3: Itinerary Stops + Chat
-- ============================================================

-- ============================================================
-- TRIP_STOPS table — itinerary items for the trip
-- ============================================================
CREATE TABLE trip_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_id TEXT,
  category TEXT,
  notes TEXT,
  day_number INT NOT NULL DEFAULT 1,
  sort_order INT NOT NULL DEFAULT 0,
  start_time TIME,
  end_time TIME,
  duration_minutes INT,
  status TEXT NOT NULL DEFAULT 'planned' CHECK (status IN ('planned', 'confirmed', 'skipped', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_stops_trip ON trip_stops(trip_id);
CREATE INDEX idx_trip_stops_day ON trip_stops(trip_id, day_number, sort_order);

-- ============================================================
-- TRIP_MESSAGES table — trip group chat
-- ============================================================
CREATE TABLE trip_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  member_id UUID REFERENCES trip_members(id) ON DELETE SET NULL,
  type TEXT NOT NULL DEFAULT 'user' CHECK (type IN ('user', 'system')),
  body TEXT NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_messages_trip ON trip_messages(trip_id, created_at);
CREATE INDEX idx_trip_messages_type ON trip_messages(trip_id, type);

-- ============================================================
-- RLS: TRIP_STOPS
-- ============================================================
ALTER TABLE trip_stops ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_stops_select ON trip_stops FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_stops_insert ON trip_stops FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY trip_stops_update ON trip_stops FOR UPDATE TO authenticated
  USING (
    added_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

CREATE POLICY trip_stops_delete ON trip_stops FOR DELETE TO authenticated
  USING (
    added_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

-- ============================================================
-- RLS: TRIP_MESSAGES
-- ============================================================
ALTER TABLE trip_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY trip_messages_select ON trip_messages FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_messages_insert ON trip_messages FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id));

-- No update/delete on messages (chat history is immutable)

-- ============================================================
-- Enable Realtime
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE trip_stops;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_messages;

-- ============================================================
-- Updated_at trigger for trip_stops
-- ============================================================
CREATE TRIGGER trip_stops_updated_at
  BEFORE UPDATE ON trip_stops
  FOR EACH ROW EXECUTE FUNCTION update_trips_updated_at();
