/**
 * trips.js — CRUD helpers for Collaborative Group Trips (Phase 1)
 * 
 * Covers: trip creation, member management, invite codes,
 * date proposals, and date voting.
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
 * Create a new trip. Inserts the trip and adds the creator as the first member.
 */
export async function createTrip({ title, description, creatorId, displayName, email }) {
  if (!supabase) throw new Error('Supabase not initialized');

  // Retry invite code generation for uniqueness (up to 3 attempts)
  let trip = null;
  let attempts = 0;
  while (!trip && attempts < 3) {
    const inviteCode = generateInviteCode();
    const { data, error } = await supabase
      .from('trips')
      .insert({
        title,
        description: description || null,
        creator_id: creatorId,
        invite_code: inviteCode,
      })
      .select()
      .single();

    if (error && error.code === '23505') {
      attempts++;
      continue;
    }
    if (error) throw error;
    trip = data;
  }

  if (!trip) throw new Error('Failed to generate unique invite code');

  // Add creator as first member (auto-joined)
  const { error: memberErr } = await supabase.from('trip_members').insert({
    trip_id: trip.id,
    user_id: creatorId,
    display_name: displayName || email?.split('@')[0] || 'Creator',
    email: email || null,
    role: 'creator',
    status: 'joined',
    joined_at: new Date().toISOString(),
  });

  if (memberErr) throw memberErr;

  return trip;
}

/**
 * Fetch all trips the current user is a member of.
 */
export async function fetchMyTrips() {
  if (!supabase) return [];

  // Get trips where user is a member
  const { data: memberships, error: memErr } = await supabase
    .from('trip_members')
    .select('trip_id')
    .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

  if (memErr) throw memErr;
  if (!memberships?.length) return [];

  const tripIds = memberships.map(m => m.trip_id);
  const { data: trips, error } = await supabase
    .from('trips')
    .select('*, trip_members(id, display_name, status, role, avatar_url:user_id)')
    .in('id', tripIds)
    .order('updated_at', { ascending: false });

  if (error) throw error;
  return trips || [];
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
    .select('id, title, description, status, invite_code, created_at, trip_members(id, display_name, status, role)')
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
 * Join a trip via invite code.
 */
export async function joinTrip(tripId, { userId, displayName, email }) {
  if (!supabase) throw new Error('Supabase not initialized');

  const { data, error } = await supabase
    .from('trip_members')
    .insert({
      trip_id: tripId,
      user_id: userId,
      display_name: displayName || email?.split('@')[0] || 'Member',
      email: email || null,
      role: 'member',
      status: 'joined',
      joined_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    // Already a member
    if (error.code === '23505') return null;
    throw error;
  }
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
  return updateTrip(tripId, { confirmed_date: date });
}
