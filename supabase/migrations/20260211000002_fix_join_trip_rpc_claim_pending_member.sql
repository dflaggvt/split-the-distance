-- Fix join_trip_rpc to claim existing pending/invited member rows
-- instead of inserting duplicates that violate the unique email constraint.
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
  v_existing_id UUID;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  -- Verify the trip exists
  IF NOT EXISTS (SELECT 1 FROM trips WHERE id = p_trip_id) THEN
    RAISE EXCEPTION 'Trip not found';
  END IF;

  -- Already a joined member by user_id? Return early.
  IF EXISTS (SELECT 1 FROM trip_members WHERE trip_id = p_trip_id AND user_id = v_user_id) THEN
    RETURN jsonb_build_object('already_member', true);
  END IF;

  -- Check for an existing pending/invited member row with the same email.
  -- This happens when the host pre-added the guest to the guest list.
  IF p_email IS NOT NULL THEN
    SELECT id INTO v_existing_id
    FROM trip_members
    WHERE trip_id = p_trip_id
      AND email = p_email
      AND status IN ('pending', 'invited')
      AND user_id IS NULL
    LIMIT 1;
  END IF;

  IF v_existing_id IS NOT NULL THEN
    -- Claim the existing row: set user_id, update status to joined
    UPDATE trip_members
    SET user_id = v_user_id,
        display_name = p_display_name,
        status = 'joined',
        joined_at = now()
    WHERE id = v_existing_id
    RETURNING * INTO v_result;
  ELSE
    -- No pre-existing row — insert a new member
    INSERT INTO trip_members (trip_id, user_id, display_name, email, role, status, joined_at)
    VALUES (p_trip_id, v_user_id, p_display_name, p_email, 'member', 'joined', now())
    RETURNING * INTO v_result;
  END IF;

  RETURN to_jsonb(v_result);
END;
$$;
