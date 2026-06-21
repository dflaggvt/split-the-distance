/**
 * sessionEvents.js - Fire-and-forget product activity timeline.
 *
 * Unlike user_events, this logs anonymous and logged-in activity so each
 * browser session can be reconstructed as an ordered product story.
 */

import { supabase } from './supabase';
import { getCurrentSessionId, getCurrentVisitorId, checkInternalUser } from './analytics';

const EVENT_GROUPS = {
  page_viewed: 'navigation',
  input_started: 'search_funnel',
  input_selected: 'search_funnel',
  input_cleared: 'search_funnel',
  search_clicked: 'search_funnel',
  search_completed: 'search_funnel',
  search_failed: 'search_funnel',
  search_history_resplit: 'search_funnel',
  locations_swapped: 'search_funnel',
  filter_toggle: 'results',
  places_loaded: 'results',
  places_load_failed: 'results',
  place_click: 'results',
  map_marker_click: 'map',
  route_selected: 'route',
  travel_mode_changed: 'route',
  midpoint_mode_changed: 'route',
  midpoint_directions_clicked: 'decision',
  place_directions_clicked: 'decision',
  place_website_clicked: 'decision',
  place_call_clicked: 'decision',
  share_created: 'decision',
  roulette_spin: 'discovery',
  road_trip_activated: 'road_trip',
  road_trip_exited: 'road_trip',
  road_trip_stop_selected: 'road_trip',
  drift_radius_toggled: 'premium',
  group_location_added: 'premium',
  pricing_modal_opened: 'monetization',
  pricing_modal_closed: 'monetization',
  credit_pack_cards_viewed: 'monetization',
  credit_pack_selected: 'monetization',
  checkout_started: 'monetization',
  checkout_failed: 'monetization',
  checkout_returned_without_purchase: 'monetization',
  credits_purchased: 'monetization',
  search_blocked_no_credits: 'monetization',
  search_credit_used: 'monetization',
  search_credit_debit_failed: 'monetization',
  feature_gate_triggered: 'monetization',
  upgrade_completed: 'monetization',
  sign_in: 'auth',
  sign_in_modal_opened: 'auth',
  sign_in_modal_closed: 'auth',
  blocked_search_auth_completed: 'auth',
  save_plan_clicked: 'auth',
  save_plan_completed: 'auth',
  save_plan_failed: 'auth',
  save_plan_abandoned: 'auth',
};

const EVENT_LABELS = {
  page_viewed: 'Page viewed',
  input_started: 'Started typing location',
  input_selected: 'Selected location',
  input_cleared: 'Cleared location input',
  search_clicked: 'Clicked search',
  search_completed: 'Search completed',
  search_failed: 'Search failed',
  search_history_resplit: 'Re-ran saved route',
  locations_swapped: 'Swapped locations',
  filter_toggle: 'Toggled place filter',
  places_loaded: 'Places loaded',
  places_load_failed: 'Places failed to load',
  place_click: 'Clicked place',
  map_marker_click: 'Clicked map marker',
  route_selected: 'Selected route option',
  travel_mode_changed: 'Changed travel mode',
  midpoint_mode_changed: 'Changed midpoint mode',
  midpoint_directions_clicked: 'Opened midpoint directions',
  place_directions_clicked: 'Opened place directions',
  place_website_clicked: 'Opened place website',
  place_call_clicked: 'Clicked place phone',
  share_created: 'Shared route',
  roulette_spin: 'Roulette spin',
  road_trip_activated: 'Activated road trip stops',
  road_trip_exited: 'Exited road trip mode',
  road_trip_stop_selected: 'Selected road trip stop',
  drift_radius_toggled: 'Changed drift radius',
  group_location_added: 'Added group location',
  pricing_modal_opened: 'Opened pricing modal',
  pricing_modal_closed: 'Closed pricing modal',
  credit_pack_cards_viewed: 'Viewed credit pack cards',
  credit_pack_selected: 'Selected credit pack',
  checkout_started: 'Started checkout',
  checkout_failed: 'Checkout failed',
  checkout_returned_without_purchase: 'Returned from checkout',
  credits_purchased: 'Purchased credits',
  search_blocked_no_credits: 'Blocked search for credits',
  search_credit_used: 'Used search credit',
  search_credit_debit_failed: 'Credit debit failed',
  feature_gate_triggered: 'Tried locked feature',
  upgrade_completed: 'Completed upgrade',
  sign_in: 'Signed in',
  sign_in_modal_opened: 'Opened sign-in modal',
  sign_in_modal_closed: 'Closed sign-in modal',
  blocked_search_auth_completed: 'Signed in after blocked search',
  save_plan_clicked: 'Clicked save plan',
  save_plan_completed: 'Saved plan',
  save_plan_failed: 'Save plan failed',
  save_plan_abandoned: 'Abandoned save plan',
};

const TRACKED_USER_ID_KEY = 'std_user_id';

export function setTrackedSessionUserId(userId) {
  if (typeof window === 'undefined') return;

  try {
    if (userId) {
      localStorage.setItem(TRACKED_USER_ID_KEY, userId);
      sessionStorage.setItem(TRACKED_USER_ID_KEY, userId);
    } else {
      localStorage.removeItem(TRACKED_USER_ID_KEY);
      sessionStorage.removeItem(TRACKED_USER_ID_KEY);
    }
  } catch {}
}

function getTrackedSessionUserId() {
  if (typeof window === 'undefined') return null;

  try {
    return sessionStorage.getItem(TRACKED_USER_ID_KEY) || localStorage.getItem(TRACKED_USER_ID_KEY);
  } catch {
    return null;
  }
}

function getNextSequenceNumber() {
  if (typeof window === 'undefined') return null;

  try {
    const sessionId = getCurrentSessionId();
    const key = sessionId ? `std_session_event_seq_${sessionId}` : 'std_session_event_seq';
    const next = Number.parseInt(localStorage.getItem(key) || sessionStorage.getItem(key) || '0', 10) + 1;
    localStorage.setItem(key, String(next));
    sessionStorage.setItem(key, String(next));
    return next;
  } catch {
    return null;
  }
}

export async function logSessionEvent(eventType, metadata = {}, options = {}) {
  if (!supabase) return;

  try {
    const sessionId = getCurrentSessionId();
    if (!sessionId) return;

    await supabase.from('session_events').insert({
      session_id: sessionId,
      visitor_id: getCurrentVisitorId(),
      user_id: options.userId || getTrackedSessionUserId() || null,
      event_type: eventType,
      event_group: options.eventGroup || EVENT_GROUPS[eventType] || 'interaction',
      event_label: options.eventLabel || EVENT_LABELS[eventType] || eventType,
      sequence_number: getNextSequenceNumber(),
      page_path: typeof window !== 'undefined' ? window.location.pathname : null,
      metadata,
      is_internal: checkInternalUser(),
    });
  } catch (err) {
    console.warn('[SessionEvents] Failed to log:', eventType, err.message);
  }
}
