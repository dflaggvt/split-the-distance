/**
 * isochrone.js — Client-side drift radius circle + point-in-polygon utility
 *
 * Generates a circular zone around the midpoint based on travel mode and
 * tolerance minutes. No external API calls — everything is computed locally.
 */

// Average speeds in miles per minute by travel mode
const SPEED_MPM = {
  DRIVING: 0.75,    // ~45 mph
  BICYCLING: 0.2,   // ~12 mph
  WALKING: 0.05,    // ~3 mph
};

/**
 * Generate a drift-radius circle around a midpoint.
 *
 * @param {{ lat: number, lon?: number, lng?: number }} midpoint
 * @param {{ minutes?: number, travelMode?: string }} options
 * @returns {{ polygon: Array<{lat: number, lng: number}>, bbox: number[], minutes: number, travelMode: string, radiusMiles: number }}
 */
export function generateDriftCircle(midpoint, { minutes = 10, travelMode = 'DRIVING' } = {}) {
  const lat = midpoint.lat;
  const lng = midpoint.lon ?? midpoint.lng;

  const speed = SPEED_MPM[travelMode] || SPEED_MPM.DRIVING;
  const radiusMiles = speed * minutes;

  // Convert miles to degrees (1 degree lat ≈ 69 miles)
  const latDeg = radiusMiles / 69;
  const cosLat = Math.cos(lat * Math.PI / 180);
  const lngDeg = Math.abs(cosLat) < 1e-10 ? 0 : radiusMiles / (69 * cosLat);

  // Generate a 64-point circle
  const polygon = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    polygon.push({
      lat: lat + latDeg * Math.sin(angle),
      lng: lng + lngDeg * Math.cos(angle),
    });
  }

  // Compute bounding box for quick rejection in point-in-polygon
  const minLat = lat - latDeg;
  const maxLat = lat + latDeg;
  const minLng = lng - lngDeg;
  const maxLng = lng + lngDeg;

  return {
    polygon,
    bbox: [minLng, minLat, maxLng, maxLat],
    minutes,
    travelMode,
    radiusMiles,
  };
}

/**
 * Ray-casting point-in-polygon test.
 *
 * @param {{ lat: number, lon?: number, lng?: number }} point
 * @param {Array<{ lat: number, lng: number }>} polygon
 * @param {number[]} [bbox] - Optional [minLng, minLat, maxLng, maxLat] for quick rejection
 * @returns {boolean}
 */
export function pointInPolygon(point, polygon, bbox) {
  const px = point.lat;
  const py = point.lon ?? point.lng;

  // Quick bounding-box rejection
  if (bbox) {
    const [minLng, minLat, maxLng, maxLat] = bbox;
    if (px < minLat || px > maxLat || py < minLng || py > maxLng) {
      return false;
    }
  }

  // Ray-casting algorithm
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].lat, yi = polygon[i].lng;
    const xj = polygon[j].lat, yj = polygon[j].lng;

    const intersect =
      yi > py !== yj > py &&
      px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Filter an array of places to only those inside the drift radius circle.
 *
 * @param {Array} places - Array of place objects with { lat, lon/lng }
 * @param {{ polygon: Array, bbox: number[] }} driftRadius
 * @returns {Array}
 */
export function filterPlacesInZone(places, driftRadius) {
  if (!driftRadius?.polygon || !Array.isArray(places) || places.length === 0) return places || [];
  return places.filter(p => pointInPolygon(p, driftRadius.polygon, driftRadius.bbox));
}
