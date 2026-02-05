/**
 * geocoding.js — Google Geocoder fallback
 *
 * Primary geocoding uses Google Places Autocomplete in LocationInput.
 * This module is a fallback for when the user types and presses Enter
 * without selecting from autocomplete, or for URL-parameter auto-splits.
 */

const MAX_RESULTS = 5;

/**
 * Search for locations matching query using Google Geocoder
 * @param {string} query
 * @returns {Promise<Array>} results with name, detail, lat, lon
 */
export async function searchLocations(query) {
  if (!query || query.trim().length < 2) {
    return [];
  }

  return new Promise((resolve, reject) => {
    const geocoder = new google.maps.Geocoder();

    geocoder.geocode({ address: query.trim() }, (results, status) => {
      if (status === google.maps.GeocoderStatus.OK && results) {
        const mapped = results.slice(0, MAX_RESULTS).map((result) => ({
          displayName: result.formatted_address,
          name: result.formatted_address,
          detail: '',
          lat: result.geometry.location.lat(),
          lon: result.geometry.location.lng(),
          placeId: result.place_id,
          type: result.types?.[0] || 'unknown',
        }));
        resolve(mapped);
      } else if (status === google.maps.GeocoderStatus.ZERO_RESULTS) {
        resolve([]);
      } else {
        reject(new Error(`Geocoding failed: ${status}`));
      }
    });
  });
}
