/**
 * trips.js — CRUD helpers for Collaborative Group Trips
 * 
 * Phase 1: trip creation, member management, invite codes, date proposals, date voting.
 * Phase 2: location proposals, location voting, distance caching, midpoint, confirm location.
 * Phase 3: itinerary stops, trip chat, system messages.
 * Phase 4: live trip mode — start/complete trip, live positions, ETA, arrived status.
 */

import { supabase } from './supabase';

// ============================================================
// INVITE CODE GENERATION
// ============================================================
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateInviteCode(length = 8) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += ALPHABET[array[i] % ALPHABET.length];
  }
  return code;
}

// ============================================================
// TRIP CRUD
// ============================================================

/**
 * Create a new trip via RPC (atomic — creates trip + creator member in one transaction).
 * Uses auth.uid() server-side instead of trusting client-provided creatorId.
 */
export async function createTrip({ title, description, displayName, email }) {
  if (!supabase) throw new Error('Supabase not initialized');

  // Retry invite code generation for uniqueness (up to 3 attempts)
  let trip = null;
  let attempts = 0;
  while (!trip && attempts < 3) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase.rpc('create_trip_rpc', {
      p_title: title,
      p_description: description || null,
      p_display_name: displayName || email?.split('@')[0] || 'Creator',
      p_email: email || null,
      p_invite_code: inviteCode,
    });

    if (error && error.code === '23505') {
      attempts++;
      continue;
    }
    if (error) throw error;
    trip = data;
  }

  if (!trip) throw new Error('Failed to generate unique invite code');
  return trip;
}

/**
 * Fetch all trips the current user is a member of.
 */
export async function fetchMyTrips() {
  if (!supabase) return [];

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  // Get trips where user is a member
  const { data: memberships, error: memErr } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', userId);

  if (memErr) throw memErr;
  if (!memberships?.length) return [];

  const tripIds = memberships.map(m => m.trip_id);
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, trip_members(id, display_name, status, role, avatar_url:user_id)')
    .in('id', tripIds)
    .neq('status', 'archived')
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return trips || [];
}

/**
 * Fetch archived trips for the current user (creator only).
 */
export async function fetchArchivedTrips() {
  if (!supabase) return [];

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return [];

  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, trip_members(id, display_name, status, role)')
    .eq('creator_id', userId)
    .eq('status', 'archived')
    .order('archived_at', { ascending: false });

  if (error) throw error;
  return trips || [];
}

/**
 * Archive a trip (creator only — moves to trash).
 */
export async function archiveTrip(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase.rpc('archive_trip_rpc', {
    p_trip_id: tripId,
  });

  if (error) throw error;
}

/**
 * Restore an archived trip (creator only — moves back to active list).
 */
export async function restoreTrip(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase.rpc('restore_trip_rpc', {
    p_trip_id: tripId,
  });

  if (error) throw error;
}

/**
 * Permanently delete a trip and all its data (creator only — irreversible).
 */
export async function permanentlyDeleteTrip(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase.rpc('permanently_delete_trip_rpc', {
    p_trip_id: tripId,
  });

  if (error) throw error;
}

/**
 * Fetch a single trip by ID with members.
 */
export async function fetchTrip(tripId) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trips')
    .select('*')
    .eq('id', tripId)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Fetch trip by invite code (for join page).
 */
export async function fetchTripByInviteCode(inviteCode) {
  if (!supabase) return null;

  const { data, error } = await supabase
    .from('trips')
    .select('id, title, description, status, invite_code, created_at, trip_members(id, user_id, display_name, status, role)')
    .eq('invite_code', inviteCode)
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a trip (creator only — enforced by RLS).
 */
export async function updateTrip(tripId, updates) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// MEMBER MANAGEMENT
// ============================================================

/**
 * Fetch members of a trip.
 */
export async function fetchTripMembers(tripId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Join a trip via RPC (SECURITY DEFINER function that uses auth.uid() directly).
 * This bypasses RLS INSERT policies to avoid timing/token issues.
 */
export async function joinTrip(tripId, { displayName, email }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('join_trip_rpc', {
    p_trip_id: tripId,
    p_display_name: displayName || email?.split('@')[0] || 'Member',
    p_email: email || null,
  });

  if (error) throw error;

  // Already a member
  if (data?.already_member) return null;

  // System message for the join event
  try {
    await sendSystemMessage(tripId, `${displayName || 'Someone'} joined the trip`);
  } catch { /* non-critical */ }

  return data;
}

/**
 * Update a member's origin location.
 */
export async function updateMemberOrigin(memberId, { lat, lng, name }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_members')
    .update({ origin_lat: lat, origin_lng: lng, origin_name: name })
    .eq('id', memberId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Get the current user's membership record for a trip.
 */
export async function getMyMembership(tripId) {
  if (!supabase) return null;

  const userId = (await supabase.auth.getUser()).data.user?.id;
  if (!userId) return null;

  const { data, error } = await supabase
    .from('trip_members')
    .select('*')
    .eq('trip_id', tripId)
    .eq('user_id', userId)
    .single();

  if (error && error.code !== 'PGRST116') throw error;
  return data || null;
}

// ============================================================
// DATE PROPOSALS & VOTING
// ============================================================

/**
 * Fetch date options for a trip, with vote counts.
 */
export async function fetchDateOptions(tripId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_date_options')
    .select('*, trip_date_votes(*)')
    .eq('trip_id', tripId)
    .order('date_start', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Propose a new date for a trip.
 */
export async function proposeDate(tripId, memberId, { dateStart, dateEnd, label }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_date_options')
    .insert({
      trip_id: tripId,
      proposed_by: memberId,
      date_start: dateStart,
      date_end: dateEnd || null,
      label: label || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a date option (proposer or creator — enforced by RLS).
 */
export async function deleteDateOption(dateOptionId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_date_options')
    .delete()
    .eq('id', dateOptionId);

  if (error) throw error;
}

/**
 * Cast or update a vote on a date option.
 */
export async function voteDateOption(dateOptionId, memberId, vote) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_date_votes')
    .upsert(
      {
        date_option_id: dateOptionId,
        member_id: memberId,
        vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date_option_id,member_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Confirm a date for the trip (creator action).
 */
export async function confirmTripDate(tripId, date) {
  const result = await updateTrip(tripId, { confirmed_date: date });

  try {
    const formatted = new Date(date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    await sendSystemMessage(tripId, `Date confirmed: ${formatted}`);
  } catch { /* non-critical */ }

  return result;
}

// ============================================================
// LOCATION PROPOSALS & VOTING (Phase 2)
// ============================================================

/**
 * Fetch location proposals for a trip, with votes and distances.
 */
export async function fetchTripLocations(tripId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_locations')
    .select('*, trip_location_votes(*), trip_location_distances(*)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Propose a location for a trip.
 */
export async function proposeLocation(tripId, memberId, { name, address, lat, lng, placeId, category, notes, isMidpoint }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_locations')
    .insert({
      trip_id: tripId,
      proposed_by: memberId,
      name,
      address: address || null,
      lat,
      lng,
      place_id: placeId || null,
      category: category || null,
      notes: notes || null,
      is_midpoint: isMidpoint || false,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a location proposal.
 */
export async function deleteLocation(locationId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_locations')
    .delete()
    .eq('id', locationId);

  if (error) throw error;
}

/**
 * Cast or update a vote on a location (up/down).
 */
export async function voteLocation(locationId, memberId, vote) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_location_votes')
    .upsert(
      {
        location_id: locationId,
        member_id: memberId,
        vote,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,member_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a vote on a location.
 */
export async function removeLocationVote(locationId, memberId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_location_votes')
    .delete()
    .eq('location_id', locationId)
    .eq('member_id', memberId);

  if (error) throw error;
}

/**
 * Save cached distance from a member to a location.
 */
export async function saveLocationDistance(locationId, memberId, { durationSeconds, durationText, distanceMeters, distanceText, travelMode }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_location_distances')
    .upsert(
      {
        location_id: locationId,
        member_id: memberId,
        duration_seconds: durationSeconds,
        duration_text: durationText,
        distance_meters: distanceMeters,
        distance_text: distanceText,
        travel_mode: travelMode || 'DRIVING',
        calculated_at: new Date().toISOString(),
      },
      { onConflict: 'location_id,member_id,travel_mode' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Confirm a location for the trip via RPC (atomic — creator action).
 */
export async function confirmTripLocation(tripId, locationId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('confirm_trip_location_rpc', {
    p_trip_id: tripId,
    p_location_id: locationId,
  });

  if (error) throw error;

  // System message (non-critical)
  try {
    const { data: loc } = await supabase.from('trip_locations').select('name').eq('id', locationId).single();
    await sendSystemMessage(tripId, `Location confirmed: ${loc?.name || 'Meeting point set'}`);
  } catch { /* non-critical */ }

  return data;
}

// ============================================================
// ITINERARY STOPS (Phase 3)
// ============================================================

/**
 * Fetch stops for a trip, ordered by day and sort_order.
 */
export async function fetchTripStops(tripId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_stops')
    .select('*')
    .eq('trip_id', tripId)
    .order('day_number', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw error;
  return data || [];
}

/**
 * Add a stop to the itinerary.
 */
export async function addTripStop(tripId, memberId, {
  name, address, lat, lng, placeId, category, notes,
  dayNumber = 1, sortOrder = 0, startTime, endTime, durationMinutes,
}) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_stops')
    .insert({
      trip_id: tripId,
      added_by: memberId,
      name,
      address: address || null,
      lat: lat || null,
      lng: lng || null,
      place_id: placeId || null,
      category: category || null,
      notes: notes || null,
      day_number: dayNumber,
      sort_order: sortOrder,
      start_time: startTime || null,
      end_time: endTime || null,
      duration_minutes: durationMinutes || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Update a stop.
 */
export async function updateTripStop(stopId, updates) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_stops')
    .update(updates)
    .eq('id', stopId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a stop.
 */
export async function deleteTripStop(stopId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_stops')
    .delete()
    .eq('id', stopId);

  if (error) throw error;
}

/**
 * Reorder stops within a day via RPC (atomic, bypasses per-stop ownership RLS).
 */
export async function reorderTripStops(stops) {
  if (!supabase) throw new Error('Supabase not initialized');

  const stopUpdates = stops.map((stop, idx) => ({
    id: stop.id,
    sort_order: idx,
    day_number: stop.day_number,
  }));

  const { error } = await supabase.rpc('reorder_trip_stops_rpc', {
    p_stop_updates: stopUpdates,
  });

  if (error) throw error;
}

// ============================================================
// TRIP CHAT / MESSAGES (Phase 3)
// ============================================================

/**
 * Fetch messages for a trip, most recent last.
 */
export async function fetchTripMessages(tripId, { limit = 100, before } = {}) {
  if (!supabase) return [];

  let query = supabase
    .from('trip_messages')
    .select('*')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

/**
 * Send a user message.
 */
export async function sendTripMessage(tripId, memberId, body) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_messages')
    .insert({
      trip_id: tripId,
      member_id: memberId,
      type: 'user',
      body: body.trim(),
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Send a system message (for automated events).
 */
export async function sendSystemMessage(tripId, body, metadata = null) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_messages')
    .insert({
      trip_id: tripId,
      member_id: null,
      type: 'system',
      body,
      metadata: metadata ? JSON.stringify(metadata) : null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================================
// LIVE TRIP MODE (Phase 4)
// ============================================================

/**
 * Start a trip via RPC — transitions to 'active', creates live status rows for ALL members.
 * Uses SECURITY DEFINER to bypass the per-user INSERT restriction on trip_live_status.
 */
export async function startTrip(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase.rpc('start_trip_rpc', {
    p_trip_id: tripId,
  });

  if (error) throw error;

  try {
    await sendSystemMessage(tripId, 'Trip started! Share your location so everyone can track progress.');
  } catch { /* non-critical */ }

  return data;
}

/**
 * Complete a trip — transitions to 'completed'.
 */
export async function completeTrip(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error: completeErr } = await supabase
    .from('trips')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', tripId)
    .select()
    .single();

  if (completeErr) throw completeErr;

  try {
    await sendSystemMessage(tripId, 'Trip completed! Thanks for traveling together.');
  } catch { /* non-critical */ }

  return data;
}

/**
 * Fetch live status for all members of a trip.
 */
export async function fetchLiveStatus(tripId) {
  if (!supabase) return [];

  const { data, error: fetchErr } = await supabase
    .from('trip_live_status')
    .select('*')
    .eq('trip_id', tripId);

  if (fetchErr) throw fetchErr;
  return data || [];
}

/**
 * Update own live position + ETA.
 */
export async function updateLivePosition(tripId, memberId, {
  lat, lng, heading, speed, accuracy, etaSeconds, etaText, distanceRemainingMeters,
}) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error: posErr } = await supabase
    .from('trip_live_status')
    .upsert(
      {
        trip_id: tripId,
        member_id: memberId,
        lat,
        lng,
        heading: heading ?? null,
        speed: speed ?? null,
        accuracy: accuracy ?? null,
        eta_seconds: etaSeconds ?? null,
        eta_text: etaText ?? null,
        distance_remaining_meters: distanceRemainingMeters ?? null,
        sharing_location: true,
        last_position_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'trip_id,member_id' }
    )
    .select()
    .single();

  if (posErr) throw posErr;
  return data;
}

/**
 * Stop sharing location.
 */
export async function stopSharingLocation(tripId, memberId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error: stopErr } = await supabase
    .from('trip_live_status')
    .update({ sharing_location: false, updated_at: new Date().toISOString() })
    .eq('trip_id', tripId)
    .eq('member_id', memberId);

  if (stopErr) throw stopErr;
}

/**
 * Mark a member as arrived.
 */
// ============================================================
// Guest List Functions
// ============================================================

/**
 * Add a guest to a trip (pre-invite, status='pending').
 */
export async function addGuest(tripId, { email, displayName }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_members')
    .insert({
      trip_id: tripId,
      email: email?.trim() || null,
      display_name: displayName?.trim() || email?.split('@')[0] || 'Guest',
      role: 'member',
      status: 'pending',
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a guest from a trip (only pending/invited members).
 */
export async function removeGuest(memberId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_members')
    .delete()
    .eq('id', memberId)
    .in('status', ['pending', 'invited']);

  if (error) throw error;
}

/**
 * Send invites for a trip — calls the send_invites_rpc function.
 */
export async function sendInvites(tripId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase.rpc('send_invites_rpc', {
    p_trip_id: tripId,
  });

  if (error) throw error;
}

// ============================================================
// Trip Options Functions (Lodging / POI / Food)
// ============================================================

/**
 * Fetch all saved options for a trip, including votes.
 */
export async function fetchTripOptions(tripId) {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('trip_saved_options')
    .select('*, trip_option_votes(*)')
    .eq('trip_id', tripId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch trip options:', error);
    return [];
  }
  return data || [];
}

/**
 * Add a saved option to a trip.
 */
export async function addTripOption(tripId, memberId, { category, name, address, lat, lng, placeId, notes, url, priceLevel }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_saved_options')
    .insert({
      trip_id: tripId,
      added_by: memberId,
      category,
      name,
      address: address || null,
      lat: lat || null,
      lng: lng || null,
      place_id: placeId || null,
      notes: notes || null,
      url: url || null,
      price_level: priceLevel || null,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Delete a saved option.
 */
export async function deleteTripOption(optionId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_saved_options')
    .delete()
    .eq('id', optionId);

  if (error) throw error;
}

/**
 * Vote on a saved option (upsert).
 */
export async function voteTripOption(optionId, memberId, vote) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_option_votes')
    .upsert(
      { option_id: optionId, member_id: memberId, vote, updated_at: new Date().toISOString() },
      { onConflict: 'option_id,member_id' }
    )
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Remove a vote on a saved option.
 */
export async function removeOptionVote(optionId, memberId) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { error } = await supabase
    .from('trip_option_votes')
    .delete()
    .eq('option_id', optionId)
    .eq('member_id', memberId);

  if (error) throw error;
}

// ============================================================
// Live Trip Functions
// ============================================================

export async function markArrived(tripId, memberId, memberName) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error: arriveErr } = await supabase
    .from('trip_live_status')
    .update({
      arrived: true,
      arrived_at: new Date().toISOString(),
      sharing_location: false,
      updated_at: new Date().toISOString(),
    })
    .eq('trip_id', tripId)
    .eq('member_id', memberId)
    .select()
    .single();

  if (arriveErr) throw arriveErr;

  try {
    await sendSystemMessage(tripId, `${memberName || 'A member'} has arrived!`);
  } catch { /* non-critical */ }

  return data;
}
