import { supabase } from './supabase'

/**
 * Check if the current user is flagged as internal (team/testing).
 * Visit the site with ?_internal=1 to set the flag.
 * Visit with ?_internal=0 to clear it.
 */
function isInternalUser() {
  if (typeof window === 'undefined') return false
  
  try {
    // Check URL param to set/clear flag
    const params = new URLSearchParams(window.location.search)
    if (params.has('_internal')) {
      const val = params.get('_internal')
      if (val === '1' || val === 'true') {
        localStorage.setItem('std_internal', '1')
        console.log('[STD] Internal user flag SET')
      } else {
        localStorage.removeItem('std_internal')
        console.log('[STD] Internal user flag CLEARED')
      }
    }
    
    const isInternal = localStorage.getItem('std_internal') === '1'
    console.log('[STD] isInternalUser:', isInternal)
    return isInternal
  } catch (e) {
    // localStorage might be blocked (private browsing, etc.)
    console.warn('[STD] localStorage error:', e)
    return false
  }
}

// Initialize on page load - run this immediately when module loads on client
if (typeof window !== 'undefined') {
  // Run once on initial load to capture URL param
  setTimeout(() => {
    isInternalUser()
  }, 0)
}

// Export a function to check internal status (for UI display)
export function checkInternalUser() {
  return isInternalUser()
}

/**
 * Send event to Google Analytics 4 / GTM
 * Exported for use in components
 */
export function trackEvent(eventName, params = {}) {
  if (typeof window === 'undefined') return
  if (typeof window.gtag !== 'function') {
    console.log('[STD] gtag not available, skipping event:', eventName, params)
    return
  }
  if (isInternalUser()) {
    console.log('[STD] Internal user, skipping GA event:', eventName, params)
    return
  }
  
  try {
    window.gtag('event', eventName, params)
    console.log('[STD] GA4 event sent:', eventName, params)
  } catch (err) {
    console.error('GA4 tracking error:', err)
  }
}

export async function logSearch(data) {
  // Track in GA4 / GTM
  trackEvent('search', {
    from_location: data.fromName,
    to_location: data.toName,
    distance_miles: data.distanceMiles,
    duration_minutes: Math.round(data.durationSeconds / 60),
    places_found: data.placesFound,
  })
  
  if (!supabase) return // gracefully skip if not configured

  try {
    await supabase.from('searches').insert({
      from_name: data.fromName,
      from_lat: data.fromLat,
      from_lng: data.fromLng,
      to_name: data.toName,
      to_lat: data.toLat,
      to_lng: data.toLng,
      midpoint_lat: data.midpointLat,
      midpoint_lng: data.midpointLng,
      distance_miles: data.distanceMiles,
      duration_seconds: data.durationSeconds,
      active_filters: data.activeFilters,
      places_found: data.placesFound,
      user_agent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
      referrer: typeof document !== 'undefined' ? document.referrer : null,
      is_internal: isInternalUser(),
    })
  } catch (err) {
    console.error('Failed to log search:', err)
    // Never block the user experience for analytics
  }
}

export async function logPlaceClick(data) {
  // Track in GA4 / GTM
  trackEvent('place_click', {
    place_name: data.placeName,
    place_category: data.placeCategory,
    place_rating: data.placeRating,
    search_route: data.fromTo,
  })
  
  if (!supabase) return

  try {
    await supabase.from('place_clicks').insert({
      place_name: data.placeName,
      place_category: data.placeCategory,
      place_lat: data.placeLat,
      place_lng: data.placeLng,
      place_rating: data.placeRating,
      from_search_route: data.fromTo,
      midpoint_lat: data.midpointLat,
      midpoint_lng: data.midpointLng,
      is_internal: isInternalUser(),
    })
  } catch (err) {
    console.error('Failed to log place click:', err)
  }
}
