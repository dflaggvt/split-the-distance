/**
 * geocoding.js — Nominatim geocoding with rate limiting
 */

const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = 'SplitTheDistance/1.0';
const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;

// Rate limiting: enforce minimum 1 second between requests
let lastRequestTime = 0;

/**
 * Search for locations matching query
 * @param {string} query
 * @returns {Promise<Array>} results with name, detail, lat, lon
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < MIN_QUERY_LENGTH) {
    return [];
  }

  // Rate limit: minimum 1 second between requests
  const now = Date.now();
  const timeSince = now - lastRequestTime;
  if (timeSince < 1000) {
    await new Promise((resolve) => setTimeout(resolve, 1000 - timeSince));
  }

  const params = new URLSearchParams({
    q: query.trim(),
    format: 'json',
    limit: MAX_RESULTS,
    addressdetails: '1',
  });

  lastRequestTime = Date.now();

  const response = await fetch(`${NOMINATIM_URL}?${params}`, {
    headers: {
      'User-Agent': USER_AGENT,
    },
  });

  if (!response.ok) {
    throw new Error(`Geocoding failed: ${response.status}`);
  }

  const data = await response.json();

  return data.map((item) => ({
    displayName: item.display_name,
    name: extractName(item),
    detail: extractDetail(item),
    lat: parseFloat(item.lat),
    lon: parseFloat(item.lon),
    type: item.type,
  }));
}

/**
 * Extract a short name from a Nominatim result
 */
function extractName(item) {
  if (item.address) {
    const addr = item.address;
    if (addr.city) return addr.city + (addr.state ? `, ${addr.state}` : '');
    if (addr.town) return addr.town + (addr.state ? `, ${addr.state}` : '');
    if (addr.village)
      return addr.village + (addr.state ? `, ${addr.state}` : '');
    if (addr.county)
      return addr.county + (addr.state ? `, ${addr.state}` : '');
    if (addr.state)
      return addr.state + (addr.country ? `, ${addr.country}` : '');
  }
  // Fallback: first two parts of display name
  const parts = item.display_name.split(',');
  return parts.slice(0, 2).join(',').trim();
}

/**
 * Extract detail line from a Nominatim result
 */
function extractDetail(item) {
  const parts = item.display_name.split(',');
  if (parts.length > 2) {
    return parts.slice(2).join(',').trim();
  }
  return '';
}
