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
          options={directionsOptions}
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
              fontFamily: 'Inter, sans-serif',
              minWidth: 180,
              maxWidth: 260,
              lineHeight: 1.5,
            }}
          >
            <div
              style={{
                fontWeight: 600,
                fontSize: 14,
                marginBottom: 4,
              }}
            >
              {activePlace.emoji} {activePlace.name}
            </div>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
              {activePlace.categoryLabel}
            </div>
            {activePlace.rating && (
              <div
                style={{
                  fontSize: 12,
                  color: '#f59e0b',
                  marginBottom: 2,
                }}
              >
                {'★'.repeat(Math.round(activePlace.rating))}{' '}
                {activePlace.rating.toFixed(1)}
                <span style={{ color: '#9ca3af', marginLeft: 4 }}>
                  ({activePlace.userRatingsTotal})
                </span>
              </div>
            )}
            {activePlace.priceLevel != null && (
              <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                {'$'.repeat(activePlace.priceLevel || 1)}
              </div>
            )}
            <div
              style={{ fontSize: 12, color: '#0d9488', fontWeight: 500 }}
            >
              {activePlace.distanceFormatted} from midpoint
            </div>
            {activePlace.openNow != null && (
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 500,
                  color: activePlace.openNow ? '#16a34a' : '#ef4444',
                  marginTop: 2,
                }}
              >
                {activePlace.openNow ? 'Open now' : 'Closed'}
              </div>
            )}
            {activePlace.address && (
              <div
                style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}
              >
                {activePlace.address}
              </div>
            )}
          </div>
        </InfoWindowF>
      )}
    </GoogleMap>

      {/* Map Controls */}
      <div className="absolute bottom-4 right-4 flex flex-col gap-2 z-10">
        {/* Map Type Toggle */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
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
