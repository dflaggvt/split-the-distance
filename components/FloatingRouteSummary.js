'use client';

import { formatDuration } from '@/lib/utils';

function shortLabel(value) {
  if (!value) return '';
  return value.split(',')[0].trim();
}

function formatMiles(meters) {
  if (!meters) return null;
  return `${Math.round(meters / 1609.344).toLocaleString()} mi`;
}

export default function FloatingRouteSummary({
  fromValue,
  toValue,
  route,
  multiResult,
  hasResults,
  loading,
  panelCollapsed,
  onEdit,
  onCollapsePanel,
}) {
  const from = shortLabel(fromValue) || 'Person A';
  const to = shortLabel(toValue) || 'Person B';
  const distance = route?.totalDistance ? formatMiles(route.totalDistance) : null;
  const duration = route?.totalDuration ? formatDuration(route.totalDuration) : null;

  return (
    <div className="hidden md:block absolute left-4 top-4 z-[50] w-[min(520px,calc(100%-32px))]">
      <div className="rounded-2xl border border-gray-200/80 bg-white/95 shadow-lg shadow-gray-900/10 backdrop-blur">
        <div className="flex items-center gap-3 px-4 py-3">
          <button
            type="button"
            onClick={onEdit}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700 transition hover:bg-teal-100"
            aria-label="Edit route"
          >
            <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="6" cy="6" r="2.5" />
              <circle cx="18" cy="18" r="2.5" />
              <path d="M8.5 6h3.5a4 4 0 0 1 0 8h-1a4 4 0 0 0 0 8h4.5" />
            </svg>
          </button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-gray-900">
              {hasResults ? `${from} -> ${to}` : 'Plan a fair midpoint'}
            </div>
            <div className="truncate text-xs text-gray-500">
              {loading
                ? 'Calculating route...'
                : hasResults
                  ? [duration, distance, multiResult ? 'group route' : null].filter(Boolean).join(' · ')
                  : 'Enter two locations, then split the distance.'}
            </div>
          </div>
          <button
            type="button"
            onClick={onCollapsePanel}
            className="rounded-full border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-600 transition hover:border-teal-200 hover:bg-teal-50 hover:text-teal-700"
          >
            {panelCollapsed ? 'Open' : 'More map'}
          </button>
        </div>
      </div>
    </div>
  );
}
