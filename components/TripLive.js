'use client';

/**
 * TripLive — Live trip mode with real-time location sharing, ETA, and arrival tracking.
 * Phase 4 of Collaborative Group Trips.
 *
 * Uses:
 * - Browser Geolocation API for own position
 * - Supabase Broadcast for ephemeral position pings (low latency, no DB)
 * - Supabase DB (trip_live_status) for persistent state (arrived, ETA)
 * - Google Directions for ETA calculation
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleMap, MarkerF, InfoWindowF } from '@react-google-maps/api';
import { useTripContext } from './TripProvider';
import { useAuth } from './AuthProvider';
import {
  updateLivePosition,
  stopSharingLocation,
  markArrived,
  startTrip,
  completeTrip,
} from '@/lib/trips';

const ETA_INTERVAL = 60_000; // 60 seconds between ETA recalculations
const STALE_THRESHOLD = 120_000; // 2 min = stale position

// Member pin colors
const PIN_COLORS = ['#0d9488', '#f97316', '#8b5cf6', '#3b82f6', '#ec4899', '#ef4444', '#84cc16', '#06b6d4'];

const mapContainerStyle = { width: '100%', height: '100%' };
const mapOptions = {
  zoomControl: true,
  streetViewControl: false,
  mapTypeControl: false,
  fullscreenControl: true,
  gestureHandling: 'greedy',
};

export default function TripLive() {
  const { trip, setTrip, members, liveStatus, livePositions, broadcastPosition, myMembership, tripId, locations, reload } = useTripContext();
  const { user } = useAuth();
  const [sharing, setSharing] = useState(false);
  const [myPosition, setMyPosition] = useState(null);
  const [geoError, setGeoError] = useState(null);
  const [activeInfo, setActiveInfo] = useState(null);
  const [starting, setStarting] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [arriving, setArriving] = useState(false);

  const watchIdRef = useRef(null);
  const etaTimerRef = useRef(null);
  const mapRef = useRef(null);
  const myPositionRef = useRef(null);

  const isCreator = trip?.creator_id === user?.id;
  const isActive = trip?.status === 'active';
  const isCompleted = trip?.status === 'completed';
  const joinedMembers = members.filter(m => m.status === 'joined');
  const confirmedLocation = locations.find(l => l.is_confirmed);
  const destination = confirmedLocation
    ? { lat: confirmedLocation.lat, lng: confirmedLocation.lng }
    : (trip?.midpoint_lat ? { lat: trip.midpoint_lat, lng: trip.midpoint_lng } : null);

  const myLiveStatus = liveStatus.find(s => s.member_id === myMembership?.id);
  const myArrived = myLiveStatus?.arrived || false;

  // ---- Start trip (creator action) ----
  const handleStartTrip = async () => {
    setStarting(true);
    try {
      const updated = await startTrip(tripId);
      setTrip(updated);
      reload();
    } catch (err) {
      console.error('Failed to start trip:', err);
    }
    setStarting(false);
  };

  // ---- Complete trip (creator action) ----
  const handleCompleteTrip = async () => {
    setCompleting(true);
    try {
      const updated = await completeTrip(tripId);
      setTrip(updated);
      stopWatching();
    } catch (err) {
      console.error('Failed to complete trip:', err);
    }
    setCompleting(false);
  };

  // ---- Calculate ETA via Google Directions ----
  const calculateEta = useCallback(async (position) => {
    if (!destination || !window.google?.maps || !position) return null;

    try {
      const service = new google.maps.DirectionsService();
      const result = await new Promise((resolve, reject) => {
        service.route(
          {
            origin: new google.maps.LatLng(position.lat, position.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: {
              departureTime: new Date(),
              trafficModel: google.maps.TrafficModel.BEST_GUESS,
            },
          },
          (result, status) => {
            if (status === 'OK') resolve(result);
            else reject(new Error(status));
          }
        );
      });

      const leg = result.routes[0]?.legs[0];
      if (leg) {
        const duration = leg.duration_in_traffic || leg.duration;
        return {
          etaSeconds: duration.value,
          etaText: duration.text,
          distanceRemainingMeters: leg.distance.value,
        };
      }
    } catch (err) {
      console.error('ETA calculation failed:', err);
    }
    return null;
  }, [destination]);

  // ---- Start sharing location ----
  const startWatching = useCallback(() => {
    if (!navigator?.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    setSharing(true);
    setGeoError(null);

    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const newPos = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          accuracy: pos.coords.accuracy,
        };
        setMyPosition(newPos);
        myPositionRef.current = newPos;

        // Broadcast ephemeral position to all members
        if (myMembership) {
          broadcastPosition({
            memberId: myMembership.id,
            lat: newPos.lat,
            lng: newPos.lng,
            heading: newPos.heading,
            speed: newPos.speed,
            arrived: myArrived,
          });
        }
      },
      (err) => {
        console.error('Geolocation error:', err);
        setGeoError(
          err.code === 1 ? 'Location access denied. Please enable location permissions.'
          : err.code === 2 ? 'Location unavailable.'
          : 'Location request timed out.'
        );
        setSharing(false);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 15000,
      }
    );
  }, [broadcastPosition, myMembership, myArrived]);

  // ---- Stop sharing ----
  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    if (etaTimerRef.current) {
      clearInterval(etaTimerRef.current);
      etaTimerRef.current = null;
    }
    setSharing(false);
    if (myMembership && tripId) {
      stopSharingLocation(tripId, myMembership.id).catch(console.error);
    }
  }, [myMembership, tripId]);

  // ---- Periodic ETA + DB position save (uses ref to avoid re-trigger on each position update) ----
  useEffect(() => {
    if (!sharing || !myMembership || !tripId) return;

    const savePosition = async () => {
      const pos = myPositionRef.current;
      if (!pos) return;

      const eta = await calculateEta(pos);
      try {
        await updateLivePosition(tripId, myMembership.id, {
          lat: pos.lat,
          lng: pos.lng,
          heading: pos.heading,
          speed: pos.speed,
          accuracy: pos.accuracy,
          etaSeconds: eta?.etaSeconds,
          etaText: eta?.etaText,
          distanceRemainingMeters: eta?.distanceRemainingMeters,
        });

        // Broadcast with ETA
        broadcastPosition({
          memberId: myMembership.id,
          lat: pos.lat,
          lng: pos.lng,
          heading: pos.heading,
          speed: pos.speed,
          etaText: eta?.etaText,
          etaSeconds: eta?.etaSeconds,
          arrived: myArrived,
        });
      } catch (err) {
        console.error('Failed to save position:', err);
      }
    };

    // Save immediately, then on interval
    savePosition();
    etaTimerRef.current = setInterval(savePosition, ETA_INTERVAL);

    return () => {
      if (etaTimerRef.current) {
        clearInterval(etaTimerRef.current);
        etaTimerRef.current = null;
      }
    };
  }, [sharing, myMembership, tripId, calculateEta, broadcastPosition, myArrived]);

  // ---- Cleanup on unmount ----
  useEffect(() => {
    return () => stopWatching();
  }, [stopWatching]);

  // ---- Mark arrived ----
  const handleArrived = async () => {
    if (!myMembership) return;
    setArriving(true);
    try {
      await markArrived(tripId, myMembership.id, myMembership.display_name);
      stopWatching();
      reload();
    } catch (err) {
      console.error('Failed to mark arrived:', err);
    }
    setArriving(false);
  };

  // ---- Build member position data for the map ----
  const memberPositions = joinedMembers.map((member, idx) => {
    // Prefer broadcast (real-time) over DB (persisted)
    const broadcast = livePositions[member.id];
    const dbStatus = liveStatus.find(s => s.member_id === member.id);
    const isStale = broadcast && (Date.now() - broadcast.timestamp > STALE_THRESHOLD);

    const pos = broadcast && !isStale
      ? { lat: broadcast.lat, lng: broadcast.lng }
      : (dbStatus?.lat ? { lat: dbStatus.lat, lng: dbStatus.lng } : null);

    const arrived = broadcast?.arrived || dbStatus?.arrived || false;
    const etaText = broadcast?.etaText || dbStatus?.eta_text || null;
    const isSharing = dbStatus?.sharing_location || (broadcast && !isStale);

    return {
      member,
      pos,
      arrived,
      etaText,
      isSharing,
      isStale: isStale && !arrived,
      color: PIN_COLORS[idx % PIN_COLORS.length],
    };
  });

  // ---- Map bounds ----
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
    const bounds = new google.maps.LatLngBounds();
    let hasPoints = false;

    if (destination) {
      bounds.extend(destination);
      hasPoints = true;
    }

    memberPositions.forEach(({ pos }) => {
      if (pos) {
        bounds.extend(pos);
        hasPoints = true;
      }
    });

    if (hasPoints) {
      map.fitBounds(bounds, { padding: 60 });
    }
  }, [destination, memberPositions]);

  // ---- Pre-active state: show start button ----
  if (!isActive && !isCompleted) {
    return (
      <div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🚗</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Live Trip Mode</h2>
          <p className="text-sm text-gray-500 mb-6 max-w-sm mx-auto">
            When the trip starts, members can share their live location and everyone can track progress to the meeting point.
          </p>
          {!destination && (
            <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-700">
              Confirm a meeting location first to enable live tracking.
            </div>
          )}
          {isCreator && destination && (
            <button
              onClick={handleStartTrip}
              disabled={starting}
              className="px-6 py-3 bg-green-600 text-white font-semibold rounded-xl hover:bg-green-700 transition disabled:opacity-50"
            >
              {starting ? 'Starting...' : '🚀 Start Trip'}
            </button>
          )}
          {!isCreator && (
            <p className="text-xs text-gray-400">Only the trip creator can start the trip.</p>
          )}
        </div>
      </div>
    );
  }

  // ---- Completed state ----
  if (isCompleted) {
    const arrivals = liveStatus.filter(s => s.arrived);
    return (
      <div>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="text-4xl mb-3">🎉</div>
          <h2 className="text-lg font-bold text-gray-900 mb-2">Trip Completed!</h2>
          <p className="text-sm text-gray-500 mb-4">
            {arrivals.length}/{joinedMembers.length} members arrived.
          </p>
          <div className="space-y-2 max-w-xs mx-auto">
            {joinedMembers.map(m => {
              const status = liveStatus.find(s => s.member_id === m.id);
              return (
                <div key={m.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">{m.display_name}</span>
                  {status?.arrived ? (
                    <span className="text-xs font-semibold text-green-600">✓ Arrived</span>
                  ) : (
                    <span className="text-xs text-gray-400">Did not arrive</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ---- Active trip: live map ----
  return (
    <div>
      {/* Controls bar */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Live Tracking</h3>
            <p className="text-xs text-gray-500">
              {memberPositions.filter(m => m.isSharing).length}/{joinedMembers.length} sharing location
              {' · '}
              {liveStatus.filter(s => s.arrived).length} arrived
            </p>
          </div>

          <div className="flex items-center gap-2">
            {!myArrived && (
              sharing ? (
                <>
                  <button
                    onClick={handleArrived}
                    disabled={arriving}
                    className="px-3 py-1.5 bg-green-600 text-white text-xs font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
                  >
                    {arriving ? '...' : '📍 I\'ve Arrived'}
                  </button>
                  <button
                    onClick={stopWatching}
                    className="px-3 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition"
                  >
                    Stop Sharing
                  </button>
                </>
              ) : (
                <button
                  onClick={startWatching}
                  className="px-4 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition"
                >
                  📡 Share My Location
                </button>
              )
            )}
            {myArrived && (
              <span className="px-3 py-1.5 bg-green-100 text-green-700 text-xs font-semibold rounded-lg">
                ✓ You&apos;ve arrived!
              </span>
            )}
            {isCreator && (
              <button
                onClick={handleCompleteTrip}
                disabled={completing}
                className="px-3 py-1.5 bg-gray-800 text-white text-xs font-semibold rounded-lg hover:bg-gray-900 transition disabled:opacity-50"
              >
                {completing ? '...' : 'End Trip'}
              </button>
            )}
          </div>
        </div>

        {geoError && (
          <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            {geoError}
          </div>
        )}
      </div>

      {/* Live map */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden" style={{ height: 400 }}>
        <GoogleMap
          mapContainerStyle={mapContainerStyle}
          options={mapOptions}
          center={destination || { lat: 39.8283, lng: -98.5795 }}
          zoom={destination ? 10 : 4}
          onLoad={onMapLoad}
        >
          {/* Destination marker */}
          {destination && (
            <MarkerF
              position={destination}
              icon={{
                path: google.maps.SymbolPath.BACKWARD_CLOSED_ARROW,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
                scale: 6,
              }}
              onClick={() => setActiveInfo('destination')}
            />
          )}
          {activeInfo === 'destination' && destination && (
            <InfoWindowF position={destination} onCloseClick={() => setActiveInfo(null)}>
              <div className="text-xs">
                <div className="font-semibold">Meeting Point</div>
                {confirmedLocation?.name && <div className="text-gray-500">{confirmedLocation.name}</div>}
              </div>
            </InfoWindowF>
          )}

          {/* Member position markers */}
          {memberPositions.map(({ member, pos, arrived, etaText, isSharing, isStale, color }) => {
            if (!pos) return null;
            const isMe = member.user_id === user?.id;

            return (
              <MarkerF
                key={member.id}
                position={pos}
                icon={{
                  path: google.maps.SymbolPath.CIRCLE,
                  fillColor: arrived ? '#22c55e' : isStale ? '#9ca3af' : color,
                  fillOpacity: arrived ? 1 : isStale ? 0.5 : 0.9,
                  strokeColor: '#fff',
                  strokeWeight: 2,
                  scale: isMe ? 10 : 8,
                }}
                onClick={() => setActiveInfo(member.id)}
              />
            );
          })}

          {/* Info windows for members */}
          {memberPositions.map(({ member, pos, arrived, etaText, isSharing, isStale }) => {
            if (!pos || activeInfo !== member.id) return null;
            return (
              <InfoWindowF key={`info-${member.id}`} position={pos} onCloseClick={() => setActiveInfo(null)}>
                <div className="text-xs min-w-[120px]">
                  <div className="font-semibold">{member.display_name}</div>
                  {arrived ? (
                    <div className="text-green-600 font-medium mt-0.5">✓ Arrived</div>
                  ) : etaText ? (
                    <div className="text-gray-600 mt-0.5">ETA: {etaText}</div>
                  ) : isStale ? (
                    <div className="text-gray-400 mt-0.5">Position stale</div>
                  ) : isSharing ? (
                    <div className="text-teal-600 mt-0.5">En route</div>
                  ) : (
                    <div className="text-gray-400 mt-0.5">Not sharing</div>
                  )}
                </div>
              </InfoWindowF>
            );
          })}
        </GoogleMap>
      </div>

      {/* Member status list */}
      <div className="mt-4 space-y-2">
        {memberPositions.map(({ member, arrived, etaText, isSharing, isStale, color }) => {
          const isMe = member.user_id === user?.id;
          return (
            <div
              key={member.id}
              className={`flex items-center justify-between p-3 rounded-xl border ${
                arrived ? 'bg-green-50/50 border-green-200' : 'bg-white border-gray-200'
              }`}
            >
              <div className="flex items-center gap-2.5">
                <div
                  className="w-3 h-3 rounded-full shrink-0"
                  style={{ backgroundColor: arrived ? '#22c55e' : isStale ? '#9ca3af' : color }}
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">
                    {member.display_name}
                    {isMe && <span className="text-teal-600 ml-1">(you)</span>}
                  </span>
                </div>
              </div>
              <div className="text-right">
                {arrived ? (
                  <span className="text-xs font-semibold text-green-600">✓ Arrived</span>
                ) : etaText ? (
                  <div>
                    <span className="text-xs font-semibold text-gray-700">{etaText}</span>
                    <span className="text-[10px] text-gray-400 ml-1">away</span>
                  </div>
                ) : isSharing ? (
                  <span className="text-xs text-teal-600">Sharing...</span>
                ) : isStale ? (
                  <span className="text-xs text-gray-400">Stale</span>
                ) : (
                  <span className="text-xs text-gray-300">Not sharing</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
