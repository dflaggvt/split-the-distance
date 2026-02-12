'use client';

import { useRef } from 'react';
import LocationInput from './LocationInput';
import RouteInfo from './RouteInfo';
import FilterChips from './FilterChips';
import PlacesList from './PlacesList';
import ComingSoonSection from './ComingSoonSection';
import RouletteSection from './RouletteSection';
import SearchHistory from './SearchHistory';
import FeatureGate, { useGatedAction } from './FeatureGate';

export default function SearchPanel({
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
  mobileCollapsed,
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
  extraLocations = [],
  onExtraLocationsChange,
  multiResult,
}) {
  const toInputRef = useRef(null);
  const travelModeGate = useGatedAction('travel_modes');
  const distanceToggleGate = useGatedAction('distance_toggle');
  const group3Gate = useGatedAction('group_gravity_3');
  const group4Gate = useGatedAction('group_gravity_4plus');

  // Display max: always show button up to the highest theoretical tier
  // so the gate can prompt login/upgrade when clicked
  const displayMax = 3; // up to 5 total people

  const handleAddLocation = () => {
    const nextCount = extraLocations.length + 1;
    // Gate the action: first extra needs group_gravity_3 (free), 2+ needs group_gravity_4plus (premium)
    if (nextCount === 1) {
      group3Gate.gate(() => {
        onExtraLocationsChange?.([...extraLocations, { value: '', location: null }]);
      });
    } else if (nextCount <= 3) {
      group4Gate.gate(() => {
        onExtraLocationsChange?.([...extraLocations, { value: '', location: null }]);
      });
    }
  };

  const handleRemoveLocation = (idx) => {
    onExtraLocationsChange?.(extraLocations.filter((_, i) => i !== idx));
  };

  const handleExtraValueChange = (idx, val) => {
    onExtraLocationsChange?.(extraLocations.map((el, i) =>
      i === idx ? { ...el, value: val, location: val.trim() ? el.location : null } : el
    ));
  };

  const handleExtraSelect = (idx, loc) => {
    onExtraLocationsChange?.(extraLocations.map((el, i) =>
      i === idx ? { ...el, location: loc, value: loc.name } : el
    ));
  };

  const handleExtraClear = (idx) => {
    onExtraLocationsChange?.(extraLocations.map((el, i) =>
      i === idx ? { value: '', location: null } : el
    ));
  };

  const canSplit = fromValue.trim().length > 0 && toValue.trim().length > 0 && !loading;

  return (
    <div
      className={`w-[420px] min-w-[420px] bg-white border-r border-gray-200 overflow-y-auto overflow-x-hidden z-[100] transition-transform duration-300 max-md:w-full max-md:min-w-0 max-md:border-r-0 max-md:border-t max-md:border-gray-200 ${
        mobileCollapsed ? 'max-md:max-h-0 max-md:overflow-hidden max-md:p-0 max-md:border-t-0' : ''
      }`}
    >
      <div className="p-6 pb-8 max-md:p-5 max-md:pb-6">
        {/* Search Section */}
        <div>
          <p className="text-sm text-gray-500 mb-5">
            {extraLocations.length > 0
              ? <>Find the fairest meeting point for {2 + extraLocations.length} people by {
                  midpointMode === 'distance'
                    ? 'distance'
                    : travelMode === 'BICYCLING' ? 'cycling time' : travelMode === 'WALKING' ? 'walking time' : 'drive time'
                }</>
              : <>Find your halfway point based on {
                  midpointMode === 'distance'
                    ? 'distance'
                    : travelMode === 'BICYCLING' ? 'cycling time' : travelMode === 'WALKING' ? 'walking time' : travelMode === 'TRANSIT' ? 'transit time' : 'drive time'
                }</>
            }
          </p>

          {/* Travel Mode + Midpoint Mode row */}
          <div className="flex gap-2 mb-4 items-center">
            {/* Travel Mode Selector */}
            <div className="flex gap-1 flex-1">
              {[
                { mode: 'DRIVING', icon: '🚗', label: 'Drive' },
                { mode: 'BICYCLING', icon: '🚴', label: 'Bike' },
                { mode: 'WALKING', icon: '🚶', label: 'Walk' },
              ].map(({ mode, icon, label }) => (
                <button
                  key={mode}
                  onClick={() => travelModeGate.gate(() => onTravelModeChange?.(mode))}
                  className={`flex-1 flex items-center justify-center gap-1 py-2 px-2 rounded-lg text-[13px] font-medium transition-all ${
                    travelMode === mode
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span className="text-sm">{icon}</span>
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="w-px h-7 bg-gray-200" />

            {/* Midpoint Mode Toggle — always visible */}
            <div className="flex gap-1">
              {[
                { mode: 'time', icon: '⏱', title: 'Optimize by travel time' },
                { mode: 'distance', icon: '📏', title: 'Optimize by distance' },
              ].map(({ mode, icon, title }) => (
                <button
                  key={mode}
                  onClick={() => distanceToggleGate.gate(() => onMidpointModeChange?.(mode))}
                  title={title}
                  className={`w-9 h-9 flex items-center justify-center rounded-lg text-base transition-all ${
                    midpointMode === mode
                      ? 'bg-teal-600 text-white shadow-sm'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Input Group - Google Maps Style */}
          <div className="mb-4">
            <div className="flex">
              {/* Left side: Timeline markers */}
              <div className="flex flex-col items-center mr-3 py-3">
                {/* A marker */}
                <div className="w-3 h-3 rounded-full border-2 border-teal-500 bg-white" />
                <div className="flex-1 w-0.5 my-1 border-l-2 border-dotted border-gray-300 min-h-[20px]" />
                {/* B marker */}
                <div className="w-3 h-3 rounded-full border-2 border-orange-500 bg-white" />
                {/* Extra location markers */}
                {extraLocations.map((_, idx) => (
                  <div key={idx} className="flex flex-col items-center">
                    <div className="flex-1 w-0.5 my-1 border-l-2 border-dotted border-gray-300 min-h-[20px]" />
                    <div className={`w-3 h-3 rounded-full border-2 bg-white ${
                      idx === 0 ? 'border-purple-500' : idx === 1 ? 'border-blue-500' : 'border-pink-500'
                    }`} />
                  </div>
                ))}
              </div>

              {/* Center: Input fields */}
              <div className="flex-1 flex flex-col gap-2">
                <LocationInput
                  value={fromValue}
                  onChange={onFromChange}
                  onSelect={onFromSelect}
                  onClear={onFromClear}
                  onError={onError}
                  placeholder="Person A"
                  variant="minimal"
                  onEnter={() => toInputRef.current?.focus()}
                />
                <LocationInput
                  value={toValue}
                  onChange={onToChange}
                  onSelect={onToSelect}
                  onClear={onToClear}
                  onError={onError}
                  placeholder="Person B"
                  variant="minimal"
                  inputRef={toInputRef}
                  onEnter={canSplit ? onSplit : undefined}
                />
                {/* Extra location inputs */}
                {extraLocations.map((el, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <div className="flex-1">
                      <LocationInput
                        value={el.value}
                        onChange={(val) => handleExtraValueChange(idx, val)}
                        onSelect={(loc) => handleExtraSelect(idx, loc)}
                        onClear={() => handleExtraClear(idx)}
                        onError={onError}
                        placeholder={`Person ${String.fromCharCode(67 + idx)}`}
                        variant="minimal"
                        onEnter={canSplit ? onSplit : undefined}
                      />
                    </div>
                    <button
                      onClick={() => handleRemoveLocation(idx)}
                      className="w-7 h-7 flex items-center justify-center rounded-full text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors shrink-0"
                      title="Remove location"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>

              {/* Right side: Swap button (only for 2 locations) */}
              {extraLocations.length === 0 && (
                <div className="flex items-center ml-2">
                  <button
                    onClick={onSwap}
                    title="Swap locations"
                    aria-label="Swap locations"
                    className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-full transition-all duration-200"
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                    </svg>
                  </button>
                </div>
              )}
            </div>

            {/* + Add location button */}
            {extraLocations.length < displayMax && (
              <button
                onClick={handleAddLocation}
                className="mt-2 ml-6 flex items-center gap-1.5 text-[13px] font-medium text-teal-600 hover:text-teal-700 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add person ({2 + extraLocations.length}/{2 + displayMax})
              </button>
            )}
          </div>

          {/* Split Button */}
          <button
            data-split-btn
            onClick={onSplit}
            disabled={!canSplit}
            className={`w-full h-[52px] border-none rounded-[10px] text-white font-bold text-base cursor-pointer relative overflow-hidden transition-all duration-200 max-md:h-12 max-md:text-[15px] ${
              canSplit
                ? 'bg-gradient-to-br from-teal-600 to-teal-700 shadow-[0_2px_8px_rgba(13,148,136,0.3)] hover:from-teal-500 hover:to-teal-600 hover:shadow-[0_4px_14px_rgba(13,148,136,0.4)] hover:-translate-y-px active:translate-y-0 active:shadow-[0_2px_6px_rgba(13,148,136,0.3)]'
                : 'bg-gray-300 cursor-not-allowed shadow-none'
            }`}
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="inline-block w-[18px] h-[18px] border-[2.5px] border-white/30 border-t-white rounded-full animate-spin" />
                Calculating...
              </span>
            ) : (
              'Split The Distance'
            )}
          </button>
        </div>

        {/* Results */}
        {hasResults && (route || multiResult) ? (
          <div className="animate-fadeInUp">
            <RouteInfo 
              route={route} 
              fromName={fromValue} 
              toName={toValue} 
              fromLocation={fromLocation}
              toLocation={toLocation}
              midpoint={midpoint}
              selectedRouteIndex={selectedRouteIndex}
              onRouteSelect={onRouteSelect}
              travelMode={travelMode}
              multiResult={multiResult}
            />
            <FilterChips
              activeFilters={activeFilters}
              onToggle={onFilterToggle}
              localOnly={localOnly}
              onLocalOnlyToggle={onLocalOnlyToggle}
            />
            <PlacesList
              places={localOnly ? places.filter(p => !p.brand) : places}
              loading={placesLoading}
              activePlaceId={activePlaceId}
              onPlaceClick={onPlaceClick}
              activeFilters={activeFilters}
            />
            <FeatureGate feature="roulette">
              <RouletteSection
                midpoint={midpoint}
                onPlaceClick={onPlaceClick}
              />
            </FeatureGate>
            {/* Coming Soon features teaser */}
            <ComingSoonSection show={true} />
          </div>
        ) : (
          /* Empty State + Search History */
          <div className={`pt-4 pb-5 ${hasResults ? 'hidden' : ''}`}>
            {/* Search History (for logged-in users) */}
            <SearchHistory onResplit={onResplit} show={!hasResults} />

            <div className="flex flex-col items-center text-center pt-4">
            <div className="mb-5 opacity-90">
              <svg
                width="120"
                height="120"
                viewBox="0 0 120 120"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <circle
                  cx="60"
                  cy="60"
                  r="50"
                  fill="#f0fdfa"
                  stroke="#99f6e4"
                  strokeWidth="2"
                />
                <path
                  d="M35 70 Q60 30 85 70"
                  stroke="#0d9488"
                  strokeWidth="3"
                  fill="none"
                  strokeLinecap="round"
                />
                <circle cx="35" cy="70" r="6" fill="#0d9488" />
                <circle cx="85" cy="70" r="6" fill="#0d9488" />
                <circle
                  cx="60"
                  cy="45"
                  r="8"
                  fill="#f97316"
                  stroke="white"
                  strokeWidth="2"
                />
                <path
                  d="M57 45h6M60 42v6"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <p className="text-[15px] text-gray-500 mb-6">
              Enter two locations above to find the perfect meeting point
            </p>
            <div className="flex flex-col gap-3 w-full max-w-[280px]">
              {[
                { icon: '🛣️', text: 'Based on real travel time' },
                { icon: '📍', text: 'Discover places at the midpoint' },
                { icon: '🔗', text: 'Share results with a link' },
              ].map((feature) => (
                <div
                  key={feature.text}
                  className="flex items-center gap-2.5 text-sm text-gray-600"
                >
                  <span className="text-lg">{feature.icon}</span>
                  <span>{feature.text}</span>
                </div>
              ))}
            </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
