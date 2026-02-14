-- SECURITY DEFINER RPC for joining a trip.
-- Bypasses INSERT RLS and uses auth.uid() directly from the JWT,
-- avoiding any timing/token mismatch issues with client-side INSERT.
CREATE OR REPLACE FUNCTION join_trip_rpc(
  p_trip_id UUID,
  p_display_name TEXT,
  p_email TEXT DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_result trip_members;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the trip exists
  IF NOT EXISTS (SELECT 1 FROM trips WHERE id = p_trip_id) THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;

  -- Already a member? Return null (handled by client as "already joined")
  IF EXISTS (SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('already_member', true);
  END IF;

  -- Insert the new member
  INSERT INTO trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
  VALUES (p_trip_id, v_user_id, p_display_name, p_email, 'member', 'joined', now())
  RETURNING * INTO v_result;

  RETURN to_jsonb(v_result);
END;
$$;
