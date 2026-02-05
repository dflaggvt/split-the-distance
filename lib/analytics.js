import { supabase } from './supabase'

export async function logSearch(data) {
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
    })
  } catch (err) {
    console.error('Failed to log search:', err)
    // Never block the user experience for analytics
  }
}

export async function logPlaceClick(data) {
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
    })
  } catch (err) {
    console.error('Failed to log place click:', err)
  }
}
