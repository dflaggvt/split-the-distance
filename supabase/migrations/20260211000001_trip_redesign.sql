-- ============================================================
-- Trip Redesign Migration
-- Adds: deferred invites, location modes, categorized options,
--        voting control, and permission support
-- ============================================================

-- 1. New columns on trips table
ALTER TABLE trips
  ADD COLUMN IF NOT EXISTS invites_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS location_mode TEXT NOT NULL DEFAULT 'fairest_all'
    CHECK (location_mode IN ('fairest_all', 'fairest_selected', 'fairest_custom', 'specific')),
  ADD COLUMN IF NOT EXISTS location_criteria JSONB,
  ADD COLUMN IF NOT EXISTS voting_open BOOLEAN NOT NULL DEFAULT false;

-- 2. New columns on trip_members table
ALTER TABLE trip_members
  ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS invite_method TEXT CHECK (invite_method IN ('email', 'sms', 'link'));

-- 3. Update trip_members status constraint to allow 'pending'
--    Drop existing constraint and re-create with new values
ALTER TABLE trip_members DROP CONSTRAINT IF EXISTS trip_members_status_check;
ALTER TABLE trip_members ADD CONSTRAINT trip_members_status_check
  CHECK (status IN ('pending', 'invited', 'joined', 'declined'));

-- 4. Create trip_saved_options table (categorized voteable options)
CREATE TABLE IF NOT EXISTS trip_saved_options (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trip_id UUID NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  added_by UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('lodging', 'poi', 'food')),
  name TEXT NOT NULL,
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  place_id TEXT,
  notes TEXT,
  url TEXT,
  price_level INT CHECK (price_level IS NULL OR (price_level >= 1 AND price_level <= 4)),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_trip_saved_options_trip ON trip_saved_options(trip_id);
CREATE INDEX idx_trip_saved_options_category ON trip_saved_options(trip_id, category);

-- 5. Create trip_option_votes table
CREATE TABLE IF NOT EXISTS trip_option_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  option_id UUID NOT NULL REFERENCES trip_saved_options(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES trip_members(id) ON DELETE CASCADE,
  vote TEXT NOT NULL CHECK (vote IN ('up', 'down')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(option_id, member_id)
);

CREATE INDEX idx_trip_option_votes_option ON trip_option_votes(option_id);
CREATE INDEX idx_trip_option_votes_member ON trip_option_votes(member_id);

-- 6. Enable RLS on new tables
ALTER TABLE trip_saved_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE trip_option_votes ENABLE ROW LEVEL SECURITY;

-- 7. RLS policies for trip_saved_options
CREATE POLICY trip_saved_options_select ON trip_saved_options
  FOR SELECT TO authenticated
  USING (is_trip_member(trip_id));

CREATE POLICY trip_saved_options_insert ON trip_saved_options
  FOR INSERT TO authenticated
  WITH CHECK (is_trip_member(trip_id));

CREATE POLICY trip_saved_options_update ON trip_saved_options
  FOR UPDATE TO authenticated
  USING (
    added_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

CREATE POLICY trip_saved_options_delete ON trip_saved_options
  FOR DELETE TO authenticated
  USING (
    added_by IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
    OR is_trip_creator(trip_id)
  );

-- 8. RLS policies for trip_option_votes
CREATE POLICY trip_option_votes_select ON trip_option_votes
  FOR SELECT TO authenticated
  USING (
    option_id IN (SELECT id FROM trip_saved_options WHERE is_trip_member(trip_id))
  );

CREATE POLICY trip_option_votes_insert ON trip_option_votes
  FOR INSERT TO authenticated
  WITH CHECK (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY trip_option_votes_update ON trip_option_votes
  FOR UPDATE TO authenticated
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

CREATE POLICY trip_option_votes_delete ON trip_option_votes
  FOR DELETE TO authenticated
  USING (
    member_id IN (SELECT id FROM trip_members WHERE user_id = auth.uid())
  );

-- 9. Add new tables to Realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE trip_saved_options;
ALTER PUBLICATION supabase_realtime ADD TABLE trip_option_votes;

-- 10. Set REPLICA IDENTITY FULL for proper Realtime filtering
ALTER TABLE trip_saved_options REPLICA IDENTITY FULL;
ALTER TABLE trip_option_votes REPLICA IDENTITY FULL;

-- 11. Updated_at triggers for new tables
CREATE TRIGGER set_trip_option_votes_updated_at
  BEFORE UPDATE ON trip_option_votes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- 12. Send invites RPC — atomically sets invites_sent_at and updates member statuses
CREATE OR REPLACE FUNCTION send_invites_rpc(p_trip_id UUID)
RETURNS void AS $$
BEGIN
  -- Only the trip creator can send invites
  IF NOT is_trip_creator(p_trip_id) THEN
    RAISE EXCEPTION 'Only the trip creator can send invites';
  END IF;

  -- Mark the trip as invites sent
  UPDATE trips
    SET invites_sent_at = now(), updated_at = now()
    WHERE id = p_trip_id AND invites_sent_at IS NULL;

  -- Flip all pending members to invited
  UPDATE trip_members
    SET status = 'invited', invited_at = now()
    WHERE trip_id = p_trip_id AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
