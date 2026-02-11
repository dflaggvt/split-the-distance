'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDistance, formatDuration, copyToClipboard } from '@/lib/utils';
import { logShare, logOutboundClick } from '@/lib/analytics';
import { useGatedAction } from './FeatureGate';

const SHARE_METHODS = [
  { id: 'copy', label: 'Copy Link', icon: '📋', color: 'text-gray-600' },
  { id: 'whatsapp', label: 'WhatsApp', icon: '💬', color: 'text-green-600' },
  { id: 'twitter', label: 'Twitter / X', icon: '🐦', color: 'text-blue-500' },
  { id: 'facebook', label: 'Facebook', icon: '📘', color: 'text-blue-700' },
  { id: 'email', label: 'Email', icon: '✉️', color: 'text-gray-700' },
  { id: 'sms', label: 'Text Message', icon: '💬', color: 'text-blue-600' },
];

const TRAVEL_MODE_LABELS = {
  DRIVING: { time: 'Drive Time', each: 'Each Drives' },
  BICYCLING: { time: 'Cycling Time', each: 'Each Cycles' },
  WALKING: { time: 'Walking Time', each: 'Each Walks' },
  TRANSIT: { time: 'Transit Time', each: 'Each Travels' },
};

export default function RouteInfo({ 
  route, 
  fromName, 
  toName, 
  fromLocation,
  toLocation,
  midpoint,
  selectedRouteIndex = 0,
  onRouteSelect,
  travelMode = 'DRIVING',
}) {
  const modeLabels = TRAVEL_MODE_LABELS[travelMode] || TRAVEL_MODE_LABELS.DRIVING;
  const [showCopied, setShowCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const shareMenuRef = useRef(null);
  const shareGate = useGatedAction('share');
  const routeOptionsGate = useGatedAction('alternative_routes');

  if (!route) return null;

  const hasAlternatives = route.allRoutes && route.allRoutes.length > 1;

  // Close share menu when clicking outside
  useEffect(() => {
    function handleClickOutside(e) {
      if (shareMenuRef.current && !shareMenuRef.current.contains(e.target)) {
        setShowShareMenu(false);
      }
    }
    if (showShareMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showShareMenu]);

  const executeShare = async (method) => {
    setShowShareMenu(false);

    const fromShort = fromName?.split(',')[0] || fromName;
    const toShort = toName?.split(',')[0] || toName;
    const shareText = `Let's meet in the middle! 📍 Halfway between ${fromShort} and ${toShort}`;

    // Log share and get trackable URL
    const shareUrl = await logShare({
      shareType: method,
      shareMethod: method,
      fromName,
      toName,
      fromLat: fromLocation?.lat || null,
      fromLng: fromLocation?.lon || null,
      toLat: toLocation?.lat || null,
      toLng: toLocation?.lon || null,
    });

    const encodedUrl = encodeURIComponent(shareUrl);
    const encodedText = encodeURIComponent(shareText);

    switch (method) {
      case 'copy':
        const success = await copyToClipboard(shareUrl);
        if (success) {
          setShowCopied(true);
          setTimeout(() => setShowCopied(false), 2500);
        }
        break;

      case 'whatsapp':
        window.open(
          `https://wa.me/?text=${encodedText}%0A${encodedUrl}`,
          '_blank', 'noopener,noreferrer'
        );
        break;

      case 'twitter':
        window.open(
          `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
          '_blank', 'noopener,noreferrer'
        );
        break;

      case 'facebook':
        window.open(
          `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`,
          '_blank', 'noopener,noreferrer'
        );
        break;

      case 'email':
        window.location.href = `mailto:?subject=${encodeURIComponent('Meet in the Middle!')}&body=${encodedText}%0A%0A${encodedUrl}`;
        break;

      case 'sms':
        // Works on both iOS and Android
        const separator = /iPhone|iPad|iPod/i.test(navigator.userAgent) ? '&' : '?';
        window.location.href = `sms:${separator}body=${encodedText}%0A${encodedUrl}`;
        break;

      case 'native':
        try {
          await navigator.share({
            title: 'Split The Distance',
            text: shareText,
            url: shareUrl,
          });
        } catch (err) {
          // User cancelled — not an error
          if (err.name !== 'AbortError') {
            console.error('Native share failed:', err);
          }
        }
        break;
    }
  };

  const handleShareClick = () => {
    shareGate.gate(() => {
      // On mobile with native share support, use it directly
      if (typeof navigator !== 'undefined' && navigator.share) {
        executeShare('native');
      } else {
        setShowShareMenu(!showShareMenu);
      }
    });
  };

  const handleMidpointClick = () => {
    if (!midpoint) return;
    const url = `https://www.google.com/maps/@${midpoint.lat},${midpoint.lon},14z`;
    logOutboundClick({
      clickType: 'midpoint_directions',
      placeName: 'Midpoint',
      destinationUrl: url,
      fromSearchRoute: `${fromName} → ${toName}`,
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="animate-fadeInUp">
      {/* Route Options (if alternatives available) — gated by feature flag */}
      {hasAlternatives && (
        <div className="mt-5 mb-3">
          <div className="text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-2">
            Route Options
            {!routeOptionsGate.allowed && routeOptionsGate.reason === 'login_required' && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-50">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            )}
            {!routeOptionsGate.allowed && routeOptionsGate.reason === 'upgrade_required' && (
              <span className="ml-1 text-[9px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded-full">PRO</span>
            )}
          </div>
          <div className="flex flex-col gap-1.5">
            {route.allRoutes.map((r, idx) => {
              const isSelected = idx === selectedRouteIndex;
              const timeDiff = r.totalDuration - route.allRoutes[0].totalDuration;
              
              return (
                <button
                  key={idx}
                  onClick={() => routeOptionsGate.gate(() => onRouteSelect?.(idx))}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-lg border transition-all ${
                    isSelected
                      ? 'border-teal-400 bg-teal-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                        isSelected ? 'border-teal-600' : 'border-gray-300'
                      }`}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-teal-600" />
                      )}
                    </div>
                    <span className={`text-sm ${isSelected ? 'font-semibold text-gray-900' : 'text-gray-700'}`}>
                      {r.summary}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-sm font-medium ${isSelected ? 'text-teal-700' : 'text-gray-600'}`}>
                      {formatDuration(r.totalDuration)}
                    </span>
                    {idx > 0 && timeDiff > 0 && (
                      <span className="text-xs text-gray-400">
                        +{formatDuration(timeDiff)}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Midpoint Location */}
      {midpoint && (
        <button
          onClick={handleMidpointClick}
          className={`w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-50 to-amber-50 border border-orange-200 rounded-[10px] px-4 py-3 ${hasAlternatives ? 'mb-3' : 'mt-5 mb-3'} cursor-pointer hover:from-orange-100 hover:to-amber-100 transition-colors group`}
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
      <div className="grid grid-cols-3 gap-2 bg-teal-50 border border-teal-200 rounded-[10px] px-3 py-3.5 mb-3 text-center">
        <div className="flex flex-col items-center">
          <span className="text-[10px] sm:text-[11px] font-semibold text-teal-700 uppercase tracking-wide leading-tight">
            Total Distance
          </span>
          <span className="text-sm sm:text-base font-bold text-teal-900 mt-1">
            {formatDistance(route.totalDistance)}
          </span>
        </div>

        <div className="flex flex-col items-center border-x border-teal-200 px-1">
          <span className="text-[10px] sm:text-[11px] font-semibold text-teal-700 uppercase tracking-wide leading-tight">
            Total {modeLabels.time}
          </span>
          <span className="text-sm sm:text-base font-bold text-teal-900 mt-1">
            {formatDuration(route.totalDuration)}
          </span>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-[10px] sm:text-[11px] font-semibold text-teal-700 uppercase tracking-wide leading-tight">
            {modeLabels.each}
          </span>
          <span className="text-sm sm:text-base font-bold text-teal-900 mt-1">
            ~{formatDuration(route.totalDuration / 2)}
          </span>
        </div>
      </div>

      {/* Share Bar */}
      <div className="relative flex items-center gap-2 mb-4" ref={shareMenuRef}>
        <button
          onClick={handleShareClick}
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
          {!shareGate.allowed && shareGate.reason === 'login_required' && (
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
          {!shareGate.allowed && shareGate.reason === 'upgrade_required' && (
            <span className="text-[9px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded-full">PRO</span>
          )}
        </button>
        <span
          className={`text-[13px] font-medium text-teal-600 transition-opacity duration-300 ${
            showCopied ? 'opacity-100' : 'opacity-0'
          }`}
        >
          Link copied!
        </span>

        {/* Share Method Dropdown */}
        {showShareMenu && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1 animate-fadeInUp">
            {SHARE_METHODS.map((method) => (
              <button
                key={method.id}
                onClick={() => executeShare(method.id)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 text-left text-[13px] font-medium text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <span className="text-base">{method.icon}</span>
                <span>{method.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
