'use client';

/**
 * TripProvider — React context for a single trip's state + Supabase Realtime.
 * Wraps trip detail pages. Manages members, date options, votes,
 * and real-time updates via Postgres Changes subscriptions.
 */

import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import {
  fetchTrip,
  fetchTripMembers,
  fetchDateOptions,
  fetchTripLocations,
  fetchTripStops,
  fetchTripMessages,
  fetchLiveStatus,
  getMyMembership,
} from '@/lib/trips';

const TripContext = createContext(null);

export function useTripContext() {
  const ctx = useContext(TripContext);
  if (!ctx) throw new Error('useTripContext must be used within TripProvider');
  return ctx;
}

export default function TripProvider({ tripId, children }) {
  const [trip, setTrip] = useState(null);
  const [members, setMembers] = useState([]);
  const [dateOptions, setDateOptions] = useState([]);
  const [locations, setLocations] = useState([]);
  const [stops, setStops] = useState([]);
  const [messages, setMessages] = useState([]);
  const [liveStatus, setLiveStatus] = useState([]);
  const [livePositions, setLivePositions] = useState({});
  const [myMembership, setMyMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);
  const broadcastRef = useRef(null);

  // ---- Initial data fetch ----
  const loadTrip = useCallback(async () => {
    if (!tripId || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [tripData, membersData, dateData, locationData, stopsData, messagesData, liveData, membership] = await Promise.all([
        fetchTrip(tripId),
        fetchTripMembers(tripId),
        fetchDateOptions(tripId),
        fetchTripLocations(tripId),
        fetchTripStops(tripId),
        fetchTripMessages(tripId),
        fetchLiveStatus(tripId),
        getMyMembership(tripId),
      ]);
      setTrip(tripData);
      setMembers(membersData);
      setDateOptions(dateData);
      setLocations(locationData);
      setStops(stopsData);
      setMessages(messagesData);
      setLiveStatus(liveData);
      setMyMembership(membership);
    } catch (err) {
      console.error('Failed to load trip:', err);
      setError(err.message);
    }
    setLoading(false);
  }, [tripId]);

  useEffect(() => {
    loadTrip();
  }, [loadTrip]);

  // ---- Supabase Realtime subscription ----
  useEffect(() => {
    if (!tripId || !supabase) return;

    const channel = supabase
      .channel(`trip:${tripId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_members', filter: `trip_id=eq.${tripId}` },
        () => {
          // Refetch members on any change
          fetchTripMembers(tripId).then(setMembers).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_date_options', filter: `trip_id=eq.${tripId}` },
        () => {
          // Refetch date options (includes votes)
          fetchDateOptions(tripId).then(setDateOptions).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_date_votes' },
        () => {
          // Refetch date options when votes change
          fetchDateOptions(tripId).then(setDateOptions).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_locations', filter: `trip_id=eq.${tripId}` },
        () => {
          fetchTripLocations(tripId).then(setLocations).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_location_votes' },
        () => {
          fetchTripLocations(tripId).then(setLocations).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_location_distances' },
        () => {
          fetchTripLocations(tripId).then(setLocations).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_stops', filter: `trip_id=eq.${tripId}` },
        () => {
          fetchTripStops(tripId).then(setStops).catch(console.error);
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'trip_messages', filter: `trip_id=eq.${tripId}` },
        (payload) => {
          // Append new messages in real-time (no full refetch needed)
          if (payload.new) {
            setMessages(prev => [...prev, payload.new]);
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'trip_live_status', filter: `trip_id=eq.${tripId}` },
        () => {
          fetchLiveStatus(tripId).then(setLiveStatus).catch(console.error);
        }
      )
      .subscribe();

    channelRef.current = channel;

    // ---- Broadcast channel for ephemeral live position pings ----
    const broadcast = supabase
      .channel(`trip-live:${tripId}`)
      .on('broadcast', { event: 'position' }, ({ payload }) => {
        if (payload?.memberId) {
          setLivePositions(prev => ({
            ...prev,
            [payload.memberId]: {
              lat: payload.lat,
              lng: payload.lng,
              heading: payload.heading,
              speed: payload.speed,
              etaText: payload.etaText,
              etaSeconds: payload.etaSeconds,
              arrived: payload.arrived,
              timestamp: Date.now(),
            },
          }));
        }
      })
      .subscribe();

    broadcastRef.current = broadcast;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (broadcastRef.current) {
        supabase.removeChannel(broadcastRef.current);
        broadcastRef.current = null;
      }
    };
  }, [tripId]);

  // Broadcast own position to other members (ephemeral, no DB write)
  const broadcastPosition = useCallback((positionData) => {
    if (broadcastRef.current) {
      broadcastRef.current.send({
        type: 'broadcast',
        event: 'position',
        payload: positionData,
      });
    }
  }, []);

  const value = {
    trip,
    setTrip,
    members,
    dateOptions,
    locations,
    stops,
    messages,
    liveStatus,
    livePositions,
    broadcastPosition,
    myMembership,
    loading,
    error,
    reload: loadTrip,
    tripId,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
