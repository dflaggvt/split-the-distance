/**
 * places.js — Google Places Nearby Search integration
 */

import { haversineDistance, formatShortDistance } from './utils';

const SEARCH_RADIUS = 8000; // meters

// Category definitions mapped to Google Places types
export const CATEGORIES = {
  restaurant: {
    label: 'Restaurants & Food',
    emoji: '🍽️',
    chipLabel: '🍽️ Food',
    searches: [{ type: 'restaurant' }],
  },
  cafe: {
    label: 'Coffee & Cafes',
    emoji: '☕',
    chipLabel: '☕ Coffee',
    searches: [{ type: 'cafe' }],
  },
  park: {
    label: 'Parks & Outdoors',
    emoji: '🌳',
    chipLabel: '🌳 Parks',
    searches: [{ type: 'park' }],
  },
  activity: {
    label: 'Activities & Entertainment',
    emoji: '🎯',
    chipLabel: '🎯 Activities',
    searches: [
      { type: 'museum' },
      { type: 'tourist_attraction' },
      { type: 'amusement_park' },
    ],
  },
  fuel: {
    label: 'Gas Stations',
    emoji: '⛽',
    chipLabel: '⛽ Gas',
    searches: [{ type: 'gas_station' }],
  },
  hotel: {
    label: 'Hotels & Lodging',
    emoji: '🛏️',
    chipLabel: '🛏️ Hotels',
    searches: [{ type: 'lodging' }],
  },
  kids: {
    label: 'Kid-Friendly',
    emoji: '👶',
    chipLabel: '👶 Kids',
    searches: [
      { keyword: 'playground' },
      { type: 'amusement_park' },
      { keyword: 'family fun center' },
    ],
  },
};

/**
 * Search for POIs near a point using Google Places
 * @param {Object} center - {lat, lon}
 * @param {string[]} categories - array of category keys to search
 * @param {number} radius - search radius in meters
 * @returns {Promise<Object[]>} array of places
 */
export async function searchNearby(
  center,
  categories = ['restaurant', 'cafe'],
  radius = SEARCH_RADIUS
) {
  if (!categories || categories.length === 0) return [];

  const service = new google.maps.places.PlacesService(
    document.createElement('div')
  );

  // Build all search requests
  const searchPromises = [];

  for (const catKey of categories) {
    const catDef = CATEGORIES[catKey];
    if (!catDef) continue;

    for (const search of catDef.searches) {
      searchPromises.push(
        doNearbySearch(service, center, radius, search, catKey)
      );
    }
  }

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
 * Perform a single nearby search
 */
function doNearbySearch(service, center, radius, search, categoryKey) {
  return new Promise((resolve) => {
    const request = {
      location: new google.maps.LatLng(center.lat, center.lon),
      radius,
    };

    if (search.type) request.type = search.type;
    if (search.keyword) request.keyword = search.keyword;

    service.nearbySearch(request, (results, status) => {
      if (
        status === google.maps.places.PlacesServiceStatus.OK &&
        results
      ) {
        const catDef = CATEGORIES[categoryKey];
        const places = results
          .filter((r) => r.name && r.geometry?.location)
          .map((r) => {
            const lat = r.geometry.location.lat();
            const lon = r.geometry.location.lng();
            const distance = haversineDistance(
              center.lat,
              center.lon,
              lat,
              lon
            );

            return {
              id: r.place_id,
              name: r.name,
              lat,
              lon,
              category: categoryKey,
              categoryLabel: catDef.label,
              emoji: catDef.emoji,
              distance,
              distanceFormatted: formatShortDistance(distance),
              rating: r.rating || null,
              userRatingsTotal: r.user_ratings_total || 0,
              priceLevel: r.price_level ?? null,
              address: r.vicinity || null,
              photos: r.photos || [],
              openNow:
                r.opening_hours?.isOpen?.() ??
                r.opening_hours?.open_now ??
                null,
            };
          });

        resolve(places);
      } else {
        resolve([]);
      }
    });
  });
}
