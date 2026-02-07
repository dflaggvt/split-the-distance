/**
 * Server-side route API with caching
 * Reduces Google Routes API costs by caching identical route requests
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SB_PROJECT_URL,
  process.env.SUPABASE_SERVICE_KEY || process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
);

const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
const CACHE_TTL_HOURS = 4; // Cache routes for 4 hours

/**
 * Generate a cache key from route parameters
 */
function generateCacheKey(from, to, travelMode) {
  // Round coordinates to 4 decimal places (~11m precision) to improve cache hits
  const fromKey = `${from.lat.toFixed(4)},${from.lon.toFixed(4)}`;
  const toKey = `${to.lat.toFixed(4)},${to.lon.toFixed(4)}`;
  return `${fromKey}|${toKey}|${travelMode}`;
}

/**
 * Check cache for existing route
 */
async function getFromCache(cacheKey) {
  try {
    const { data, error } = await supabase
      .from('route_cache')
      .select('route_data, expires_at')
      .eq('cache_key', cacheKey)
      .single();
    
    if (error || !data) return null;
    
    // Check if expired
    if (new Date(data.expires_at) < new Date()) {
      // Clean up expired entry
      await supabase.from('route_cache').delete().eq('cache_key', cacheKey);
      return null;
    }
    
    return data.route_data;
  } catch (err) {
    console.error('Cache read error:', err);
    return null;
  }
}

/**
 * Store route in cache
 */
async function storeInCache(cacheKey, routeData) {
  try {
    const expiresAt = new Date(Date.now() + CACHE_TTL_HOURS * 60 * 60 * 1000).toISOString();
    
    await supabase
      .from('route_cache')
      .upsert({
        cache_key: cacheKey,
        route_data: routeData,
        expires_at: expiresAt,
      }, {
        onConflict: 'cache_key'
      });
  } catch (err) {
    console.error('Cache write error:', err);
    // Don't fail the request if caching fails
  }
}

/**
 * Call Google Routes API
 */
async function fetchRouteFromGoogle(from, to, travelMode) {
  const requestBody = {
    origin: {
      location: {
        latLng: { latitude: from.lat, longitude: from.lon }
      }
    },
    destination: {
      location: {
        latLng: { latitude: to.lat, longitude: to.lon }
      }
    },
    travelMode: travelMode,
    computeAlternativeRoutes: true,
    routeModifiers: {
      avoidTolls: false,
      avoidHighways: false,
      avoidFerries: false,
    },
    languageCode: 'en-US',
    units: 'IMPERIAL',
  };

  // Add traffic for driving
  if (travelMode === 'DRIVE') {
    requestBody.routingPreference = 'TRAFFIC_AWARE';
  }

  const response = await fetch(
    'https://routes.googleapis.com/directions/v2:computeRoutes',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': GOOGLE_API_KEY,
        'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline,routes.legs,routes.description,routes.warnings',
      },
      body: JSON.stringify(requestBody),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Routes API error: ${response.status} - ${error}`);
  }

  return response.json();
}

/**
 * Calculate time-based midpoint from route legs
 */
function calculateMidpoint(legs) {
  if (!legs || legs.length === 0) return null;
  
  const leg = legs[0];
  const steps = leg.steps;
  
  if (!steps || steps.length === 0) {
    // Fallback: geographic midpoint
    const start = leg.startLocation.latLng;
    const end = leg.endLocation.latLng;
    return {
      lat: (start.latitude + end.latitude) / 2,
      lon: (start.longitude + end.longitude) / 2,
    };
  }
  
  // Calculate total duration
  const totalDuration = parseInt(leg.duration.replace('s', ''));
  const halfTime = totalDuration / 2;
  
  let accumulated = 0;
  
  for (const step of steps) {
    const stepDuration = parseInt(step.staticDuration.replace('s', ''));
    
    if (accumulated + stepDuration >= halfTime) {
      const remaining = halfTime - accumulated;
      const fraction = stepDuration > 0 ? remaining / stepDuration : 0;
      
      const start = step.startLocation.latLng;
      const end = step.endLocation.latLng;
      
      return {
        lat: start.latitude + fraction * (end.latitude - start.latitude),
        lon: start.longitude + fraction * (end.longitude - start.longitude),
        timeFromStart: halfTime,
      };
    }
    
    accumulated += stepDuration;
  }
  
  // Fallback: end of route
  const lastStep = steps[steps.length - 1];
  return {
    lat: lastStep.endLocation.latLng.latitude,
    lon: lastStep.endLocation.latLng.longitude,
    timeFromStart: accumulated,
  };
}

/**
 * Process Google Routes response into our format
 */
function processRouteResponse(googleResponse, from, to) {
  if (!googleResponse.routes || googleResponse.routes.length === 0) {
    throw new Error('No routes found');
  }

  const allRoutes = googleResponse.routes.map((route, index) => {
    const leg = route.legs[0];
    const duration = parseInt(route.duration.replace('s', ''));
    const distance = route.distanceMeters;
    const midpoint = calculateMidpoint(route.legs);
    
    return {
      index,
      summary: route.description || `Route ${index + 1}`,
      totalDuration: duration,
      totalDistance: distance,
      midpoint,
      polyline: route.polyline?.encodedPolyline,
      warnings: route.warnings || [],
    };
  });

  const primaryRoute = allRoutes[0];

  return {
    from,
    to,
    totalDuration: primaryRoute.totalDuration,
    totalDistance: primaryRoute.totalDistance,
    midpoint: primaryRoute.midpoint,
    allRoutes,
    polyline: primaryRoute.polyline,
    cached: false,
  };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { from, to, travelMode = 'DRIVE' } = body;

    if (!from || !to || !from.lat || !from.lon || !to.lat || !to.lon) {
      return Response.json({ error: 'Invalid coordinates' }, { status: 400 });
    }

    // Generate cache key
    const cacheKey = generateCacheKey(from, to, travelMode);

    // Check cache first
    const cached = await getFromCache(cacheKey);
    if (cached) {
      console.log(`[Cache HIT] ${cacheKey}`);
      return Response.json({ ...cached, cached: true });
    }

    console.log(`[Cache MISS] ${cacheKey}`);

    // Fetch from Google
    const googleResponse = await fetchRouteFromGoogle(from, to, travelMode);
    
    // Process response
    const routeData = processRouteResponse(googleResponse, from, to);

    // Store in cache (async, don't wait)
    storeInCache(cacheKey, routeData);

    return Response.json(routeData);
  } catch (error) {
    console.error('Route API error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function GET() {
  return Response.json({ error: 'Use POST method' }, { status: 405 });
}
