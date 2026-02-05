'use client';

import { useEffect, useRef, useMemo } from 'react';
import {
  MapContainer,
  TileLayer,
  Polyline,
  Marker,
  Popup,
  useMap,
} from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { formatDuration } from '@/lib/utils';

// Fix Leaflet default icon issue in Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const DEFAULT_CENTER = [39.8283, -98.5795];
const DEFAULT_ZOOM = 4;

/**
 * Create a custom div icon for A/B/midpoint markers
 */
function createMarkerIcon(type, label) {
  const colors = {
    start: '#0d9488',
    end: '#f97316',
    mid: '#ef4444',
  };
  const bg = colors[type] || colors.start;
  const size = type === 'mid' ? 34 : 28;

  return L.divIcon({
    html: `
      <div style="
        width: ${size}px; height: ${size}px;
        border-radius: 50% 50% 50% 0;
        transform: rotate(-45deg);
        display: flex; align-items: center; justify-content: center;
        background: ${bg};
        box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      ">
        <span style="
          transform: rotate(45deg);
          font-size: ${type === 'mid' ? '16px' : '12px'};
          font-weight: 700;
          color: white;
          font-family: Inter, sans-serif;
        ">${label}</span>
      </div>
    `,
    className: 'custom-marker-icon',
    iconSize: [size, size + 10],
    iconAnchor: [size / 2, size + 10],
    popupAnchor: [0, -(size + 10)],
  });
}

/**
 * Create a POI marker icon
 */
function createPoiIcon(emoji) {
  return L.divIcon({
    html: `
      <div style="
        width: 32px; height: 32px;
        background: white;
        border: 2px solid #e5e7eb;
        border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        font-size: 16px;
        box-shadow: 0 2px 4px rgba(0,0,0,0.15);
        transition: transform 0.15s ease, border-color 0.15s ease;
      ">${emoji}</div>
    `,
    className: 'custom-marker-icon poi-marker',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -18],
  });
}

// Memoize icons to prevent recreating on every render
const startIcon = createMarkerIcon('start', 'A');
const endIcon = createMarkerIcon('end', 'B');
const midIcon = createMarkerIcon('mid', '★');

/**
 * Component that manages map bounds and view fitting
 */
function MapBoundsManager({ route, from, to }) {
  const map = useMap();

  useEffect(() => {
    if (route && from && to) {
      const coords = route.geometry.coordinates.map((c) => [c[1], c[0]]);
      const bounds = L.latLngBounds(coords);
      bounds.extend([from.lat, from.lon]);
      bounds.extend([to.lat, to.lon]);
      map.fitBounds(bounds.pad(0.1), {
        paddingTopLeft: [window.innerWidth > 768 ? 40 : 20, 20],
        paddingBottomRight: [20, 20],
        maxZoom: 14,
      });
    }
  }, [route, from, to, map]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => map.invalidateSize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);

  return null;
}

/**
 * Component to highlight and pan to a specific POI
 */
function PoiHighlighter({ activePlaceId, places }) {
  const map = useMap();
  const prevId = useRef(null);

  useEffect(() => {
    if (activePlaceId && activePlaceId !== prevId.current) {
      const place = places.find((p) => p.id === activePlaceId);
      if (place) {
        map.panTo([place.lat, place.lon], { animate: true, duration: 0.5 });
      }
      prevId.current = activePlaceId;
    }
  }, [activePlaceId, places, map]);

  return null;
}

export default function MapView({
  from,
  to,
  route,
  midpoint,
  places = [],
  activePlaceId,
  onPlaceClick,
}) {
  // Memoize POI icons
  const poiIcons = useMemo(() => {
    const icons = {};
    places.forEach((place) => {
      if (!icons[place.emoji]) {
        icons[place.emoji] = createPoiIcon(place.emoji);
      }
    });
    return icons;
  }, [places]);

  // Route coordinates for polyline
  const routeCoords = useMemo(() => {
    if (!route) return [];
    return route.geometry.coordinates.map((c) => [c[1], c[0]]);
  }, [route]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      className="w-full h-full"
      zoomControl={true}
      attributionControl={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        maxZoom={19}
      />

      <MapBoundsManager route={route} from={from} to={to} />
      <PoiHighlighter activePlaceId={activePlaceId} places={places} />

      {/* Route shadow line */}
      {routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#0f766e',
            weight: 8,
            opacity: 0.15,
            lineCap: 'round',
          }}
        />
      )}

      {/* Route main line */}
      {routeCoords.length > 0 && (
        <Polyline
          positions={routeCoords}
          pathOptions={{
            color: '#0d9488',
            weight: 5,
            opacity: 0.85,
            lineCap: 'round',
            lineJoin: 'round',
          }}
        />
      )}

      {/* Start marker */}
      {from && (
        <Marker
          position={[from.lat, from.lon]}
          icon={startIcon}
          zIndexOffset={100}
        >
          <Popup>
            <strong>Start:</strong> {from.name || 'Starting Point'}
          </Popup>
        </Marker>
      )}

      {/* End marker */}
      {to && (
        <Marker
          position={[to.lat, to.lon]}
          icon={endIcon}
          zIndexOffset={100}
        >
          <Popup>
            <strong>End:</strong> {to.name || 'Destination'}
          </Popup>
        </Marker>
      )}

      {/* Midpoint marker */}
      {midpoint && route && (
        <Marker
          position={[midpoint.lat, midpoint.lon]}
          icon={midIcon}
          zIndexOffset={200}
        >
          <Popup>
            <div className="text-center font-sans">
              <strong className="text-sm">📍 Midpoint</strong>
              <br />
              <span className="text-gray-500 text-[13px]">
                {formatDuration(route.totalDuration / 2)} from each location
              </span>
            </div>
          </Popup>
        </Marker>
      )}

      {/* POI markers */}
      {places.map((place) => (
        <Marker
          key={place.id}
          position={[place.lat, place.lon]}
          icon={poiIcons[place.emoji] || createPoiIcon(place.emoji)}
          eventHandlers={{
            click: () => {
              if (onPlaceClick) onPlaceClick(place.id);
            },
          }}
        >
          <Popup>
            <div className="font-sans min-w-[150px]">
              <strong className="text-sm">
                {place.emoji} {place.name}
              </strong>
              <br />
              <span className="text-gray-500 text-xs">
                {place.categoryLabel}
              </span>
              <br />
              <span className="text-teal-600 text-xs font-medium">
                {place.distanceFormatted} from midpoint
              </span>
              {place.address && (
                <>
                  <br />
                  <span className="text-gray-400 text-[11px]">
                    {place.address}
                  </span>
                </>
              )}
              {place.cuisine && (
                <>
                  <br />
                  <span className="text-gray-400 text-[11px]">
                    Cuisine: {place.cuisine}
                  </span>
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
