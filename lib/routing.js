/**
 * routing.js — Google Directions routing & drive-time midpoint calculation
 */

import { getCachedRoute, decodePolyline } from './routeCache';

/**
 * Get route between two points - tries server cache first, falls back to client SDK
 * @param {Object} from - {lat, lon}
 * @param {Object} to - {lat, lon}
 * @param {string} travelMode - 'DRIVING' | 'BICYCLING' | 'WALKING'
 * @returns {Promise<Object>} route data with directionsResult, duration, distance, midpoint
 */
export async function getRoute(from, to, travelMode = 'DRIVING', options = {}) {
  // Try server-side cached route first
  if (!options.skipCache) {
    try {
      const cachedRoute = await getCachedRoute(from, to, travelMode);
      if (cachedRoute && cachedRoute.midpoint) {
        console.log(`[Route] Cache ${cachedRoute.fromCache ? 'HIT' : 'MISS'} - using server API`);
        
        // Convert server response to client format
        return convertServerRouteToClient(cachedRoute, from, to, travelMode);
      }
    } catch (err) {
      console.warn('[Route] Server cache failed, falling back to client SDK:', err);
    }
  }
  
  // Fall back to client-side Google SDK
  return getRouteFromGoogleSDK(from, to, travelMode, options);
}

/**
 * Convert server API response to client-compatible format
 * Uses polyline data from cache - NO additional API call!
 */
function convertServerRouteToClient(serverRoute, from, to) {
  // Decode polylines from all routes
  const allRoutes = serverRoute.allRoutes.map((route, index) => ({
    index,
    summary: route.summary || `Route ${index + 1}`,
    totalDuration: route.totalDuration,
    totalDistance: route.totalDistance,
    midpoint: route.midpoint,
    polyline: route.polyline, // Encoded polyline string
    decodedPath: decodePolyline(route.polyline), // Decoded for rendering
    warnings: route.warnings || [],
  }));

  const primaryRoute = allRoutes[0];

  return {
    // No directionsResult - use polyline rendering instead
    directionsResult: null,
    usePolyline: true, // Flag for MapView to use polyline rendering
    polylinePath: primaryRoute.decodedPath,
    totalDuration: serverRoute.totalDuration,
    totalDistance: serverRoute.totalDistance,
    midpoint: serverRoute.midpoint,
    allRoutes,
    selectedRouteIndex: 0,
    fromCache: serverRoute.fromCache,
    from,
    to,
  };
}

/**
 * Get route between two points using Google Directions SDK directly (internal use)
 * @param {Object} from - {lat, lon}
 * @param {Object} to - {lat, lon}
 * @param {string} travelMode - 'DRIVING' | 'BICYCLING' | 'WALKING'
 * @returns {Promise<Object>} route data with directionsResult, duration, distance, midpoint
 */
async function getRouteFromGoogleSDK(from, to, travelMode = 'DRIVING', options = {}) {
  const { skipAlternatives = false, skipTraffic = false } = options;
  
  return new Promise((resolve, reject) => {
    const directionsService = new google.maps.DirectionsService();

    // Build request options
    const requestOptions = {
      origin: new google.maps.LatLng(from.lat, from.lon),
      destination: new google.maps.LatLng(to.lat, to.lon),
      travelMode: google.maps.TravelMode[travelMode],
      provideRouteAlternatives: !skipAlternatives, // Request alternative routes unless skipped
    };

    // Only add drivingOptions for DRIVING mode (unless skipped for long routes)
    if (travelMode === 'DRIVING' && !skipTraffic) {
      requestOptions.drivingOptions = {
        departureTime: new Date(), // Use current time for live traffic
        trafficModel: google.maps.TrafficModel.BEST_GUESS,
      };
    }

    directionsService.route(
      requestOptions,
      async (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          if (status === 'ZERO_RESULTS') {
            reject(
              new Error(
                'No route found between these locations. They may be on different continents or unreachable by car.'
              )
            );
          } else if (status === 'MAX_ROUTE_LENGTH_EXCEEDED') {
            // For long routes, retry without alternatives and traffic (Google API limitation)
            if (!skipAlternatives || !skipTraffic) {
              console.log('[STD] Long route detected, retrying with simpler request...');
              try {
                const simpleResult = await getRoute(from, to, travelMode, { 
                  skipAlternatives: true, 
                  skipTraffic: true 
                });
                resolve(simpleResult);
                return;
              } catch (retryError) {
                reject(retryError);
                return;
              }
            }
            // If we already tried simple mode and still failed, it's truly too long
            reject(
              new Error(
                'This route is too long (over 6,000 miles). Try locations that are closer together or on the same continent.'
              )
            );
          } else {
            reject(new Error(`Routing failed: ${status}`));
          }
          return;
        }

        // Process all routes
        const allRoutes = result.routes.map((route, index) => {
          const leg = route.legs[0];
          const totalDuration = leg.duration_in_traffic?.value || leg.duration.value;
          const totalDistance = leg.distance.value;
          const midpoint = calculateTimeMidpoint(leg);
          
          // Extract route summary (e.g., "via I-95 S")
          const summary = route.summary || `Route ${index + 1}`;
          
          return {
            index,
            summary,
            totalDuration,
            totalDistance,
            midpoint,
            leg,
          };
        });

        // Primary route data (first/fastest route)
        const primaryRoute = allRoutes[0];

        resolve({
          directionsResult: result,
          totalDuration: primaryRoute.totalDuration,
          totalDistance: primaryRoute.totalDistance,
          midpoint: primaryRoute.midpoint,
          allRoutes, // Include all route options
          selectedRouteIndex: 0,
        });
      }
    );
  });
}

/**
 * Calculate the midpoint along the route based on drive time.
 * Walks along the route steps using per-step duration.
 */
function calculateTimeMidpoint(leg) {
  const totalDuration = leg.duration.value;
  const halfTime = totalDuration / 2;
  const steps = leg.steps;

  if (!steps || steps.length === 0) {
    // Fallback to geographic midpoint
    const start = leg.start_location;
    const end = leg.end_location;
    return {
      lat: (start.lat() + end.lat()) / 2,
      lon: (start.lng() + end.lng()) / 2,
      timeFromStart: halfTime,
    };
  }

  let accumulated = 0;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepDuration = step.duration.value; // seconds
    const path = step.path; // array of LatLng objects

    if (accumulated + stepDuration >= halfTime) {
      // The midpoint is within this step
      const remaining = halfTime - accumulated;
      const fraction = stepDuration > 0 ? remaining / stepDuration : 0;

      if (path && path.length >= 2) {
        // Walk along the path points within this step
        return interpolateAlongPath(path, fraction, halfTime);
      }

      // Interpolate between step start and end
      const startLat = step.start_location.lat();
      const startLng = step.start_location.lng();
      const endLat = step.end_location.lat();
      const endLng = step.end_location.lng();

      return {
        lat: startLat + fraction * (endLat - startLat),
        lon: startLng + fraction * (endLng - startLng),
        timeFromStart: halfTime,
      };
    }

    accumulated += stepDuration;
  }

  // Fallback: return end of route
  const lastStep = steps[steps.length - 1];
  return {
    lat: lastStep.end_location.lat(),
    lon: lastStep.end_location.lng(),
    timeFromStart: accumulated,
  };
}

/**
 * Interpolate along a path of LatLng points at a given fraction (0 to 1)
 */
function interpolateAlongPath(path, fraction, timeFromStart) {
  if (path.length < 2) {
    return {
      lat: path[0].lat(),
      lon: path[0].lng(),
      timeFromStart,
    };
  }

  // Calculate total path distance
  let totalDist = 0;
  const segDists = [];
  for (let i = 0; i < path.length - 1; i++) {
    const d = simpleDistance(path[i], path[i + 1]);
    segDists.push(d);
    totalDist += d;
  }

  const targetDist = totalDist * fraction;
  let accumulated = 0;

  for (let i = 0; i < segDists.length; i++) {
    if (accumulated + segDists[i] >= targetDist) {
      const remaining = targetDist - accumulated;
      const segFraction = segDists[i] > 0 ? remaining / segDists[i] : 0;

      const startLat = path[i].lat();
      const startLng = path[i].lng();
      const endLat = path[i + 1].lat();
      const endLng = path[i + 1].lng();

      return {
        lat: startLat + segFraction * (endLat - startLat),
        lon: startLng + segFraction * (endLng - startLng),
        timeFromStart,
      };
    }
    accumulated += segDists[i];
  }

  // Fallback: last point
  const last = path[path.length - 1];
  return {
    lat: last.lat(),
    lon: last.lng(),
    timeFromStart,
  };
}

/**
 * Simple haversine distance between two LatLng objects (meters)
 */
function simpleDistance(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat() - a.lat());
  const dLng = toRad(b.lng() - a.lng());
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const val =
    sinDLat * sinDLat +
    Math.cos(toRad(a.lat())) * Math.cos(toRad(b.lat())) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
}

/**
 * Simple haversine distance between two {lat, lon/lng} objects (meters)
 */
function haversineDistance(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const lat1 = a.lat;
  const lat2 = b.lat;
  const lng1 = a.lon || a.lng;
  const lng2 = b.lon || b.lng;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const val =
    sinDLat * sinDLat +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * sinDLng * sinDLng;
  return R * 2 * Math.atan2(Math.sqrt(val), Math.sqrt(1 - val));
}

/**
 * Calculate geographic centroid of multiple locations
 */
function calculateCentroid(locations) {
  const n = locations.length;
  const sum = locations.reduce(
    (acc, loc) => ({
      lat: acc.lat + loc.lat,
      lon: acc.lon + (loc.lon || loc.lng),
    }),
    { lat: 0, lon: 0 }
  );
  return { lat: sum.lat / n, lon: sum.lon / n };
}

/**
 * Get drive times from multiple origins to a single destination using Distance Matrix API
 */
function getDistanceMatrix(origins, destination) {
  return new Promise((resolve, reject) => {
    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix(
      {
        origins: origins.map((o) => new google.maps.LatLng(o.lat, o.lon || o.lng)),
        destinations: [new google.maps.LatLng(destination.lat, destination.lon || destination.lng)],
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (response, status) => {
        if (status !== 'OK') {
          reject(new Error(`Distance Matrix failed: ${status}`));
          return;
        }
        
        const results = response.rows.map((row, i) => {
          const element = row.elements[0];
          if (element.status !== 'OK') {
            return { origin: origins[i], duration: Infinity, distance: Infinity, status: element.status };
          }
          return {
            origin: origins[i],
            duration: element.duration.value, // seconds
            distance: element.distance.value, // meters
            durationText: element.duration.text,
            distanceText: element.distance.text,
            status: 'OK',
          };
        });
        
        resolve(results);
      }
    );
  });
}

/**
 * Find the fairest meeting point for multiple locations.
 * Minimizes the maximum drive time (so no one gets screwed).
 * 
 * @param {Array} locations - Array of {lat, lon, name} objects (3-6 locations)
 * @returns {Promise<Object>} - { midpoint, driveTimes, maxDrive, minDrive, spread }
 */
export async function getMultiLocationMidpoint(locations) {
  if (locations.length < 2) {
    throw new Error('Need at least 2 locations');
  }
  
  if (locations.length === 2) {
    // For 2 locations, use the existing route-based midpoint
    const route = await getRoute(locations[0], locations[1]);
    return {
      midpoint: route.midpoint,
      driveTimes: [
        { origin: locations[0], duration: route.totalDuration / 2, durationText: formatDuration(route.totalDuration / 2) },
        { origin: locations[1], duration: route.totalDuration / 2, durationText: formatDuration(route.totalDuration / 2) },
      ],
      maxDrive: route.totalDuration / 2,
      minDrive: route.totalDuration / 2,
      spread: 0,
      totalDistance: route.totalDistance,
      directionsResult: route.directionsResult,
    };
  }
  
  // For 3+ locations, use iterative optimization
  let candidate = calculateCentroid(locations);
  let bestCandidate = candidate;
  let bestMaxDrive = Infinity;
  let bestDriveTimes = null;
  
  const MAX_ITERATIONS = 8;
  
  for (let i = 0; i < MAX_ITERATIONS; i++) {
    try {
      const driveTimes = await getDistanceMatrix(locations, candidate);
      
      // Check if any route failed
      const failedRoutes = driveTimes.filter((dt) => dt.status !== 'OK');
      if (failedRoutes.length > 0) {
        // Some routes not possible, adjust candidate slightly and retry
        candidate = {
          lat: candidate.lat + (Math.random() - 0.5) * 0.1,
          lon: candidate.lon + (Math.random() - 0.5) * 0.1,
        };
        continue;
      }
      
      const maxDrive = Math.max(...driveTimes.map((dt) => dt.duration));
      const minDrive = Math.min(...driveTimes.map((dt) => dt.duration));
      const spread = maxDrive - minDrive;
      
      // Track best result
      if (maxDrive < bestMaxDrive) {
        bestMaxDrive = maxDrive;
        bestCandidate = { ...candidate };
        bestDriveTimes = driveTimes;
      }
      
      // If spread is small enough (< 10 min), we're done
      if (spread < 600) {
        break;
      }
      
      // Find the "loser" - person with longest drive
      const loserIdx = driveTimes.findIndex((dt) => dt.duration === maxDrive);
      const loserLocation = locations[loserIdx];
      
      // Shift candidate toward the loser
      const shiftFactor = 0.25;
      candidate = {
        lat: candidate.lat + shiftFactor * (loserLocation.lat - candidate.lat),
        lon: candidate.lon + shiftFactor * ((loserLocation.lon || loserLocation.lng) - candidate.lon),
      };
    } catch (err) {
      console.error('Iteration error:', err);
      // Continue with current best
    }
  }
  
  // Final result with best candidate
  if (!bestDriveTimes) {
    // Fallback - just use centroid and get times
    bestDriveTimes = await getDistanceMatrix(locations, bestCandidate);
  }
  
  const maxDrive = Math.max(...bestDriveTimes.map((dt) => dt.duration));
  const minDrive = Math.min(...bestDriveTimes.map((dt) => dt.duration));
  
  return {
    midpoint: bestCandidate,
    driveTimes: bestDriveTimes.map((dt, i) => ({
      ...dt,
      name: locations[i].name,
    })),
    maxDrive,
    minDrive,
    spread: maxDrive - minDrive,
  };
}

/**
 * Format duration in seconds to human readable string
 */
function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes} min`;
}
