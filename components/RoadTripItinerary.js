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
  const activeColor = STOP_COLORS[activeStopIndex % STOP_COLORS.length];

  // Progress percentage for the active stop
  const progressPct = activeStop && totalDistance > 0
    ? Math.round((activeStop.distanceFromStart / totalDistance) * 100)
    : 0;

  return (
    <div className="mt-5 mb-3 animate-fadeInUp">
      {/* Header row */}
      <div className="flex items-center justify-between mb-1">
        <h3 className="text-[15px] font-bold text-gray-800 flex items-center gap-1.5">
          🛣️ Road Trip
        </h3>
        <button
          onClick={onExitRoadTrip}
          className="text-[11px] font-semibold text-gray-400 hover:text-red-400 transition-colors uppercase tracking-wide"
        >
          Exit
        </button>
      </div>
      <p className="text-[11px] text-gray-400 mb-4">
        {stops.length} stop{stops.length !== 1 ? 's' : ''} every{' '}
        {interval?.mode === 'distance'
          ? `${interval.value} mi`
          : `${interval.value} min`
        }
        <span className="mx-1 text-gray-300">&middot;</span>
        {formatDistance(totalDistance)}
        <span className="mx-1 text-gray-300">&middot;</span>
        {formatDuration(totalDuration)}
      </p>

      {/* Route progress track */}
      <div className="relative px-1 mb-4">
        {/* Background track */}
        <div className="absolute top-1/2 left-4 right-4 h-[3px] -translate-y-1/2 bg-gray-200 rounded-full" />
        {/* Filled track up to active stop */}
        <div
          className="absolute top-1/2 left-4 h-[3px] -translate-y-1/2 rounded-full transition-all duration-300"
          style={{
            background: activeColor,
            width: `${progressPct * 0.92}%`,
            opacity: 0.4,
          }}
        />

        {/* Dots on track */}
        <div className="relative flex items-center justify-between">
          {/* Start dot */}
          <button
            onClick={() => onActiveStopIndexChange?.(-1)}
            className="w-6 h-6 rounded-full bg-teal-600 flex items-center justify-center z-10 shrink-0"
            title={fromName?.split(',')[0] || 'Start'}
          >
            <span className="text-white text-[9px] font-black">A</span>
          </button>

          {/* Stop dots */}
          {stops.map((stop, idx) => {
            const isActive = idx === activeStopIndex;
            const color = STOP_COLORS[idx % STOP_COLORS.length];
            return (
              <button
                key={stop.index}
                onClick={() => onActiveStopIndexChange?.(idx)}
                className={`rounded-full flex items-center justify-center font-bold text-white z-10 shrink-0 transition-all duration-200 ${
                  isActive
                    ? 'w-9 h-9 text-[14px] shadow-lg ring-[3px] ring-white'
                    : 'w-6 h-6 text-[10px] hover:scale-110'
                }`}
                style={{ backgroundColor: color }}
                title={`Stop ${stop.index}: ${stop.label}`}
              >
                {stop.index}
              </button>
            );
          })}

          {/* End dot */}
          <button
            onClick={() => onActiveStopIndexChange?.(-2)}
            className="w-6 h-6 rounded-full bg-orange-500 flex items-center justify-center z-10 shrink-0"
            title={toName?.split(',')[0] || 'End'}
          >
            <span className="text-white text-[9px] font-black">B</span>
          </button>
        </div>

        {/* Labels under start/end */}
        <div className="flex justify-between mt-1 px-0">
          <span className="text-[10px] text-gray-400 font-medium w-6 text-center">
            {fromName?.split(',')[0]?.slice(0, 8) || 'Start'}
          </span>
          <span className="text-[10px] text-gray-400 font-medium w-6 text-center">
            {toName?.split(',')[0]?.slice(0, 8) || 'End'}
          </span>
        </div>
      </div>

      {/* Selected stop info card */}
      {activeStop && (
        <div
          className="rounded-xl overflow-hidden border transition-colors duration-200"
          style={{ borderColor: `${activeColor}30` }}
        >
          {/* Colored top bar */}
          <div className="h-1" style={{ background: activeColor }} />
          <div className="px-3.5 py-3 bg-white">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                {/* Stop badge */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-[13px] font-bold shrink-0"
                  style={{ backgroundColor: activeColor }}
                >
                  {activeStop.index}
                </div>
                <div>
                  <p className="text-[15px] font-bold text-gray-800 leading-tight">
                    {activeStop.label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {formatDuration(activeStop.timeFromStart)} in
                    <span className="mx-1 text-gray-300">&middot;</span>
                    {formatDistance(activeStop.distanceFromStart)}
                    <span className="mx-1 text-gray-300">&middot;</span>
                    {progressPct}% of trip
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
