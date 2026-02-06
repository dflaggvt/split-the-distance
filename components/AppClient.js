'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useJsApiLoader } from '@react-google-maps/api';
import SearchPanel from './SearchPanel';
import HowItWorks from './HowItWorks';
import { searchLocations } from '@/lib/geocoding';
import { getRoute } from '@/lib/routing';
import { searchNearby } from '@/lib/places';
import { logSearch, logPlaceClick, checkInternalUser, trackEvent } from '@/lib/analytics';

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

export default function AppClient() {
  const searchParams = useSearchParams();

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
  const [places, setPlaces] = useState([]);
  const [activeFilters, setActiveFilters] = useState(['restaurant', 'cafe']);
  const [loading, setLoading] = useState(false);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [activePlaceId, setActivePlaceId] = useState(null);
  const [hasResults, setHasResults] = useState(false);
  const [mobileCollapsed, setMobileCollapsed] = useState(false);
  const [toast, setToast] = useState(null);
  const [isInternal, setIsInternal] = useState(false);

  const toastTimer = useRef(null);
  const initialLoadDone = useRef(false);

  // Check internal user status on mount
  useEffect(() => {
    setIsInternal(checkInternalUser());
  }, []);

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

  // ---- Fetch places ----
  const fetchPlaces = useCallback(
    async (mp, filters) => {
      if (!mp) return [];
      const cats = filters || activeFilters;

      if (cats.length === 0) {
        setPlaces([]);
        return [];
      }

      setPlacesLoading(true);
      try {
        const results = await searchNearby(mp, cats);
        setPlaces(results);
        return results;
      } catch (err) {
        console.error('POI search error:', err);
        setPlaces([]);
        return [];
      } finally {
        setPlacesLoading(false);
      }
    },
    [activeFilters]
  );

  // ---- Handle split ----
  const handleSplit = useCallback(async () => {
    if (loading) return;

    const fromVal = fromValue.trim();
    const toVal = toValue.trim();

    if (!fromVal || !toVal) {
      showToast('Please enter both a starting location and destination.');
      return;
    }

    // Track search button click
    trackEvent('search_clicked', {
      from_input: fromVal,
      to_input: toVal,
    });

    setLoading(true);

    try {
      // Geocode if needed
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

      // Get route
      const routeData = await getRoute(from, to, travelMode);
      setRoute(routeData);
      setMidpoint(routeData.midpoint);
      setHasResults(true);

      // Update URL
      const params = new URLSearchParams({
        from: fromValue.trim() || from.name,
        to: toValue.trim() || to.name,
      });
      window.history.replaceState(
        {},
        '',
        `${window.location.pathname}?${params}`
      );

      // Fetch places
      const fetchedPlaces = await fetchPlaces(routeData.midpoint, activeFilters);

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
        activeFilters,
        placesFound: fetchedPlaces.length,
      });
    } catch (err) {
      console.error('Split error:', err);
      showToast(err.message || 'Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    fromValue,
    toValue,
    fromLocation,
    toLocation,
    loading,
    showToast,
    fetchPlaces,
    activeFilters,
    travelMode,
  ]);

  // ---- Handle swap ----
  const handleSwap = useCallback(() => {
    setFromValue(toValue);
    setToValue(fromValue);
    setFromLocation(toLocation);
    setToLocation(fromLocation);
  }, [fromValue, toValue, fromLocation, toLocation]);

  // ---- Handle filter toggle ----
  const handleFilterToggle = useCallback(
    (key) => {
      setActiveFilters((prev) => {
        const next = prev.includes(key)
          ? prev.filter((k) => k !== key)
          : [...prev, key];

        // Re-fetch places with new filters
        if (midpoint) {
          fetchPlaces(midpoint, next);
        }

        return next;
      });
    },
    [midpoint, fetchPlaces]
  );

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
    }
  }, [places, fromValue, toValue, midpoint]);

  // ---- Handle route selection ----
  const handleRouteSelect = useCallback(
    async (index) => {
      if (!route?.allRoutes?.[index]) return;
      
      const selectedRoute = route.allRoutes[index];
      setSelectedRouteIndex(index);
      setMidpoint(selectedRoute.midpoint);
      
      // Update route state with new selection
      setRoute((prev) => ({
        ...prev,
        totalDuration: selectedRoute.totalDuration,
        totalDistance: selectedRoute.totalDistance,
        midpoint: selectedRoute.midpoint,
        selectedRouteIndex: index,
      }));
      
      // Re-fetch places for the new midpoint
      await fetchPlaces(selectedRoute.midpoint, activeFilters);
      
      trackEvent('route_selected', {
        route_index: index,
        route_summary: selectedRoute.summary,
      });
    },
    [route, fetchPlaces, activeFilters]
  );

  // ---- Auto-run from URL params on mount ----
  useEffect(() => {
    if (!isLoaded || initialLoadDone.current) return;
    initialLoadDone.current = true;

    const fromParam = searchParams.get('from');
    const toParam = searchParams.get('to');

    if (fromParam && toParam) {
      setFromValue(fromParam);
      setToValue(toParam);

      const timer = setTimeout(() => {
        autoSplit(fromParam, toParam);
      }, 500);

      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded]);

  // ---- Auto split from URL params ----
  const autoSplit = useCallback(
    async (fromVal, toVal) => {
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

        const fetchedPlaces = await fetchPlaces(routeData.midpoint, activeFilters);

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
          activeFilters,
          placesFound: fetchedPlaces.length,
        });
      } catch (err) {
        console.error('Auto-split error:', err);
        showToast(err.message || 'Failed to load shared route.');
      } finally {
        setLoading(false);
      }
    },
    [fetchPlaces, activeFilters, showToast]
  );

  // ---- Loading state while Google Maps loads ----
  if (!isLoaded) {
    return (
      <>
        {/* Header (always visible) */}
        <header className="fixed top-0 left-0 right-0 h-14 bg-white border-b border-gray-200 z-[1000] flex items-center">
          <div className="w-full max-w-[1440px] mx-auto px-5 flex items-center">
            <a
              href="/"
              className="flex items-center gap-2.5 no-underline text-gray-900"
            >
              <svg
                className="shrink-0"
                viewBox="0 0 32 32"
                width="32"
                height="32"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  d="M16 2C10.477 2 6 6.477 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.523-4.477-10-10-10z"
                  fill="#0d9488"
                  stroke="#0f766e"
                  strokeWidth="1.5"
                />
                <circle cx="16" cy="12" r="4" fill="white" />
                <path
                  d="M4 16h6M22 16h6"
                  stroke="#0d9488"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-lg font-bold tracking-tight">
                Split The Distance
              </span>
            </a>
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
          <a
            href="/"
            className="flex items-center gap-2.5 no-underline text-gray-900"
          >
            <svg
              className="shrink-0"
              viewBox="0 0 32 32"
              width="32"
              height="32"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M16 2C10.477 2 6 6.477 6 12c0 7.5 10 18 10 18s10-10.5 10-18c0-5.523-4.477-10-10-10z"
                fill="#0d9488"
                stroke="#0f766e"
                strokeWidth="1.5"
              />
              <circle cx="16" cy="12" r="4" fill="white" />
              <path
                d="M4 16h6M22 16h6"
                stroke="#0d9488"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-lg font-bold tracking-tight">
              Split The Distance
            </span>
            {isInternal && (
              <span className="ml-2 px-1.5 py-0.5 text-[10px] font-medium bg-amber-100 text-amber-700 rounded">
                INTERNAL
              </span>
            )}
          </a>
          <nav className="hidden md:flex items-center gap-4">
            <a
              href="#how-it-works"
              className="text-sm font-medium text-gray-500 no-underline hover:text-teal-600 transition-colors duration-200"
            >
              How It Works
            </a>
          </nav>
        </div>
      </header>

      {/* Main App */}
      <main className="flex h-[calc(100vh-56px)] mt-14 max-md:flex-col-reverse max-md:h-auto max-md:min-h-[calc(100vh-52px)] max-md:mt-13">
        <SearchPanel
          fromValue={fromValue}
          toValue={toValue}
          onFromChange={(val) => {
            setFromValue(val);
            if (!val.trim()) setFromLocation(null);
          }}
          onToChange={(val) => {
            setToValue(val);
            if (!val.trim()) setToLocation(null);
          }}
          onFromSelect={(loc) => setFromLocation(loc)}
          onToSelect={(loc) => setToLocation(loc)}
          onFromClear={() => setFromLocation(null)}
          onToClear={() => setToLocation(null)}
          onSwap={handleSwap}
          onSplit={handleSplit}
          loading={loading}
          route={route}
          midpoint={midpoint}
          places={places}
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
          onTravelModeChange={setTravelMode}
        />

        {/* Map Container */}
        <div className="flex-1 relative max-md:h-[45vh] max-md:min-h-[280px]">
          <MapView
            from={fromLocation}
            to={toLocation}
            route={route}
            midpoint={midpoint}
            places={places}
            activePlaceId={activePlaceId}
            onPlaceClick={handlePlaceClick}
            selectedRouteIndex={selectedRouteIndex}
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
          <span>Split The Distance © {new Date().getFullYear()}</span>
          <span className="text-gray-600">·</span>
          <span>Powered by Google Maps Platform</span>
        </div>
      </footer>

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
