/**
 * features.js — Feature flag system with tier-based access control and lifecycle status
 * 
 * Each feature has:
 *   - tier: anonymous | free | premium | enterprise (who can access)
 *   - status: hidden | coming_soon | live (lifecycle stage)
 *   - enabled: boolean (kill switch)
 * 
 * Flags are fetched from Supabase and cached in memory with 1-min TTL.
 * DEFAULT_FEATURES serve as fallback if Supabase is unreachable.
 */

import { supabase } from './supabase';

// Tier hierarchy: anonymous (0) < free (1) < premium (2) < enterprise (3)
export const TIER_LEVELS = {
  anonymous: 0,
  free: 1,
  premium: 2,
  enterprise: 3,
};

export const TIER_LABELS = {
  anonymous: 'Free',
  free: 'Free',
  premium: 'Premium',
  enterprise: 'Enterprise',
};

export const TIER_COLORS = {
  anonymous: 'text-gray-600 bg-gray-100',
  free: 'text-emerald-700 bg-emerald-100',
  premium: 'text-purple-700 bg-purple-100',
  enterprise: 'text-blue-700 bg-blue-100',
};

export const STATUS_LABELS = {
  hidden: 'Hidden',
  coming_soon: 'Coming Soon',
  live: 'Live',
};

export const STATUS_COLORS = {
  hidden: 'text-gray-500 bg-gray-100',
  coming_soon: 'text-amber-700 bg-amber-100',
  live: 'text-emerald-700 bg-emerald-100',
};

// Hardcoded defaults — fallback if Supabase is unreachable
export const DEFAULT_FEATURES = {
  // Anonymous, LIVE — no login needed, already built
  basic_search:       { tier: 'anonymous', status: 'live',        label: 'Basic Search',        description: 'Search for midpoint between two locations',           emoji: '📍', enabled: true, sort_order: 1 },
  alternative_routes: { tier: 'anonymous', status: 'live',        label: 'Route Options',       description: 'View and select alternative routes',                  emoji: '🔀', enabled: true, sort_order: 2 },
  category_filters:   { tier: 'anonymous', status: 'live',        label: 'Place Categories',    description: 'Browse nearby Food, Coffee, Parks, and more',         emoji: '🗂️', enabled: true, sort_order: 3 },
  share:              { tier: 'anonymous', status: 'live',        label: 'Share Routes',        description: 'Share your split via link',                           emoji: '🔗', enabled: true, sort_order: 4 },
  travel_modes:       { tier: 'anonymous', status: 'live',        label: 'Travel Modes',        description: 'Switch between Drive, Bike, and Walk',                emoji: '🚗', enabled: true, sort_order: 5 },

  // Free, LIVE — login required, already built
  local_only:         { tier: 'free',      status: 'live',        label: 'Local Only',          description: 'Filter out chain restaurants and brands',             emoji: '⭐', enabled: true, sort_order: 10 },

  // Free, COMING SOON — login required, not yet built
  group_gravity_3:    { tier: 'free',      status: 'coming_soon', label: 'Group (3 People)',    description: 'Find the fairest meeting point for 3 friends',        emoji: '👥', enabled: true, sort_order: 11 },
  roulette:           { tier: 'anonymous', status: 'live',        label: 'Midpoint Roulette',   description: 'Feeling adventurous? Let us pick a random spot',      emoji: '🎲', enabled: true, sort_order: 12 },
  fair_swap_zones:    { tier: 'free',      status: 'coming_soon', label: 'Fair Swap Zones',     description: 'Safe public meeting spots for marketplace trades',    emoji: '🤝', enabled: true, sort_order: 13 },

  // Premium, COMING SOON — subscription required, not yet built
  drift_radius:       { tier: 'premium',   status: 'coming_soon', label: 'Drift Radius',        description: 'See a fairness zone instead of a single point',      emoji: '🎯', enabled: true, sort_order: 20 },
  group_gravity_4plus:{ tier: 'premium',   status: 'coming_soon', label: 'Group (4+ People)',   description: 'Optimal meeting point for 4-10 people',               emoji: '👥', enabled: true, sort_order: 21 },
  commute_equalizer:  { tier: 'premium',   status: 'coming_soon', label: 'Commute Equalizer',   description: 'Find neighborhoods where both commutes are balanced', emoji: '🏠', enabled: true, sort_order: 22 },
  date_night:         { tier: 'premium',   status: 'coming_soon', label: 'Date Night',          description: 'Multi-stop evening itineraries at your midpoint',     emoji: '🌙', enabled: true, sort_order: 23 },
  recurring_midpoints:{ tier: 'premium',   status: 'coming_soon', label: 'Recurring Midpoints', description: 'Save a pair and get fresh suggestions every week',    emoji: '🔄', enabled: true, sort_order: 24 },
  roulette_unlimited: { tier: 'premium',   status: 'live',        label: 'Unlimited Roulette',  description: 'Unlimited random place picks with re-rolls',         emoji: '🎰', enabled: true, sort_order: 25 },
};

// ---- In-memory cache ----
let cachedFeatures = null;
let cacheTimestamp = 0;
const CACHE_TTL = 60 * 1000; // 1 minute — keeps flags responsive to dashboard changes

/**
 * Fetch feature flags from Supabase, merge with defaults, cache result.
 * Returns a map of { key: featureObject }
 */
export async function fetchFeatureFlags(forceRefresh = false) {
  // Return cache if fresh
  if (!forceRefresh && cachedFeatures && (Date.now() - cacheTimestamp < CACHE_TTL)) {
    return cachedFeatures;
  }

  // If no Supabase client, use defaults
  if (!supabase) {
    console.warn('[Features] No Supabase client — using defaults');
    cachedFeatures = { ...DEFAULT_FEATURES };
    cacheTimestamp = Date.now();
    return cachedFeatures;
  }

  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('*')
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('[Features] Supabase fetch error:', error);
      // Fall back to defaults
      cachedFeatures = { ...DEFAULT_FEATURES };
      cacheTimestamp = Date.now();
      return cachedFeatures;
    }

    // Merge Supabase data with defaults (Supabase takes precedence)
    const merged = { ...DEFAULT_FEATURES };
    for (const row of data) {
      merged[row.key] = {
        tier: row.tier,
        status: row.status,
        label: row.label,
        description: row.description || '',
        emoji: row.emoji || '',
        enabled: row.enabled,
        sort_order: row.sort_order || 0,
      };
    }

    cachedFeatures = merged;
    cacheTimestamp = Date.now();
    return merged;
  } catch (err) {
    console.error('[Features] Fetch failed:', err);
    cachedFeatures = { ...DEFAULT_FEATURES };
    cacheTimestamp = Date.now();
    return cachedFeatures;
  }
}

/**
 * Get features with coming_soon status, sorted by sort_order.
 */
export function getComingSoonFeatures(features) {
  return Object.entries(features)
    .filter(([, f]) => f.status === 'coming_soon' && f.enabled)
    .sort(([, a], [, b]) => (a.sort_order || 0) - (b.sort_order || 0))
    .map(([key, f]) => ({ key, ...f }));
}

/**
 * Get features grouped by tier (for PricingModal).
 */
export function getFeaturesByTier(features) {
  const groups = { anonymous: [], free: [], premium: [], enterprise: [] };
  for (const [key, f] of Object.entries(features)) {
    if (!f.enabled) continue;
    if (f.status === 'hidden') continue;
    if (groups[f.tier]) {
      groups[f.tier].push({ key, ...f });
    }
  }
  // Sort each group by sort_order
  for (const tier of Object.keys(groups)) {
    groups[tier].sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0));
  }
  return groups;
}

/**
 * Check if a user's plan level meets or exceeds a feature's tier requirement.
 */
export function checkAccess(feature, userState) {
  if (!feature.enabled) return 'disabled';
  if (feature.status === 'hidden') return 'hidden';
  if (feature.status === 'coming_soon') return 'coming_soon';
  // status === 'live' — check tier access
  if (feature.tier === 'anonymous') return 'allowed';
  if (!userState.isLoggedIn) return 'login_required';
  if (TIER_LEVELS[userState.plan || 'free'] >= TIER_LEVELS[feature.tier]) return 'allowed';
  return 'upgrade_required';
}

/**
 * Submit a Notify Me signup for a coming_soon feature.
 */
export async function submitWaitlistSignup(featureKey, email, userId = null) {
  if (!supabase) return { success: false, error: 'No database connection' };

  try {
    const { error } = await supabase
      .from('feature_waitlist')
      .upsert(
        { feature_key: featureKey, email, user_id: userId },
        { onConflict: 'feature_key,email' }
      );

    if (error) {
      console.error('[Waitlist] Signup error:', error);
      return { success: false, error: error.message };
    }
    return { success: true };
  } catch (err) {
    console.error('[Waitlist] Signup failed:', err);
    return { success: false, error: err.message };
  }
}

/**
 * Check if an email is already on the waitlist for a feature.
 */
export async function checkWaitlistStatus(featureKey, email) {
  if (!supabase || !email) return false;

  try {
    const { data, error } = await supabase
      .from('feature_waitlist')
      .select('id')
      .eq('feature_key', featureKey)
      .eq('email', email)
      .limit(1);

    if (error) return false;
    return data && data.length > 0;
  } catch {
    return false;
  }
}
