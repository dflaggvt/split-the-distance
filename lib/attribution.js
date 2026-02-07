/**
 * Attribution detection and classification.
 * Determines where a visitor came from based on share IDs, UTM params, and referrer.
 */

// Known search engines
const SEARCH_ENGINES = [
  'google', 'bing', 'duckduckgo', 'yahoo', 'baidu', 'yandex',
  'ecosia', 'brave', 'startpage', 'searx'
];

// Known social platforms
const SOCIAL_PLATFORMS = [
  { domain: 'twitter.com', name: 'twitter' },
  { domain: 't.co', name: 'twitter' },
  { domain: 'x.com', name: 'twitter' },
  { domain: 'facebook.com', name: 'facebook' },
  { domain: 'fb.com', name: 'facebook' },
  { domain: 'fb.me', name: 'facebook' },
  { domain: 'l.facebook.com', name: 'facebook' },
  { domain: 'lm.facebook.com', name: 'facebook' },
  { domain: 'instagram.com', name: 'instagram' },
  { domain: 'l.instagram.com', name: 'instagram' },
  { domain: 'linkedin.com', name: 'linkedin' },
  { domain: 'lnkd.in', name: 'linkedin' },
  { domain: 'reddit.com', name: 'reddit' },
  { domain: 'old.reddit.com', name: 'reddit' },
  { domain: 'tiktok.com', name: 'tiktok' },
  { domain: 'pinterest.com', name: 'pinterest' },
  { domain: 'pin.it', name: 'pinterest' },
  { domain: 'threads.net', name: 'threads' },
  { domain: 'bsky.app', name: 'bluesky' },
  { domain: 'mastodon.social', name: 'mastodon' },
  { domain: 'youtube.com', name: 'youtube' },
  { domain: 'youtu.be', name: 'youtube' },
];

// UTM medium to source type mapping
const UTM_MEDIUM_MAP = {
  'cpc': 'paid',
  'ppc': 'paid',
  'paid': 'paid',
  'paid-social': 'paid',
  'display': 'paid',
  'email': 'email',
  'social': 'social',
  'organic': 'organic',
  'referral': 'referral',
};

/**
 * Parse UTM parameters from URL search params.
 */
export function parseUTM(searchParams) {
  return {
    utm_source: searchParams.get('utm_source') || null,
    utm_medium: searchParams.get('utm_medium') || null,
    utm_campaign: searchParams.get('utm_campaign') || null,
    utm_content: searchParams.get('utm_content') || null,
    utm_term: searchParams.get('utm_term') || null,
  };
}

/**
 * Check if any UTM params are present.
 */
export function hasUTM(utm) {
  return !!(utm.utm_source || utm.utm_medium || utm.utm_campaign);
}

/**
 * Determine source type from UTM medium.
 */
export function sourceFromUTM(utm) {
  if (!utm.utm_medium) return 'referral';
  return UTM_MEDIUM_MAP[utm.utm_medium.toLowerCase()] || 'referral';
}

/**
 * Classify a referrer URL into source type and detail.
 */
export function classifyReferrer(referrerUrl) {
  if (!referrerUrl) return { source: 'direct', detail: null };

  let domain;
  try {
    domain = new URL(referrerUrl).hostname.replace(/^www\./, '');
  } catch {
    return { source: 'direct', detail: null };
  }

  // Check search engines
  for (const engine of SEARCH_ENGINES) {
    if (domain.includes(engine)) {
      return { source: 'organic', detail: engine };
    }
  }

  // Check social platforms
  for (const platform of SOCIAL_PLATFORMS) {
    if (domain === platform.domain || domain.endsWith('.' + platform.domain)) {
      return { source: 'social', detail: platform.name };
    }
  }

  // Everything else is a referral
  return { source: 'referral', detail: domain };
}

/**
 * Master attribution detection.
 * Priority: share ID → UTM → referrer → direct
 * 
 * Returns: { source, sourceDetail, utm, referrer, referrerDomain, landingPage }
 */
export function detectAttribution() {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const referrer = document.referrer || null;
  const shareId = params.get('s') || null;
  const utm = parseUTM(params);

  let source, sourceDetail;

  if (shareId) {
    // Priority 1: Shared link
    source = 'share';
    sourceDetail = shareId;
  } else if (hasUTM(utm)) {
    // Priority 2: UTM params
    source = sourceFromUTM(utm);
    sourceDetail = utm.utm_source || null;
  } else {
    // Priority 3: Referrer classification
    const classified = classifyReferrer(referrer);
    source = classified.source;
    sourceDetail = classified.detail;
  }

  // Extract referrer domain
  let referrerDomain = null;
  if (referrer) {
    try {
      referrerDomain = new URL(referrer).hostname.replace(/^www\./, '');
    } catch {}
  }

  return {
    source,
    sourceDetail,
    shareId,
    utm,
    referrer,
    referrerDomain,
    landingPage: window.location.pathname,
  };
}

/**
 * Generate a short unique share ID (6 chars, alphanumeric).
 * 62^6 = ~56 billion possible IDs.
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';

export function generateShareId(length = 6) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  let id = '';
  for (let i = 0; i < length; i++) {
    id += ALPHABET[array[i] % ALPHABET.length];
  }
  return id;
}

/**
 * Truncate coordinate to 4 decimal places (~11m precision).
 */
export function truncateCoord(n) {
  return Math.round(n * 10000) / 10000;
}

/**
 * Build a share URL with share ID and route coordinates.
 */
export function buildShareUrl(shareId, fromLat, fromLng, toLat, toLng) {
  const url = new URL(window.location.origin);
  url.searchParams.set('s', shareId);
  url.searchParams.set('from', `${truncateCoord(fromLat)},${truncateCoord(fromLng)}`);
  url.searchParams.set('to', `${truncateCoord(toLat)},${truncateCoord(toLng)}`);
  return url.toString();
}

/**
 * Clean attribution params from URL bar after capture.
 * Removes ?s=, utm_*, etc. without triggering navigation.
 */
export function cleanUrlParams() {
  if (typeof window === 'undefined') return;
  
  const url = new URL(window.location.href);
  const paramsToRemove = ['s', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];
  let changed = false;
  
  for (const param of paramsToRemove) {
    if (url.searchParams.has(param)) {
      url.searchParams.delete(param);
      changed = true;
    }
  }
  
  if (changed) {
    const cleanUrl = url.searchParams.toString() 
      ? `${url.pathname}?${url.searchParams.toString()}` 
      : url.pathname;
    window.history.replaceState({}, '', cleanUrl);
  }
}
