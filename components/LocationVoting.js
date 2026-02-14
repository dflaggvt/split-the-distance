'use client';

/**
 * LocationVoting — Location proposal, voting, distance calculation, midpoint, and confirm UI.
 * Phase 2 of Collaborative Group Trips.
 * 
 * Reuses LocationInput for place search and lib/routing.js for midpoint calculation.
 */

import { useState, useCallback, useEffect } from 'react';
import { useTripContext } from './TripProvider';
import { useAuth } from './AuthProvider';
import LocationInput from './LocationInput';
import {
  proposeLocation,
  deleteLocation,
  voteLocation,
  removeLocationVote,
  saveLocationDistance,
  confirmTripLocation,
} from '@/lib/trips';

const VOTE_STYLES = {
  up: { active: 'bg-green-100 text-green-700 border-green-300', icon: '👍' },
  down: { active: 'bg-red-100 text-red-700 border-red-300', icon: '👎' },
};

export default function LocationVoting() {
  const { trip, setTrip, locations, members, myMembership, tripId } = useTripContext();
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');
  const [proposing, setProposing] = useState(false);
  const [findingMidpoint, setFindingMidpoint] = useState(false);
  const [midpointError, setMidpointError] = useState(null);
  const [confirming, setConfirming] = useState(null);
  const [calculatingDistances, setCalculatingDistances] = useState(null);

  const isCreator = myMembership?.role === 'creator';
  const confirmedLocation = locations.find(l => l.is_confirmed);
  const joinedMembers = members.filter(m => m.status === 'joined');
  const membersWithOrigins = joinedMembers.filter(m => m.origin_lat && m.origin_lng);

  // ---- Propose a location from search ----
  const handleLocationSelect = async (place) => {
    if (!myMembership || !place?.lat) return;
    setProposing(true);
    try {
      await proposeLocation(tripId, myMembership.id, {
        name: place.name || place.formattedAddress || 'Unnamed location',
        address: place.formattedAddress || place.name,
        lat: place.lat,
        lng: place.lng || place.lon,
        placeId: place.placeId || null,
      });
      setSearchValue('');
    } catch (err) {
      console.error('Failed to propose location:', err);
    }
    setProposing(false);
  };

  // ---- Vote on a location ----
  const handleVote = async (locationId, vote) => {
    if (!myMembership) return;
    const myVote = getMyVote(locationId);
    try {
      if (myVote === vote) {
        // Toggle off
        await removeLocationVote(locationId, myMembership.id);
      } else {
        await voteLocation(locationId, myMembership.id, vote);
      }
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // ---- Delete a location ----
  const handleDelete = async (locationId) => {
    try {
      await deleteLocation(locationId);
    } catch (err) {
      console.error('Failed to delete location:', err);
    }
  };

  // ---- Calculate distances from all members to a location ----
  const calculateDistances = useCallback(async (location) => {
    if (!window.google?.maps || membersWithOrigins.length === 0) return;

    setCalculatingDistances(location.id);
    try {
      const service = new google.maps.DistanceMatrixService();
      const origins = membersWithOrigins.map(m => new google.maps.LatLng(m.origin_lat, m.origin_lng));
      const destination = [new google.maps.LatLng(location.lat, location.lng)];

      const result = await new Promise((resolve, reject) => {
        service.getDistanceMatrix(
          {
            origins,
            destinations: destination,
            travelMode: google.maps.TravelMode.DRIVING,
            drivingOptions: { departureTime: new Date(), trafficModel: google.maps.TrafficModel.BEST_GUESS },
          },
          (response, status) => {
            if (status === 'OK') resolve(response);
            else reject(new Error(`Distance Matrix failed: ${status}`));
          }
        );
      });

      // Save each member's distance to the DB
      for (let i = 0; i < membersWithOrigins.length; i++) {
        const element = result.rows[i]?.elements?.[0];
        if (element?.status === 'OK') {
          await saveLocationDistance(location.id, membersWithOrigins[i].id, {
            durationSeconds: element.duration_in_traffic?.value || element.duration.value,
            durationText: element.duration_in_traffic?.text || element.duration.text,
            distanceMeters: element.distance.value,
            distanceText: element.distance.text,
            travelMode: 'DRIVING',
          });
        }
      }
    } catch (err) {
      console.error('Failed to calculate distances:', err);
    }
    setCalculatingDistances(null);
  }, [membersWithOrigins]);

  // ---- Auto-calculate distances for new locations ----
  useEffect(() => {
    if (!window.google?.maps || membersWithOrigins.length === 0) return;

    locations.forEach(loc => {
      const hasDistances = loc.trip_location_distances?.length >= membersWithOrigins.length;
      if (!hasDistances && calculatingDistances !== loc.id) {
        calculateDistances(loc);
      }
    });
  }, [locations, membersWithOrigins, calculateDistances, calculatingDistances]);

  // ---- Find group midpoint ----
  const handleFindMidpoint = async () => {
    if (membersWithOrigins.length < 2) {
      setMidpointError('At least 2 members need to set their starting location first.');
      return;
    }
    if (!window.google?.maps) {
      setMidpointError('Google Maps is still loading. Please try again.');
      return;
    }

    setFindingMidpoint(true);
    setMidpointError(null);

    try {
      // Dynamic import to avoid loading routing.js until needed
      const { getMultiLocationMidpoint } = await import('@/lib/routing');

      const locs = membersWithOrigins.map(m => ({
        lat: m.origin_lat,
        lon: m.origin_lng,
        name: m.origin_name || m.display_name,
      }));

      const result = await getMultiLocationMidpoint(locs, { mode: 'time', travelMode: 'DRIVING' });

      if (result?.midpoint) {
        // Reverse geocode the midpoint
        const geocoder = new google.maps.Geocoder();
        const geocodeResult = await new Promise((resolve) => {
          geocoder.geocode(
            { location: { lat: result.midpoint.lat, lng: result.midpoint.lon || result.midpoint.lng } },
            (results, status) => {
              resolve(status === 'OK' && results?.[0] ? results[0] : null);
            }
          );
        });

        const midpointName = geocodeResult?.formatted_address || 'Group Midpoint';

        await proposeLocation(tripId, myMembership.id, {
          name: `Midpoint: ${midpointName.split(',').slice(0, 2).join(',')}`,
          address: midpointName,
          lat: result.midpoint.lat,
          lng: result.midpoint.lon || result.midpoint.lng,
          isMidpoint: true,
          notes: `Optimized for equal drive time. Max drive: ${Math.round(result.maxDrive / 60)} min`,
        });
      }
    } catch (err) {
      console.error('Failed to find midpoint:', err);
      setMidpointError(err.message || 'Failed to calculate midpoint. Please try again.');
    }
    setFindingMidpoint(false);
  };

  // ---- Confirm a location ----
  const handleConfirm = async (locationId) => {
    setConfirming(locationId);
    try {
      const updated = await confirmTripLocation(tripId, locationId);
      setTrip(updated);
    } catch (err) {
      console.error('Failed to confirm location:', err);
    }
    setConfirming(null);
  };

  // ---- Helpers ----
  const getMyVote = (locationId) => {
    if (!myMembership) return null;
    const loc = locations.find(l => l.id === locationId);
    const vote = loc?.trip_location_votes?.find(v => v.member_id === myMembership.id);
    return vote?.vote || null;
  };

  const getVoteSummary = (location) => {
    const votes = location.trip_location_votes || [];
    return {
      up: votes.filter(v => v.vote === 'up').length,
      down: votes.filter(v => v.vote === 'down').length,
      score: votes.reduce((acc, v) => acc + (v.vote === 'up' ? 1 : -1), 0),
    };
  };

  const getDistancesForLocation = (location) => {
    return location.trip_location_distances || [];
  };

  return (
    <div>
      {/* Confirmed location banner */}
      {confirmedLocation && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">📍</span>
            <div>
              <div className="font-semibold text-green-800">Location Confirmed</div>
              <div className="text-sm text-green-700">{confirmedLocation.name}</div>
              {confirmedLocation.address && confirmedLocation.address !== confirmedLocation.name && (
                <div className="text-xs text-green-600 mt-0.5">{confirmedLocation.address}</div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Propose location + find midpoint controls */}
      {!confirmedLocation && (
        <div className="space-y-3 mb-6">
          {/* Search to propose */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <h3 className="font-semibold text-gray-900 mb-3">Suggest a Location</h3>
            <div className="relative">
              <LocationInput
                value={searchValue}
                onChange={setSearchValue}
                onSelect={handleLocationSelect}
                onClear={() => setSearchValue('')}
                placeholder="Search for a place..."
                variant="from"
              />
              {proposing && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
          </div>

          {/* Find midpoint button */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900 text-sm">Find Group Midpoint</h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Auto-calculate the optimal meeting point for all members.
                  {membersWithOrigins.length < 2 && (
                    <span className="text-amber-600 ml-1">
                      ({membersWithOrigins.length}/{joinedMembers.length} members have set origins)
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={handleFindMidpoint}
                disabled={findingMidpoint || membersWithOrigins.length < 2}
                className="shrink-0 px-4 py-2 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {findingMidpoint ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Calculating...
                  </span>
                ) : (
                  '🎯 Find Midpoint'
                )}
              </button>
            </div>
            {midpointError && (
              <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
                {midpointError}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Location proposals list */}
      <div className="space-y-3">
        {locations.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-3xl mb-2">📍</div>
            <div className="text-gray-500 text-sm">
              No locations proposed yet. Search for a place or find the group midpoint.
            </div>
          </div>
        ) : (
          [...locations]
            .sort((a, b) => {
              // Confirmed first, then midpoints, then by score
              if (a.is_confirmed && !b.is_confirmed) return -1;
              if (!a.is_confirmed && b.is_confirmed) return 1;
              const scoreA = getVoteSummary(a).score;
              const scoreB = getVoteSummary(b).score;
              return scoreB - scoreA;
            })
            .map((location) => {
              const summary = getVoteSummary(location);
              const myVote = getMyVote(location.id);
              const distances = getDistancesForLocation(location);
              const proposer = members.find(m => m.id === location.proposed_by);
              const isCalculating = calculatingDistances === location.id;

              return (
                <div
                  key={location.id}
                  className={`bg-white rounded-xl border p-4 ${
                    location.is_confirmed
                      ? 'border-green-300 bg-green-50/30'
                      : location.is_midpoint
                      ? 'border-indigo-200 bg-indigo-50/20'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Location header */}
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="font-semibold text-gray-900 text-sm truncate">
                          {location.name}
                        </span>
                        {location.is_midpoint && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-100 text-indigo-700 shrink-0">
                            Midpoint
                          </span>
                        )}
                        {location.is_confirmed && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 shrink-0">
                            ✓ Confirmed
                          </span>
                        )}
                      </div>
                      {location.address && location.address !== location.name && (
                        <div className="text-xs text-gray-400 truncate">{location.address}</div>
                      )}
                      {location.notes && (
                        <div className="text-xs text-gray-500 mt-1 italic">{location.notes}</div>
                      )}
                      <div className="text-xs text-gray-400 mt-0.5">
                        Suggested by {proposer?.display_name || 'Unknown'}
                      </div>
                    </div>

                    {/* Score badge */}
                    <div className="flex flex-col items-center ml-3 shrink-0">
                      <span className={`text-lg font-bold ${
                        summary.score > 0 ? 'text-green-600' : summary.score < 0 ? 'text-red-500' : 'text-gray-400'
                      }`}>
                        {summary.score > 0 ? '+' : ''}{summary.score}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        {summary.up}↑ {summary.down}↓
                      </span>
                    </div>
                  </div>

                  {/* Drive times from members */}
                  {distances.length > 0 && (
                    <div className="mb-3 flex flex-wrap gap-1.5">
                      {distances.map((d) => {
                        const member = members.find(m => m.id === d.member_id);
                        return (
                          <span
                            key={d.id}
                            className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 bg-gray-50 border border-gray-100 rounded-full text-gray-600"
                          >
                            <span className="font-medium">{member?.display_name?.split(' ')[0] || '?'}</span>
                            <span className="text-gray-400">·</span>
                            <span>{d.duration_text}</span>
                            <span className="text-gray-300">({d.distance_text})</span>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {isCalculating && (
                    <div className="mb-3 text-xs text-gray-400 flex items-center gap-1">
                      <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Calculating drive times...
                    </div>
                  )}

                  {/* Voting buttons + actions */}
                  {!confirmedLocation && myMembership && (
                    <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                      {/* Vote up */}
                      <button
                        onClick={() => handleVote(location.id, 'up')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          myVote === 'up'
                            ? VOTE_STYLES.up.active
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-green-50 hover:border-green-200'
                        }`}
                      >
                        👍 Like
                      </button>

                      {/* Vote down */}
                      <button
                        onClick={() => handleVote(location.id, 'down')}
                        className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                          myVote === 'down'
                            ? VOTE_STYLES.down.active
                            : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-red-50 hover:border-red-200'
                        }`}
                      >
                        👎 Nah
                      </button>

                      <div className="flex-1" />

                      {/* Recalculate distances */}
                      {membersWithOrigins.length > 0 && (
                        <button
                          onClick={() => calculateDistances(location)}
                          disabled={isCalculating}
                          className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition"
                          title="Recalculate drive times"
                        >
                          🔄
                        </button>
                      )}

                      {/* Confirm (creator only) */}
                      {isCreator && (
                        <button
                          onClick={() => handleConfirm(location.id)}
                          disabled={confirming === location.id}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                        >
                          {confirming === location.id ? '...' : '✓ Confirm'}
                        </button>
                      )}

                      {/* Delete (proposer or creator) */}
                      {(isCreator || (myMembership && location.proposed_by === myMembership.id)) && (
                        <button
                          onClick={() => handleDelete(location.id)}
                          className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  )}

                  {/* Per-member vote breakdown */}
                  {(location.trip_location_votes || []).length > 0 && (
                    <div className="mt-2 pt-2 border-t border-gray-100 flex flex-wrap gap-1.5">
                      {(location.trip_location_votes || []).map((v) => {
                        const member = members.find(m => m.id === v.member_id);
                        return (
                          <span
                            key={v.id}
                            className={`text-[11px] px-2 py-0.5 rounded-full ${
                              v.vote === 'up'
                                ? 'bg-green-50 text-green-600'
                                : 'bg-red-50 text-red-500'
                            }`}
                          >
                            {member?.display_name?.split(' ')[0] || '?'} {v.vote === 'up' ? '👍' : '👎'}
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </div>

      {/* Member origins reminder */}
      {!confirmedLocation && membersWithOrigins.length < joinedMembers.length && (
        <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-700">
          <strong>{joinedMembers.length - membersWithOrigins.length} member{joinedMembers.length - membersWithOrigins.length !== 1 ? 's' : ''}</strong> haven&apos;t set their starting location yet.
          Drive times and midpoint work best when all members have origins.
        </div>
      )}
    </div>
  );
}
