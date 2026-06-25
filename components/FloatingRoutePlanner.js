'use client';

import { useMemo, useRef } from 'react';
import LocationInput from './LocationInput';
import { useGatedAction } from './FeatureGate';

const TRAVEL_MODE_LIMITS = { DRIVING: Infinity, BICYCLING: 75, WALKING: 25 };

function haversineMiles(a, b) {
  const R = 3958.8;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = ((b.lon || b.lng) - (a.lon || a.lng)) * Math.PI / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLon = Math.sin(dLon / 2);
  const h = sinLat * sinLat + Math.cos(a.lat * Math.PI / 180) * Math.cos(b.lat * Math.PI / 180) * sinLon * sinLon;
  return R * 2 * Math.asin(Math.sqrt(h));
}

export default function FloatingRoutePlanner({
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
  fromLocation,
  toLocation,
  travelMode,
  onTravelModeChange,
  midpointMode,
  onMidpointModeChange,
  extraLocations = [],
  onExtraLocationsChange,
  onError,
  creditStatus,
  creditsLoading,
  onBuyCredits,
  enableLocationLookup,
  panelCollapsed,
  onTogglePanel,
  compactMobile = false,
  className = '',
}) {
  const toInputRef = useRef(null);
  const travelModeGate = useGatedAction('travel_modes');
  const distanceToggleGate = useGatedAction('distance_toggle');
  const group3Gate = useGatedAction('group_gravity_3');
  const group4Gate = useGatedAction('group_gravity_4plus');

  const maxPairwiseMiles = useMemo(() => {
    const locs = [fromLocation, toLocation, ...extraLocations.map((el) => el.location)].filter(Boolean);
    if (locs.length < 2) return 0;
    let max = 0;
    for (let i = 0; i < locs.length; i += 1) {
      for (let j = i + 1; j < locs.length; j += 1) {
        max = Math.max(max, haversineMiles(locs[i], locs[j]));
      }
    }
    return max;
  }, [extraLocations, fromLocation, toLocation]);

  const canSplit = fromValue.trim().length > 0 && toValue.trim().length > 0 && !loading;
  const displayMax = 3;
  const mobileInputClassName = compactMobile ? 'max-sm:h-10 max-sm:text-sm' : '';

  const handleTravelModeClick = (mode) => {
    const limit = TRAVEL_MODE_LIMITS[mode];
    if (maxPairwiseMiles > limit) {
      onError?.(`Locations are too far apart for ${mode === 'WALKING' ? 'walking' : 'biking'} (${Math.round(maxPairwiseMiles)} mi apart, max ${limit} mi). Try driving instead.`);
      return;
    }
    travelModeGate.gate(() => onTravelModeChange?.(mode));
  };

  const handleAddLocation = () => {
    const nextCount = extraLocations.length + 1;
    if (nextCount === 1) {
      group3Gate.gate(() => {
        onExtraLocationsChange?.([...extraLocations, { value: '', location: null }]);
      });
    } else if (nextCount <= displayMax) {
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
      i === idx ? { ...el, value: val, location: val.trim() && enableLocationLookup ? el.location : null } : el
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

  const shellClassName = className || 'hidden md:block absolute left-4 top-4 z-[60] w-[min(590px,calc(100%-32px))]';

  return (
    <div className={shellClassName}>
      <div className="rounded-2xl border border-gray-200/80 bg-white/95 shadow-xl shadow-gray-900/15 backdrop-blur max-sm:rounded-[20px]">
        <div className="flex items-center gap-2 border-b border-gray-100 px-3 py-2 max-sm:flex-wrap max-sm:px-2 max-sm:py-2">
          <div className="flex flex-1 gap-1">
            {[
              { mode: 'DRIVING', icon: '🚗', label: 'Drive' },
              { mode: 'BICYCLING', icon: '🚴', label: 'Bike' },
              { mode: 'WALKING', icon: '🚶', label: 'Walk' },
            ].map(({ mode, icon, label }) => {
              const tooFar = maxPairwiseMiles > TRAVEL_MODE_LIMITS[mode];
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => handleTravelModeClick(mode)}
                  title={tooFar ? `Too far for ${label.toLowerCase()}` : label}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-2 text-xs font-bold transition ${
                    travelMode === mode
                      ? 'bg-teal-600 text-white shadow-sm'
                      : tooFar
                        ? 'bg-gray-50 text-gray-300'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  <span>{icon}</span>
                  <span>{label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex gap-1">
            {[
              { mode: 'time', icon: '⏱', title: 'Optimize by travel time' },
              { mode: 'distance', icon: '📏', title: 'Optimize by distance' },
            ].map(({ mode, icon, title }) => (
              <button
                key={mode}
                type="button"
                onClick={() => distanceToggleGate.gate(() => onMidpointModeChange?.(mode))}
                title={title}
                className={`flex h-9 w-9 items-center justify-center rounded-full text-sm transition ${
                  midpointMode === mode
                    ? 'bg-teal-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {icon}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onTogglePanel}
            className={`rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 max-sm:ml-auto ${compactMobile ? 'max-sm:hidden' : ''}`}
          >
            {panelCollapsed ? 'Show results' : 'Hide panel'}
          </button>
        </div>

        <div className="flex gap-3 px-3 py-3 max-sm:flex-col max-sm:gap-2 max-sm:px-2 max-sm:py-2">
          <div className="flex flex-col items-center py-3 max-sm:hidden">
            <div className="h-3 w-3 rounded-full border-2 border-teal-500 bg-white" />
            <div className="my-1 min-h-[22px] flex-1 border-l-2 border-dotted border-gray-300" />
            <div className="h-3 w-3 rounded-full border-2 border-orange-500 bg-white" />
            {extraLocations.map((_, idx) => (
              <div key={idx} className="flex flex-col items-center">
                <div className="my-1 min-h-[22px] flex-1 border-l-2 border-dotted border-gray-300" />
                <div className={`h-3 w-3 rounded-full border-2 bg-white ${
                  idx === 0 ? 'border-purple-500' : idx === 1 ? 'border-blue-500' : 'border-pink-500'
                }`} />
              </div>
            ))}
          </div>

          <div className="min-w-0 flex-1 space-y-2">
            <LocationInput
              value={fromValue}
              onChange={onFromChange}
              onSelect={onFromSelect}
              onClear={onFromClear}
              onError={onError}
              placeholder="Person A"
              variant="minimal"
              onEnter={() => toInputRef.current?.focus()}
              enableLocationLookup={enableLocationLookup}
              inputClassName={mobileInputClassName}
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
              enableLocationLookup={enableLocationLookup}
              inputClassName={mobileInputClassName}
            />
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
                    enableLocationLookup={enableLocationLookup}
                    inputClassName={mobileInputClassName}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleRemoveLocation(idx)}
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-gray-300 transition hover:bg-red-50 hover:text-red-500"
                  title="Remove location"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            ))}

            {extraLocations.length < displayMax && (
              <button
                type="button"
                onClick={handleAddLocation}
                className="flex items-center gap-1.5 text-xs font-bold text-teal-700 transition hover:text-teal-800 max-sm:mt-1"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="12" y1="5" x2="12" y2="19" />
                  <line x1="5" y1="12" x2="19" y2="12" />
                </svg>
                Add person ({2 + extraLocations.length}/{2 + displayMax})
              </button>
            )}
          </div>

          <div className="flex w-[150px] shrink-0 flex-col gap-2 max-sm:w-full max-sm:flex-row max-sm:gap-2">
            {extraLocations.length === 0 && (
              <button
                type="button"
                onClick={onSwap}
                title="Swap locations"
                className="flex h-10 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700 max-sm:w-12 max-sm:shrink-0"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4" />
                </svg>
              </button>
            )}
            <button
              data-split-btn
              type="button"
              onClick={onSplit}
              disabled={!canSplit}
              className={`h-11 rounded-lg text-sm font-bold text-white transition max-sm:h-10 max-sm:flex-1 ${
                canSplit
                  ? 'bg-teal-600 shadow-sm hover:bg-teal-700'
                  : 'cursor-not-allowed bg-gray-300'
              }`}
            >
              {loading ? 'Calculating...' : 'Split'}
            </button>
            <div className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 max-sm:w-28 max-sm:shrink-0 max-sm:py-1.5">
              <div className="flex items-center justify-between gap-2">
                <p className="truncate text-xs font-bold text-gray-700">
                  {creditStatus?.hasActiveSubscription
                    ? 'Premium'
                    : creditsLoading
                      ? 'Checking...'
                      : `${creditStatus?.credits || 0} credits`}
                </p>
                {!creditStatus?.hasActiveSubscription && (
                  <button
                    type="button"
                    onClick={onBuyCredits}
                    className="text-xs font-bold text-teal-700 hover:text-teal-800"
                  >
                    Buy
                  </button>
                )}
              </div>
              <p className="mt-0.5 text-[10px] text-gray-400">Used after successful searches</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
