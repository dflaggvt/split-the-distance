'use client';

import { useMemo, useState } from 'react';
import FloatingRoutePlanner from './FloatingRoutePlanner';
import SearchPanel from './SearchPanel';
import { filterPlacesInZone } from '@/lib/isochrone';

const SHEET_HEIGHT = {
  peek: 'h-[92px]',
  half: 'h-[28dvh] min-h-[220px]',
  full: 'h-[calc(100dvh-72px)]',
};

function NavIcon({ type }) {
  const common = {
    width: 22,
    height: 22,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };

  if (type === 'results') {
    return (
      <svg {...common}>
        <circle cx="6" cy="6" r="2.5" />
        <circle cx="18" cy="18" r="2.5" />
        <path d="M8.5 6h3.5a4 4 0 0 1 0 8h-1a4 4 0 0 0 0 8h4.5" />
      </svg>
    );
  }

  if (type === 'ai') {
    return (
      <svg {...common}>
        <path d="M12 3l1.6 4.4L18 9l-4.4 1.6L12 15l-1.6-4.4L6 9l4.4-1.6L12 3z" />
        <path d="M19 14l.8 2.2L22 17l-2.2.8L19 20l-.8-2.2L16 17l2.2-.8L19 14z" />
      </svg>
    );
  }

  if (type === 'saved') {
    return (
      <svg {...common}>
        <path d="M6 4h12v17l-6-4-6 4V4z" />
      </svg>
    );
  }

  return (
    <svg {...common}>
      <circle cx="12" cy="12" r="8" />
      <path d="M8.5 12h7" />
      <path d="M12 8.5v7" />
    </svg>
  );
}

function MobileNavButton({ active, label, icon, onClick, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex h-full flex-col items-center justify-center gap-1 text-[11px] font-bold transition ${
        active ? 'text-teal-700' : 'text-gray-500 hover:text-gray-900'
      }`}
    >
      <NavIcon type={icon} />
      <span>{label}</span>
      {badge ? (
        <span className="absolute right-3 top-2 min-w-4 rounded-full bg-teal-600 px-1 text-[10px] leading-4 text-white">
          {badge}
        </span>
      ) : null}
    </button>
  );
}

export default function MobileAppShell({
  MapComponent,
  fromValue,
  toValue,
  onFromChange,
  onToChange,
  onFromSelect,
  onToSelect,
  onFromClear,
  onToClear,
  onSwap,
  onSplit,
  loading,
  route,
  midpoint,
  fromLocation,
  toLocation,
  places,
  placesLoading,
  activeFilters,
  onFilterToggle,
  activePlaceId,
  onPlaceClick,
  hasResults,
  onError,
  selectedRouteIndex,
  onRouteSelect,
  travelMode,
  onTravelModeChange,
  midpointMode,
  onMidpointModeChange,
  localOnly,
  onLocalOnlyToggle,
  onResplit,
  extraLocations,
  onExtraLocationsChange,
  multiResult,
  driftRadius,
  onDriftRadiusChange,
  roadTripStops,
  roadTripInterval,
  activeStopIndex,
  onActiveStopIndexChange,
  onActivateRoadTrip,
  onExitRoadTrip,
  isLoggedIn,
  savePlanStatus,
  onSavePlan,
  creditStatus,
  creditsLoading,
  onBuyCredits,
  enableLocationLookup,
  panelView,
  onPanelViewChange,
}) {
  const visiblePlaces = useMemo(() => {
    const base = localOnly ? places.filter((place) => !place.brand) : places;
    return (!roadTripStops && driftRadius) ? filterPlacesInZone(base, driftRadius) : base;
  }, [driftRadius, localOnly, places, roadTripStops]);

  const defaultSheetMode = panelView === 'ai'
    ? 'full'
    : panelView === 'saved'
      ? 'half'
      : hasResults
        ? 'half'
        : 'peek';
  const [manualSheetMode, setManualSheetMode] = useState(null);
  const sheetMode = manualSheetMode || defaultSheetMode;

  const openPanelView = (view) => {
    onPanelViewChange?.(view);
    if (view === 'ai') {
      setManualSheetMode('full');
    } else if (view === 'plan') {
      setManualSheetMode(hasResults ? 'half' : 'peek');
    } else {
      setManualSheetMode('half');
    }
  };

  const cycleSheetMode = () => {
    setManualSheetMode((current) => {
      const activeMode = current || defaultSheetMode;
      if (activeMode === 'peek') return 'half';
      if (activeMode === 'half') return 'full';
      return hasResults ? 'half' : 'peek';
    });
  };

  return (
    <section className="mobile-app-shell relative h-[calc(100dvh-56px)] overflow-hidden bg-gray-100">
      <div className="absolute inset-0">
        <MapComponent
          from={fromLocation}
          to={toLocation}
          route={route}
          midpoint={midpoint}
          midpointMode={midpointMode}
          places={visiblePlaces}
          activePlaceId={activePlaceId}
          onPlaceClick={onPlaceClick}
          selectedRouteIndex={selectedRouteIndex}
          extraLocations={extraLocations.filter((el) => el.location).map((el) => el.location)}
          multiResult={multiResult}
          driftRadius={driftRadius}
          roadTripStops={roadTripStops}
          activeStopIndex={activeStopIndex}
          onActiveStopIndexChange={onActiveStopIndexChange}
        />
      </div>

      <div className="pointer-events-none absolute left-2 right-2 top-2 z-[70]">
        <FloatingRoutePlanner
          className="pointer-events-auto w-full"
          fromValue={fromValue}
          toValue={toValue}
          onFromChange={onFromChange}
          onToChange={onToChange}
          onFromSelect={onFromSelect}
          onToSelect={onToSelect}
          onFromClear={onFromClear}
          onToClear={onToClear}
          onSwap={onSwap}
          onSplit={onSplit}
          loading={loading}
          fromLocation={fromLocation}
          toLocation={toLocation}
          travelMode={travelMode}
          onTravelModeChange={onTravelModeChange}
          midpointMode={midpointMode}
          onMidpointModeChange={onMidpointModeChange}
          extraLocations={extraLocations}
          onExtraLocationsChange={onExtraLocationsChange}
          onError={onError}
          creditStatus={creditStatus}
          creditsLoading={creditsLoading}
          onBuyCredits={onBuyCredits}
          enableLocationLookup={enableLocationLookup}
          panelCollapsed={sheetMode === 'peek'}
          onTogglePanel={cycleSheetMode}
          compactMobile
        />
      </div>

      <div
        className={`absolute bottom-0 left-0 right-0 z-[90] rounded-t-[28px] border border-gray-200 bg-white shadow-2xl shadow-gray-900/20 transition-[height] duration-300 ${SHEET_HEIGHT[sheetMode]}`}
      >
        <button
          type="button"
          onClick={cycleSheetMode}
          className="mx-auto mt-1 flex h-5 w-24 items-center justify-center"
          aria-label="Resize results sheet"
        >
          <span className="h-1.5 w-12 rounded-full bg-gray-300" />
        </button>

        <div className="h-[calc(100%-72px)] min-h-0">
          <SearchPanel
            fromValue={fromValue}
            toValue={toValue}
            onFromChange={onFromChange}
            onToChange={onToChange}
            onFromSelect={onFromSelect}
            onToSelect={onToSelect}
            onFromClear={onFromClear}
            onToClear={onToClear}
            onSwap={onSwap}
            onSplit={onSplit}
            loading={loading}
            route={route}
            midpoint={midpoint}
            fromLocation={fromLocation}
            toLocation={toLocation}
            places={visiblePlaces}
            placesLoading={placesLoading}
            activeFilters={activeFilters}
            onFilterToggle={onFilterToggle}
            activePlaceId={activePlaceId}
            onPlaceClick={onPlaceClick}
            hasResults={hasResults}
            mobileCollapsed={false}
            onError={onError}
            selectedRouteIndex={selectedRouteIndex}
            onRouteSelect={onRouteSelect}
            travelMode={travelMode}
            onTravelModeChange={onTravelModeChange}
            midpointMode={midpointMode}
            onMidpointModeChange={onMidpointModeChange}
            localOnly={localOnly}
            onLocalOnlyToggle={onLocalOnlyToggle}
            onResplit={onResplit}
            extraLocations={extraLocations}
            onExtraLocationsChange={onExtraLocationsChange}
            multiResult={multiResult}
            driftRadius={driftRadius}
            onDriftRadiusChange={onDriftRadiusChange}
            roadTripStops={roadTripStops}
            roadTripInterval={roadTripInterval}
            activeStopIndex={activeStopIndex}
            onActiveStopIndexChange={onActiveStopIndexChange}
            onActivateRoadTrip={onActivateRoadTrip}
            onExitRoadTrip={onExitRoadTrip}
            isLoggedIn={isLoggedIn}
            savePlanStatus={savePlanStatus}
            onSavePlan={onSavePlan}
            creditStatus={creditStatus}
            creditsLoading={creditsLoading}
            onBuyCredits={onBuyCredits}
            enableLocationLookup={enableLocationLookup}
            panelView={panelView}
            onPanelViewChange={openPanelView}
            showPlannerControls={false}
            mobileSheetMode
            className="h-full w-full overflow-hidden border-0 bg-white"
          />
        </div>

        <nav className="absolute bottom-0 left-0 right-0 grid h-[64px] grid-cols-4 border-t border-gray-200 bg-white/95 backdrop-blur">
          <MobileNavButton
            active={panelView === 'plan'}
            label={hasResults ? 'Results' : 'Plan'}
            icon="results"
            onClick={() => openPanelView('plan')}
          />
          <MobileNavButton
            active={panelView === 'ai'}
            label="AI"
            icon="ai"
            onClick={() => openPanelView('ai')}
          />
          <MobileNavButton
            active={panelView === 'saved'}
            label="Saved"
            icon="saved"
            onClick={() => openPanelView('saved')}
          />
          <MobileNavButton
            active={false}
            label="Credits"
            icon="credits"
            badge={creditStatus?.hasActiveSubscription ? 'Pro' : creditStatus?.credits || null}
            onClick={onBuyCredits}
          />
        </nav>
      </div>
    </section>
  );
}
