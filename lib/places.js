/**
 * places.js — Google Places (New) Nearby Search integration via REST API
 */

import { haversineDistance, formatShortDistance } from './utils';

const SEARCH_RADIUS = 8000; // meters
const API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;

const FIELD_MASK = [
  'places.displayName',
  'places.id',
  'places.rating',
  'places.userRatingCount',
  'places.formattedAddress',
  'places.types',
  'places.location',
  'places.photos',
  'places.priceLevel',
  'places.currentOpeningHours',
  'places.websiteUri',
  'places.nationalPhoneNumber',
].join(',');

// Price level string → number mapping
const PRICE_LEVEL_MAP = {
  PRICE_LEVEL_FREE: 0,
  PRICE_LEVEL_INEXPENSIVE: 1,
  PRICE_LEVEL_MODERATE: 2,
  PRICE_LEVEL_EXPENSIVE: 3,
  PRICE_LEVEL_VERY_EXPENSIVE: 4,
};

// Category definitions mapped to Places API (New) types
export const CATEGORIES = {
  restaurant: {
    label: 'Restaurants & Food',
    emoji: '🍽️',
    chipLabel: '🍽️ Food',
    includedTypes: ['restaurant', 'fast_food_restaurant'],
  },
  cafe: {
    label: 'Coffee & Cafes',
    emoji: '☕',
    chipLabel: '☕ Coffee',
    includedTypes: ['cafe', 'coffee_shop'],
  },
  park: {
    label: 'Parks & Outdoors',
    emoji: '🌳',
    chipLabel: '🌳 Parks',
    includedTypes: ['park', 'national_park'],
  },
  activity: {
    label: 'Activities & Entertainment',
    emoji: '🎯',
    chipLabel: '🎯 Activities',
    includedTypes: ['museum', 'tourist_attraction', 'amusement_center'],
  },
  fuel: {
    label: 'Gas Stations',
    emoji: '⛽',
    chipLabel: '⛽ Gas',
    includedTypes: ['gas_station'],
  },
  hotel: {
    label: 'Hotels & Lodging',
    emoji: '🛏️',
    chipLabel: '🛏️ Hotels',
    includedTypes: ['hotel', 'motel'],
  },
  kids: {
    label: 'Kid-Friendly',
    emoji: '👶',
    chipLabel: '👶 Kids',
    includedTypes: ['playground', 'amusement_park'],
  },
};

/**
 * Build photo URL from a Places API (New) photo resource name
 */
export function getPhotoUrl(photoName, maxWidthPx = 400) {
  if (!photoName) return null;
  return `https://places.googleapis.com/v1/${photoName}/media?maxWidthPx=${maxWidthPx}&key=${API_KEY}`;
}

/**
 * Search for POIs near a point using Google Places API (New)
 * @param {Object} center - {lat, lon}
 * @param {string[]} categories - array of category keys to search
 * @param {number} radius - search radius in meters
 * @returns {Promise<Object[]>} array of normalized places
 */
export async function searchNearby(
  center,
  categories = ['restaurant', 'cafe'],
  radius = SEARCH_RADIUS
) {
  if (!categories || categories.length === 0) return [];

  // Build one search per category
  const searchPromises = categories
    .filter((catKey) => CATEGORIES[catKey])
    .map((catKey) => doNearbySearch(center, radius, catKey));

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
 * Perform a single nearby search via Places API (New) REST endpoint
 */
async function doNearbySearch(center, radius, categoryKey) {
  const catDef = CATEGORIES[categoryKey];
  if (!catDef) return [];

  const body = {
    includedTypes: catDef.includedTypes,
    maxResultCount: 20,
    locationRestriction: {
      circle: {
        center: { latitude: center.lat, longitude: center.lon },
        radius: Math.min(radius, 50000), // API max is 50km
      },
    },
  };

  try {
    const response = await fetch(
      'https://places.googleapis.com/v1/places:searchNearby',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': FIELD_MASK,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      console.error(`Places API error (${categoryKey}):`, response.status, errText);
      return [];
    }

    const data = await response.json();
    const places = data.places || [];

    return places
      .filter((p) => p.displayName?.text && p.location)
      .map((p) => {
        const lat = p.location.latitude;
        const lon = p.location.longitude;
        const distance = haversineDistance(center.lat, center.lon, lat, lon);
        const priceLevel =
          p.priceLevel != null ? (PRICE_LEVEL_MAP[p.priceLevel] ?? null) : null;

        // Extract closing time if available
        let closingTime = null;
        if (p.currentOpeningHours?.periods) {
          const now = new Date();
          const currentDay = now.getDay(); // 0=Sunday
          const todayPeriod = p.currentOpeningHours.periods.find(
            (period) => period.open?.day === currentDay
          );
          if (todayPeriod?.close?.hour != null) {
            const closeHour = todayPeriod.close.hour;
            const closeMin = todayPeriod.close.minute || 0;
            const ampm = closeHour >= 12 ? 'PM' : 'AM';
            const hour12 = closeHour > 12 ? closeHour - 12 : closeHour === 0 ? 12 : closeHour;
            closingTime = closeMin > 0 ? `${hour12}:${closeMin.toString().padStart(2, '0')} ${ampm}` : `${hour12} ${ampm}`;
          }
        }

        return {
          id: p.id,
          placeId: p.id,
          name: p.displayName.text,
          lat,
          lon,
          category: categoryKey,
          categoryLabel: catDef.label,
          emoji: catDef.emoji,
          distance,
          distanceFormatted: formatShortDistance(distance),
          rating: p.rating || null,
          userRatingsTotal: p.userRatingCount || 0,
          priceLevel,
          address: p.formattedAddress || null,
          photoUrl: p.photos?.[0]?.name
            ? getPhotoUrl(p.photos[0].name, 400)
            : null,
          openNow: p.currentOpeningHours?.openNow ?? null,
          closingTime,
          websiteUri: p.websiteUri || null,
          phoneNumber: p.nationalPhoneNumber || null,
        };
      });
  } catch (err) {
    console.error(`Places API fetch error (${categoryKey}):`, err);
    return [];
  }
}
