/**
 * isochrone.js — Mapbox Isochrone API helper + point-in-polygon utility
 *
 * Fetches drive-time polygons from the Mapbox Isochrone API and provides
 * geometry utilities for filtering places within the zone.
 */

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

// Map our travel modes to Mapbox profile names
const PROFILE_MAP = {
  DRIVING: 'driving',
  BICYCLING: 'cycling',
  WALKING: 'walking',
};

/**
 * Generate a circle polygon as a fallback when Mapbox Isochrone is unavailable.
 * Approximates the reachable area based on average speed for the travel mode.
 */
function generateCircle(lat, lng, minutes, travelMode) {
  // Average speeds in miles per minute
  const speeds = { DRIVING: 0.75, BICYCLING: 0.2, WALKING: 0.05 };
  const speed = speeds[travelMode] || speeds.DRIVING;
  const radiusMiles = speed * minutes;

  // Convert miles to degrees (rough: 1 degree lat ≈ 69 miles)
  const latDeg = radiusMiles / 69;
  const lngDeg = radiusMiles / (69 * Math.cos(lat * Math.PI / 180));

  // Generate 64-point circle
  const points = [];
  for (let i = 0; i < 64; i++) {
    const angle = (i / 64) * 2 * Math.PI;
    points.push({
      lat: lat + latDeg * Math.sin(angle),
      lng: lng + lngDeg * Math.cos(angle),
    });
  }
  return points;
}

/**
 * Fetch an isochrone polygon from Mapbox.
 *
 * @param {{ lat: number, lon?: number, lng?: number }} midpoint
 * @param {{ minutes: number, travelMode?: string }} options
 * @returns {Promise<{ polygon: Array<{lat: number, lng: number}>, geojson: Object, bbox: number[] }>}
 */
export async function fetchIsochrone(midpoint, { minutes = 10, travelMode = 'DRIVING' } = {}) {
  if (!MAPBOX_TOKEN) {
    throw new Error('Mapbox token not configured');
  }

  const lng = midpoint.lon ?? midpoint.lng;
  const lat = midpoint.lat;
  const profile = PROFILE_MAP[travelMode] || 'driving';

  const url =
    `https://api.mapbox.com/isochrone/v1/mapbox/${profile}/${lng},${lat}` +
    `?contours_minutes=${minutes}` +
    `&polygons=true` +
    `&access_token=${MAPBOX_TOKEN}`;

  let polygon;
  let geojsonData = null;

  try {
    const res = await fetch(url);

    if (!res.ok) {
      const text = await res.text();
      console.warn('[Isochrone] API error:', res.status, text, '— falling back to circle');
      polygon = generateCircle(lat, lng, minutes, travelMode);
    } else {
      geojsonData = await res.json();

      const feature = geojsonData.features?.[0];
      if (!feature || !feature.geometry?.coordinates?.[0]) {
        console.warn('[Isochrone] No polygon in response — falling back to circle');
        polygon = generateCircle(lat, lng, minutes, travelMode);
      } else {
        // GeoJSON coordinates are [lng, lat] — convert to Google Maps { lat, lng }
        const ring = feature.geometry.coordinates[0];
        polygon = ring.map(([gLng, gLat]) => ({ lat: gLat, lng: gLng }));
      }
    }
  } catch (fetchErr) {
    console.warn('[Isochrone] Fetch failed:', fetchErr.message, '— falling back to circle');
    polygon = generateCircle(lat, lng, minutes, travelMode);
  }

  // Compute bounding box for quick rejection
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  for (const pt of polygon) {
    if (pt.lat < minLat) minLat = pt.lat;
    if (pt.lat > maxLat) maxLat = pt.lat;
    if (pt.lng < minLng) minLng = pt.lng;
    if (pt.lng > maxLng) maxLng = pt.lng;
  }

  return {
    polygon,
    geojson: geojsonData,
    bbox: [minLng, minLat, maxLng, maxLat],
    minutes,
    travelMode,
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
 * Filter an array of places to only those inside the isochrone polygon.
 *
 * @param {Array} places - Array of place objects with { lat, lon/lng }
 * @param {{ polygon: Array, bbox: number[] }} driftRadius
 * @returns {Array}
 */
export function filterPlacesInZone(places, driftRadius) {
  if (!driftRadius?.polygon || !places?.length) return places;
  return places.filter(p => pointInPolygon(p, driftRadius.polygon, driftRadius.bbox));
}
