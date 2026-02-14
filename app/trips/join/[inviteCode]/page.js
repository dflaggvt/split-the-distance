'use client';

/**
 * /trips/join/[inviteCode] — Join a trip via invite link.
 *
 * Flow:
 *   1. Anonymous user clicks invite link → sees trip preview + "Sign In to Join"
 *   2. User signs in (email or Google OAuth) → auto-joins and lands on the trip page
 *   3. Already-logged-in user → sees trip preview + "Join This Trip" button
 *   4. Already a member → redirected straight to the trip page
 *
 * For Google OAuth (which requires a full-page redirect), the join intent is
 * persisted in sessionStorage so we can skip the preview on return and show
 * a minimal "Joining…" spinner instead.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { useFeatures } from '@/components/FeatureProvider';
import { fetchTripByInviteCode, joinTrip } from '@/lib/trips';
import SignInModal from '@/components/SignInModal';
import Link from 'next/link';

const PENDING_JOIN_KEY = 'std_pending_join';

export default function JoinTripPage() {
  const { inviteCode } = useParams();
  const router = useRouter();
  const { user, profile, isLoggedIn, loading: authLoading } = useAuth();
  const { openSignIn } = useFeatures();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState(null);
  const [joined, setJoined] = useState(false);

  // True when returning from an OAuth redirect with a stored join intent
  const [pendingJoin, setPendingJoin] = useState(false);
  // Tracks in-session intent (user clicked "Sign In to Join" then signed in via modal)
  const joinIntended = useRef(false);

  // ── On mount: check sessionStorage for a pending join from OAuth redirect ──
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(PENDING_JOIN_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        if (data.inviteCode === inviteCode) {
          setPendingJoin(true);
        } else {
          // Stale intent for a different trip — clear it
          sessionStorage.removeItem(PENDING_JOIN_KEY);
        }
      }
    } catch { /* ignore */ }
  }, [inviteCode]);

  // ── Load trip preview ──
  useEffect(() => {
    if (!inviteCode) return;
    setLoading(true);
    fetchTripByInviteCode(inviteCode)
      .then(setTrip)
      .catch((err) => {
        console.error('Failed to load trip:', err);
        setError('Trip not found or invalid invite link.');
      })
      .finally(() => setLoading(false));
  }, [inviteCode]);

  // ── Helpers ──
  const clearPendingJoin = useCallback(() => {
    try { sessionStorage.removeItem(PENDING_JOIN_KEY); } catch { /* ignore */ }
    setPendingJoin(false);
    joinIntended.current = false;
  }, []);

  const performJoin = useCallback(async () => {
    if (!trip || !user) return;
    setJoining(true);
    setError(null);
    try {
      await joinTrip(trip.id, {
        displayName: profile?.display_name || user?.email?.split('@')[0] || 'Member',
        email: user?.email,
      });
      setJoined(true);
      clearPendingJoin();
      // Navigate immediately — no artificial delay
      router.push(`/trips/${trip.id}`);
    } catch (err) {
      console.error('Failed to join trip:', err);
      setError(err.message || 'Failed to join. Please try again.');
      setJoining(false);
      clearPendingJoin();
    }
  }, [trip, user, profile, router, clearPendingJoin]);

  // ── Auto-join when conditions are met ──
  useEffect(() => {
    if (authLoading || loading || !trip || !isLoggedIn || joined || joining) return;

    // Already a member → redirect straight to the trip
    const existing = trip.trip_members?.find(m => m.user_id === user?.id);
    if (existing) {
      setJoined(true);
      clearPendingJoin();
      router.push(`/trips/${trip.id}`);
      return;
    }

    // User expressed join intent (clicked button then signed in, or returning from OAuth)
    if (pendingJoin || joinIntended.current) {
      performJoin();
    }
  }, [authLoading, loading, isLoggedIn, trip, user, joined, joining, pendingJoin, performJoin, clearPendingJoin, router]);

  // ── Button handler ──
  const handleJoin = () => {
    if (!isLoggedIn) {
      // Store intent so we can auto-join after OAuth redirect
      joinIntended.current = true;
      try {
        sessionStorage.setItem(PENDING_JOIN_KEY, JSON.stringify({ inviteCode }));
      } catch { /* ignore */ }
      openSignIn();
      return;
    }
    performJoin();
  };

  // ─────────────────────────── Render ───────────────────────────

  // Returning from OAuth → minimal spinner (no re-showing the full preview)
  if (pendingJoin && (authLoading || loading || joining) && !error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <SignInModal />
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-xs w-full">
          <svg className="animate-spin h-8 w-8 text-teal-600 mx-auto mb-4" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <h2 className="text-lg font-semibold text-gray-900 mb-1">Joining trip...</h2>
          <p className="text-sm text-gray-500">Just a moment</p>
        </div>
      </div>
    );
  }

  // Initial load
  if (loading || authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center animate-pulse">
          <div className="w-16 h-16 bg-gray-200 rounded-full mx-auto mb-4" />
          <div className="h-5 w-48 bg-gray-200 rounded mx-auto mb-2" />
          <div className="h-4 w-32 bg-gray-100 rounded mx-auto" />
        </div>
      </div>
    );
  }

  // Trip not found
  if (!trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trip not found</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error || 'This invite link is invalid or the trip has been deleted.'}
          </p>
          <Link
            href="/"
            className="text-sm text-teal-600 font-medium hover:text-teal-700 no-underline"
          >
            Go to Split The Distance →
          </Link>
        </div>
      </div>
    );
  }

  const memberCount = trip.trip_members?.filter(m => m.status === 'joined').length || 0;
  const creator = trip.trip_members?.find(m => m.role === 'creator');

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <SignInModal />
      <div className="bg-white rounded-2xl shadow-lg border border-gray-200 p-8 max-w-md w-full text-center">
        {/* Trip info */}
        <div className="text-4xl mb-4">🗺️</div>
        <h1 className="text-2xl font-bold text-gray-900 mb-1">{trip.title}</h1>
        {trip.description && (
          <p className="text-sm text-gray-500 mb-3">{trip.description}</p>
        )}

        {/* Creator + member count */}
        <div className="flex items-center justify-center gap-4 mb-6 text-sm text-gray-500">
          {creator && (
            <span>Created by <strong className="text-gray-700">{creator.display_name}</strong></span>
          )}
          <span className="flex items-center gap-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            {memberCount} member{memberCount !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 mb-4">
            {error}
          </div>
        )}

        {/* Join / Joining button */}
        {!joined && (
          <button
            onClick={handleJoin}
            disabled={joining}
            className="w-full py-3 bg-teal-600 text-white font-semibold rounded-xl hover:bg-teal-700 transition disabled:opacity-50 text-sm"
          >
            {joining ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Joining...
              </span>
            ) : isLoggedIn ? (
              'Join This Trip'
            ) : (
              'Sign In to Join'
            )}
          </button>
        )}

        <div className="mt-6 pt-4 border-t border-gray-100">
          <Link
            href="/"
            className="text-xs text-gray-400 hover:text-gray-600 no-underline flex items-center justify-center gap-1.5"
          >
            <img src="/logo.png" alt="Split The Distance" width="16" height="16" />
            Split The Distance
          </Link>
        </div>
      </div>
    </div>
  );
}
