/**
 * places.js — Overpass API integration for POI discovery
 */

import { haversineDistance, formatShortDistance } from './utils';

const OVERPASS_URL = 'https://overpass-api.de/api/interpreter';
const SEARCH_RADIUS = 5000; // meters

// Category definitions with Overpass tags and display info
export const CATEGORIES = {
  restaurant: {
    label: 'Restaurants & Food',
    emoji: '🍽️',
    chipLabel: '🍽️ Food',
    tags: [
      ['amenity', 'restaurant'],
      ['amenity', 'fast_food'],
    ],
  },
  cafe: {
    label: 'Coffee & Cafes',
    emoji: '☕',
    chipLabel: '☕ Coffee',
    tags: [['amenity', 'cafe']],
  },
  park: {
    label: 'Parks & Outdoors',
    emoji: '🌳',
    chipLabel: '🌳 Parks',
    tags: [
      ['leisure', 'park'],
      ['leisure', 'nature_reserve'],
      ['leisure', 'garden'],
    ],
  },
  activity: {
    label: 'Activities & Entertainment',
    emoji: '🎯',
    chipLabel: '🎯 Activities',
    tags: [
      ['tourism', 'museum'],
      ['tourism', 'attraction'],
      ['leisure', 'sports_centre'],
      ['amenity', 'cinema'],
      ['amenity', 'theatre'],
    ],
  },
  fuel: {
    label: 'Gas Stations',
    emoji: '⛽',
    chipLabel: '⛽ Gas',
    tags: [['amenity', 'fuel']],
  },
  hotel: {
    label: 'Hotels & Lodging',
    emoji: '🛏️',
    chipLabel: '🛏️ Hotels',
    tags: [
      ['tourism', 'hotel'],
      ['tourism', 'motel'],
      ['tourism', 'guest_house'],
    ],
  },
  kids: {
    label: 'Kid-Friendly',
    emoji: '👶',
    chipLabel: '👶 Kids',
    tags: [
      ['amenity', 'playground'],
      ['leisure', 'playground'],
      ['tourism', 'zoo'],
      ['tourism', 'theme_park'],
    ],
  },
};

/**
 * Search for POIs near a point
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

  const query = buildQuery(center, categories, radius);

  const response = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `data=${encodeURIComponent(query)}`,
  });

  if (!response.ok) {
    throw new Error(`Overpass API failed: ${response.status}`);
  }

  const data = await response.json();
  return parseResults(data.elements, center, categories);
}

/**
 * Build Overpass QL query
 */
function buildQuery(center, categories, radius) {
  let tagFilters = [];

  for (const cat of categories) {
    const catDef = CATEGORIES[cat];
    if (!catDef) continue;

    for (const [key, value] of catDef.tags) {
      tagFilters.push(
        `node["${key}"="${value}"](around:${radius},${center.lat},${center.lon});`
      );
      tagFilters.push(
        `way["${key}"="${value}"](around:${radius},${center.lat},${center.lon});`
      );
    }
  }

  return `[out:json][timeout:15];(${tagFilters.join('')});out center body 50;`;
}

/**
 * Parse Overpass results into our format
 */
function parseResults(elements, center, requestedCategories) {
  if (!elements) return [];

  const places = [];
  const seen = new Set();

  for (const el of elements) {
    let lat, lon;
    if (el.type === 'node') {
      lat = el.lat;
      lon = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lon = el.center.lon;
    } else {
      continue;
    }

    const tags = el.tags || {};
    const name = tags.name;
    if (!name) continue;

    // Deduplicate
    const dedupeKey = `${name}-${lat.toFixed(3)}-${lon.toFixed(3)}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    // Determine category
    const category = classifyPlace(tags, requestedCategories);
    if (!category) continue;

    const catDef = CATEGORIES[category];
    const distance = haversineDistance(center.lat, center.lon, lat, lon);

    places.push({
      id: el.id,
      name,
      lat,
      lon,
      category,
      categoryLabel: catDef.label,
      emoji: catDef.emoji,
      distance,
      distanceFormatted: formatShortDistance(distance),
      cuisine: tags.cuisine || null,
      phone: tags.phone || tags['contact:phone'] || null,
      website: tags.website || tags['contact:website'] || null,
      openingHours: tags.opening_hours || null,
      address: formatAddress(tags),
    });
  }

  // Sort by distance from midpoint
  places.sort((a, b) => a.distance - b.distance);

  return places;
}

/**
 * Classify a place into one of our categories
 */
function classifyPlace(tags, requestedCategories) {
  for (const cat of requestedCategories) {
    const catDef = CATEGORIES[cat];
    if (!catDef) continue;

    for (const [key, value] of catDef.tags) {
      if (tags[key] === value) {
        return cat;
      }
    }
  }
  return null;
}

/**
 * Format address from OSM tags
 */
function formatAddress(tags) {
  const parts = [];
  if (tags['addr:housenumber'] && tags['addr:street']) {
    parts.push(`${tags['addr:housenumber']} ${tags['addr:street']}`);
  } else if (tags['addr:street']) {
    parts.push(tags['addr:street']);
  }
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:state']) parts.push(tags['addr:state']);
  return parts.join(', ') || null;
}
