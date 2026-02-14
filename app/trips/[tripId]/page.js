'use client';

/**
 * /trips/[tripId] — Trip detail page with guided workflow.
 *
 * Tabs: Guests/Members | Dates | Locations | Options | Itinerary | Chat | Live
 *
 * Progress:
 *   1. Build Guest List
 *   2. Pick Dates
 *   3. Choose Location (criteria + vote)
 *   4. Save Options
 *   5. Build Itinerary
 *   6. Send Invites (when ready)
 */

import { useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import TripProvider, { useTripContext } from '@/components/TripProvider';
import GuestList from '@/components/GuestList';
import DateVoting from '@/components/DateVoting';
import LocationCriteria from '@/components/LocationCriteria';
import LocationVoting from '@/components/LocationVoting';
import TripOptions from '@/components/TripOptions';
import TripItinerary from '@/components/TripItinerary';
import TripChat from '@/components/TripChat';
import TripLive from '@/components/TripLive';
import TripInvite from '@/components/TripInvite';
import { updateTrip } from '@/lib/trips';
import Link from 'next/link';

const TABS = [
  { id: 'guests', label: 'Guests', icon: '👥' },
  { id: 'dates', label: 'Dates', icon: '📅' },
  { id: 'locations', label: 'Locations', icon: '📍' },
  { id: 'options', label: 'Options', icon: '⭐' },
  { id: 'itinerary', label: 'Itinerary', icon: '📋' },
  { id: 'chat', label: 'Chat', icon: '💬' },
  { id: 'live', label: 'Live', icon: '🚗' },
];

const STATUS_BADGE = {
  planning: { label: 'Planning', className: 'bg-blue-100 text-blue-700' },
  confirmed: { label: 'Confirmed', className: 'bg-green-100 text-green-700' },
  active: { label: 'Active', className: 'bg-amber-100 text-amber-700' },
  completed: { label: 'Completed', className: 'bg-gray-100 text-gray-600' },
  canceled: { label: 'Canceled', className: 'bg-red-100 text-red-600' },
};

// ---- Determine the smart default tab based on trip progress ----
function getDefaultTab(trip) {
  if (!trip) return 'guests';
  if (trip.status === 'active') return 'live';
  if (trip.status === 'completed') return 'itinerary';
  if (trip.confirmed_location_id) return 'itinerary';
  if (trip.confirmed_date) return 'locations';
  if (trip.invites_sent_at) return 'dates';
  return 'guests';
}

// ---- Progress stepper component ----
function TripProgress({ trip, options, onNavigate }) {
  const steps = [
    {
      id: 'guests',
      label: 'Guest List',
      description: 'Add people to invite',
      done: !!trip?.invites_sent_at,
      active: !trip?.invites_sent_at,
    },
    {
      id: 'dates',
      label: 'Pick Dates',
      description: 'Propose & vote on dates',
      done: !!trip?.confirmed_date,
      active: !!trip?.invites_sent_at && !trip?.confirmed_date,
    },
    {
      id: 'locations',
      label: 'Choose Location',
      description: 'Vote on a meeting point',
      done: !!trip?.confirmed_location_id,
      active: !!trip?.confirmed_date && !trip?.confirmed_location_id,
    },
    {
      id: 'options',
      label: 'Save Options',
      description: 'Lodging, POI, Food',
      done: (options?.length || 0) > 0,
      active: !!trip?.confirmed_location_id,
    },
    {
      id: 'itinerary',
      label: 'Itinerary',
      description: 'Add stops & activities',
      done: trip?.status === 'active' || trip?.status === 'completed',
      active: !!trip?.confirmed_location_id && trip?.status !== 'active' && trip?.status !== 'completed',
    },
  ];

  // Don't show stepper once trip is active/completed
  if (trip?.status === 'active' || trip?.status === 'completed') return null;

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 mb-4 overflow-x-auto">
      <div className="flex items-center justify-between min-w-max">
        {steps.map((step, idx) => (
          <div key={step.id} className="flex items-center flex-1">
            <button
              onClick={() => onNavigate(step.id)}
              className="flex items-center gap-2 group"
            >
              {/* Step circle */}
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition ${
                step.done
                  ? 'bg-green-500 text-white'
                  : step.active
                    ? 'bg-teal-600 text-white ring-2 ring-teal-200'
                    : 'bg-gray-200 text-gray-400'
              }`}>
                {step.done ? (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  idx + 1
                )}
              </div>
              {/* Step text */}
              <div className="text-left">
                <div className={`text-xs font-semibold leading-tight ${
                  step.done ? 'text-green-700' : step.active ? 'text-teal-700' : 'text-gray-400'
                }`}>
                  {step.label}
                </div>
                <div className="text-[10px] text-gray-400 leading-tight hidden sm:block">
                  {step.description}
                </div>
              </div>
            </button>
            {/* Connector line */}
            {idx < steps.length - 1 && (
              <div className={`flex-1 h-px mx-3 ${step.done ? 'bg-green-300' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---- Voting toggle for host ----
function VotingToggle({ trip, permissions, refetchTrip }) {
  const [toggling, setToggling] = useState(false);

  if (!permissions.isHost) return null;

  const handleToggle = async () => {
    setToggling(true);
    try {
      await updateTrip(trip.id, { voting_open: !trip.voting_open });
      refetchTrip();
    } catch (err) {
      console.error('Failed to toggle voting:', err);
    }
    setToggling(false);
  };

  return (
    <button
      onClick={handleToggle}
      disabled={toggling}
      className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
        trip.voting_open
          ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
          : 'bg-gray-50 text-gray-500 border border-gray-200 hover:bg-gray-100'
      }`}
      title={trip.voting_open ? 'Voting is open for all members' : 'Voting is closed for free members'}
    >
      {trip.voting_open ? '🗳️ Voting Open' : '🔒 Voting Closed'}
    </button>
  );
}

function TripDetail() {
  const { trip, members, dateOptions, locations, stops, messages, options, permissions, loading, error, refetchTrip } = useTripContext();

  // Smart default tab based on trip progress
  const defaultTab = useMemo(
    () => getDefaultTab(trip),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [trip?.confirmed_date, trip?.confirmed_location_id, trip?.status, trip?.invites_sent_at]
  );
  const [activeTab, setActiveTab] = useState(null);
  const currentTab = activeTab || defaultTab;

  const [showInvite, setShowInvite] = useState(false);
  // Track whether to show LocationCriteria or LocationVoting
  const [showLocationCriteria, setShowLocationCriteria] = useState(false);

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

  const invitesSent = !!trip.invites_sent_at;
  const joinedMembers = members.filter(m => m.status === 'joined');
  const badge = STATUS_BADGE[trip.status] || STATUS_BADGE.planning;

  // Dynamically relabel "Guests" to "Members" after invites are sent
  const displayTabs = TABS.map(tab => {
    if (tab.id === 'guests' && invitesSent) {
      return { ...tab, label: 'Members' };
    }
    return tab;
  });

  // Tab state indicators
  const tabState = {
    guests: invitesSent ? 'done' : 'active',
    dates: trip?.confirmed_date ? 'done' : 'active',
    locations: trip?.confirmed_location_id ? 'done' : trip?.confirmed_date ? 'active' : 'locked',
    options: options.length > 0 ? 'active' : trip?.confirmed_location_id ? 'active' : 'locked',
    itinerary: stops.length > 0 ? 'active' : trip?.confirmed_location_id ? 'active' : 'locked',
    chat: 'active',
    live: trip?.status === 'active' ? 'active' : 'locked',
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
            <div className="flex items-center gap-2 shrink-0">
              <VotingToggle trip={trip} permissions={permissions} refetchTrip={refetchTrip} />
              <button
                onClick={() => setShowInvite(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 text-white text-xs font-semibold rounded-lg hover:bg-teal-700 transition"
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
          </div>

          {/* Tabs */}
          <div className="flex gap-1 -mb-px overflow-x-auto">
            {displayTabs.map((tab) => {
              const isLiveActive = tab.id === 'live' && trip?.status === 'active';
              const state = tabState[tab.id];
              const isDone = state === 'done';
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-t-lg border-b-2 transition-colors whitespace-nowrap shrink-0 ${
                    currentTab === tab.id
                      ? 'border-teal-500 text-teal-700 bg-teal-50/50'
                      : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {isDone && (tab.id === 'dates' || tab.id === 'locations' || tab.id === 'guests') ? (
                    <span className="w-4 h-4 rounded-full bg-green-500 text-white flex items-center justify-center">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </span>
                  ) : (
                    <span>{tab.icon}</span>
                  )}
                  {tab.label}
                  {isLiveActive && (
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                    </span>
                  )}
                  {tab.id === 'guests' && (
                    <span className="text-xs text-gray-400 ml-0.5">({joinedMembers.length})</span>
                  )}
                  {tab.id === 'locations' && locations.length > 0 && (
                    <span className="text-xs text-gray-400 ml-0.5">({locations.length})</span>
                  )}
                  {tab.id === 'options' && options.length > 0 && (
                    <span className="text-xs text-gray-400 ml-0.5">({options.length})</span>
                  )}
                  {tab.id === 'itinerary' && stops.length > 0 && (
                    <span className="text-xs text-gray-400 ml-0.5">({stops.length})</span>
                  )}
                  {tab.id === 'chat' && messages.length > 0 && (
                    <span className="text-xs text-gray-400 ml-0.5">({messages.length})</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      {/* Tab Content */}
      <main className="max-w-3xl mx-auto px-5 py-6">
        {/* Progress stepper (only during planning) */}
        <TripProgress trip={trip} options={options} onNavigate={setActiveTab} />

        {currentTab === 'guests' && <GuestList />}
        {currentTab === 'dates' && <DateVoting />}
        {currentTab === 'locations' && (
          <div className="space-y-6">
            {/* Location criteria selector (host can configure or change) */}
            {permissions.isHost && (
              <div>
                {showLocationCriteria ? (
                  <>
                    <LocationCriteria />
                    <button
                      onClick={() => setShowLocationCriteria(false)}
                      className="mt-2 text-xs text-gray-400 hover:text-gray-600 transition"
                    >
                      Hide criteria settings
                    </button>
                  </>
                ) : (
                  <button
                    onClick={() => setShowLocationCriteria(true)}
                    className="text-xs text-teal-600 hover:text-teal-700 font-medium"
                  >
                    {trip.location_mode ? 'Change location strategy' : 'Set location strategy'}
                  </button>
                )}
              </div>
            )}
            {/* Non-host: read-only criteria */}
            {!permissions.isHost && (
              <LocationCriteria />
            )}
            {/* Location voting */}
            <LocationVoting />
          </div>
        )}
        {currentTab === 'options' && <TripOptions />}
        {currentTab === 'itinerary' && <TripItinerary />}
        {currentTab === 'chat' && <TripChat />}
        {currentTab === 'live' && <TripLive />}
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
