'use client';

import { CATEGORIES } from '@/lib/places';
import { formatDuration, formatDistance } from '@/lib/utils';
import PlaceCard from './PlaceCard';

const CATEGORY_KEYS = ['restaurant', 'cafe', 'fuel', 'park', 'activity', 'hotel'];

// Stop marker colors match MapView
const STOP_COLORS = ['#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c'];

export default function RoadTripItinerary({
  stops,
  interval,
  fromName,
  toName,
  route,
  stopPlaces = {},
  stopFilters = {},
  stopPlacesLoading = {},
  activeStopIndex = 0,
  onActiveStopIndexChange,
  onStopFilterToggle,
  onPlaceClick,
  activePlaceId,
  onExitRoadTrip,
}) {
  if (!stops || stops.length === 0) return null;

  const totalDuration = route?.totalDuration || 0;
  const totalDistance = route?.totalDistance || 0;

  // Get places for a given stop, combining all active categories
  const getStopPlaces = (stopIndex) => {
    const filters = stopFilters[stopIndex] || [];
    if (filters.length === 0) return [];
    const all = [];
    filters.forEach(cat => {
      const key = `${stopIndex}|${cat}`;
      if (stopPlaces[key]) {
        all.push(...stopPlaces[key]);
      }
    });
    // Sort by distance and deduplicate
    const seen = new Set();
    return all
      .sort((a, b) => a.distance - b.distance)
      .filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
  };

  return (
    <div className="animate-fadeInUp">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 mt-5">
        <div>
          <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5">
            <span className="text-lg">🛣️</span>
            Road Trip Stops
          </h3>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {stops.length} stop{stops.length !== 1 ? 's' : ''} every{' '}
            {interval?.mode === 'distance'
              ? `${interval.value} mi`
              : `${interval.value} min`
            }
            {' '}along {formatDistance(totalDistance)} / {formatDuration(totalDuration)}
          </p>
        </div>
        <button
          onClick={onExitRoadTrip}
          className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
          title="Exit road trip mode"
        >
          Exit
        </button>
      </div>

      {/* Timeline */}
      <div className="relative">
        {/* Start node */}
        <div className="flex items-start gap-3 mb-0">
          <div className="flex flex-col items-center">
            <div className="w-5 h-5 rounded-full bg-teal-600 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">A</span>
            </div>
            <div className="w-0.5 h-4 bg-gray-200" />
          </div>
          <div className="pt-0.5">
            <p className="text-[13px] font-semibold text-gray-700">{fromName?.split(',')[0] || 'Start'}</p>
            <p className="text-[11px] text-gray-400">Departure</p>
          </div>
        </div>

        {/* Stop cards */}
        {stops.map((stop, idx) => {
          const isActive = idx === activeStopIndex;
          const color = STOP_COLORS[idx % STOP_COLORS.length];
          const filters = stopFilters[idx] || [];
          const places = getStopPlaces(idx);
          const isLoading = stopPlacesLoading[idx];

          return (
            <div key={stop.index} className="flex items-start gap-3 mb-0">
              {/* Timeline connector + numbered dot */}
              <div className="flex flex-col items-center">
                <div className="w-0.5 h-3 bg-gray-200" />
                <button
                  onClick={() => onActiveStopIndexChange?.(idx)}
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-white text-[12px] font-bold transition-all ${
                    isActive ? 'ring-2 ring-offset-1 shadow-md scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                  style={{ backgroundColor: color, ringColor: color }}
                  title={`Stop ${stop.index}: ${stop.label}`}
                >
                  {stop.index}
                </button>
                <div className="w-0.5 h-3 bg-gray-200" />
              </div>

              {/* Stop content */}
              <div className={`flex-1 -mt-0.5 mb-1 rounded-lg border transition-all ${
                isActive
                  ? 'border-teal-300 bg-teal-50/30 shadow-sm'
                  : 'border-gray-150 bg-white hover:border-gray-250'
              }`}>
                <button
                  onClick={() => onActiveStopIndexChange?.(idx)}
                  className="w-full text-left px-3 py-2.5"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-[14px] font-semibold text-gray-800">{stop.label}</p>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {formatDuration(stop.timeFromStart)} from start
                        <span className="mx-1 text-gray-300">|</span>
                        {formatDistance(stop.distanceFromStart)}
                      </p>
                    </div>
                    <svg
                      width="14" height="14" viewBox="0 0 24 24"
                      fill="none" stroke="currentColor" strokeWidth="2"
                      strokeLinecap="round" strokeLinejoin="round"
                      className={`text-gray-400 transition-transform ${isActive ? 'rotate-180' : ''}`}
                    >
                      <path d="M6 9l6 6 6-6" />
                    </svg>
                  </div>
                </button>

                {/* Expanded content: category chips + places */}
                {isActive && (
                  <div className="px-3 pb-3 animate-fadeInUp">
                    {/* Category chips */}
                    <div className="flex flex-wrap gap-1 mt-1 mb-2">
                      {CATEGORY_KEYS.map(key => {
                        const cat = CATEGORIES[key];
                        const active = filters.includes(key);
                        return (
                          <button
                            key={key}
                            onClick={() => onStopFilterToggle?.(idx, key)}
                            className={`px-2 py-1 border rounded-full text-[11px] font-medium transition-all ${
                              active
                                ? 'bg-teal-600 border-teal-600 text-white'
                                : 'bg-white border-gray-200 text-gray-500 hover:border-teal-300'
                            }`}
                          >
                            {cat.chipLabel}
                          </button>
                        );
                      })}
                    </div>

                    {/* Loading spinner */}
                    {isLoading && (
                      <div className="flex items-center justify-center py-3">
                        <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin" />
                      </div>
                    )}

                    {/* Places list */}
                    {places.length > 0 && (
                      <div className="flex flex-col gap-1.5 mt-1">
                        {places.slice(0, 5).map(place => (
                          <PlaceCard
                            key={place.id}
                            place={place}
                            isActive={place.id === activePlaceId}
                            onClick={onPlaceClick}
                          />
                        ))}
                        {places.length > 5 && (
                          <p className="text-[11px] text-gray-400 text-center mt-1">
                            +{places.length - 5} more nearby
                          </p>
                        )}
                      </div>
                    )}

                    {/* Empty state for no places */}
                    {!isLoading && filters.length > 0 && places.length === 0 && (
                      <p className="text-[12px] text-gray-400 text-center py-2">
                        No places found near this stop
                      </p>
                    )}

                    {/* Hint when no filters selected */}
                    {filters.length === 0 && (
                      <p className="text-[11px] text-gray-400 text-center py-1">
                        Tap a category to discover places near this stop
                      </p>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Destination node */}
        <div className="flex items-start gap-3">
          <div className="flex flex-col items-center">
            <div className="w-0.5 h-3 bg-gray-200" />
            <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
              <span className="text-white text-[10px] font-bold">B</span>
            </div>
          </div>
          <div className="pt-1.5">
            <p className="text-[13px] font-semibold text-gray-700">{toName?.split(',')[0] || 'Destination'}</p>
            <p className="text-[11px] text-gray-400">
              {formatDuration(totalDuration)} total
              <span className="mx-1 text-gray-300">|</span>
              {formatDistance(totalDistance)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
