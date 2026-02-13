'use client';

import { formatDuration, formatDistance } from '@/lib/utils';

// Stop marker colors match MapView
const STOP_COLORS = ['#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c'];

export default function RoadTripItinerary({
  stops,
  interval,
  fromName,
  toName,
  route,
  activeStopIndex = 0,
  onActiveStopIndexChange,
  onExitRoadTrip,
}) {
  if (!stops || stops.length === 0) return null;

  const totalDuration = route?.totalDuration || 0;
  const totalDistance = route?.totalDistance || 0;
  const activeStop = stops[activeStopIndex];

  return (
    <div className="mt-5 mb-3 animate-fadeInUp">
      {/* Compact header */}
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5">
          <span className="text-lg">🛣️</span>
          Road Trip Stops
        </h3>
        <button
          onClick={onExitRoadTrip}
          className="text-[12px] font-medium text-gray-400 hover:text-gray-600 transition-colors"
        >
          Exit
        </button>
      </div>
      <p className="text-[12px] text-gray-400 mb-3">
        {stops.length} stop{stops.length !== 1 ? 's' : ''} every{' '}
        {interval?.mode === 'distance'
          ? `${interval.value} mi`
          : `${interval.value} min`
        }
        {' '}along {formatDistance(totalDistance)} / {formatDuration(totalDuration)}
      </p>

      {/* Horizontal stop pills */}
      <div className="flex items-center gap-1.5 mb-3 overflow-x-auto pb-1">
        {/* Start pill */}
        <button
          onClick={() => onActiveStopIndexChange?.(-1)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-teal-600 text-white"
          title={fromName?.split(',')[0] || 'Start'}
        >
          <span className="text-[10px]">A</span>
          <span>Start</span>
        </button>

        {/* Numbered stop pills */}
        {stops.map((stop, idx) => {
          const isActive = idx === activeStopIndex;
          const color = STOP_COLORS[idx % STOP_COLORS.length];
          return (
            <button
              key={stop.index}
              onClick={() => onActiveStopIndexChange?.(idx)}
              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-[13px] font-bold text-white transition-all ${
                isActive ? 'ring-2 ring-offset-2 scale-110 shadow-md' : 'opacity-75 hover:opacity-100'
              }`}
              style={{
                backgroundColor: color,
                '--tw-ring-color': color,
              }}
              title={`Stop ${stop.index}: ${stop.label}`}
            >
              {stop.index}
            </button>
          );
        })}

        {/* End pill */}
        <button
          onClick={() => onActiveStopIndexChange?.(-2)}
          className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-full text-[11px] font-bold bg-orange-500 text-white"
          title={toName?.split(',')[0] || 'End'}
        >
          <span className="text-[10px]">B</span>
          <span>End</span>
        </button>
      </div>

      {/* Selected stop info card */}
      {activeStop && (
        <div className="px-3 py-2.5 rounded-lg border border-gray-200 bg-white mb-1">
          <p className="text-[15px] font-bold text-gray-800">{activeStop.label}</p>
          <p className="text-[12px] text-gray-400 mt-0.5">
            {formatDuration(activeStop.timeFromStart)} from start
            <span className="mx-1.5 text-gray-300">|</span>
            {formatDistance(activeStop.distanceFromStart)}
          </p>
        </div>
      )}
    </div>
  );
}
