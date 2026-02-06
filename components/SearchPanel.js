'use client';

import { useRef } from 'react';
import LocationInput from './LocationInput';
import MultiLocationInput from './MultiLocationInput';
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
  places,
  placesLoading,
  activeFilters,
  onFilterToggle,
  activePlaceId,
  onPlaceClick,
  hasResults,
  mobileCollapsed,
  onError,
  // Multi-location props
  isMultiMode,
  locations,
  onLocationChange,
  onLocationSelect,
  onLocationClear,
  onAddLocation,
  onRemoveLocation,
  driveTimes,
}) {
  const toInputRef = useRef(null);

  // For 2-location mode
  const canSplitTwo = fromValue.trim().length > 0 && toValue.trim().length > 0 && !loading;
  
  // For multi-location mode
  const filledLocations = locations?.filter((l) => l.value.trim().length > 0) || [];
  const canSplitMulti = filledLocations.length >= 2 && !loading;
  
  const canSplit = isMultiMode ? canSplitMulti : canSplitTwo;

  return (
    <div
      className={`w-[420px] min-w-[420px] bg-white border-r border-gray-200 overflow-y-auto overflow-x-hidden z-[100] transition-transform duration-300 max-md:w-full max-md:min-w-0 max-md:border-r-0 max-md:border-t max-md:border-gray-200 ${
        mobileCollapsed ? 'max-md:max-h-0 max-md:overflow-hidden max-md:p-0 max-md:border-t-0' : ''
      }`}
    >
      <div className="p-6 pb-8 max-md:p-5 max-md:pb-6">
        {/* Search Section */}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-gray-900 mb-1">
            Meet in the Middle
          </h1>
          <p className="text-sm text-gray-500 mb-5">
            Find the perfect halfway point based on actual drive time
          </p>

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
                {/* More dotted lines for multi-mode */}
                {isMultiMode && locations.slice(2).map((_, i) => (
                  <div key={i} className="flex flex-col items-center">
                    <div className="flex-1 w-0.5 my-1 border-l-2 border-dotted border-gray-300 min-h-[20px]" />
                    <div className="w-3 h-3 rounded-full bg-purple-500" />
                  </div>
                ))}
              </div>

              {/* Center: Input fields */}
              <div className="flex-1 flex flex-col gap-2">
                {isMultiMode ? (
                  /* Multi-location inputs */
                  locations.map((loc, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={loc.value}
                        onChange={(e) => onLocationChange(index, e.target.value)}
                        placeholder={index === 0 ? "Starting point" : index === 1 ? "Destination" : `Stop ${index}`}
                        className="flex-1 h-11 px-3 border border-gray-200 rounded-lg text-[15px] text-gray-800 bg-white outline-none transition-all duration-200 focus:border-teal-400 focus:ring-2 focus:ring-teal-100 placeholder:text-gray-400"
                      />
                      {locations.length > 2 && (
                        <button
                          onClick={() => onRemoveLocation(index)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-red-500 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <path d="M18 6L6 18M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  /* Two-location inputs */
                  <>
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
                  </>
                )}
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

            {/* Add destination button */}
            <button
              onClick={onAddLocation}
              className="flex items-center gap-2 mt-2 ml-6 py-2 text-sm text-gray-500 hover:text-teal-600 transition-colors"
            >
              <div className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                  <path d="M12 5v14M5 12h14" />
                </svg>
              </div>
              <span>Add destination</span>
            </button>
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
        {hasResults && (route || driveTimes) ? (
          <div className="animate-fadeInUp">
            <RouteInfo 
              route={route} 
              fromName={fromValue} 
              toName={toValue} 
              midpoint={midpoint}
              isMultiMode={isMultiMode}
              driveTimes={driveTimes}
              locations={locations}
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
            />
          </div>
        ) : (
          /* Empty State */
          <div className={`flex flex-col items-center text-center pt-10 pb-5 ${hasResults ? 'hidden' : ''}`}>
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
                { icon: '🛣️', text: 'Based on real drive time' },
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
