'use client';

import { useRef } from 'react';
import LocationInput from './LocationInput';
import RouteInfo from './RouteInfo';
import FilterChips from './FilterChips';
import PlacesList from './PlacesList';

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
}) {
  const toInputRef = useRef(null);

  const canSplit = fromValue.trim().length > 0 && toValue.trim().length > 0 && !loading;

  return (
    <div
      className={`w-[420px] min-w-[420px] bg-white border-r border-gray-200 overflow-y-auto overflow-x-hidden z-[100] transition-transform duration-300 max-md:w-full max-md:min-w-0 max-md:border-r-0 max-md:border-none max-md:contents ${
        mobileCollapsed ? 'max-md:max-h-0 max-md:overflow-hidden max-md:p-0 max-md:border-t-0' : ''
      }`}
    >
      {/* Search inputs - on mobile this renders ABOVE the map via contents + order */}
      <div className="hidden max-md:block max-md:order-[-1] bg-white p-4 pb-3 border-b border-gray-200">
        <p className="text-sm text-gray-500 mb-3">
          Find your halfway point based on {travelMode === 'BICYCLING' ? 'cycling' : travelMode === 'WALKING' ? 'walking' : travelMode === 'TRANSIT' ? 'transit' : 'drive'} time
        </p>
        {/* Travel Mode Selector */}
        <div className="flex gap-1 mb-3">
          {[
            { mode: 'DRIVING', icon: '🚗', label: 'Drive' },
            { mode: 'BICYCLING', icon: '🚴', label: 'Bike' },
            { mode: 'WALKING', icon: '🚶', label: 'Walk' },
          ].map(({ mode, icon, label }) => (
            <button
              key={mode}
              onClick={() => onTravelModeChange?.(mode)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-sm font-medium transition-all ${
                travelMode === mode
                  ? 'bg-teal-600 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <span>{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </div>
        {/* Input Group */}
        <div className="mb-3">
          <div className="flex">
            <div className="flex flex-col items-center mr-3 py-3">
              <div className="w-3 h-3 rounded-full border-2 border-gray-400 bg-white" />
              <div className="flex-1 w-0.5 my-1 border-l-2 border-dotted border-gray-300 min-h-[20px]" />
              <div className="w-3 h-3 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 flex flex-col gap-2">
              <LocationInput
                value={fromValue}
                onChange={onFromChange}
                onSelect={onFromSelect}
                onClear={onFromClear}
                onError={onError}
                placeholder="Starting point"
                variant="minimal"
                onEnter={() => toInputRef.current?.focus()}
              />
              <LocationInput
                value={toValue}
                onChange={onToChange}
                onSelect={onToSelect}
                onClear={onToClear}
                onError={onError}
                placeholder="Destination"
                variant="minimal"
                inputRef={toInputRef}
                onEnter={canSplit ? onSplit : undefined}
              />
            </div>
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
          </div>
        </div>
        {/* Split Button */}
        <button
          onClick={onSplit}
          disabled={!canSplit}
          className={`w-full h-12 border-none rounded-[10px] text-white font-bold text-[15px] cursor-pointer relative overflow-hidden transition-all duration-200 ${
            canSplit
              ? 'bg-gradient-to-br from-teal-600 to-teal-700 shadow-[0_2px_8px_rgba(13,148,136,0.3)] hover:from-teal-500 hover:to-teal-600'
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

      {/* Desktop panel + mobile results (below map) */}
      <div className="p-6 pb-8 max-md:p-5 max-md:pb-6 max-md:order-[1]">
        {/* Search Section - desktop only */}
        <div className="max-md:hidden">
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mb-1">
            Split The Distance
          </h1>
          <p className="text-sm text-gray-500 mb-5">
            Find your halfway point based on {travelMode === 'BICYCLING' ? 'cycling' : travelMode === 'WALKING' ? 'walking' : travelMode === 'TRANSIT' ? 'transit' : 'drive'} time
          </p>

          {/* Travel Mode Selector */}
          <div className="flex gap-1 mb-4">
            {[
              { mode: 'DRIVING', icon: '🚗', label: 'Drive' },
              { mode: 'BICYCLING', icon: '🚴', label: 'Bike' },
              { mode: 'WALKING', icon: '🚶', label: 'Walk' },
            ].map(({ mode, icon, label }) => (
              <button
                key={mode}
                onClick={() => onTravelModeChange?.(mode)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all ${
                  travelMode === mode
                    ? 'bg-teal-600 text-white shadow-sm'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* Input Group - Google Maps Style */}
          <div className="mb-4">
            <div className="flex">
              {/* Left side: Timeline markers */}
              <div className="flex flex-col items-center mr-3 py-3">
                {/* Origin marker (hollow circle) */}
                <div className="w-3 h-3 rounded-full border-2 border-gray-400 bg-white" />
                {/* Dotted line */}
                <div className="flex-1 w-0.5 my-1 border-l-2 border-dotted border-gray-300 min-h-[20px]" />
                {/* Destination marker (red pin) */}
                <div className="w-3 h-3 rounded-full bg-red-500" />
              </div>

              {/* Center: Input fields */}
              <div className="flex-1 flex flex-col gap-2">
                <LocationInput
                  value={fromValue}
                  onChange={onFromChange}
                  onSelect={onFromSelect}
                  onClear={onFromClear}
                  onError={onError}
                  placeholder="Starting point"
                  variant="minimal"
                  onEnter={() => toInputRef.current?.focus()}
                />
                <LocationInput
                  value={toValue}
                  onChange={onToChange}
                  onSelect={onToSelect}
                  onClear={onToClear}
                  onError={onError}
                  placeholder="Destination"
                  variant="minimal"
                  inputRef={toInputRef}
                  onEnter={canSplit ? onSplit : undefined}
                />
              </div>

              {/* Right side: Swap button */}
              <div className="flex items-center ml-2">
                <button
                  onClick={onSwap}
                  title="Swap locations"
                  aria-label="Swap locations"
                  className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-teal-600 hover:bg-gray-50 rounded-full transition-all duration-200"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Split Button */}
          <button
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
        {hasResults && route ? (
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
            />
            <FilterChips
              activeFilters={activeFilters}
              onToggle={onFilterToggle}
            />
            <PlacesList
              places={places}
              loading={placesLoading}
              activePlaceId={activePlaceId}
              onPlaceClick={onPlaceClick}
              activeFilters={activeFilters}
            />
          </div>
        ) : (
          /* Empty State - desktop only */
          <div className={`flex flex-col items-center text-center pt-10 pb-5 max-md:hidden ${hasResults ? 'hidden' : ''}`}>
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
        )}
      </div>
    </div>
  );
}
