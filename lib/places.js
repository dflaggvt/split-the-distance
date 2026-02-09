/**
 * places.js — Mapbox Search Box API + Google Places hybrid integration
 * 
 * Place discovery: Mapbox /category endpoint (free tier: 25K-50K req/mo)
 * Photos/ratings: Google Places API (on-demand, future premium feature)
 */

import { haversineDistance, formatShortDistance } from './utils';

const SEARCH_RADIUS = 8000; // meters
const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
const GOOGLE_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

// Category definitions mapped to Mapbox category slugs
// See: https://docs.mapbox.com/api/search/search-box/#category-search
export const CATEGORIES = {
  restaurant: {
    label: 'Restaurants & Food',
    emoji: '🍽️',
    chipLabel: '🍽️ Food',
    mapboxCategories: ['restaurant', 'fast_food'],
  },
  cafe: {
    label: 'Coffee & Cafes',
    emoji: '☕',
    chipLabel: '☕ Coffee',
    mapboxCategories: ['cafe', 'coffee_shop'],
  },
  park: {
    label: 'Parks & Outdoors',
    emoji: '🌳',
    chipLabel: '🌳 Parks',
    mapboxCategories: ['park'],
  },
  activity: {
    label: 'Activities & Entertainment',
    emoji: '🎯',
    chipLabel: '🎯 Activities',
    mapboxCategories: ['museum', 'tourist_attraction', 'entertainment'],
  },
  fuel: {
    label: 'Gas Stations',
    emoji: '⛽',
    chipLabel: '⛽ Gas',
    mapboxCategories: ['gas_station'],
  },
  hotel: {
    label: 'Hotels & Lodging',
    emoji: '🛏️',
    chipLabel: '🛏️ Hotels',
    mapboxCategories: ['hotel'],
  },
};

/**
 * Build photo URL from a Google Places API (New) photo resource name
 * Kept for future premium feature / OpenTable integration
 */
export function getPhotoUrl(photoName, maxWidthPx = 400) {
  if (!photoName) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${GOOGLE_API_KEY}`;
}

/**
 * Search for POIs near a point using Mapbox Search Box /category endpoint
 * @param {Object} center - {lat, lon}
 * @param {string[]} categories - array of category keys to search
 * @param {number} radius - search radius in meters (used for bbox calculation)
 * @returns {Promise<Object[]>} array of normalized places
 */
export async function searchNearby(
  center,
  categories = ['restaurant', 'cafe'],
  radius = SEARCH_RADIUS
) {
  if (!categories || categories.length === 0) return [];

  // Build one search per mapbox category (some of ours map to multiple)
  const searchPromises = categories
    .filter((catKey) => CATEGORIES[catKey])
    .flatMap((catKey) =>
      CATEGORIES[catKey].mapboxCategories.map((mbCat) =>
        doMapboxCategorySearch(center, radius, mbCat, catKey)
      )
    );

  const results = await Promise.allSettled(searchPromises);

  // Flatten and deduplicate
  const allPlaces = [];
  const seen = new Set();

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value) {
      for (const place of result.value) {
        if (!seen.has(place.id)) {
          seen.add(place.id);
          allPlaces.push(place);
        }
      }
    }
  }

  // Sort by distance from midpoint
  allPlaces.sort((a, b) => a.distance - b.distance);

  return allPlaces;
}

/**
 * Calculate a bounding box around a center point
 */
function getBbox(center, radiusMeters) {
  // Approximate degrees per meter
  const latDeg = radiusMeters / 111320;
  const lonDeg = radiusMeters / (111320 * Math.cos((center.lat * Math.PI) / 180));
  return `${center.lon - lonDeg},${center.lat - latDeg},${center.lon + lonDeg},${center.lat + latDeg}`;
}

/**
 * Parse Mapbox opening hours to determine if currently open and closing time
 */
function parseOpeningHours(metadata) {
  if (!metadata?.open_hours?.periods) return { openNow: null, closingTime: null };

  const periods = metadata.open_hours.periods;
  const now = new Date();
  const currentDay = now.getDay(); // 0=Sunday
  const currentTime = now.getHours() * 100 + now.getMinutes();

  // Find today's period
  const todayPeriod = periods.find((p) => p.open?.day === currentDay);
  if (!todayPeriod) return { openNow: false, closingTime: null };

  const openTime = parseInt(todayPeriod.open?.time || '0', 10);
  const closeTime = parseInt(todayPeriod.close?.time || '2359', 10);

  const openNow = currentTime >= openTime && currentTime < closeTime;

  // Format closing time
  let closingTime = null;
  if (todayPeriod.close?.time) {
    const closeHour = Math.floor(closeTime / 100);
    const closeMin = closeTime % 100;
    const ampm = closeHour >= 12 ? 'PM' : 'AM';
    const hour12 = closeHour > 12 ? closeHour - 12 : closeHour === 0 ? 12 : closeHour;
    closingTime =
      closeMin > 0
        ? `${hour12}:${closeMin.toString().padStart(2, '0')} ${ampm}`
        : `${hour12} ${ampm}`;
  }

  return { openNow, closingTime };
}

/**
 * Perform a single category search via Mapbox Search Box API
 */
async function doMapboxCategorySearch(center, radius, mapboxCategory, categoryKey) {
  const catDef = CATEGORIES[categoryKey];
  if (!catDef) return [];

  const bbox = getBbox(center, radius);

  const url =
    `https://api.mapbox.com/search/searchbox/v1/category/${mapboxCategory}` +
    `?proximity=${center.lon},${center.lat}` +
    `&bbox=${bbox}` +
    `&limit=25` +
    `&access_token=${MAPBOX_TOKEN}`;

  try {
    const response = await fetch(url);

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Mapbox category search error (${mapboxCategory}):`, response.status, errText);
      return [];
    }

    const data = await response.json();
    const features = data.features || [];

    return features
      .filter((f) => f.properties?.name && f.geometry?.coordinates)
      .map((f) => {
        const props = f.properties;
        const [lon, lat] = f.geometry.coordinates;
        const distance = props.distance != null
          ? props.distance
          : haversineDistance(center.lat, center.lon, lat, lon);
        const { openNow, closingTime } = parseOpeningHours(props.metadata);

        return {
          id: props.mapbox_id,
          placeId: props.mapbox_id,
          name: props.name,
          lat,
          lon,
          category: categoryKey,
          categoryLabel: catDef.label,
          emoji: catDef.emoji,
          distance,
          distanceFormatted: formatShortDistance(distance),
          rating: null, // Mapbox doesn't provide ratings
          userRatingsTotal: 0,
          priceLevel: null, // Mapbox doesn't provide price level
          address: props.full_address || props.address || null,
          photoUrl: null, // No photos from Mapbox — future: OpenTable/premium
          openNow,
          closingTime,
          websiteUri: props.metadata?.website || null,
          phoneNumber: props.metadata?.phone || null,
          // Mapbox-specific fields for future use
          brand: props.brand?.[0] || null,
          poiCategories: props.poi_category || [],
          externalIds: props.external_ids || {},
          maki: props.maki || null,
        };
      });
  } catch (err) {
    console.error(`Mapbox category search fetch error (${mapboxCategory}):`, err);
    return [];
  }
}
