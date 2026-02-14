-- Fix: authenticated users had MORE restrictive SELECT on trips than anonymous users.
-- This broke the join-via-invite flow: after signing in, the user couldn't see
-- the trip they were about to join because they weren't yet a member.
-- Allow authenticated users to read any trip (same as anon), since trip data
-- (title, description, member list) is not sensitive and the join page needs it.

DROP POLICY IF EXISTS trips_select ON trips;
CREATE POLICY trips_select ON trips FOR SELECT TO authenticated
  USING (true);
