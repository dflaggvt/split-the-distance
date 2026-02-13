'use client';

import { useRef, useMemo, useState, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  DirectionsRenderer,
  MarkerF,
  InfoWindowF,
  PolygonF,
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
  gestureHandling: 'greedy',
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

// Per-person route colors for multi-location (A=teal, B=orange, C=purple, D=blue, E=pink)
const PERSON_ROUTE_COLORS = ['#0d9488', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899'];

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

// Extra location pin colors (C, D, E)
const EXTRA_PIN_COLORS = ['#8b5cf6', '#3b82f6', '#ec4899'];
const EXTRA_PIN_LABELS = ['C', 'D', 'E'];

// Road trip stop pin: numbered green circle
const STOP_COLORS = ['#059669', '#0d9488', '#0891b2', '#2563eb', '#7c3aed', '#db2777', '#ea580c'];

function stopPinSvg(number, color, active = false) {
  const size = active ? 36 : 28;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
    <circle cx="${size/2}" cy="${size/2}" r="${size/2 - 2}" fill="${color}" stroke="white" stroke-width="2.5"/>
    <text x="${size/2}" y="${size/2 + 4.5}" text-anchor="middle" fill="white" font-family="Arial,sans-serif" font-size="${active ? 15 : 12}" font-weight="bold">${number}</text>
  </svg>`;
  return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

export default function MapView({
  from,
  to,
  route,
  midpoint,
  midpointMode = 'time',
  places = [],
  activePlaceId,
  onPlaceClick,
  selectedRouteIndex = 0,
  extraLocations = [],
  multiResult = null,
  driftRadius = null,
  roadTripStops = null,
  activeStopIndex = 0,
  onActiveStopIndexChange,
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

  // Extra location pin icons (C, D, E)
  const extraIcons = useMemo(
    () =>
      EXTRA_PIN_COLORS.map((color, i) => ({
        url: pinSvg(color, EXTRA_PIN_LABELS[i]),
        scaledSize: new google.maps.Size(30, 42),
        anchor: new google.maps.Point(15, 42),
      })),
    []
  );

  // Road trip stop icons
  const stopIcons = useMemo(() => {
    if (!roadTripStops) return [];
    return roadTripStops.map((stop, idx) => {
      const color = STOP_COLORS[idx % STOP_COLORS.length];
      const active = idx === activeStopIndex;
      const size = active ? 36 : 28;
      return {
        url: stopPinSvg(stop.index, color, active),
        scaledSize: new google.maps.Size(size, size),
        anchor: new google.maps.Point(size / 2, size / 2),
      };
    });
  }, [roadTripStops, activeStopIndex]);

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

  // Fit bounds when route / multi-result / road trip stops change
  useEffect(() => {
    if (!mapRef.current) return;

    const bounds = new google.maps.LatLngBounds();

    if (multiResult) {
      // Multi-location: include all origin locations + midpoint
      if (from) bounds.extend(new google.maps.LatLng(from.lat, from.lon || from.lng));
      if (to) bounds.extend(new google.maps.LatLng(to.lat, to.lon || to.lng));
      extraLocations.forEach(loc => {
        if (loc) bounds.extend(new google.maps.LatLng(loc.lat, loc.lon || loc.lng));
      });
      if (midpoint) bounds.extend(new google.maps.LatLng(midpoint.lat, midpoint.lon || midpoint.lng));
    } else if (route?.directionsResult) {
      const leg = route.directionsResult.routes[0].legs[0];
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);
      if (midpoint && !roadTripStops) {
        bounds.extend(new google.maps.LatLng(midpoint.lat, midpoint.lon));
      }
      // Include all road trip stops in bounds
      if (roadTripStops) {
        roadTripStops.forEach(stop => {
          bounds.extend(new google.maps.LatLng(stop.lat, stop.lon));
        });
      }
    } else {
      return; // nothing to fit
    }

    mapRef.current.fitBounds(bounds, {
      top: 50,
      right: 50,
      bottom: 50,
      left: window.innerWidth > 768 ? 60 : 20,
    });
  }, [route, midpoint, multiResult, from, to, extraLocations, roadTripStops]);

  // Zoom to midpoint area when places load
  const prevPlacesCount = useRef(0);
  useEffect(() => {
    if (!mapRef.current || !midpoint) return;
    // Zoom in when places go from 0 to some (filter activated)
    if (places.length > 0 && prevPlacesCount.current === 0) {
      mapRef.current.panTo({ lat: midpoint.lat, lng: midpoint.lon });
      mapRef.current.setZoom(11);
    }
    // Zoom back out when all filters deactivated
    if (places.length === 0 && prevPlacesCount.current > 0 && route?.directionsResult) {
      const bounds = new google.maps.LatLngBounds();
      const leg = route.directionsResult.routes[0].legs[0];
      bounds.extend(leg.start_location);
      bounds.extend(leg.end_location);
      mapRef.current.fitBounds(bounds, {
        top: 50, right: 50, bottom: 50,
        left: window.innerWidth > 768 ? 60 : 20,
      });
    }
    prevPlacesCount.current = places.length;
  }, [places, midpoint, route]);

  // Pan to active road trip stop
  useEffect(() => {
    if (!mapRef.current || !roadTripStops || activeStopIndex == null) return;
    const stop = roadTripStops[activeStopIndex];
    if (stop) {
      mapRef.current.panTo({ lat: stop.lat, lng: stop.lon });
      if (mapRef.current.getZoom() < 10) {
        mapRef.current.setZoom(10);
      }
    }
  }, [activeStopIndex, roadTripStops]);

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
      {/* Standard 2-person route */}
      {route?.directionsResult && (
        <DirectionsRenderer
          directions={route.directionsResult}
          options={{
            ...directionsOptions,
            routeIndex: selectedRouteIndex,
          }}
        />
      )}

      {/* Multi-location routes (one per person to the meeting point) */}
      {multiResult?.personRoutes?.map((personRoute, idx) =>
        personRoute?.directionsResult ? (
          <DirectionsRenderer
            key={`multi-route-${idx}`}
            directions={personRoute.directionsResult}
            options={{
              suppressMarkers: true,
              preserveViewport: true,
              polylineOptions: {
                strokeColor: PERSON_ROUTE_COLORS[idx] || '#6b7280',
                strokeOpacity: 0.8,
                strokeWeight: 4,
              },
            }}
          />
        ) : null
      )}

      {/* Drift Radius zone polygon */}
      {driftRadius?.polygon?.length > 0 && (
        <PolygonF
          paths={driftRadius.polygon}
          options={{
            fillColor: '#0d9488',
            fillOpacity: 0.15,
            strokeColor: '#0d9488',
            strokeOpacity: 0.7,
            strokeWeight: 2.5,
            clickable: false,
            zIndex: 10,
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

      {/* Extra location markers (C, D, E) */}
      {extraLocations.map((loc, idx) => loc && (
        <MarkerF
          key={`extra-${idx}`}
          position={{ lat: loc.lat, lng: loc.lon || loc.lng }}
          icon={extraIcons[idx]}
          zIndex={100}
          title={`Person ${EXTRA_PIN_LABELS[idx]}: ${loc.name || ''}`}
        />
      ))}

      {/* Midpoint marker — hidden in road trip mode */}
      {midpoint && (route || multiResult) && !roadTripStops && (
        <MarkerF
          position={{ lat: midpoint.lat, lng: midpoint.lon || midpoint.lng }}
          icon={midIcon}
          zIndex={200}
          title={
            multiResult
              ? `Group meeting point`
              : midpointMode === 'distance'
                ? `Midpoint — ${Math.round(route.totalDistance / 2 / 1609.344)} mi from each`
                : `Midpoint — ${formatDuration(route.totalDuration / 2)} from each`
          }
        />
      )}

      {/* Road trip stop markers */}
      {roadTripStops?.map((stop, idx) => (
        <MarkerF
          key={`stop-${stop.index}`}
          position={{ lat: stop.lat, lng: stop.lon }}
          icon={stopIcons[idx]}
          zIndex={idx === activeStopIndex ? 300 : 150}
          title={`Stop ${stop.index}: ${stop.label || ''}`}
          onClick={() => onActiveStopIndexChange?.(idx)}
        />
      ))}

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
              width: 240,
              margin: -8,
              padding: 0,
            }}
          >
            {/* Photo */}
            {activePlace.photoUrl && (
              <div style={{
                height: 100,
                overflow: 'hidden',
              }}>
                <img 
                  src={activePlace.photoUrl} 
                  alt={activePlace.name}
                  style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                  }}
                />
              </div>
            )}

            {/* Content */}
            <div style={{ padding: 12 }}>
              {/* Header */}
              <div
                style={{
                  fontSize: 15,
                  fontWeight: 700,
                  color: '#111827',
                  lineHeight: 1.2,
                  marginBottom: 6,
                }}
              >
                {activePlace.name}
              </div>
              
              {/* Category & Price */}
              <div style={{ 
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                marginBottom: 8,
              }}>
                <span style={{
                  background: '#f3f4f6',
                  padding: '3px 8px',
                  borderRadius: 12,
                  fontSize: 11,
                  color: '#4b5563',
                }}>
                  {activePlace.emoji} {activePlace.categoryLabel}
                </span>
                {activePlace.priceLevel != null && (
                  <span style={{ color: '#059669', fontWeight: 600, fontSize: 13 }}>
                    {'$'.repeat(activePlace.priceLevel || 1)}
                  </span>
                )}
              </div>

              {/* Rating & Status Row */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
                paddingBottom: 10,
                borderBottom: '1px solid #e5e7eb',
              }}>
                {activePlace.rating ? (
                  <div style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                  }}>
                    <span style={{
                      background: '#fef3c7',
                      color: '#b45309',
                      padding: '3px 8px',
                      borderRadius: 4,
                      fontSize: 12,
                      fontWeight: 700,
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
                  }}>
                    {activePlace.openNow 
                      ? (activePlace.closingTime ? `Open · ${activePlace.closingTime}` : '● Open')
                      : '● Closed'}
                  </span>
                )}
              </div>

              {/* Distance */}
              <div style={{
                fontSize: 13,
                color: '#0d9488',
                fontWeight: 600,
                marginBottom: 4,
              }}>
                📍 {activePlace.distanceFormatted} from midpoint
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
                  href={`https://www.google.com/maps/dir/?api=1&destination=${activePlace.lat && activePlace.lon ? `${activePlace.lat},${activePlace.lon}` : encodeURIComponent(activePlace.address || activePlace.name)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 6,
                    padding: '10px 12px',
                    background: '#0d9488',
                    color: 'white',
                    borderRadius: 8,
                    fontSize: 13,
                    fontWeight: 600,
                    textDecoration: 'none',
                    whiteSpace: 'nowrap',
                  }}
                  onClick={() => {
                    trackEvent('infowindow_directions_click', {
                      place_name: activePlace.name,
                      place_category: activePlace.category,
                    });
                  }}
                >
                  <span>🧭</span><span>Directions</span>
                </a>
                {activePlace.phoneNumber && (
                  <a
                    href={`tel:${activePlace.phoneNumber}`}
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 12px',
                      background: '#2563eb',
                      color: 'white',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      trackEvent('infowindow_call_click', {
                        place_name: activePlace.name,
                        place_category: activePlace.category,
                      });
                    }}
                  >
                    <span>📞</span><span>Call</span>
                  </a>
                )}
                {activePlace.websiteUri && !activePlace.phoneNumber && (
                  <a
                    href={activePlace.websiteUri}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{
                      flex: 1,
                      display: 'flex',
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                      padding: '10px 12px',
                      background: '#e5e7eb',
                      color: '#374151',
                      borderRadius: 8,
                      fontSize: 13,
                      fontWeight: 600,
                      textDecoration: 'none',
                      whiteSpace: 'nowrap',
                    }}
                    onClick={() => {
                      trackEvent('infowindow_website_click', {
                        place_name: activePlace.name,
                        place_category: activePlace.category,
                      });
                    }}
                  >
                    <span>🌐</span><span>Website</span>
                  </a>
                )}
              </div>
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
