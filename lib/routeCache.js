/**
 * Route caching client - checks server-side cache before Google API calls
 */

/**
 * Get route with caching
 * First checks our server-side cache, falls back to direct Google API if needed
 */
export async function getCachedRoute(from, to, travelMode = 'DRIVING') {
  try {
    // Convert to our API format
    const apiTravelMode = travelMode === 'DRIVING' ? 'DRIVE' : travelMode;
    
    const response = await fetch('/api/route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: { lat: from.lat, lon: from.lon || from.lng },
        to: { lat: to.lat, lon: to.lon || to.lng },
        travelMode: apiTravelMode,
      }),
    });

    if (!response.ok) {
      throw new Error(`Route API error: ${response.status}`);
    }

    const data = await response.json();
    
    // Log cache hit/miss for analytics
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('route-cache-event', { 
        detail: { cached: data.cached } 
      }));
    }

    return {
      ...data,
      // Add flag for downstream code to know this came from cache
      fromCache: data.cached,
    };
  } catch (error) {
    console.error('Cache route error:', error);
    // Return null to signal fallback to direct API
    return null;
  }
}

/**
 * Decode a Google polyline string into array of coordinates
 */
export function decodePolyline(encoded) {
  if (!encoded) return [];
  
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = (result & 1) ? ~(result >> 1) : (result >> 1);
    lat += dlat;

    shift = 0;
    result = 0;

    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = (result & 1) ? ~(result >> 1) : (result >> 1);
    lng += dlng;

    points.push({
      lat: lat / 1e5,
      lng: lng / 1e5,
    });
  }

  return points;
}
