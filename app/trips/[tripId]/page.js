'use client';

/**
 * /trips/[tripId] — Trip detail page.
 *
 * 4 tabs: Plan | People | Trip | Chat
 *
 * - Plan: TripPlan component with sub-navigation (dates, locations, options)
 * - People: GuestList with origin setting
 * - Trip: Itinerary during planning, Live when active
 * - Chat: Real-time group chat
 */

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useJsApiLoader } from '@react-google-maps/api';
import { useAuth } from '@/components/AuthProvider';
import TripProvider, { useTripContext } from '@/components/TripProvider';

import TripPlan from '@/components/TripPlan';
import GuestList from '@/components/GuestList';
import TripItinerary from '@/components/TripItinerary';
import TripChat from '@/components/TripChat';
import TripLive from '@/components/TripLive';
import TripInvite from '@/components/TripInvite';
import Link from 'next/link';

// Must be a static constant to prevent useJsApiLoader from re-loading
const GOOGLE_MAPS_LIBRARIES = [];

const STATUS_BADGE = {
  planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  active: { label: 'Active', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  canceled: { label: 'Canceled', className: 'bg-red-100 text-red-600' },
};

function getDefaultTab(trip) {
  if (!trip) return 'plan';
  if (trip.status === 'active') return 'trip';
  if (trip.status === 'completed') return 'trip';
  return 'plan';
}

function TripDetail() {
  const {
    trip, members, stops, messages, locations, permissions,
    loading, error, refetchTrip,
  } = useTripContext();

  const defaultTab = useMemo(
    () => getDefaultTab(trip),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip?.status]
  );
  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab || defaultTab;

  const [showInvite, setShowInvite] = useState(false);
  // When trip is active, allow toggling between Live and Itinerary in the Trip tab
  const [tripSubview, setTripSubview] = useState(null); // null = auto, 'live', 'itinerary'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-5 py-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-5 py-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse">
            <div className="h-4 w-64 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (error || !trip) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">😕</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Trip not found</h2>
          <p className="text-sm text-gray-500 mb-4">
            {error || 'This trip may have been deleted or you don\'t have access.'}
          </p>
          <Link
            href="/trips"
            className="inline-flex items-center gap-1 text-sm text-teal-600 font-medium hover:text-teal-700 no-underline"
          >
            ← Back to My Trips
          </Link>
        </div>
      </div>
    );
  }

  const badge = STATUS_BADGE[trip.status] || STATUS_BADGE.planning;
  const joinedMembers = members.filter(m => m.status === 'joined');
  const confirmedLocation = locations.find(l => l.is_confirmed);
  const isActive = trip.status === 'active';

  // Build tabs — "Trip" tab label changes contextually
  const tabs = [
    { id: 'plan', label: 'Plan', icon: '📋' },
    { id: 'people', label: 'People', icon: '👥' },
    {
      id: 'trip',
      label: isActive ? 'Live' : 'Trip',
      icon: isActive ? '🚗' : '🗺️',
      pulse: isActive,
    },
    { id: 'chat', label: 'Chat', icon: '💬' },
  ];

  // Determine what the Trip tab shows
  const renderTripTab = () => {
    const showLive = isActive && tripSubview !== 'itinerary';
    const showItinerary = !isActive || tripSubview === 'itinerary';

    // During planning with no confirmed location and no stops: empty state
    if (!isActive && !confirmedLocation && stops.length === 0) {
      return (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <span className="text-3xl block mb-3">📋</span>
          <h3 className="font-semibold text-gray-900 mb-1">Itinerary</h3>
          <p className="text-sm text-gray-500">
            Confirm a date and location in the Plan tab first, then build your itinerary here.
          </p>
        </div>
      );
    }

    return (
      <div>
        {/* Toggle between Live / Itinerary when trip is active */}
        {isActive && (
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setTripSubview(showLive ? 'itinerary' : null)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                showLive
                  ? 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  : 'bg-teal-50 text-teal-700 border border-teal-200'
              }`}
            >
              {showLive ? 'View Itinerary' : 'View Live Map'}
            </button>
          </div>
        )}
        {showLive && <TripLive />}
        {showItinerary && <TripItinerary />}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-3xl mx-auto px-5 py-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3 min-w-0">
              <Link href="/trips" className="text-gray-400 hover:text-gray-600 transition no-underline shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M15 18l-6-6 6-6" />
                </svg>
              </Link>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold text-gray-900 truncate">{trip.title}</h1>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${badge.className}`}>
                    {badge.label}
                  </span>
                </div>
                {trip.description && (
                  <p className="text-sm text-gray-500 truncate mt-0.5">{trip.description}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition shrink-0"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="8.5" cy="7" r="4" />
                <line x1="20" y1="8" x2="20" y2="14" />
                <line x1="23" y1="11" x2="17" y2="11" />
              </svg>
              Invite
            </button>
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => { setActiveTab(tab.id); if (tab.id === 'trip') setTripSubview(null); }}
                className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap flex-1 justify-center ${
                  currentTab === tab.id
                    ? 'border-teal-500 text-teal-700 bg-teal-50/50'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span>{tab.icon}</span>
                {tab.label}
                {tab.pulse && (
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                  </span>
                )}
                {tab.id === 'people' && (
                  <span className="text-xs text-gray-400">({joinedMembers.length})</span>
                )}
                {tab.id === 'chat' && messages.length > 0 && (
                  <span className="text-xs text-gray-400">({messages.length})</span>
                )}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-3xl mx-auto px-5 py-6">
        {currentTab === 'plan' && <TripPlan onSwitchTab={setActiveTab} />}
        {currentTab === 'people' && <GuestList />}
        {currentTab === 'trip' && renderTripTab()}
        {currentTab === 'chat' && <TripChat />}
      </main>

      {/* Invite modal */}
      {showInvite && (
        <TripInvite
          inviteCode={trip.invite_code}
          tripTitle={trip.title}
          onClose={() => setShowInvite(false)}
        />
      )}
    </div>
  );
}

export default function TripDetailPage() {
  const { tripId } = useParams();
  const { isLoggedIn, loading: authLoading } = useAuth();

  useJsApiLoader({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries: GOOGLE_MAPS_LIBRARIES,
  });

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="bg-white border-b border-gray-200">
          <div className="max-w-3xl mx-auto px-5 py-4">
            <div className="h-6 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
        </header>
        <main className="max-w-3xl mx-auto px-5 py-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 animate-pulse">
            <div className="h-4 w-64 bg-gray-200 rounded mb-3" />
            <div className="h-4 w-40 bg-gray-100 rounded" />
          </div>
        </main>
      </div>
    );
  }

  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 text-center max-w-md">
          <div className="text-4xl mb-3">🗺️</div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Sign in to view this trip</h2>
          <p className="text-sm text-gray-500">You need to be signed in to access trip details.</p>
        </div>
      </div>
    );
  }

  return (
    <TripProvider tripId={tripId}>
      <TripDetail />
    </TripProvider>
  );
}
