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
  const [myMembership, setMyMembership] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const channelRef = useRef(null);

  // ---- Initial data fetch ----
  const loadTrip = useCallback(async () => {
    if (!tripId || !supabase) return;
    setLoading(true);
    setError(null);
    try {
      const [tripData, membersData, dateData, membership] = await Promise.all([
        fetchTrip(tripId),
        fetchTripMembers(tripId),
        fetchDateOptions(tripId),
        getMyMembership(tripId),
      ]);
      setTrip(tripData);
      setMembers(membersData);
      setDateOptions(dateData);
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
        (payload) => {
          // Refetch date options when votes change
          fetchDateOptions(tripId).then(setDateOptions).catch(console.error);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tripId]);

  const value = {
    trip,
    setTrip,
    members,
    dateOptions,
    myMembership,
    loading,
    error,
    reload: loadTrip,
    tripId,
  };

  return <TripContext.Provider value={value}>{children}</TripContext.Provider>;
}
