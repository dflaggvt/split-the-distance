/**
 * userEvents.js — Fire-and-forget user activity tracking.
 *
 * Logs user actions to the `user_events` table for per-user analytics.
 * All calls are async and non-blocking — errors are silently caught.
 */

import { supabase } from './supabase';

/**
 * Get the current session ID from sessionStorage (matches analytics.js)
 */
function getSessionId() {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem('std_session_id') || null;
  } catch {
    return null;
  }
}

/**
 * Log a user event. Fire-and-forget — never blocks the UI.
 *
 * @param {string} userId - auth.uid() of the user (null for anonymous)
 * @param {string} eventType - e.g. 'search', 'place_click', 'roulette_spin'
 * @param {object} metadata - arbitrary JSON data for this event
 */
export async function logUserEvent(userId, eventType, metadata = {}) {
  if (!supabase) return;

  try {
    await supabase.from('user_events').insert({
      user_id: userId || null,
      session_id: getSessionId(),
      event_type: eventType,
      metadata,
    });
  } catch (err) {
    // Silent — never block the app for analytics
    console.warn('[UserEvents] Failed to log:', eventType, err.message);
  }
}
