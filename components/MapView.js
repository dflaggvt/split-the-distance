'use client';

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  DirectionsRenderer,
  MarkerF,
  InfoWindowF,
} from '@react-google-maps/api';
import { formatDuration } from '@/lib/utils';
import { trackEvent } from '@/lib/analytics';

const DEFAULT_CENTER = { lat: 39.8283, lng: -98.5795 };
const DEFAULT_ZOOM = 4;

const mapContainerStyle = {
  width: '100%',
  height: '100%',
};

const mapOptions = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: false,
  styles: [
    {
      featureType: 'poi',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
    {
      featureType: 'transit',
      elementType: 'labels',
      stylers: [{ visibility: 'off' }],
    },
  ],
};

// Custom polyline options for the route
const routePolylineOptions = {
  strokeColor: '#0d9488',
  strokeOpacity: 0.85,
  strokeWeight: 5,
};

// SVG data-URI helpers (no google dependency — safe at module scope)
function pinSvg(color, label, w = 30, h = 42) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <path d="M${w / 2} 0C${w * 0.224} 0 0 ${w * 0.224} 0 ${w / 2}c0 ${h * 0.536} ${w / 2} ${h * 0.595} ${w / 2} ${h * 0.595}s${w / 2}-${h * 0.059} ${w / 2}-${h * 0.595}C${w} ${w * 0.224} ${w * 0.776} 0 ${w / 2} 0z"
      fill="${color}" stroke="white" stroke-width="1.5"/>
    <text x="${w / 2}" y="${w / 2 + 4}" text-anchor="middle"
      fill="white" font-family="Arial,sans-serif"
      font-size="${label === '★' ? '16' : '13'}" font-weight="bold">${label}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

const START_PIN_URL = pinSvg('#0d9488', 'A');
const END_PIN_URL = pinSvg('#f97316', 'B');
const MID_PIN_URL = pinSvg('#ef4444', '★', 34, 46);

export default function MapView({
  from,
  to,
  route,
  midpoint,
  places = [],
  activePlaceId,
  onPlaceClick,
  selectedRouteIndex = 0,
}) {
  const mapRef = useRef(null);
  const [activeInfoWindow, setActiveInfoWindow] = useState(null);
  const [mapType, setMapType] = useState('roadmap'); // 'roadmap' | 'satellite' | 'hybrid'
  const [showTraffic, setShowTraffic] = useState(false);

  const onLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  // Toggle traffic layer
  useEffect(() => {
    if (!mapRef.current) return;
    
    if (showTraffic) {
      if (!mapRef.current.trafficLayer) {
        mapRef.current.trafficLayer = new google.maps.TrafficLayer();
      }
      mapRef.current.trafficLayer.setMap(mapRef.current);
    } else {
      if (mapRef.current.trafficLayer) {
        mapRef.current.trafficLayer.setMap(null);
      }
    }
  }, [showTraffic]);

  // Update map type
  useEffect(() => {
    if (mapRef.current) {
      mapRef.current.setMapTypeId(mapType);
    }
  }, [mapType]);

  // Build marker icons (needs google.maps available)
  const startIcon = useMemo(
    () => ({
      url: START_PIN_URL,
      scaledSize: new google.maps.Size(30, 42),
      anchor: new google.maps.Point(15, 42),
    }),
    []
  );

  const endIcon = useMemo(
    () => ({
      url: END_PIN_URL,
      scaledSize: new google.maps.Size(30, 42),
      anchor: new google.maps.Point(15, 42),
    }),
    []
  );

  const midIcon = useMemo(
    () => ({
      url: MID_PIN_URL,
      scaledSize: new google.maps.Size(34, 46),
      anchor: new google.maps.Point(17, 46),
    }),
    []
  );

  // POI icons keyed by emoji
  const poiIcons = useMemo(() => {
    const icons = {};
    places.forEach((p) => {
      if (!icons[p.emoji]) {
        icons[p.emoji] = {
          path: google.maps.SymbolPath.CIRCLE,
          fillColor: '#ffffff',
          fillOpacity: 1,
          strokeColor: '#d1d5db',
          strokeWeight: 2,
          scale: 18,
        };
      }
    });
    return icons;
  }, [places]);

  // Fit bounds when route changes
  useEffect(() => {
    if (!mapRef.current || !route?.directionsResult) return;

    const bounds = new google.maps.LatLngBounds();
    const leg = route.directionsResult.routes[0].legs[0];

    bounds.extend(leg.start_location);
    bounds.extend(leg.end_location);

    if (midpoint) {
      bounds.extend(new google.maps.LatLng(midpoint.lat, midpoint.lon));
    }

    mapRef.current.fitBounds(bounds, {
      top: 50,
      right: 50,
      bottom: 50,
      left: window.innerWidth > 768 ? 60 : 20,
    });
  }, [route, midpoint]);

  // Pan to active place
  useEffect(() => {
    if (!mapRef.current || !activePlaceId) return;
    const place = places.find((p) => p.id === activePlaceId);
    if (place) {
      mapRef.current.panTo({ lat: place.lat, lng: place.lon });
      setActiveInfoWindow(activePlaceId);
    }
  }, [activePlaceId, places]);

  // Directions renderer options
  const directionsOptions = useMemo(
    () => ({
      suppressMarkers: true,
      polylineOptions: routePolylineOptions,
      preserveViewport: true,
    }),
    []
  );

  // Active info window data
  const activePlace = activeInfoWindow
    ? places.find((p) => p.id === activeInfoWindow)
    : null;

  return (
    <div className="relative w-full h-full">
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        center={DEFAULT_CENTER}
        zoom={DEFAULT_ZOOM}
        onLoad={onLoad}
        options={{ ...mapOptions, mapTypeId: mapType }}
      >
      {/* Route */}
      {route?.directionsResult && (
        <DirectionsRenderer
          directions={route.directionsResult}
          options={{
            ...directionsOptions,
            routeIndex: selectedRouteIndex,
          }}
        />
      )}

      {/* Start marker */}
      {from && (
        <MarkerF
          position={{ lat: from.lat, lng: from.lon }}
          icon={startIcon}
          zIndex={100}
          title={`Start: ${from.name || 'Starting Point'}`}
        />
      )}

      {/* End marker */}
      {to && (
        <MarkerF
          position={{ lat: to.lat, lng: to.lon }}
          icon={endIcon}
          zIndex={100}
          title={`End: ${to.name || 'Destination'}`}
        />
      )}

      {/* Midpoint marker */}
      {midpoint && route && (
        <MarkerF
          position={{ lat: midpoint.lat, lng: midpoint.lon }}
          icon={midIcon}
          zIndex={200}
          title={`Midpoint — ${formatDuration(route.totalDuration / 2)} from each`}
        />
      )}

      {/* POI markers */}
      {places.map((place) => (
        <MarkerF
          key={place.id}
          position={{ lat: place.lat, lng: place.lon }}
          icon={poiIcons[place.emoji]}
          label={{
            text: place.emoji,
            fontSize: '16px',
          }}
          onClick={() => {
            // Track map marker click
            trackEvent('map_marker_click', {
              place_name: place.name,
              place_category: place.category,
            });
            onPlaceClick?.(place.id);
            setActiveInfoWindow(place.id);
          }}
          zIndex={50}
        />
      ))}

      {/* POI info window */}
      {activePlace && (
        <InfoWindowF
          position={{ lat: activePlace.lat, lng: activePlace.lon }}
          onCloseClick={() => setActiveInfoWindow(null)}
          options={{ pixelOffset: new google.maps.Size(0, -22) }}
        >
          <div
            style={{
              fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
              minWidth: 220,
              maxWidth: 280,
              padding: '4px',
            }}
          >
            {/* Header */}
            <div style={{ marginBottom: 12 }}>
              <div
                style={{
                  fontSize: 16,
                  fontWeight: 700,
                  color: '#111827',
                  lineHeight: 1.3,
                  marginBottom: 4,
                }}
              >
                {activePlace.name}
              </div>
              <div style={{ 
                fontSize: 12, 
                color: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                gap: 6,
              }}>
                <span style={{
                  background: '#f3f4f6',
                  padding: '2px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                }}>
                  {activePlace.emoji} {activePlace.categoryLabel}
                </span>
                {activePlace.priceLevel != null && (
                  <span style={{ color: '#059669', fontWeight: 500 }}>
                    {'$'.repeat(activePlace.priceLevel || 1)}
                  </span>
                )}
              </div>
            </div>

            {/* Rating & Status Row */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: 12,
              paddingBottom: 12,
              borderBottom: '1px solid #f3f4f6',
            }}>
              {activePlace.rating ? (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}>
                  <span style={{
                    background: '#fef3c7',
                    color: '#d97706',
                    padding: '3px 8px',
                    borderRadius: 6,
                    fontSize: 13,
                    fontWeight: 600,
                  }}>
                    ★ {activePlace.rating.toFixed(1)}
                  </span>
                  <span style={{ fontSize: 12, color: '#9ca3af' }}>
                    ({activePlace.userRatingsTotal?.toLocaleString()})
                  </span>
                </div>
              ) : <div />}
              {activePlace.openNow != null && (
                <span style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: activePlace.openNow ? '#059669' : '#dc2626',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}>
                  <span style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: activePlace.openNow ? '#059669' : '#dc2626',
                  }} />
                  {activePlace.openNow ? 'Open' : 'Closed'}
                </span>
              )}
            </div>

            {/* Distance */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 8,
            }}>
              <span style={{ fontSize: 14 }}>📍</span>
              <span style={{
                fontSize: 13,
                color: '#0d9488',
                fontWeight: 600,
              }}>
                {activePlace.distanceFormatted} from midpoint
              </span>
            </div>

            {/* Address */}
            {activePlace.address && (
              <div style={{
                fontSize: 12,
                color: '#6b7280',
                lineHeight: 1.4,
                marginBottom: 12,
              }}>
                {activePlace.address}
              </div>
            )}

            {/* Action Buttons */}
            <div style={{
              display: 'flex',
              gap: 8,
            }}>
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(activePlace.address || activePlace.name)}&destination_place_id=${activePlace.placeId || ''}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  flex: 1,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  padding: '8px 12px',
                  background: '#0d9488',
                  color: 'white',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  textDecoration: 'none',
                }}
                onClick={() => {
                  trackEvent('infowindow_directions_click', {
                    place_name: activePlace.name,
                    place_category: activePlace.category,
                  });
                }}
              >
                🧭 Directions
              </a>
              {activePlace.website && (
                <a
                  href={activePlace.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '8px 12px',
                    background: '#f3f4f6',
                    color: '#374151',
                    borderRadius: 8,
                    fontSize: 12,
                    fontWeight: 600,
                    textDecoration: 'none',
                  }}
                  onClick={() => {
                    trackEvent('infowindow_website_click', {
                      place_name: activePlace.name,
                      place_category: activePlace.category,
                    });
                  }}
                >
                  🌐 Website
                </a>
              )}
            </div>
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>

      {/* Map Controls - bottom left to avoid Google's native controls */}
      <div className="absolute bottom-6 left-3 flex flex-col gap-2 z-10">
        {/* Map Type Toggle */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden flex">
          <button
            onClick={() => setMapType('roadmap')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              mapType === 'roadmap'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Map
          </button>
          <button
            onClick={() => setMapType('satellite')}
            className={`px-3 py-2 text-xs font-medium transition-colors ${
              mapType === 'satellite' || mapType === 'hybrid'
                ? 'bg-teal-600 text-white'
                : 'bg-white text-gray-600 hover:bg-gray-50'
            }`}
          >
            Satellite
          </button>
        </div>

        {/* Traffic Toggle */}
        <button
          onClick={() => setShowTraffic(!showTraffic)}
          className={`px-3 py-2 text-xs font-medium rounded-lg shadow-md transition-colors ${
            showTraffic
              ? 'bg-teal-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-50'
          }`}
        >
          🚗 Traffic
        </button>
      </div>
    </div>
  );
}
