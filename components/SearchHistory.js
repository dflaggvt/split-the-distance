'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useGatedAction } from './FeatureGate';
import { fetchHistory, deleteHistoryEntry, clearAllHistory } from '@/lib/searchHistory';

function timeAgo(dateStr) {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const seconds = Math.floor((now - then) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days === 1) return 'yesterday';
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 4) return `${weeks}w ago`;
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function shortName(name) {
  if (!name) return '';
  return name.split(',')[0].trim();
}

function formatDistance(miles) {
  const value = Number(miles);
  if (!Number.isFinite(value)) return null;
  return value < 10 ? `${value.toFixed(1)} mi` : `${Math.round(value)} mi`;
}

function formatDuration(seconds) {
  const value = Number(seconds);
  if (!Number.isFinite(value)) return null;

  const minutes = Math.max(1, Math.round(value / 60));
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (!hours) return `${minutes} min`;
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`;
}

function modeLabel(mode) {
  if (mode === 'BICYCLING') return 'Bike';
  if (mode === 'WALKING') return 'Walk';
  return 'Drive';
}

function RouteDots({ library }) {
  return (
    <div className="flex shrink-0 flex-col items-center gap-0.5">
      <div
        className={
          library
            ? 'h-2.5 w-2.5 rounded-full border-2 border-teal-500 bg-white'
            : 'h-2 w-2 rounded-full border-[1.5px] border-gray-400 bg-white'
        }
      />
      <div className={library ? 'h-4 w-px bg-gray-300' : 'h-2.5 w-px bg-gray-300'} />
      <div className={library ? 'h-2.5 w-2.5 rounded-full bg-red-500' : 'h-2 w-2 rounded-full bg-red-500'} />
    </div>
  );
}

export default function SearchHistory({
  onResplit,
  show,
  label = 'Recent',
  variant = 'default',
  emptyTitle = '',
  emptyBody = '',
}) {
  const { isLoggedIn, user } = useAuth();
  const historyGate = useGatedAction('search_history');
  const userId = user?.id;
  const isLibrary = variant === 'library';

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showClear, setShowClear] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!isLoggedIn || !userId) return;
    setLoading(true);
    const data = await fetchHistory(userId);
    setHistory(data);
    setLoading(false);
  }, [isLoggedIn, userId]);

  useEffect(() => {
    if (show && isLoggedIn) {
      queueMicrotask(() => loadHistory());
    }
  }, [show, isLoggedIn, loadHistory]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.__refreshSearchHistory = loadHistory;
    }
    return () => {
      if (typeof window !== 'undefined') {
        delete window.__refreshSearchHistory;
      }
    };
  }, [loadHistory]);

  const handleDelete = async (entryId) => {
    const ok = await deleteHistoryEntry(entryId);
    if (ok) {
      setHistory((prev) => prev.filter((h) => h.id !== entryId));
    }
  };

  const handleClearAll = async () => {
    if (!user?.id) return;
    const ok = await clearAllHistory(user.id);
    if (ok) {
      setHistory([]);
      setShowClear(false);
    }
  };

  const handleResplit = (entry) => {
    onResplit?.({
      fromName: entry.from_name,
      fromLat: entry.from_lat,
      fromLng: entry.from_lng,
      toName: entry.to_name,
      toLat: entry.to_lat,
      toLng: entry.to_lng,
      travelMode: entry.travel_mode,
      midpointMode: entry.midpoint_mode,
    });
  };

  if (!show || !isLoggedIn) return null;
  if (!historyGate.allowed) return null;

  if (loading) {
    return (
      <div className="mb-4">
        <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">{label}</div>
        <div className="flex items-center justify-center rounded-xl border border-gray-100 bg-gray-50 py-5 text-sm text-gray-400">
          <span className="mr-2 inline-block h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-teal-500" />
          Loading...
        </div>
      </div>
    );
  }

  if (history.length === 0) {
    if (!emptyTitle && !emptyBody) return null;

    return (
      <div className="mb-4 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-4 py-5 text-center">
        {emptyTitle ? <p className="text-sm font-bold text-gray-900">{emptyTitle}</p> : null}
        {emptyBody ? <p className="mt-1 text-sm text-gray-500">{emptyBody}</p> : null}
      </div>
    );
  }

  return (
    <div className="mb-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-gray-400"
          >
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
        </div>

        <div className="relative">
          <button
            type="button"
            onClick={() => setShowClear(!showClear)}
            className="rounded-full px-2 py-1 text-[11px] font-semibold text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            Clear
          </button>
          {showClear && (
            <div className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-lg border border-gray-200 bg-white p-3 shadow-lg animate-fadeInUp">
              <p className="mb-2 text-xs text-gray-600">Clear all search history?</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClearAll}
                  className="flex-1 rounded-md bg-red-500 px-2 py-1.5 text-xs font-medium text-white transition-colors hover:bg-red-600"
                >
                  Clear All
                </button>
                <button
                  type="button"
                  onClick={() => setShowClear(false)}
                  className="flex-1 rounded-md bg-gray-100 px-2 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className={isLibrary ? 'space-y-2.5' : 'flex flex-col gap-1'}>
        {history.map((entry) => {
          const distance = formatDistance(entry.distance_miles);
          const duration = formatDuration(entry.duration_seconds);

          return (
            <div
              key={entry.id}
              className={
                isLibrary
                  ? 'group rounded-2xl border border-gray-200 bg-white p-3 shadow-sm transition hover:border-teal-200 hover:shadow-md'
                  : 'group rounded-lg border border-transparent transition hover:border-gray-200 hover:bg-gray-50'
              }
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleResplit(entry)}
                  className={
                    isLibrary
                      ? 'flex min-w-0 flex-1 items-center gap-3 text-left'
                      : 'flex min-w-0 flex-1 items-center gap-2.5 px-3 py-2.5 text-left'
                  }
                >
                  <RouteDots library={isLibrary} />

                  <div className="min-w-0 flex-1">
                    <div
                      className={
                        isLibrary
                          ? 'truncate text-sm font-bold text-gray-900'
                          : 'truncate text-[13px] font-medium text-gray-800'
                      }
                    >
                      {shortName(entry.from_name)} <span aria-hidden="true">&rarr;</span> {shortName(entry.to_name)}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-gray-400">
                      <span>{timeAgo(entry.last_searched_at)}</span>
                      {entry.search_count > 1 ? <span>{entry.search_count} runs</span> : null}
                      <span>{modeLabel(entry.travel_mode)}</span>
                      {distance ? <span>{distance}</span> : null}
                      {duration ? <span>{duration}</span> : null}
                    </div>
                    {entry.midpoint_label ? (
                      <div className="mt-1 truncate text-xs font-semibold text-orange-600">
                        {entry.midpoint_label}
                      </div>
                    ) : null}
                  </div>

                  {isLibrary ? (
                    <span className="hidden shrink-0 rounded-full bg-teal-50 px-3 py-1 text-xs font-bold text-teal-700 transition group-hover:bg-teal-100 sm:inline-flex">
                      Run
                    </span>
                  ) : null}
                </button>

                <button
                  type="button"
                  onClick={() => handleDelete(entry.id)}
                  className={
                    isLibrary
                      ? 'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-gray-300 transition hover:bg-gray-100 hover:text-gray-600 sm:opacity-0 sm:group-hover:opacity-100'
                      : 'flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-gray-300 opacity-0 transition-all hover:bg-gray-200 hover:text-gray-500 group-hover:opacity-100'
                  }
                  title="Remove"
                  aria-label="Remove saved route"
                >
                  <svg
                    width="13"
                    height="13"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
