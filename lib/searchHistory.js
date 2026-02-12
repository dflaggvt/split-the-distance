/**
 * searchHistory.js — Client-side helpers for saving/fetching/managing search history.
 *
 * - Auto-saves on every split for logged-in users
 * - Upserts on matching from/to pair (increments search_count, updates last_searched_at)
 * - Free accounts: capped at 10 entries (FIFO — oldest trimmed after insert)
 * - Premium accounts: unlimited
 */

import { supabase } from './supabase';

const FREE_HISTORY_LIMIT = 10;

/**
 * Save a search to history (upsert by route pair).
 * @param {Object} params
 * @param {string} params.userId
 * @param {string} params.fromName
 * @param {number} params.fromLat
 * @param {number} params.fromLng
 * @param {string} params.toName
 * @param {number} params.toLat
 * @param {number} params.toLng
 * @param {string} [params.midpointLabel]
 * @param {string} [params.travelMode]
 * @param {string} [params.midpointMode]
 * @param {number} [params.distanceMiles]
 * @param {number} [params.durationSeconds]
 * @param {boolean} [params.isUnlimited] - true for premium users (skip FIFO trim)
 */
export async function saveSearch({
  userId,
  fromName,
  fromLat,
  fromLng,
  toName,
  toLat,
  toLng,
  midpointLabel = null,
  travelMode = 'DRIVING',
  midpointMode = 'time',
  distanceMiles = null,
  durationSeconds = null,
  isUnlimited = false,
}) {
  if (!supabase || !userId) return;

  try {
    // Check if this exact route pair already exists for this user
    const { data: existing } = await supabase
      .from('search_history')
      .select('id, search_count')
      .eq('user_id', userId)
      .eq('from_lat', fromLat)
      .eq('from_lng', fromLng)
      .eq('to_lat', toLat)
      .eq('to_lng', toLng)
      .limit(1)
      .single();

    if (existing) {
      // Upsert: update existing entry
      await supabase
        .from('search_history')
        .update({
          from_name: fromName,
          to_name: toName,
          midpoint_label: midpointLabel,
          travel_mode: travelMode,
          midpoint_mode: midpointMode,
          distance_miles: distanceMiles,
          duration_seconds: durationSeconds,
          search_count: (existing.search_count || 1) + 1,
          last_searched_at: new Date().toISOString(),
        })
        .eq('id', existing.id);
    } else {
      // Insert new entry
      await supabase
        .from('search_history')
        .insert({
          user_id: userId,
          from_name: fromName,
          from_lat: fromLat,
          from_lng: fromLng,
          to_name: toName,
          to_lat: toLat,
          to_lng: toLng,
          midpoint_label: midpointLabel,
          travel_mode: travelMode,
          midpoint_mode: midpointMode,
          distance_miles: distanceMiles,
          duration_seconds: durationSeconds,
        });

      // FIFO trim for free users: delete oldest entries beyond the limit
      if (!isUnlimited) {
        await trimHistory(userId, FREE_HISTORY_LIMIT);
      }
    }
  } catch (err) {
    console.error('[SearchHistory] Save error:', err);
  }
}

/**
 * Fetch user's search history, most recent first.
 * @param {string} userId
 * @param {number} [limit] - max entries to return
 * @returns {Promise<Array>}
 */
export async function fetchHistory(userId, limit = 20) {
  if (!supabase || !userId) return [];

  try {
    const { data, error } = await supabase
      .from('search_history')
      .select('*')
      .eq('user_id', userId)
      .order('last_searched_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('[SearchHistory] Fetch error:', error);
      return [];
    }
    return data || [];
  } catch (err) {
    console.error('[SearchHistory] Fetch error:', err);
    return [];
  }
}

/**
 * Delete a single history entry.
 * @param {number} entryId
 * @returns {Promise<boolean>}
 */
export async function deleteHistoryEntry(entryId) {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('search_history')
      .delete()
      .eq('id', entryId);

    if (error) {
      console.error('[SearchHistory] Delete error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SearchHistory] Delete error:', err);
    return false;
  }
}

/**
 * Clear all history for a user.
 * @param {string} userId
 * @returns {Promise<boolean>}
 */
export async function clearAllHistory(userId) {
  if (!supabase || !userId) return false;

  try {
    const { error } = await supabase
      .from('search_history')
      .delete()
      .eq('user_id', userId);

    if (error) {
      console.error('[SearchHistory] Clear error:', error);
      return false;
    }
    return true;
  } catch (err) {
    console.error('[SearchHistory] Clear error:', err);
    return false;
  }
}

/**
 * Trim history to keep only the most recent `limit` entries.
 * Called after insert for free-tier users.
 */
async function trimHistory(userId, limit) {
  try {
    // Get IDs of entries beyond the limit
    const { data: allEntries } = await supabase
      .from('search_history')
      .select('id')
      .eq('user_id', userId)
      .order('last_searched_at', { ascending: false });

    if (!allEntries || allEntries.length <= limit) return;

    // IDs to delete (everything past the limit)
    const idsToDelete = allEntries.slice(limit).map(e => e.id);

    if (idsToDelete.length > 0) {
      await supabase
        .from('search_history')
        .delete()
        .in('id', idsToDelete);
    }
  } catch (err) {
    console.error('[SearchHistory] Trim error:', err);
  }
}
