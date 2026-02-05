/**
 * routing.js — Google Directions routing & drive-time midpoint calculation
 */

/**
 * Get route between two points using Google Directions
 * @param {Object} from - {lat, lon}
 * @param {Object} to - {lat, lon}
 * @returns {Promise<Object>} route data with directionsResult, duration, distance, midpoint
 */
export async function getRoute(from, to) {
  return new Promise((resolve, reject) => {
    const directionsService = new google.maps.DirectionsService();

    directionsService.route(
      {
        origin: new google.maps.LatLng(from.lat, from.lon),
        destination: new google.maps.LatLng(to.lat, to.lon),
        travelMode: google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status !== google.maps.DirectionsStatus.OK || !result) {
          if (status === 'ZERO_RESULTS') {
            reject(
              new Error(
                'No route found between these locations. They may be on different continents or unreachable by car.'
              )
            );
          } else {
            reject(new Error(`Routing failed: ${status}`));
          }
          return;
        }

        const route = result.routes[0];
        const leg = route.legs[0];
        const totalDuration = leg.duration.value; // seconds
        const totalDistance = leg.distance.value; // meters

        // Calculate the time-based midpoint by walking through steps
        const midpoint = calculateTimeMidpoint(leg);

        resolve({
          directionsResult: result,
          totalDuration,
          totalDistance,
          midpoint,
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
