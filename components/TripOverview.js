'use client';

/**
 * TripOverview — Dashboard / control panel for a trip.
 * Shows the full trip status at a glance with actionable cards
 * that navigate to the relevant tabs. Replaces the stepper.
 */

import { format, parseISO } from 'date-fns';
import { useTripContext } from './TripProvider';
import { startTrip } from '@/lib/trips';

// ---- Status card wrapper ----
function Card({ icon, title, status, statusColor, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <div className="flex items-center gap-2.5 mb-3">
        <span className="text-lg">{icon}</span>
        <h3 className="font-semibold text-gray-900 text-sm flex-1">{title}</h3>
        {status && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${statusColor || 'bg-gray-100 text-gray-500'}`}>
            {status}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

// ---- Action button ----
function ActionButton({ onClick, children, variant = 'primary' }) {
  const base = 'px-3.5 py-1.5 text-xs font-semibold rounded-lg transition';
  const styles = {
    primary: `${base} bg-teal-600 text-white hover:bg-teal-700`,
    secondary: `${base} bg-gray-100 text-gray-700 hover:bg-gray-200`,
    success: `${base} bg-green-600 text-white hover:bg-green-700`,
    warning: `${base} bg-amber-500 text-white hover:bg-amber-600`,
  };
  return (
    <button onClick={onClick} className={styles[variant] || styles.primary}>
      {children}
    </button>
  );
}

// ---- Attention prompt for pending actions ----
function AttentionPrompt({ text, actionLabel, onClick }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg mt-2">
      <span className="text-amber-500 text-sm shrink-0">!</span>
      <span className="text-xs text-amber-800 flex-1">{text}</span>
      {actionLabel && (
        <button
          onClick={onClick}
          className="shrink-0 px-3 py-1 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}

export default function TripOverview({ onNavigate }) {
  const {
    trip, members, dateOptions, locations, options, stops, messages,
    liveStatus, myMembership, permissions, setTrip,
    tripId, refetchTrip, refetchLiveStatus,
  } = useTripContext();

  const isHost = permissions.isHost;
  const invitesSent = !!trip?.invites_sent_at;
  const joinedMembers = members.filter(m => m.status === 'joined');
  const pendingMembers = members.filter(m => m.status === 'pending');
  const invitedMembers = members.filter(m => m.status === 'invited');
  const nonCreatorMembers = members.filter(m => m.role !== 'creator');
  const confirmedLocation = locations.find(l => l.is_confirmed);

  // ---- Pending action detection for current user ----
  const myVotedDateIds = new Set();
  dateOptions.forEach(opt => {
    (opt.trip_date_votes || []).forEach(v => {
      if (v.member_id === myMembership?.id) myVotedDateIds.add(opt.id);
    });
  });
  const unvotedDates = dateOptions.filter(o => !myVotedDateIds.has(o.id));
  const hasUnvotedDates = !trip?.confirmed_date && dateOptions.length > 0 && unvotedDates.length > 0;

  const myVotedLocationIds = new Set();
  locations.forEach(loc => {
    (loc.trip_location_votes || []).forEach(v => {
      if (v.member_id === myMembership?.id) myVotedLocationIds.add(loc.id);
    });
  });
  const unvotedLocations = locations.filter(l => !myVotedLocationIds.has(l.id));
  const hasUnvotedLocations = !trip?.confirmed_location_id && locations.length > 0 && unvotedLocations.length > 0;

  const originNotSet = myMembership && !myMembership.origin_lat;

  // ---- Trip start handler (for host status card) ----
  const handleStartTrip = async () => {
    try {
      const updated = await startTrip(tripId);
      setTrip(updated);
      refetchTrip();
      refetchLiveStatus();
      onNavigate('live');
    } catch (err) {
      console.error('Failed to start trip:', err);
    }
  };

  return (
    <div className="space-y-4">
      {/* Pending actions banner for guests */}
      {(hasUnvotedDates || hasUnvotedLocations || originNotSet) && (
        <div className="bg-white rounded-xl border-2 border-amber-300 p-4">
          <h3 className="text-sm font-bold text-amber-800 mb-2">Things that need your attention</h3>
          <div className="space-y-2">
            {originNotSet && (
              <AttentionPrompt
                text="Set your starting location so the group can calculate drive times."
                actionLabel="Set Location"
                onClick={() => onNavigate('guests')}
              />
            )}
            {hasUnvotedDates && (
              <AttentionPrompt
                text={`You haven't voted on ${unvotedDates.length} date${unvotedDates.length !== 1 ? 's' : ''} yet.`}
                actionLabel="Vote Now"
                onClick={() => onNavigate('dates')}
              />
            )}
            {hasUnvotedLocations && (
              <AttentionPrompt
                text={`You haven't voted on ${unvotedLocations.length} location${unvotedLocations.length !== 1 ? 's' : ''} yet.`}
                actionLabel="Vote Now"
                onClick={() => onNavigate('locations')}
              />
            )}
          </div>
        </div>
      )}

      {/* 1. Guests / Members Card */}
      <Card
        icon="👥"
        title={invitesSent ? 'Members' : 'Guest List'}
        status={invitesSent ? `${joinedMembers.length} joined` : `${nonCreatorMembers.length} guests`}
        statusColor={invitesSent ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'}
      >
        {isHost && !invitesSent ? (
          <div>
            <p className="text-sm text-gray-600">
              {nonCreatorMembers.length === 0
                ? 'No guests added yet. Build your guest list before sending invites.'
                : `${nonCreatorMembers.length} guest${nonCreatorMembers.length !== 1 ? 's' : ''} added. Invites not sent yet.`}
            </p>
            <div className="flex gap-2 mt-3">
              <ActionButton onClick={() => onNavigate('guests')}>
                Manage Guest List
              </ActionButton>
              {pendingMembers.length > 0 && (
                <ActionButton onClick={() => onNavigate('guests')} variant="success">
                  Send Invites
                </ActionButton>
              )}
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-600">
              {joinedMembers.length} of {members.length} member{members.length !== 1 ? 's' : ''} joined.
              {invitedMembers.length > 0 && ` ${invitedMembers.length} still invited.`}
            </p>
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('guests')} variant="secondary">
                View Members
              </ActionButton>
            </div>
          </div>
        )}
      </Card>

      {/* 2. Dates Card */}
      <Card
        icon="📅"
        title="Dates"
        status={
          trip?.confirmed_date
            ? 'Confirmed'
            : dateOptions.length > 0
              ? `${dateOptions.length} proposed`
              : 'Not started'
        }
        statusColor={
          trip?.confirmed_date
            ? 'bg-green-100 text-green-700'
            : dateOptions.length > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
        }
      >
        {trip?.confirmed_date ? (
          <div>
            <p className="text-sm text-green-700 font-medium">
              {format(parseISO(trip.confirmed_date.split('T')[0]), 'EEEE, MMMM d, yyyy')}
            </p>
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('dates')} variant="secondary">
                View Dates
              </ActionButton>
            </div>
          </div>
        ) : dateOptions.length > 0 ? (
          <div>
            <p className="text-sm text-gray-600">
              {dateOptions.length} date{dateOptions.length !== 1 ? 's' : ''} proposed.
              {isHost && ' Confirm a date when you\'re ready.'}
            </p>
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('dates')}>
                {hasUnvotedDates ? 'Vote on Dates' : 'View Dates'}
              </ActionButton>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              {isHost || permissions.canProposeDates
                ? 'No dates proposed yet. Suggest when to meet.'
                : 'No dates proposed yet. Waiting for the host to add dates.'}
            </p>
            {(isHost || permissions.canProposeDates) && (
              <div className="mt-3">
                <ActionButton onClick={() => onNavigate('dates')}>
                  Propose Dates
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 3. Location Card */}
      <Card
        icon="📍"
        title="Location"
        status={
          confirmedLocation
            ? 'Confirmed'
            : locations.length > 0
              ? `${locations.length} proposed`
              : 'Not started'
        }
        statusColor={
          confirmedLocation
            ? 'bg-green-100 text-green-700'
            : locations.length > 0
              ? 'bg-blue-100 text-blue-700'
              : 'bg-gray-100 text-gray-500'
        }
      >
        {confirmedLocation ? (
          <div>
            <p className="text-sm text-green-700 font-medium">{confirmedLocation.name}</p>
            {confirmedLocation.address && confirmedLocation.address !== confirmedLocation.name && (
              <p className="text-xs text-green-600 mt-0.5">{confirmedLocation.address}</p>
            )}
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('locations')} variant="secondary">
                View Locations
              </ActionButton>
            </div>
          </div>
        ) : locations.length > 0 ? (
          <div>
            <p className="text-sm text-gray-600">
              {locations.length} location{locations.length !== 1 ? 's' : ''} proposed.
              {isHost && ' Confirm one when the group is ready.'}
            </p>
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('locations')}>
                {hasUnvotedLocations ? 'Vote on Locations' : 'View Locations'}
              </ActionButton>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              {isHost
                ? 'No locations proposed yet. Set a location strategy and start suggesting places.'
                : 'No locations proposed yet. Waiting for suggestions.'}
            </p>
            {(isHost || permissions.canProposeLocations) && (
              <div className="mt-3">
                <ActionButton onClick={() => onNavigate('locations')}>
                  {isHost ? 'Set Up Location' : 'Suggest Location'}
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 4. Options Card */}
      <Card
        icon="⭐"
        title="Options"
        status={options.length > 0 ? `${options.length} saved` : 'None yet'}
        statusColor={options.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}
      >
        {options.length > 0 ? (
          <div>
            {(() => {
              const lodging = options.filter(o => o.category === 'lodging').length;
              const poi = options.filter(o => o.category === 'poi').length;
              const food = options.filter(o => o.category === 'food').length;
              const parts = [];
              if (lodging) parts.push(`${lodging} lodging`);
              if (poi) parts.push(`${poi} activity`);
              if (food) parts.push(`${food} food`);
              return (
                <p className="text-sm text-gray-600">
                  {options.length} option{options.length !== 1 ? 's' : ''} saved ({parts.join(', ')}).
                </p>
              );
            })()}
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('options')} variant="secondary">
                View Options
              </ActionButton>
            </div>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              {permissions.canAddOptions
                ? 'No lodging, food, or activity options saved yet. Start collecting ideas.'
                : 'No options saved yet. Waiting for the group to add some.'}
            </p>
            {permissions.canAddOptions && (
              <div className="mt-3">
                <ActionButton onClick={() => onNavigate('options')}>
                  Add Options
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 5. Itinerary Card */}
      <Card
        icon="📋"
        title="Itinerary"
        status={stops.length > 0 ? `${stops.length} stops` : 'No stops'}
        statusColor={stops.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}
      >
        {stops.length > 0 ? (
          <div>
            {(() => {
              const days = new Set(stops.map(s => s.day_number));
              return (
                <p className="text-sm text-gray-600">
                  {stops.length} stop{stops.length !== 1 ? 's' : ''} planned across {days.size} day{days.size !== 1 ? 's' : ''}.
                </p>
              );
            })()}
            <div className="mt-3">
              <ActionButton onClick={() => onNavigate('itinerary')} variant="secondary">
                View Itinerary
              </ActionButton>
            </div>
          </div>
        ) : !confirmedLocation ? (
          <div>
            <p className="text-sm text-gray-400">
              Confirm a location first, then start building your itinerary.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm text-gray-500">
              {permissions.canAddStops
                ? 'No stops added yet. Start building the trip itinerary.'
                : 'No stops added yet. Waiting for the host to build the itinerary.'}
            </p>
            {permissions.canAddStops && (
              <div className="mt-3">
                <ActionButton onClick={() => onNavigate('itinerary')}>
                  Build Itinerary
                </ActionButton>
              </div>
            )}
          </div>
        )}
      </Card>

      {/* 6. Trip Status Card (host only, or when trip is active) */}
      {(isHost || trip?.status === 'active') && (
        <Card
          icon={trip?.status === 'active' ? '🚗' : '🎯'}
          title="Trip Status"
          status={
            trip?.status === 'active' ? 'Live' :
            trip?.status === 'completed' ? 'Completed' :
            'Planning'
          }
          statusColor={
            trip?.status === 'active' ? 'bg-amber-100 text-amber-700' :
            trip?.status === 'completed' ? 'bg-gray-100 text-gray-600' :
            'bg-blue-100 text-blue-700'
          }
        >
          {trip?.status === 'active' ? (
            <div>
              {(() => {
                const sharingCount = liveStatus.filter(s => s.sharing_location && !s.arrived).length;
                const arrivedCount = liveStatus.filter(s => s.arrived).length;
                return (
                  <p className="text-sm text-gray-600">
                    Trip is live! {sharingCount} sharing location, {arrivedCount} arrived.
                  </p>
                );
              })()}
              <div className="mt-3">
                <ActionButton onClick={() => onNavigate('live')}>
                  View Live Map
                </ActionButton>
              </div>
            </div>
          ) : trip?.status === 'completed' ? (
            <p className="text-sm text-gray-500">This trip has been completed.</p>
          ) : isHost ? (
            <div>
              {trip?.confirmed_date && confirmedLocation ? (
                <>
                  <p className="text-sm text-gray-600">
                    Date and location confirmed. Ready to start the trip when everyone is set.
                  </p>
                  <div className="mt-3">
                    <ActionButton onClick={handleStartTrip} variant="success">
                      Start Trip
                    </ActionButton>
                  </div>
                </>
              ) : (
                <p className="text-sm text-gray-500">
                  Confirm a date and location before starting the trip.
                </p>
              )}
            </div>
          ) : null}
        </Card>
      )}

      {/* Chat shortcut */}
      <div
        onClick={() => onNavigate('chat')}
        className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3 cursor-pointer hover:bg-gray-50 transition"
      >
        <span className="text-lg">💬</span>
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 text-sm">Chat</h3>
          <p className="text-xs text-gray-500">
            {messages.length > 0
              ? `${messages.length} message${messages.length !== 1 ? 's' : ''}`
              : 'No messages yet. Start the conversation.'}
          </p>
        </div>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-400">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>
    </div>
  );
}
