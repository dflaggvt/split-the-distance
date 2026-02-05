/**
 * utils.js — Shared utility functions
 */

/**
 * Haversine distance between two points in meters
 */
export function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours === 0) return `${minutes} min`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
}

/**
 * Format distance in meters to human-readable string (miles)
 */
export function formatDistance(meters) {
  const miles = meters / 1609.344;
  if (miles < 0.1) return `${Math.round(meters)} m`;
  if (miles < 10) return `${miles.toFixed(1)} mi`;
  return `${Math.round(miles)} mi`;
}

/**
 * Format short distance for POI display
 */
export function formatShortDistance(meters) {
  if (meters < 1000) return `${Math.round(meters)}m`;
  const mi = meters / 1609.344;
  return `${mi.toFixed(1)} mi`;
}

/**
 * Debounce a function
 */
export function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}

/**
 * Build a share URL from locations
 */
export function buildShareUrl(fromName, toName) {
  if (!fromName || !toName) return null;
  const params = new URLSearchParams({ from: fromName, to: toName });
  return `${window.location.origin}${window.location.pathname}?${params}`;
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text) {
  if (navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }

  // Fallback for older browsers
  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();
  try {
    document.execCommand('copy');
    document.body.removeChild(textarea);
    return true;
  } catch {
    document.body.removeChild(textarea);
    return false;
  }
}
