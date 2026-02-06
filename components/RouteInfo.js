'use client';

import { useState } from 'react';
import { formatDistance, formatDuration, buildShareUrl, copyToClipboard } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

export default function RouteInfo({ route, fromName, toName, midpoint }) {
  const [showCopied, setShowCopied] = useState(false);

  if (!route) return null;

  const handleShare = async () => {
    const url = buildShareUrl(fromName, toName);
    if (!url) return;

    const success = await copyToClipboard(url);
    if (success) {
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2500);
      trackEvent('share_click', { method: 'copy_link' });
    }
  };

  const handleMidpointClick = () => {
    if (!midpoint) return;
    trackEvent('midpoint_click', {
      midpoint_lat: midpoint.lat,
      midpoint_lng: midpoint.lon,
    });
    const url = `https://www.google.com/maps/@${midpoint.lat},${midpoint.lon},14z`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="animate-fadeInUp">
      {/* Midpoint Location */}
      {midpoint && (
        <button
          onClick={handleMidpointClick}
          className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-[10px] px-4 py-3 mt-5 mb-3 cursor-pointer hover:from-orange-100 hover:to-amber-100 transition-colors group"
        >
          <span className="text-xl">📍</span>
          <div className="flex flex-col items-start">
            <span className="text-[11px] font-semibold text-orange-700 uppercase tracking-wide">
              Halfway Point
            </span>
            <span className="text-sm font-bold text-orange-900 group-hover:underline">
              Open in Google Maps →
            </span>
          </div>
        </button>
      )}

      {/* Route Summary Card */}
      <div className="flex items-center justify-between bg-teal-50 border border-teal-200 rounded-[10px] px-4 py-3.5 mb-3">
        <div className="flex flex-col items-center flex-1">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
            Total Distance
          </span>
          <span className="text-base font-bold text-teal-900 mt-0.5">
            {formatDistance(route.totalDistance)}
          </span>
        </div>

        <div className="w-px h-8 bg-teal-200 shrink-0 hidden sm:block" />

        <div className="flex flex-col items-center flex-1">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
            Total Drive Time
          </span>
          <span className="text-base font-bold text-teal-900 mt-0.5">
            {formatDuration(route.totalDuration)}
          </span>
        </div>

        <div className="w-px h-8 bg-teal-200 shrink-0 hidden sm:block" />

        <div className="flex flex-col items-center flex-1">
          <span className="text-[11px] font-semibold text-teal-700 uppercase tracking-wide">
            Each Drives
          </span>
          <span className="text-base font-bold text-teal-900 mt-0.5">
            ~{formatDuration(route.totalDuration / 2)}
          </span>
        </div>
      </div>

      {/* Share Bar */}
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 px-3.5 py-2 bg-white border border-gray-200 rounded-md text-[13px] font-medium text-gray-600 cursor-pointer transition-all duration-200 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="18" cy="5" r="3" />
            <circle cx="6" cy="12" r="3" />
            <circle cx="18" cy="19" r="3" />
            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
          </svg>
          Share This Split
        </button>
        <span
          className={`text-[13px] font-medium text-teal-600 transition-opacity duration-300 ${
            showCopied ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Link copied!
        </span>
      </div>
    </div>
  );
}
