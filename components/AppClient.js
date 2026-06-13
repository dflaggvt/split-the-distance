'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useJsApiLoader } from '@react-google-maps/api';
import SearchPanel from './SearchPanel';
import HowItWorks from './HowItWorks';
import AuthButton from './AuthButton';
import SignInModal from './SignInModal';
import PricingModal from './PricingModal';
import AccountModal from './AccountModal';
import WelcomeModal from './WelcomeModal';
import { useAuth } from './AuthProvider';
import { useFeatures } from './FeatureProvider';
import { searchLocations, reverseGeocode } from '@/lib/geocoding';
import { getRoute, calculateTimeMidpoint, calculateDistanceMidpoint, getMultiLocationMidpoint, calculateStopPoints } from '@/lib/routing';
import { searchNearby } from '@/lib/places';
import { logSearch, logPlaceClick, checkInternalUser, trackEvent, getSharedRouteData } from '@/lib/analytics';
import { saveSearch } from '@/lib/searchHistory';
import { generateDriftCircle, filterPlacesInZone } from '@/lib/isochrone';
import { logUserEvent } from '@/lib/userEvents';
import { logSessionEvent } from '@/lib/sessionEvents';
import { consumeSearchCredit, fetchCreditStatus } from '@/lib/credits';

// Dynamic import for MapView — Google Maps doesn't work with SSR either
const MapView = dynamic(() => import('./MapView'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center">
      <div className="text-gray-400 text-sm">Loading map...</div>
    </div>
  ),
});

// Must be a static constant to prevent useJsApiLoader from re-loading
// Places library no longer needed — we use Places API (New) REST endpoints
const LIBRARIES = [];

/**
 * Compute midpoint from a Directions leg based on the selected mode.
 * 'time' = halfway by drive time, 'distance' = halfway by distance.
 */
function computeMidpoint(leg, mode) {
  return mode === 'distance' ? calculateDistanceMidpoint(leg) : calculateTimeMidpoint(leg);
}

export default function AppClient() {
  const searchParams = useSearchParams();
  const { refreshProfile, user, isLoggedIn, plan } = useAuth();
  const { openPricingModal, openSignIn, signInOpen } = useFeatures();

  // Load Google Maps
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES,
  });

  // ---- State ----
  const [fromValue, setFromValue] = useState('');
  const [toValue, setToValue] = useState('');
  const [fromLocation, setFromLocation] = useState(null);
  const [toLocation, setToLocation] = useState(null);
  const [route, setRoute] = useState(null);
  const [selectedRouteIndex, setSelectedRouteIndex] = useState(0);
  const [midpoint, setMidpoint] = useState(null);
  const [travelMode, setTravelMode] = useState('DRIVING'); // DRIVING | BICYCLING | WALKING
  const [midpointMode, setMidpointMode] = useState('time'); // 'time' | 'distance'
  // Extra locations for group midpoint (3-5 people). from+to are always locations 1-2.
  const [extraLocations, setExtraLocations] = useState([]); // Array of { value, location }
  const [multiResult, setMultiResult] = useState(null); // Result from getMultiLocationMidpoint
  const [places, setPlaces] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]); // Start empty - fetch on category click only
  const [localOnly, setLocalOnly] = useState(false);
  const [placesCache, setPlacesCache] = useState({}); // Cache: { category: [places] }
  const routeCacheRef = useRef({}); // Cache: { "lat,lon|lat,lon|MODE": routeData }
  const [driftRadius, setDriftRadius] = useState(null); // null | { minutes, polygon, bbox, ... }
  // Road Trip Mode state
  const [roadTripStops, setRoadTripStops] = useState(null); // null | Array<StopPoint>
  const [roadTripInterval, setRoadTripInterval] = useState(null); // { value, mode } e.g. { value: 90, mode: 'time' }
  const [activeStopIndex, setActiveStopIndex] = useState(0);
  const savedMidpointRef = useRef(null); // Stores original midpoint during road trip mode
  const [loading, setLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState(null);
  const [hasResults, setHasResults] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [toast, setToast] = useState(null);
  const [isInternal, setIsInternal] = useState(false);
  const [pendingSave, setPendingSave] = useState(null);
  const [savePlanStatus, setSavePlanStatus] = useState('idle'); // idle | saving | saved | error
  const [savePlanAuthOpened, setSavePlanAuthOpened] = useState(false);
  const [creditStatus, setCreditStatus] = useState({
    credits: 0,
    lifetimePurchased: 0,
    lifetimeUsed: 0,
    hasActiveSubscription: false,
    authenticated: false,
  });
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [creditsBannerStatus, setCreditsBannerStatus] = useState(null); // success | cancelled | null
  const [runPendingSearchAfterCredits, setRunPendingSearchAfterCredits] = useState(false);
  const hasSearchCredits = creditStatus.hasActiveSubscription || creditStatus.credits > 0;

  const toastTimer = useRef(null);
  const initialLoadDone = useRef(false);
  const cachedMidpointRef = useRef(null); // Track which midpoint the cache is for

  // ---- Welcome Modal (signup / upgrade walkthrough) ----
  const [welcomeModalType, setWelcomeModalType] = useState(null); // 'signup' | 'upgrade' | null
  const prevLoggedIn = useRef(false);

  // ---- Handle Stripe redirect (upgrade success/cancel) ----
  const [upgradeStatus, setUpgradeStatus] = useState(null); // 'success' | 'cancelled' | null

  // ---- Toast ----
  const showToast = useCallback((message) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 5000);
  }, []);

  const hideToast = useCallback(() => {
    setToast(null);
    if (toastTimer.current) clearTimeout(toastTimer.current);
  }, []);

  const refreshCredits = useCallback(async () => {
    if (!isLoggedIn) {
      setCreditStatus({
        credits: 0,
        lifetimePurchased: 0,
        lifetimeUsed: 0,
        hasActiveSubscription: false,
        authenticated: false,
      });
      setCreditsLoading(false);
      return null;
    }

    setCreditsLoading(true);
    try {
      const status = await fetchCreditStatus();
      setCreditStatus(status);
      return status;
    } catch (err) {
      console.error('[Credits] Failed to refresh:', err);
      return null;
    } finally {
      setCreditsLoading(false);
    }
  }, [isLoggedIn]);

  useEffect(() => {
    refreshCredits();
  }, [refreshCredits]);

  const storePendingSearch = useCallback(() => {
    if (typeof window === 'undefined') return;

    try {
      localStorage.setItem('std_pending_credit_search', JSON.stringify({
        fromValue,
        toValue,
        fromLocation,
        toLocation,
        extraLocations,
        travelMode,
        midpointMode,
      }));
    } catch {}
  }, [extraLocations, fromLocation, fromValue, midpointMode, toLocation, toValue, travelMode]);

  const restorePendingSearch = useCallback(() => {
    if (typeof window === 'undefined') return false;

    try {
      const raw = localStorage.getItem('std_pending_credit_search');
      if (!raw) return false;
      const pending = JSON.parse(raw);
      setFromValue(pending.fromValue || '');
      setToValue(pending.toValue || '');
      setFromLocation(pending.fromLocation || null);
      setToLocation(pending.toLocation || null);
      setExtraLocations(Array.isArray(pending.extraLocations) ? pending.extraLocations : []);
      if (pending.travelMode) setTravelMode(pending.travelMode);
      if (pending.midpointMode) setMidpointMode(pending.midpointMode);
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearPendingSearch = useCallback(() => {
    try {
      localStorage.removeItem('std_pending_credit_search');
    } catch {}
  }, []);

  // Check internal user status on mount
  useEffect(() => {
    setIsInternal(checkInternalUser());
  }, []);

  // ---- Handle Stripe redirect (upgrade success/cancel) ----
  useEffect(() => {
    const status = searchParams.get('upgrade');
    if (!status) return;

    if (status === 'success') {
      setUpgradeStatus('success');
      // Show upgrade walkthrough modal
      setWelcomeModalType('upgrade');
      // Refresh profile to pick up the new plan from DB
      refreshProfile();
      // Log upgrade event
      logSessionEvent('upgrade_completed', { plan: 'premium' }, { userId: user?.id });
      if (user?.id) {
        logUserEvent(user.id, 'upgrade_completed', { plan: 'premium' });
      }
    } else if (status === 'cancelled') {
      setUpgradeStatus('cancelled');
    }

    // Clean the URL params so reloads don't re-trigger
    const url = new URL(window.location.href);
    url.searchParams.delete('upgrade');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));

    // Auto-dismiss upgrade banner after 8 seconds (if they close the modal first)
    const dismissTimer = setTimeout(() => setUpgradeStatus(null), 8000);
    return () => clearTimeout(dismissTimer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Handle Stripe redirect (credit purchase success/cancel) ----
  useEffect(() => {
    const status = searchParams.get('credits');
    if (!status) return;

    let cancelled = false;
    const timers = [];

    const refreshCreditsAfterCheckout = async () => {
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const latest = await refreshCredits();
        if (cancelled) return;
        if (latest?.hasActiveSubscription || (latest?.credits || 0) > 0) {
          setRunPendingSearchAfterCredits(true);
          return;
        }

        await new Promise((resolve) => {
          const timer = setTimeout(resolve, 1200);
          timers.push(timer);
        });
      }

      if (!cancelled) {
        showToast('Payment received. Credits are still syncing; refresh in a moment.');
      }
    };

    if (status === 'success') {
      setCreditsBannerStatus('success');
      refreshCreditsAfterCheckout();
      logSessionEvent('credits_purchased', {}, { userId: user?.id });
    } else if (status === 'cancelled') {
      setCreditsBannerStatus('cancelled');
    }

    const url = new URL(window.location.href);
    url.searchParams.delete('credits');
    window.history.replaceState({}, '', url.pathname + (url.search || ''));

    const dismissTimer = setTimeout(() => setCreditsBannerStatus(null), 8000);
    timers.push(dismissTimer);

    return () => {
      cancelled = true;
      timers.forEach((timer) => clearTimeout(timer));
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Show signup walkthrough when user first signs in ----
  useEffect(() => {
    // Detect transition from anonymous to logged-in
    if (isLoggedIn && !prevLoggedIn.current) {
      // Only show if user hasn't seen the welcome modal before
      const hasSeenWelcome = localStorage.getItem('std_welcome_seen');
      if (!hasSeenWelcome) {
        // Small delay to let sign-in modal close first
        const timer = setTimeout(() => {
          setWelcomeModalType('signup');
          localStorage.setItem('std_welcome_seen', '1');
        }, 600);
        return () => clearTimeout(timer);
      }
    }
    prevLoggedIn.current = isLoggedIn;
  }, [isLoggedIn]);

  useEffect(() => {
    if (!isLoggedIn) return;

    try {
      if (localStorage.getItem('std_open_credits_after_signin') === '1') {
        localStorage.removeItem('std_open_credits_after_signin');
        setTimeout(() => openPricingModal(), 250);
      }
    } catch {}
  }, [isLoggedIn, openPricingModal]);

  useEffect(() => {
    if (!runPendingSearchAfterCredits || !hasSearchCredits) return;

    const restored = restorePendingSearch();
    setRunPendingSearchAfterCredits(false);

    if (!restored) {
      showToast('Credits added. Enter two locations to start planning.');
      return;
    }

    const timer = setTimeout(() => {
      document.querySelector('[data-split-btn]')?.click();
    }, 350);

    return () => clearTimeout(timer);
  }, [hasSearchCredits, restorePendingSearch, runPendingSearchAfterCredits, showToast]);

  const refreshSearchHistoryList = useCallback(() => {
    if (typeof window !== 'undefined' && window.__refreshSearchHistory) {
      window.__refreshSearchHistory();
    }
  }, []);

  const saveRoutePayload = useCallback(async (payload, source) => {
    if (!payload || !user?.id) return false;

    setSavePlanStatus('saving');
    const saved = await saveSearch({
      userId: user.id,
      ...payload,
      isUnlimited: plan === 'premium',
    });

    if (saved) {
      setSavePlanStatus('saved');
      refreshSearchHistoryList();
      logSessionEvent('save_plan_completed', { source }, { userId: user.id });
      return true;
    }

    setSavePlanStatus('error');
    logSessionEvent('save_plan_failed', { source }, { userId: user.id });
    return false;
  }, [plan, refreshSearchHistoryList, user]);

  const getCurrentRouteSavePayload = useCallback(() => {
    if (!fromLocation || !toLocation || !route) return null;

    return {
      fromName: fromLocation.name,
      fromLat: fromLocation.lat,
      fromLng: fromLocation.lon,
      toName: toLocation.name,
      toLat: toLocation.lat,
      toLng: toLocation.lon,
      travelMode,
      midpointMode,
      distanceMiles: route.totalDistance ? route.totalDistance / 1609.344 : null,
      durationSeconds: route.totalDuration || null,
    };
  }, [fromLocation, midpointMode, route, toLocation, travelMode]);

  const handleSavePlanClick = useCallback(() => {
    const payload = getCurrentRouteSavePayload();
    if (!payload) {
      showToast('Run a route first, then you can save it.');
      return;
    }

    logSessionEvent('save_plan_clicked', {
      from: payload.fromName,
      to: payload.toName,
      travelMode: payload.travelMode,
      midpointMode: payload.midpointMode,
    }, { userId: user?.id });

    if (isLoggedIn && user?.id) {
      saveRoutePayload(payload, 'manual').then((saved) => {
        if (saved) showToast('Saved. You can find it in Recent searches.');
      });
      return;
    }

    setPendingSave(payload);
    setSavePlanAuthOpened(false);
    openSignIn({ mode: 'signup', context: 'save_plan' });
  }, [getCurrentRouteSavePayload, isLoggedIn, openSignIn, saveRoutePayload, showToast, user]);

  useEffect(() => {
    if (pendingSave && signInOpen) {
      setSavePlanAuthOpened(true);
    }
  }, [pendingSave, signInOpen]);

  useEffect(() => {
    if (!pendingSave || signInOpen || isLoggedIn || !savePlanAuthOpened) return;

    logSessionEvent('save_plan_abandoned', {
      from: pendingSave.fromName,
      to: pendingSave.toName,
    }, { userId: user?.id });
    setPendingSave(null);
    setSavePlanAuthOpened(false);
  }, [isLoggedIn, pendingSave, savePlanAuthOpened, signInOpen, user]);

  useEffect(() => {
    if (!isLoggedIn || !user?.id || !pendingSave) return;

    let cancelled = false;
    const payload = pendingSave;

    async function savePendingPlan() {
      const saved = await saveRoutePayload(payload, 'post_auth');
      if (cancelled) return;

      if (saved) {
        setPendingSave(null);
        setSavePlanAuthOpened(false);
        showToast('Saved. You can find it in Recent searches.');
      } else {
        showToast('We could not save that route. Please try again.');
      }
    }

    savePendingPlan();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, pendingSave, saveRoutePayload, showToast, user]);

  // ---- Fetch places with client-side caching ----
  const fetchPlaces = useCallback(
    async (mp, filters, currentCache = {}) => {
      if (!mp) return [];
      const cats = filters || activeFilters;

      if (cats.length === 0) {
        setPlaces([]);
        return [];
      }

      // Check if midpoint changed - if so, clear cache
      const mpKey = `${mp.lat.toFixed(4)},${mp.lon.toFixed(4)}`;
      if (cachedMidpointRef.current !== mpKey) {
        console.log('[Cache CLEAR] New midpoint:', mpKey);
        cachedMidpointRef.current = mpKey;
        currentCache = {};
        setPlacesCache({});
      }

      // Separate categories into cached and uncached
      const cachedCats = cats.filter(cat => currentCache[cat]);
      const uncachedCats = cats.filter(cat => !currentCache[cat]);

      // If all categories are cached, just combine and return
      if (uncachedCats.length === 0) {
        console.log('[Cache HIT] All categories cached:', cats);
        const allPlaces = cats.flatMap(cat => currentCache[cat] || []);
        // Sort by distance
        allPlaces.sort((a, b) => a.distance - b.distance);
        setPlaces(allPlaces);
        logSessionEvent('places_loaded', {
          categories: cats,
          count: allPlaces.length,
          cacheStatus: 'hit',
        }, { userId: user?.id });
        return allPlaces;
      }
      
      // Log what we're fetching vs using from cache
      if (cachedCats.length > 0) {
        console.log('[Cache PARTIAL] Using cached:', cachedCats, '| Fetching:', uncachedCats);
      } else {
        console.log('[Cache MISS] Fetching:', uncachedCats);
      }

      // Fetch only uncached categories
      setPlacesLoading(true);
      try {
        const newResults = await searchNearby(mp, uncachedCats);
        
        // Group results by category and update cache
        const newCache = { ...currentCache };
        uncachedCats.forEach(cat => {
          newCache[cat] = newResults.filter(p => p.category === cat);
        });
        setPlacesCache(newCache);

        // Combine cached + new results
        const allPlaces = cats.flatMap(cat => newCache[cat] || []);
        allPlaces.sort((a, b) => a.distance - b.distance);
        setPlaces(allPlaces);
        logSessionEvent('places_loaded', {
          categories: cats,
          fetchedCategories: uncachedCats,
          cachedCategories: cachedCats,
          count: allPlaces.length,
          cacheStatus: cachedCats.length > 0 ? 'partial' : 'miss',
        }, { userId: user?.id });
        return allPlaces;
      } catch (err) {
        console.error('POI search error:', err);
        logSessionEvent('places_load_failed', {
          categories: cats,
          error: err.message,
        }, { userId: user?.id });
        setPlaces([]);
        return [];
      } finally {
        setPlacesLoading(false);
      }
    },
    [activeFilters]
  );

  const finalizeSearchCreditUse = useCallback(async (metadata) => {
    try {
      const result = await consumeSearchCredit(metadata);

      if (!result.allowed) {
        logSessionEvent('search_credit_debit_failed', {
          reason: result.reason,
          ...metadata,
        }, { userId: user?.id });
        openPricingModal();
        return false;
      }

      setCreditStatus((prev) => ({
        ...prev,
        credits: result.credits,
        hasActiveSubscription: result.grandfathered || prev.hasActiveSubscription,
        authenticated: true,
      }));

      logSessionEvent('search_credit_used', {
        reason: result.reason,
        creditsRemaining: result.credits,
        grandfathered: result.grandfathered,
        ...metadata,
      }, { userId: user?.id });
      return true;
    } catch (err) {
      console.error('[Credits] Debit failed:', err);
      logSessionEvent('search_credit_debit_failed', {
        error: err.message,
        ...metadata,
      }, { userId: user?.id });
      return false;
    }
  }, [openPricingModal, user]);

  // ---- Handle split ----
  const handleSplit = useCallback(async () => {
    if (loading) return;

    const fromVal = fromValue.trim();
    const toVal = toValue.trim();

    if (!fromVal || !toVal) {
      showToast('Please enter both a starting location and destination.');
      return;
    }

    // Check extra locations all have values
    const validExtras = extraLocations.filter(el => el.value.trim());
    const isMulti = validExtras.length > 0;

    let currentCreditStatus = creditStatus;
    if (isLoggedIn && !hasSearchCredits) {
      currentCreditStatus = await refreshCredits() || creditStatus;
    }

    const canRunSearch =
      currentCreditStatus?.hasActiveSubscription || (currentCreditStatus?.credits || 0) > 0;

    if (!canRunSearch) {
      storePendingSearch();
      logSessionEvent('search_blocked_no_credits', {
        from: fromVal,
        to: toVal,
        locationCount: 2 + validExtras.length,
        travelMode,
        midpointMode,
        isLoggedIn,
      }, { userId: user?.id });

      if (!isLoggedIn) {
        try {
          localStorage.setItem('std_open_credits_after_signin', '1');
        } catch {}
        openSignIn({ mode: 'signup', context: 'search_credits' });
      } else {
        openPricingModal();
      }
      return;
    }

    // Clear route cache and road trip state for new search
    routeCacheRef.current = {};
    setDriftRadius(null);
    setRoadTripStops(null);
    setRoadTripInterval(null);
    savedMidpointRef.current = null;
    setPendingSave(null);
    setSavePlanAuthOpened(false);
    setSavePlanStatus('idle');

    // Track search button click
    trackEvent('search_clicked', {
      from_input: fromVal,
      to_input: toVal,
      location_count: 2 + validExtras.length,
    });
    logSessionEvent('search_clicked', {
      from: fromVal,
      to: toVal,
      locationCount: 2 + validExtras.length,
      travelMode,
      midpointMode,
      isMulti,
    }, { userId: user?.id });

    setLoading(true);
    setMultiResult(null);

    try {
      // Geocode from/to if needed
      let from = fromLocation;
      let to = toLocation;

      if (!from) {
        const results = await searchLocations(fromVal);
        if (results.length === 0) {
          throw new Error(
            `Could not find location: "${fromVal}". Try being more specific.`
          );
        }
        from = results[0];
        setFromLocation(from);
        setFromValue(from.name);
      }

      if (!to) {
        const results = await searchLocations(toVal);
        if (results.length === 0) {
          throw new Error(
            `Could not find location: "${toVal}". Try being more specific.`
          );
        }
        to = results[0];
        setToLocation(to);
        setToValue(to.name);
      }

      // Geocode extra locations if needed
      const resolvedExtras = [];
      if (isMulti) {
        for (let i = 0; i < validExtras.length; i++) {
          const el = validExtras[i];
          if (el.location) {
            resolvedExtras.push(el.location);
          } else {
            const results = await searchLocations(el.value.trim());
            if (results.length === 0) {
              throw new Error(
                `Could not find location: "${el.value.trim()}". Try being more specific.`
              );
            }
            resolvedExtras.push(results[0]);
            // Update the extra location with resolved data
            setExtraLocations(prev => prev.map((item, idx) =>
              idx === i ? { ...item, location: results[0], value: results[0].name } : item
            ));
          }
        }
      }

      if (isMulti) {
        // ---- MULTI-LOCATION PATH (3-5 people) ----
        const allLocations = [
          { lat: from.lat, lon: from.lon, name: from.name },
          { lat: to.lat, lon: to.lon, name: to.name },
          ...resolvedExtras.map(loc => ({ lat: loc.lat, lon: loc.lon, name: loc.name })),
        ];

        const result = await getMultiLocationMidpoint(allLocations, { mode: midpointMode, travelMode });

        // Fetch individual routes from each person to the midpoint (for map polylines)
        const midDest = { lat: result.midpoint.lat, lon: result.midpoint.lon || result.midpoint.lng, name: 'Meeting Point' };
        const routePromises = allLocations.map(loc => 
          getRoute(loc, midDest, travelMode).catch(err => {
            console.warn(`Route to midpoint failed for ${loc.name}:`, err);
            return null;
          })
        );
        const personRoutes = await Promise.all(routePromises);
        result.personRoutes = personRoutes; // Attach to multiResult

        setMultiResult(result);
        setMidpoint(result.midpoint);
        setRoute(null); // No single route for multi-location
        setHasResults(true);
        setPlaces([]);

        // Update URL
        const params = new URLSearchParams({
          from: from.name,
          to: to.name,
        });
        allLocations.slice(2).forEach((loc, i) => {
          params.set(`loc${i + 3}`, loc.name);
        });
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);

        // Analytics
        logSearch({
          fromName: from.name,
          fromLat: from.lat,
          fromLng: from.lon,
          toName: to.name,
          toLat: to.lat,
          toLng: to.lon,
          midpointLat: result.midpoint.lat,
          midpointLng: result.midpoint.lon || result.midpoint.lng,
          distanceMiles: null,
          durationSeconds: result.maxDrive,
          activeFilters: [],
          placesFound: 0,
        });
        logSessionEvent('search_completed', {
          from: from.name,
          to: to.name,
          locationCount: allLocations.length,
          travelMode,
          midpointMode,
          resultType: 'group',
          maxDriveSeconds: result.maxDrive,
          driveTimeSpreadSeconds: result.maxDrive && result.minDrive ? result.maxDrive - result.minDrive : null,
          midpointLat: result.midpoint.lat,
          midpointLng: result.midpoint.lon || result.midpoint.lng,
        }, { userId: user?.id });

        await finalizeSearchCreditUse({
          from: from.name,
          to: to.name,
          locationCount: allLocations.length,
          travelMode,
          midpointMode,
          resultType: 'group',
        });
        clearPendingSearch();
      } else {
        // ---- STANDARD 2-LOCATION PATH ----
        const cacheKey = `${from.lat},${from.lon}|${to.lat},${to.lon}|${travelMode}`;
        let routeData;
        if (routeCacheRef.current[cacheKey]) {
          routeData = routeCacheRef.current[cacheKey];
        } else {
          routeData = await getRoute(from, to, travelMode);
          routeCacheRef.current[cacheKey] = routeData;
        }
        setRoute(routeData);
        setMultiResult(null);
        const mp = computeMidpoint(routeData.allRoutes[0].leg, midpointMode);
        setMidpoint(mp);
        setHasResults(true);

        // Update URL
        const params = new URLSearchParams({
          from: fromValue.trim() || from.name,
          to: toValue.trim() || to.name,
        });
        window.history.replaceState({}, '', `${window.location.pathname}?${params}`);

        setPlaces([]);

        // Fire-and-forget analytics
        logSearch({
          fromName: from.name,
          fromLat: from.lat,
          fromLng: from.lon,
          toName: to.name,
          toLat: to.lat,
          toLng: to.lon,
          midpointLat: mp.lat,
          midpointLng: mp.lon,
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          activeFilters: [],
          placesFound: 0,
        });
        logSessionEvent('search_completed', {
          from: from.name,
          to: to.name,
          locationCount: 2,
          travelMode,
          midpointMode,
          resultType: 'standard',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          midpointLat: mp.lat,
          midpointLng: mp.lon,
          routeOptions: routeData.allRoutes?.length || 1,
        }, { userId: user?.id });

        // Log user event for per-user analytics
        if (user?.id) {
          logUserEvent(user.id, 'search', {
            from: from.name,
            to: to.name,
            distanceMiles: Math.round(routeData.totalDistance / 1609.344),
            durationMin: Math.round(routeData.totalDuration / 60),
            travelMode,
            midpointMode,
            locationCount: isMulti ? 2 + validExtras.length : 2,
          });
        }

        // Auto-save to search history for logged-in users
        if (isLoggedIn && user?.id) {
          saveRoutePayload({
            fromName: from.name,
            fromLat: from.lat,
            fromLng: from.lon,
            toName: to.name,
            toLat: to.lat,
            toLng: to.lon,
            travelMode,
            midpointMode,
            distanceMiles: routeData.totalDistance / 1609.344,
            durationSeconds: routeData.totalDuration,
          }, 'auto').catch(err => {
            console.warn('[SearchHistory] Save failed:', err);
            setSavePlanStatus('error');
          });
        }

        await finalizeSearchCreditUse({
          from: from.name,
          to: to.name,
          locationCount: 2,
          travelMode,
          midpointMode,
          resultType: 'standard',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
        });
        clearPendingSearch();
      }
    } catch (err) {
      console.error('Split error:', err);
      logSessionEvent('search_failed', {
        from: fromVal,
        to: toVal,
        locationCount: 2 + validExtras.length,
        travelMode,
        midpointMode,
        error: err.message,
      }, { userId: user?.id });
      showToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    fromValue,
    toValue,
    fromLocation,
    toLocation,
    extraLocations,
    loading,
    showToast,
    fetchPlaces,
    activeFilters,
    travelMode,
    midpointMode,
    isLoggedIn,
    user,
    saveRoutePayload,
    creditStatus,
    hasSearchCredits,
    refreshCredits,
    storePendingSearch,
    openSignIn,
    openPricingModal,
    finalizeSearchCreditUse,
    clearPendingSearch,
  ]);

  // ---- Handle re-split from search history ----
  const handleResplit = useCallback((entry) => {
    // Populate inputs with the saved route
    setFromValue(entry.fromName);
    setToValue(entry.toName);
    setFromLocation({ name: entry.fromName, lat: entry.fromLat, lon: entry.fromLng });
    setToLocation({ name: entry.toName, lat: entry.toLat, lon: entry.toLng });
    if (entry.travelMode) setTravelMode(entry.travelMode);
    if (entry.midpointMode) setMidpointMode(entry.midpointMode);
    // Per-user event
    if (user?.id) {
      logUserEvent(user.id, 'search_history_resplit', {
        from: entry.fromName,
        to: entry.toName,
      });
    }
    logSessionEvent('search_history_resplit', {
      from: entry.fromName,
      to: entry.toName,
      travelMode: entry.travelMode,
      midpointMode: entry.midpointMode,
    }, { userId: user?.id });
    // Trigger the split on next tick (after state updates)
    setTimeout(() => {
      const splitBtn = document.querySelector('[data-split-btn]');
      if (splitBtn) splitBtn.click();
    }, 100);
  }, [user]);

  // ---- Handle drift radius toggle ----
  const handleDriftRadiusChange = useCallback((minutes) => {
    // Toggle off if same minutes clicked again, or null passed
    if (!minutes || (driftRadius?.minutes === minutes)) {
      setDriftRadius(null);
      return;
    }

    if (!midpoint) return;

    // Pure client-side computation — no API call needed
    const result = generateDriftCircle(midpoint, { minutes, travelMode });
    setDriftRadius(result);
    logSessionEvent('drift_radius_toggled', { minutes, travelMode, enabled: true }, { userId: user?.id });
    // Per-user event
    if (user?.id) {
      logUserEvent(user.id, 'drift_radius_toggled', { minutes, travelMode });
    }
  }, [midpoint, travelMode, driftRadius, user]);

  // ---- Handle road trip activation ----
  const handleActivateRoadTrip = useCallback(async (interval) => {
    if (!route) return;

    const leg = route.allRoutes?.[selectedRouteIndex]?.leg;
    if (!leg) return;

    const stops = calculateStopPoints(leg, { interval: interval.value, mode: interval.mode });
    if (stops.length === 0) {
      showToast('This route is too short for stops at that interval.');
      return;
    }

    // Reverse geocode each stop for a city label (fire in parallel)
    const labelPromises = stops.map(stop =>
      reverseGeocode(stop.lat, stop.lon).catch(() => null)
    );
    const labels = await Promise.all(labelPromises);
    const stopsWithLabels = stops.map((stop, i) => ({
      ...stop,
      label: labels[i] || `Stop ${stop.index}`,
    }));

    // Save the original midpoint so we can restore on exit
    savedMidpointRef.current = midpoint;

    setRoadTripStops(stopsWithLabels);
    setRoadTripInterval(interval);
    setActiveStopIndex(0);

    // Set midpoint to first stop so the standard places pipeline works
    const firstStop = stopsWithLabels[0];
    setMidpoint({ lat: firstStop.lat, lon: firstStop.lon });
    setPlaces([]);
    setPlacesCache({});
    setActiveFilters([]);

    trackEvent('road_trip_activated', {
      interval_value: interval.value,
      interval_mode: interval.mode,
      stop_count: stopsWithLabels.length,
      route_duration: route.totalDuration,
      route_distance: route.totalDistance,
    });
    logSessionEvent('road_trip_activated', {
      intervalValue: interval.value,
      intervalMode: interval.mode,
      stopCount: stopsWithLabels.length,
      routeDurationSeconds: route.totalDuration,
      routeDistanceMeters: route.totalDistance,
    }, { userId: user?.id });
    // Per-user event
    if (user?.id) {
      logUserEvent(user.id, 'road_trip_activated', {
        intervalValue: interval.value,
        intervalMode: interval.mode,
        stopCount: stopsWithLabels.length,
      });
    }
  }, [route, selectedRouteIndex, showToast, midpoint, user]);

  const handleExitRoadTrip = useCallback(() => {
    logSessionEvent('road_trip_exited', {
      stopCount: roadTripStops?.length || 0,
      intervalValue: roadTripInterval?.value || null,
      intervalMode: roadTripInterval?.mode || null,
    }, { userId: user?.id });
    setRoadTripStops(null);
    setRoadTripInterval(null);
    setActiveStopIndex(0);

    // Restore original midpoint and clear road trip places
    if (savedMidpointRef.current) {
      setMidpoint(savedMidpointRef.current);
      savedMidpointRef.current = null;
    }
    setPlaces([]);
    setPlacesCache({});
    setActiveFilters([]);
  }, [roadTripStops, roadTripInterval, user]);

  // ---- Handle road trip stop selection ----
  const handleActiveStopChange = useCallback((idx) => {
    // Start/End pills are special: -1 = start, -2 = end (informational only)
    if (idx < 0) return;
    if (!roadTripStops?.[idx]) return;
    setActiveStopIndex(idx);

    // Move the midpoint to this stop so the standard fetchPlaces pipeline picks it up
    const stop = roadTripStops[idx];
    setMidpoint({ lat: stop.lat, lon: stop.lon });
    setPlaces([]);
    setPlacesCache({});
    setActiveFilters([]);
    logSessionEvent('road_trip_stop_selected', {
      stopIndex: idx,
      label: stop.label,
      distanceFromStart: stop.distanceFromStart,
      timeFromStart: stop.timeFromStart,
    }, { userId: user?.id });
    // Per-user event
    if (user?.id) {
      logUserEvent(user.id, 'road_trip_stop_selected', { stopIndex: idx, label: stop.label });
    }
  }, [roadTripStops, user]);

  // ---- Handle swap ----
  // ---- Tracked travel mode change ----
  const handleTravelModeChange = useCallback((mode) => {
    setTravelMode(mode);
    logSessionEvent('travel_mode_changed', { mode }, { userId: user?.id });
    if (user?.id) {
      logUserEvent(user.id, 'travel_mode_changed', { mode });
    }
  }, [user]);

  // ---- Tracked midpoint mode change ----
  const handleMidpointModeChange = useCallback((mode) => {
    setMidpointMode(mode);
    logSessionEvent('midpoint_mode_changed', { mode }, { userId: user?.id });
    if (user?.id) {
      logUserEvent(user.id, 'midpoint_mode_changed', { mode });
    }
  }, [user]);

  // ---- Tracked extra locations change ----
  const handleExtraLocationsChange = useCallback((newExtras) => {
    // Detect if a location was added (array grew)
    if (newExtras.length > extraLocations.length && user?.id) {
      logUserEvent(user.id, 'group_location_added', { totalPeople: 2 + newExtras.length });
    }
    if (newExtras.length > extraLocations.length) {
      logSessionEvent('group_location_added', { totalPeople: 2 + newExtras.length }, { userId: user?.id });
    }
    setExtraLocations(newExtras);
  }, [extraLocations.length, user]);

  const handleSwap = useCallback(() => {
    setFromValue(toValue);
    setToValue(fromValue);
    setFromLocation(toLocation);
    setToLocation(fromLocation);
    logSessionEvent('locations_swapped', {
      from: toValue,
      to: fromValue,
    }, { userId: user?.id });
  }, [fromValue, toValue, fromLocation, toLocation, user]);

  // ---- Handle filter toggle ----
  const handleFilterToggle = useCallback(
    (key) => {
      // Use functional update to get CURRENT state, not stale closure
      setActiveFilters((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key];
        return next;
      });
      // Per-user event
      if (user?.id) {
        logUserEvent(user.id, 'filter_toggle', { category: key });
      }
      logSessionEvent('filter_toggle', {
        category: key,
        action: activeFilters.includes(key) ? 'off' : 'on',
      }, { userId: user?.id });
    },
    [user, activeFilters]
  );

  const handleLocalOnlyToggle = useCallback(() => {
    setLocalOnly((prev) => {
      const next = !prev;
      logSessionEvent('filter_toggle', {
        category: 'local_only',
        action: next ? 'on' : 'off',
      }, { userId: user?.id });
      return next;
    });
  }, [user]);

  // Re-calculate route when travel mode changes (if we have locations)
  useEffect(() => {
    if (!fromLocation || !toLocation || !hasResults) return;

    const recalculate = async () => {
      const cacheKey = `${fromLocation.lat},${fromLocation.lon}|${toLocation.lat},${toLocation.lon}|${travelMode}`;
      let routeData;

      if (routeCacheRef.current[cacheKey]) {
        console.log('[Route Cache HIT] mode switch:', travelMode);
        routeData = routeCacheRef.current[cacheKey];
      } else {
        setLoading(true);
        try {
          routeData = await getRoute(fromLocation, toLocation, travelMode);
          routeCacheRef.current[cacheKey] = routeData;
          console.log('[Route Cache MISS] mode switch:', travelMode);
        } catch (err) {
          console.error('Route recalc error:', err);
          showToast('Could not recalculate route for this travel mode.');
          setLoading(false);
          return;
        }
        setLoading(false);
      }

      setRoute(routeData);
      const mp = computeMidpoint(routeData.allRoutes[0].leg, midpointMode);
      setMidpoint(mp);
      setSelectedRouteIndex(0);
      // Clear places cache since midpoint may have changed
      setPlacesCache({});
      if (activeFilters.length > 0) {
        fetchPlaces(mp, activeFilters, {});
      }
    };

    recalculate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [travelMode]);

  // Re-calculate midpoint when midpoint mode changes (time vs distance)
  useEffect(() => {
    if (!route) return;
    const leg = route.allRoutes?.[selectedRouteIndex]?.leg;
    if (!leg) return;

    const mp = computeMidpoint(leg, midpointMode);
    setMidpoint(mp);
    // Clear places cache since midpoint moved
    setPlacesCache({});
    if (activeFilters.length > 0) {
      fetchPlaces(mp, activeFilters, {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [midpointMode]);

  // React to filter changes - separate from toggle to avoid closure issues
  useEffect(() => {
    if (!midpoint) return;

    if (activeFilters.length === 0) {
      console.log('[Filter] All filters off - clearing places');
      setPlaces([]);
      return;
    }

    // Fetch places with cache awareness
    setPlacesCache((currentCache) => {
      fetchPlaces(midpoint, activeFilters, currentCache);
      return currentCache;
    });
  }, [activeFilters, midpoint, fetchPlaces]);

  // ---- Handle place click (from map or list) ----
  const handlePlaceClick = useCallback((placeId) => {
    setActivePlaceId(placeId);

    // Fire-and-forget place click analytics
    const place = places.find((p) => p.id === placeId);
    if (place) {
      logPlaceClick({
        placeName: place.name,
        placeCategory: place.category,
        placeLat: place.lat,
        placeLng: place.lon,
        placeRating: place.rating,
        fromTo: fromValue && toValue ? `${fromValue} → ${toValue}` : null,
        midpointLat: midpoint?.lat ?? null,
        midpointLng: midpoint?.lon ?? null,
      });
      // Per-user event
      const rank = places.findIndex((p) => p.id === placeId) + 1;
      logSessionEvent('place_click', {
        placeName: place.name,
        category: place.category,
        rank: rank || null,
        distanceMeters: place.distance,
        openNow: place.openNow,
        hasWebsite: Boolean(place.websiteUri),
        hasPhone: Boolean(place.phoneNumber),
      }, { userId: user?.id });
      if (user?.id) {
        logUserEvent(user.id, 'place_click', {
          placeName: place.name,
          category: place.category,
        });
      }
    }
  }, [places, fromValue, toValue, midpoint, user]);

  // ---- Handle route selection ----
  const handleRouteSelect = useCallback(
    async (index) => {
      if (!route?.allRoutes?.[index]) return;
      
      const selectedRoute = route.allRoutes[index];
      const mp = computeMidpoint(selectedRoute.leg, midpointMode);
      setSelectedRouteIndex(index);
      setMidpoint(mp);
      
      // Update route state with new selection
      setRoute((prev) => ({
        ...prev,
        totalDuration: selectedRoute.totalDuration,
        totalDistance: selectedRoute.totalDistance,
        midpoint: mp,
        selectedRouteIndex: index,
      }));
      
      // Re-fetch places for the new midpoint
      await fetchPlaces(mp, activeFilters);
      
      trackEvent('route_selected', {
        route_index: index,
        route_summary: selectedRoute.summary,
      });
      logSessionEvent('route_selected', {
        routeIndex: index,
        routeSummary: selectedRoute.summary,
        durationSeconds: selectedRoute.totalDuration,
        distanceMeters: selectedRoute.totalDistance,
      }, { userId: user?.id });
    },
    [route, fetchPlaces, activeFilters, midpointMode, user]
  );

  // ---- Auto-run from URL params on mount ----
  useEffect(() => {
    if (!isLoaded || initialLoadDone.current || creditsLoading) return;
    initialLoadDone.current = true;

    // Check for shared route data (from ?s= share links)
    const sharedRoute = getSharedRouteData();
    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    // Helper: detect if param looks like coords "lat,lng"
    const isCoords = (str) => str && /^-?\d+\.?\d*,-?\d+\.?\d*$/.test(str.trim());

    if (sharedRoute && sharedRoute.fromLat && sharedRoute.toLat) {
      // Share link — shared route data available (from DB lookup or URL coords)
      const timer = setTimeout(() => {
        autoSplitFromCoords(sharedRoute);
      }, 500);
      return () => clearTimeout(timer);
    } else if (fromParam && toParam && isCoords(fromParam) && isCoords(toParam)) {
      // URL has coordinate params (share link fallback) — use coords directly
      const [fromLat, fromLng] = fromParam.split(',').map(Number);
      const [toLat, toLng] = toParam.split(',').map(Number);
      const timer = setTimeout(() => {
        autoSplitFromCoords({ fromLat, fromLng, toLat, toLng, fromName: null, toName: null });
      }, 500);
      return () => clearTimeout(timer);
    } else if (fromParam && toParam) {
      // Regular link with place names
      setFromValue(fromParam);
      setToValue(toParam);

      const timer = setTimeout(() => {
        autoSplit(fromParam, toParam);
      }, 500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, creditsLoading, hasSearchCredits, isLoggedIn]);

  // ---- Auto split from URL params ----
  const autoSplit = useCallback(
    async (fromVal, toVal) => {
      if (!hasSearchCredits) {
        setFromValue(fromVal);
        setToValue(toVal);
        try {
          localStorage.setItem('std_pending_credit_search', JSON.stringify({
            fromValue: fromVal,
            toValue: toVal,
            fromLocation: null,
            toLocation: null,
            extraLocations: [],
            travelMode,
            midpointMode,
          }));
        } catch {}
        logSessionEvent('search_blocked_no_credits', {
          from: fromVal,
          to: toVal,
          resultType: 'url_autoload',
          travelMode,
          midpointMode,
          isLoggedIn,
        }, { userId: user?.id });
        if (!isLoggedIn) {
          try {
            localStorage.setItem('std_open_credits_after_signin', '1');
          } catch {}
          openSignIn({ mode: 'signup', context: 'search_credits' });
        } else {
          openPricingModal();
        }
        return;
      }

      setLoading(true);
      try {
        const fromResults = await searchLocations(fromVal);
        if (fromResults.length === 0)
          throw new Error(`Could not find: "${fromVal}"`);
        const from = fromResults[0];
        setFromLocation(from);
        setFromValue(from.name);

        const toResults = await searchLocations(toVal);
        if (toResults.length === 0)
          throw new Error(`Could not find: "${toVal}"`);
        const to = toResults[0];
        setToLocation(to);
        setToValue(to.name);

        const routeData = await getRoute(from, to);
        setRoute(routeData);
        setMidpoint(routeData.midpoint);
        setHasResults(true);

        // Don't fetch places automatically - wait for user to click a category
        setPlaces([]);

        // Fire-and-forget analytics
        logSearch({
          fromName: from.name,
          fromLat: from.lat,
          fromLng: from.lon,
          toName: to.name,
          toLat: to.lat,
          toLng: to.lon,
          midpointLat: routeData.midpoint.lat,
          midpointLng: routeData.midpoint.lon,
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          activeFilters: [],
          placesFound: 0,
        });
        logSessionEvent('search_completed', {
          from: from.name,
          to: to.name,
          resultType: 'url_autoload',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          midpointLat: routeData.midpoint.lat,
          midpointLng: routeData.midpoint.lon,
        }, { userId: user?.id });

        await finalizeSearchCreditUse({
          from: from.name,
          to: to.name,
          locationCount: 2,
          travelMode,
          midpointMode,
          resultType: 'url_autoload',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
        });
        clearPendingSearch();
      } catch (err) {
        console.error('Auto-split error:', err);
        logSessionEvent('search_failed', {
          from: fromVal,
          to: toVal,
          resultType: 'url_autoload',
          error: err.message,
        }, { userId: user?.id });
        showToast(err.message || 'Failed to load shared route.');
      } finally {
        setLoading(false);
      }
    },
    [clearPendingSearch, finalizeSearchCreditUse, hasSearchCredits, isLoggedIn, midpointMode, openPricingModal, openSignIn, showToast, travelMode, user]
  );

  // ---- Auto split from shared route coordinates ----
  const autoSplitFromCoords = useCallback(
    async (sharedRoute) => {
      const from = {
        lat: sharedRoute.fromLat,
        lon: sharedRoute.fromLng,
        name: sharedRoute.fromName || `${sharedRoute.fromLat.toFixed(4)}, ${sharedRoute.fromLng.toFixed(4)}`,
      };
      const to = {
        lat: sharedRoute.toLat,
        lon: sharedRoute.toLng,
        name: sharedRoute.toName || `${sharedRoute.toLat.toFixed(4)}, ${sharedRoute.toLng.toFixed(4)}`,
      };

      setFromValue(sharedRoute.fromName || from.name);
      setToValue(sharedRoute.toName || to.name);
      setFromLocation(from);
      setToLocation(to);

      if (!hasSearchCredits) {
        try {
          localStorage.setItem('std_pending_credit_search', JSON.stringify({
            fromValue: sharedRoute.fromName || from.name,
            toValue: sharedRoute.toName || to.name,
            fromLocation: from,
            toLocation: to,
            extraLocations: [],
            travelMode,
            midpointMode,
          }));
        } catch {}
        logSessionEvent('search_blocked_no_credits', {
          from: from.name,
          to: to.name,
          resultType: 'share_autoload',
          travelMode,
          midpointMode,
          isLoggedIn,
        }, { userId: user?.id });
        if (!isLoggedIn) {
          try {
            localStorage.setItem('std_open_credits_after_signin', '1');
          } catch {}
          openSignIn({ mode: 'signup', context: 'search_credits' });
        } else {
          openPricingModal();
        }
        return;
      }

      setLoading(true);
      try {
        const routeData = await getRoute(from, to);
        setRoute(routeData);
        setMidpoint(routeData.midpoint);
        setHasResults(true);
        setPlaces([]);

        logSearch({
          fromName: from.name,
          fromLat: from.lat,
          fromLng: from.lon,
          toName: to.name,
          toLat: to.lat,
          toLng: to.lon,
          midpointLat: routeData.midpoint.lat,
          midpointLng: routeData.midpoint.lon,
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          activeFilters: [],
          placesFound: 0,
        });
        logSessionEvent('search_completed', {
          from: from.name,
          to: to.name,
          resultType: 'share_autoload',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
          midpointLat: routeData.midpoint.lat,
          midpointLng: routeData.midpoint.lon,
        }, { userId: user?.id });

        await finalizeSearchCreditUse({
          from: from.name,
          to: to.name,
          locationCount: 2,
          travelMode,
          midpointMode,
          resultType: 'share_autoload',
          distanceMiles: routeData.totalDistance / 1609.344,
          durationSeconds: routeData.totalDuration,
        });
        clearPendingSearch();
      } catch (err) {
        console.error('Shared route error:', err);
        logSessionEvent('search_failed', {
          resultType: 'share_autoload',
          error: err.message,
        }, { userId: user?.id });
        showToast(err.message || 'Failed to load shared route.');
      } finally {
        setLoading(false);
      }
    },
    [clearPendingSearch, finalizeSearchCreditUse, hasSearchCredits, isLoggedIn, midpointMode, openPricingModal, openSignIn, showToast, travelMode, user]
  );

  // ---- Loading state while Google Maps loads ----
  if (!isLoaded) {
    return (
      <>
        {/* Header (always visible) */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-[1000] flex items-center">
          <div className="w-full max-w-[1440px] mx-auto px-5 flex items-center">
            <Link
              href="/"
              className="flex items-center gap-2.5 no-underline text-gray-900"
            >
              <img src="/logo.png" alt="Split The Distance" width="28" height="28" className="shrink-0" />
              <span className="text-lg font-bold tracking-tight">
                Split The Distance
              </span>
            </Link>
          </div>
        </header>
        <div className="flex items-center justify-center h-[calc(100vh-56px)] mt-14 bg-gray-50">
          <div className="flex flex-col items-center gap-3">
            <span className="inline-block w-8 h-8 border-[3px] border-gray-200 border-t-teal-500 rounded-full animate-spin" />
            <span className="text-sm text-gray-400">Loading Google Maps...</span>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-[1000] flex items-center">
        <div className="w-full max-w-[1440px] mx-auto px-5 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2.5 no-underline text-gray-900"
          >
            <img src="/logo.png" alt="Split The Distance" width="28" height="28" className="shrink-0" />
            <span className="text-lg font-bold tracking-tight">
              Split The Distance
            </span>
            {isInternal && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                INTERNAL
              </span>
            )}
          </Link>
          <nav className="flex items-center gap-4">
            <a
              href="#how-it-works"
              className="hidden md:block text-sm font-medium text-gray-500 no-underline hover:text-teal-600 transition-colors duration-200"
            >
              How It Works
            </a>
            <AuthButton />
          </nav>
        </div>
      </header>

      {/* Main App */}
      <main className="flex h-[calc(100vh-56px)] mt-14 max-md:flex-col-reverse max-md:h-auto max-md:min-h-[calc(100vh-52px)] max-md:mt-13">
        <SearchPanel
          fromValue={fromValue}
          toValue={toValue}
          onFromChange={(val) => {
            if (!fromValue && val.trim()) {
              logSessionEvent('input_started', { field: 'from' }, { userId: user?.id });
            }
            setFromValue(val);
            if (!val.trim()) setFromLocation(null);
          }}
          onToChange={(val) => {
            if (!toValue && val.trim()) {
              logSessionEvent('input_started', { field: 'to' }, { userId: user?.id });
            }
            setToValue(val);
            if (!val.trim()) setToLocation(null);
          }}
          onFromSelect={(loc) => {
            setFromLocation(loc);
            logSessionEvent('input_selected', { field: 'from', locationName: loc.name }, { userId: user?.id });
          }}
          onToSelect={(loc) => {
            setToLocation(loc);
            logSessionEvent('input_selected', { field: 'to', locationName: loc.name }, { userId: user?.id });
          }}
          onFromClear={() => {
            setFromLocation(null);
            logSessionEvent('input_cleared', { field: 'from' }, { userId: user?.id });
          }}
          onToClear={() => {
            setToLocation(null);
            logSessionEvent('input_cleared', { field: 'to' }, { userId: user?.id });
          }}
          onSwap={handleSwap}
          onSplit={handleSplit}
          loading={loading}
          route={route}
          midpoint={midpoint}
          fromLocation={fromLocation}
          toLocation={toLocation}
          places={(!roadTripStops && driftRadius) ? filterPlacesInZone(places, driftRadius) : places}
          placesLoading={placesLoading}
          activeFilters={activeFilters}
          onFilterToggle={handleFilterToggle}
          activePlaceId={activePlaceId}
          onPlaceClick={handlePlaceClick}
          hasResults={hasResults}
          mobileCollapsed={mobileCollapsed}
          onError={showToast}
          selectedRouteIndex={selectedRouteIndex}
          onRouteSelect={handleRouteSelect}
          travelMode={travelMode}
          onTravelModeChange={handleTravelModeChange}
          midpointMode={midpointMode}
          onMidpointModeChange={handleMidpointModeChange}
          localOnly={localOnly}
          onLocalOnlyToggle={handleLocalOnlyToggle}
          onResplit={handleResplit}
          extraLocations={extraLocations}
          onExtraLocationsChange={handleExtraLocationsChange}
          multiResult={multiResult}
          driftRadius={driftRadius}
          onDriftRadiusChange={handleDriftRadiusChange}
          roadTripStops={roadTripStops}
          roadTripInterval={roadTripInterval}
          activeStopIndex={activeStopIndex}
          onActiveStopIndexChange={handleActiveStopChange}
          onActivateRoadTrip={handleActivateRoadTrip}
          onExitRoadTrip={handleExitRoadTrip}
          isLoggedIn={isLoggedIn}
          savePlanStatus={savePlanStatus}
          onSavePlan={handleSavePlanClick}
          creditStatus={creditStatus}
          creditsLoading={creditsLoading}
          onBuyCredits={openPricingModal}
        />

        {/* Map Container */}
        <div className={`flex-1 relative max-md:flex-none ${mobileCollapsed ? 'max-md:h-[calc(100vh-56px)]' : 'max-md:h-[45vh] max-md:min-h-[280px]'}`}>
          <MapView
            from={fromLocation}
            to={toLocation}
            route={route}
            midpoint={midpoint}
            midpointMode={midpointMode}
            places={(() => {
              let filtered = localOnly ? places.filter(p => !p.brand) : places;
              return (!roadTripStops && driftRadius) ? filterPlacesInZone(filtered, driftRadius) : filtered;
            })()}
            activePlaceId={activePlaceId}
            onPlaceClick={handlePlaceClick}
            selectedRouteIndex={selectedRouteIndex}
            extraLocations={extraLocations.filter(el => el.location).map(el => el.location)}
            multiResult={multiResult}
            driftRadius={driftRadius}
            roadTripStops={roadTripStops}
            activeStopIndex={activeStopIndex}
            onActiveStopIndexChange={handleActiveStopChange}
          />

          {/* Mobile panel toggle */}
          <button
            onClick={() => setMobileCollapsed((prev) => !prev)}
            className="hidden max-md:flex absolute top-3 left-3 z-[800] w-11 h-11 border-none rounded-md bg-white shadow-md text-gray-700 cursor-pointer items-center justify-center"
            aria-label="Toggle results panel"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </main>

      {/* How It Works */}
      <HowItWorks />

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-5 px-6 text-[13px]">
        <div className="max-w-[800px] mx-auto text-center flex items-center justify-center gap-2 flex-wrap">
          <span>Split The Distance &copy; {new Date().getFullYear()}</span>
          <span className="text-gray-600">·</span>
          <Link href="/about" className="hover:text-gray-200 transition">About Us</Link>
          <span className="text-gray-600">&middot;</span>
          <Link href="/legal/terms" className="hover:text-gray-200 transition">Terms</Link>
          <span className="text-gray-600">·</span>
          <Link href="/legal/privacy" className="hover:text-gray-200 transition">Privacy</Link>
        </div>
      </footer>

      {/* Auth, Pricing & Account Modals */}
      <SignInModal />
      <PricingModal />
      <AccountModal />

      {/* Welcome Walkthrough Modal */}
      {welcomeModalType && (
        <WelcomeModal
          type={welcomeModalType}
          onClose={() => setWelcomeModalType(null)}
          onUpgrade={() => {
            setWelcomeModalType(null);
            // Small delay so the welcome modal unmounts before pricing opens
            setTimeout(() => openPricingModal(), 200);
          }}
        />
      )}

      {/* Upgrade status banner (hidden when welcome modal is open) */}
      {upgradeStatus === 'success' && !welcomeModalType && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md animate-slideUp">
          <div className="mx-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-lg px-5 py-4 flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">&#x2705;</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Welcome to Premium!</p>
              <p className="text-xs text-emerald-600 mt-0.5">Your upgrade was successful. Enjoy all premium features.</p>
            </div>
            <button
              onClick={() => setUpgradeStatus(null)}
              className="bg-transparent border-none text-emerald-400 text-lg cursor-pointer leading-none hover:text-emerald-700 p-0"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      {upgradeStatus === 'cancelled' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md animate-slideUp">
          <div className="mx-4 bg-amber-50 border border-amber-200 rounded-xl shadow-lg px-5 py-4 flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">&#x2139;&#xFE0F;</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Upgrade cancelled</p>
              <p className="text-xs text-amber-600 mt-0.5">No charges were made. You can upgrade anytime from the menu.</p>
            </div>
            <button
              onClick={() => setUpgradeStatus(null)}
              className="bg-transparent border-none text-amber-400 text-lg cursor-pointer leading-none hover:text-amber-700 p-0"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {creditsBannerStatus === 'success' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md animate-slideUp">
          <div className="mx-4 bg-emerald-50 border border-emerald-200 rounded-xl shadow-lg px-5 py-4 flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">&#x2705;</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-emerald-800">Credits added</p>
              <p className="text-xs text-emerald-600 mt-0.5">Your search credits are ready to use.</p>
            </div>
            <button
              onClick={() => setCreditsBannerStatus(null)}
              className="bg-transparent border-none text-emerald-400 text-lg cursor-pointer leading-none hover:text-emerald-700 p-0"
            >
              &times;
            </button>
          </div>
        </div>
      )}
      {creditsBannerStatus === 'cancelled' && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-[9999] w-full max-w-md animate-slideUp">
          <div className="mx-4 bg-amber-50 border border-amber-200 rounded-xl shadow-lg px-5 py-4 flex items-start gap-3">
            <span className="text-2xl leading-none mt-0.5">&#x2139;&#xFE0F;</span>
            <div className="flex-1">
              <p className="text-sm font-semibold text-amber-800">Checkout cancelled</p>
              <p className="text-xs text-amber-600 mt-0.5">No credits were purchased.</p>
            </div>
            <button
              onClick={() => setCreditsBannerStatus(null)}
              className="bg-transparent border-none text-amber-400 text-lg cursor-pointer leading-none hover:text-amber-700 p-0"
            >
              &times;
            </button>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-gray-800 text-white px-5 py-3 rounded-[10px] shadow-xl flex items-center gap-2.5 text-sm font-medium z-[9999] max-w-[calc(100vw-32px)] animate-slideUp">
          <span>⚠️</span>
          <span>{toast}</span>
          <button
            onClick={hideToast}
            className="bg-transparent border-none text-gray-400 text-lg cursor-pointer pl-1 leading-none hover:text-white"
          >
            ×
          </button>
        </div>
      )}
    </>
  );
}
