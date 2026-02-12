/**
 * geocoding.js — Google Geocoder fallback
 *
 * Primary geocoding uses Google Places Autocomplete in LocationInput.
 * This module is a fallback for when the user types and presses Enter
 * without selecting from autocomplete, or for URL-parameter auto-splits.
 */

const MAX_RESULTS = 5;

/**
 * Reverse geocode a lat/lng to a city/state label.
 * Returns a short string like "Trenton, NJ" or null on failure.
 * @param {number} lat
 * @param {number} lng
 * @returns {Promise<string|null>}
 */
export async function reverseGeocode(lat, lng) {
  if (typeof google === 'undefined' || !google.maps) return null;

  return new Promise((resolve) => {
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode(
      { location: { lat, lng } },
      (results, status) => {
        if (status !== google.maps.GeocoderStatus.OK || !results?.length) {
          resolve(null);
          return;
        }

        // Walk through results looking for the best locality match
        for (const result of results) {
          const types = result.types || [];
          if (types.includes('locality') || types.includes('sublocality')) {
            // Extract city and state from address_components
            const components = result.address_components || [];
            const city = components.find(c =>
              c.types.includes('locality') || c.types.includes('sublocality')
            );
            const state = components.find(c =>
              c.types.includes('administrative_area_level_1')
            );
            if (city) {
              resolve(state ? `${city.long_name}, ${state.short_name}` : city.long_name);
              return;
            }
          }
        }

        // Fallback: try the first result's address components
        const components = results[0].address_components || [];
        const city = components.find(c =>
          c.types.includes('locality') ||
          c.types.includes('sublocality') ||
          c.types.includes('administrative_area_level_2')
        );
        const state = components.find(c =>
          c.types.includes('administrative_area_level_1')
        );
        if (city) {
          resolve(state ? `${city.long_name}, ${state.short_name}` : city.long_name);
        } else if (state) {
          resolve(state.long_name);
        } else {
          resolve(null);
        }
      }
    );
  });
}

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
