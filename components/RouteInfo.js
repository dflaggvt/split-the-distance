'use client';

import { useState, useRef, useEffect } from 'react';
import { formatDistance, formatDuration, copyToClipboard } from '@/lib/utils';
import { logShare, logOutboundClick } from '@/lib/analytics';
import { reverseGeocode } from '@/lib/geocoding';
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
  multiResult = null,
}) {
  const modeLabels = TRAVEL_MODE_LABELS[travelMode] || TRAVEL_MODE_LABELS.DRIVING;
  const [showCopied, setShowCopied] = useState(false);
  const [showShareMenu, setShowShareMenu] = useState(false);
  const [midpointLabel, setMidpointLabel] = useState(null);
  const [routeOptionsOpen, setRouteOptionsOpen] = useState(false);
  const shareMenuRef = useRef(null);
  const shareGate = useGatedAction('share');
  const routeOptionsGate = useGatedAction('alternative_routes');

  // Reverse geocode midpoint to get city/state label
  useEffect(() => {
    if (!midpoint?.lat || !midpoint?.lon) {
      setMidpointLabel(null);
      return;
    }
    let cancelled = false;
    setMidpointLabel(null);
    reverseGeocode(midpoint.lat, midpoint.lon).then((label) => {
      if (!cancelled) setMidpointLabel(label);
    });
    return () => { cancelled = true; };
  }, [midpoint?.lat, midpoint?.lon]);

  if (!route && !multiResult) return null;

  const hasAlternatives = route?.allRoutes && route.allRoutes.length > 1;

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

  // ---- MULTI-LOCATION CARD ----
  if (multiResult && midpoint) {
    const PERSON_COLORS = ['#0d9488', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899'];
    const PERSON_LABELS = ['A', 'B', 'C', 'D', 'E'];
    return (
      <div className="animate-fadeInUp">
        <div className="mt-5 mb-3 rounded-xl overflow-hidden border border-purple-300 bg-white">
          {/* Purple banner — GROUP MIDPOINT label */}
          <div className="bg-gradient-to-r from-purple-500 to-indigo-500 px-4 py-2">
            <span className="text-white text-xs font-bold uppercase tracking-wider">
              Group Meeting Point ({multiResult.locations?.length || '?'} people)
            </span>
          </div>

          {/* Body */}
          <div className="px-4 pt-3 pb-2">
            {midpointLabel ? (
              <h3 className="text-[22px] font-bold text-gray-900 leading-tight">{midpointLabel}</h3>
            ) : (
              <h3 className="text-lg font-bold text-gray-700 leading-tight">Meeting point found</h3>
            )}
            <p className="text-xs text-gray-400 mt-1">
              Optimized for fairest {
                multiResult.optimizeBy === 'distance'
                  ? 'distance'
                  : travelMode === 'BICYCLING' ? 'cycling time' : travelMode === 'WALKING' ? 'walking time' : 'drive time'
              }
            </p>

            {/* Per-person drive times */}
            {multiResult.driveTimes && (
              <div className="mt-3 space-y-1.5">
                {multiResult.driveTimes.map((dt, idx) => {
                  const name = dt.name?.split(',')[0] || `Person ${PERSON_LABELS[idx]}`;
                  const color = PERSON_COLORS[idx] || '#6b7280';
                  return (
                    <div key={idx} className="flex items-center justify-between text-[13px]">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                        <span className="text-gray-700 font-medium">{name}</span>
                      </div>
                      <div className="flex items-center gap-2 text-gray-500">
                        {dt.distanceText && <span>{dt.distanceText}</span>}
                        {dt.distanceText && <span className="text-gray-300">|</span>}
                        <span className="font-semibold text-gray-600">
                          {dt.durationText || formatDuration(dt.duration)}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Max spread */}
            {multiResult.maxDrive && multiResult.minDrive && (
              <div className="mt-2 pt-2 border-t border-gray-100 flex items-center justify-between text-xs text-gray-400">
                <span>Drive time spread</span>
                <span className="font-medium text-gray-600">
                  {formatDuration(multiResult.minDrive)} – {formatDuration(multiResult.maxDrive)}
                </span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-purple-100">
            <button
              onClick={handleMidpointClick}
              className="text-[13px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Open in Google Maps
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ---- STANDARD 2-LOCATION CARD ----
  if (!route) return null;

  return (
    <div className="animate-fadeInUp">
      {/* Halfway Point Card */}
      {midpoint && (
        <div className="mt-5 mb-3 rounded-xl overflow-hidden border border-orange-300 bg-white">
          {/* Orange banner — HALFWAY POINT label only */}
          <div className="bg-gradient-to-r from-orange-400 to-amber-400 px-4 py-2">
            <span className="text-white text-xs font-bold uppercase tracking-wider">Halfway Point</span>
          </div>

          {/* Body — city name + stats on white bg */}
          <div className="px-4 pt-3 pb-2">
            {midpointLabel ? (
              <h3 className="text-[22px] font-bold text-gray-900 leading-tight">{midpointLabel}</h3>
            ) : (
              <h3 className="text-lg font-bold text-gray-700 leading-tight">Midpoint found</h3>
            )}
            <div className="flex items-center gap-1.5 mt-2 text-[15px] text-gray-500">
              <span className="font-semibold text-gray-600">{formatDistance(route.totalDistance)}</span>
              <span className="text-gray-300">|</span>
              <span className="font-semibold text-gray-600">{formatDuration(route.totalDuration)}</span>
              <span className="text-gray-300">|</span>
              <span className="text-gray-500">~{formatDuration(route.totalDuration / 2)} each</span>
            </div>
          </div>

          {/* Footer — Open in Maps + Share */}
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-orange-100 relative" ref={shareMenuRef}>
            <button
              onClick={handleMidpointClick}
              className="text-[13px] font-medium text-blue-600 hover:text-blue-800 hover:underline transition-colors"
            >
              Open in Google Maps
            </button>

            <div className="relative flex items-center gap-2">
              <span
                className={`text-[11px] font-medium text-teal-600 transition-opacity duration-300 ${
                  showCopied ? 'opacity-100' : 'opacity-0'
                }`}
              >
                Copied!
              </span>
              <button
                onClick={handleShareClick}
                className="flex items-center gap-1.5 text-[13px] font-medium text-gray-600 hover:text-gray-800 transition-colors"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Share
                {!shareGate.allowed && shareGate.reason === 'login_required' && (
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="opacity-50">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                )}
              </button>

              {/* Share Method Dropdown */}
              {showShareMenu && (
                <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 min-w-[180px] py-1 animate-fadeInUp">
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
        </div>
      )}

      {/* Route Options Accordion (collapsed by default) */}
      {hasAlternatives && (
        <div className="mb-3">
          <button
            onClick={() => setRouteOptionsOpen(!routeOptionsOpen)}
            className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm font-medium text-gray-700 cursor-pointer hover:bg-gray-50 transition-colors"
          >
            <span>
              Route Options ({route.allRoutes.length})
              {!routeOptionsGate.allowed && routeOptionsGate.reason === 'login_required' && (
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="inline ml-1 opacity-50">
                  <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                  <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                </svg>
              )}
              {!routeOptionsGate.allowed && routeOptionsGate.reason === 'upgrade_required' && (
                <span className="ml-1 text-[9px] font-bold text-purple-600 bg-purple-100 px-1 py-0.5 rounded-full">PRO</span>
              )}
            </span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`text-gray-400 transition-transform duration-200 ${routeOptionsOpen ? 'rotate-180' : ''}`}
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </button>

          {routeOptionsOpen && (
            <div className="flex flex-col gap-1.5 mt-2 animate-fadeInUp">
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
          )}
        </div>
      )}
    </div>
  );
}
