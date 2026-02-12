'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './AuthProvider';
import { useGatedAction } from './FeatureGate';
import { fetchHistory, deleteHistoryEntry, clearAllHistory } from '@/lib/searchHistory';

/**
 * Relative time label (e.g. "just now", "2h ago", "3 days ago")
 */
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

/**
 * Short location label: take the first part before the first comma.
 */
function shortName(name) {
  if (!name) return '';
  return name.split(',')[0].trim();
}

export default function SearchHistory({ onResplit, show }) {
  const { isLoggedIn, user } = useAuth();
  const historyGate = useGatedAction('search_history');

  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showClear, setShowClear] = useState(false);

  // Fetch history when component shows and user is logged in
  const loadHistory = useCallback(async () => {
    if (!isLoggedIn || !user?.id) return;
    setLoading(true);
    const data = await fetchHistory(user.id);
    setHistory(data);
    setLoading(false);
  }, [isLoggedIn, user?.id]);

  useEffect(() => {
    if (show && isLoggedIn) {
      loadHistory();
    }
  }, [show, isLoggedIn, loadHistory]);

  // Expose refresh for parent to call after a new search
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

  const handleDelete = async (e, entryId) => {
    e.stopPropagation();
    const ok = await deleteHistoryEntry(entryId);
    if (ok) {
      setHistory(prev => prev.filter(h => h.id !== entryId));
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

  // Don't render for anonymous users or when hidden
  if (!show || !isLoggedIn) return null;

  // Feature gate check
  if (!historyGate.allowed) return null;

  if (loading) {
    return (
      <div className="mb-4">
        <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Recent Searches</div>
        <div className="flex items-center justify-center py-4 text-sm text-gray-400">
          <span className="inline-block w-4 h-4 border-2 border-gray-200 border-t-teal-500 rounded-full animate-spin mr-2" />
          Loading...
        </div>
      </div>
    );
  }

  if (history.length === 0) return null;

  return (
    <div className="mb-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Recent</span>
        </div>
        {history.length > 0 && (
          <div className="relative">
            <button
              onClick={() => setShowClear(!showClear)}
              className="text-[11px] text-gray-400 hover:text-gray-600 transition-colors"
            >
              Clear
            </button>
            {showClear && (
              <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 p-3 min-w-[180px] animate-fadeInUp">
                <p className="text-xs text-gray-600 mb-2">Clear all search history?</p>
                <div className="flex gap-2">
                  <button
                    onClick={handleClearAll}
                    className="flex-1 py-1.5 px-2 text-xs font-medium text-white bg-red-500 rounded-md hover:bg-red-600 transition-colors"
                  >
                    Clear All
                  </button>
                  <button
                    onClick={() => setShowClear(false)}
                    className="flex-1 py-1.5 px-2 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* History list */}
      <div className="flex flex-col gap-1">
        {history.map((entry) => (
          <button
            key={entry.id}
            onClick={() => handleResplit(entry)}
            className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-left hover:bg-gray-50 transition-colors group border border-transparent hover:border-gray-200"
          >
            {/* Route icon */}
            <div className="flex flex-col items-center shrink-0 gap-0.5">
              <div className="w-2 h-2 rounded-full border-[1.5px] border-gray-400 bg-white" />
              <div className="w-px h-2.5 bg-gray-300" />
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>

            {/* Route text */}
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-medium text-gray-800 truncate">
                {shortName(entry.from_name)} → {shortName(entry.to_name)}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {entry.midpoint_label && (
                  <span className="text-[11px] text-orange-600 font-medium truncate">
                    {entry.midpoint_label}
                  </span>
                )}
                <span className="text-[11px] text-gray-400">
                  {timeAgo(entry.last_searched_at)}
                </span>
                {entry.search_count > 1 && (
                  <span className="text-[10px] text-gray-400">
                    ×{entry.search_count}
                  </span>
                )}
              </div>
            </div>

            {/* Delete button (shows on hover) */}
            <button
              onClick={(e) => handleDelete(e, entry.id)}
              className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full text-gray-300 opacity-0 group-hover:opacity-100 hover:bg-gray-200 hover:text-gray-500 transition-all"
              title="Remove"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </button>
        ))}
      </div>
    </div>
  );
}
