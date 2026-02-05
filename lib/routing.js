/**
 * routing.js — OSRM routing & drive-time midpoint calculation
 */

import { haversineDistance } from './utils';

const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving';

/**
 * Get route between two points
 * @param {Object} from - {lat, lon}
 * @param {Object} to - {lat, lon}
 * @returns {Promise<Object>} route data with geometry, duration, distance, midpoint
 */
export async function getRoute(from, to) {
  const url = `${OSRM_URL}/${from.lon},${from.lat};${to.lon},${to.lat}?overview=full&geometries=geojson&steps=true&annotations=duration`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Routing failed: ${response.status}`);
  }

  const data = await response.json();

  if (data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
    throw new Error(
      'No route found between these locations. They may be on different continents or unreachable by car.'
    );
  }

  const route = data.routes[0];
  const geometry = route.geometry;
  const totalDuration = route.duration; // seconds
  const totalDistance = route.distance; // meters

  // Calculate the time-based midpoint
  const midpoint = calculateTimeMidpoint(route);

  return {
    geometry,
    totalDuration,
    totalDistance,
    midpoint,
    legs: route.legs,
    steps: route.legs[0]?.steps || [],
  };
}

/**
 * Calculate the midpoint along the route based on drive time.
 * Walks along the route geometry using per-segment duration annotations.
 */
function calculateTimeMidpoint(route) {
  const totalDuration = route.duration;
  const halfTime = totalDuration / 2;

  const coords = route.geometry.coordinates; // [lon, lat] pairs

  // Get durations for each segment from annotations
  let segmentDurations = [];
  if (route.legs) {
    for (const leg of route.legs) {
      if (leg.annotation && leg.annotation.duration) {
        segmentDurations = segmentDurations.concat(leg.annotation.duration);
      }
    }
  }

  // If we have per-segment durations from annotations
  if (
    segmentDurations.length > 0 &&
    segmentDurations.length === coords.length - 1
  ) {
    return walkSegmentsWithDurations(coords, segmentDurations, halfTime);
  }

  // Fallback: distribute total duration proportionally by distance
  return walkSegmentsByDistance(coords, totalDuration, halfTime);
}

/**
 * Walk along segments using actual per-segment durations
 */
function walkSegmentsWithDurations(coords, durations, targetTime) {
  let accumulated = 0;

  for (let i = 0; i < durations.length; i++) {
    const segDuration = durations[i];

    if (accumulated + segDuration >= targetTime) {
      const remaining = targetTime - accumulated;
      const fraction = segDuration > 0 ? remaining / segDuration : 0;

      const startCoord = coords[i];
      const endCoord = coords[i + 1];

      return {
        lat: startCoord[1] + fraction * (endCoord[1] - startCoord[1]),
        lon: startCoord[0] + fraction * (endCoord[0] - startCoord[0]),
        segmentIndex: i,
        timeFromStart: targetTime,
      };
    }

    accumulated += segDuration;
  }

  // Fallback: return last coordinate
  const last = coords[coords.length - 1];
  return {
    lat: last[1],
    lon: last[0],
    segmentIndex: coords.length - 1,
    timeFromStart: accumulated,
  };
}

/**
 * Fallback: distribute time proportionally by distance along segments
 */
function walkSegmentsByDistance(coords, totalDuration, targetTime) {
  let totalDist = 0;
  const segDistances = [];

  for (let i = 0; i < coords.length - 1; i++) {
    const d = haversineDistance(
      coords[i][1],
      coords[i][0],
      coords[i + 1][1],
      coords[i + 1][0]
    );
    segDistances.push(d);
    totalDist += d;
  }

  let accumulated = 0;

  for (let i = 0; i < segDistances.length; i++) {
    const segTime =
      totalDist > 0 ? (segDistances[i] / totalDist) * totalDuration : 0;

    if (accumulated + segTime >= targetTime) {
      const remaining = targetTime - accumulated;
      const fraction = segTime > 0 ? remaining / segTime : 0;

      const startCoord = coords[i];
      const endCoord = coords[i + 1];

      return {
        lat: startCoord[1] + fraction * (endCoord[1] - startCoord[1]),
        lon: startCoord[0] + fraction * (endCoord[0] - startCoord[0]),
        segmentIndex: i,
        timeFromStart: targetTime,
      };
    }

    accumulated += segTime;
  }

  const last = coords[coords.length - 1];
  return {
    lat: last[1],
    lon: last[0],
    segmentIndex: coords.length - 1,
    timeFromStart: accumulated,
  };
}
