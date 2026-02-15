'use client';

/**
 * TripPlan — The "Plan" tab for a trip.
 *
 * Sub-navigation:
 *   PlanHome (default) -> Dates | Location | Options sections
 *
 * PlanHome shows:
 *   - Host: "Next Step" hero card + status checklist
 *   - Guest: Pending actions + read-only summary (or "all caught up")
 */

import { useState } from 'react';
import { format, parseISO } from 'date-fns';
import { useTripContext } from './TripProvider';
import { startTrip, updateTrip } from '@/lib/trips';

// Sub-section components (rendered when user drills in)
import DateVoting from './DateVoting';
import LocationCriteria from './LocationCriteria';
import LocationVoting from './LocationVoting';
import TripOptions from './TripOptions';

// ---------------------------------------------------------------------------
// Back button for sub-sections
// ---------------------------------------------------------------------------
function BackHeader({ label, onBack }) {
  return (
    <button
      onClick={onBack}
      className="flex items-center gap-2 text-sm font-medium text-gray-500 hover:text-gray-700 transition mb-4"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      Back to Plan
    </button>
  );
}

// ---------------------------------------------------------------------------
// Next Step hero card (host)
// ---------------------------------------------------------------------------
function NextStepHero({ step, onAction }) {
  if (!step) return null;
  return (
    <div className="bg-gradient-to-br from-teal-600 to-teal-700 rounded-2xl p-6 text-white mb-5">
      <div className="flex items-start gap-4">
        <span className="text-3xl">{step.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-teal-200 text-xs font-semibold uppercase tracking-wide mb-1">Next Step</p>
          <h2 className="text-lg font-bold leading-tight">{step.title}</h2>
          <p className="text-sm text-teal-100 mt-1">{step.description}</p>
          <div className="flex items-center gap-3 mt-4">
            <button
              onClick={onAction}
              className="px-4 py-2 bg-white text-teal-700 text-sm font-semibold rounded-lg hover:bg-teal-50 transition"
            >
              {step.actionLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Compact status checklist row
// ---------------------------------------------------------------------------
function ChecklistRow({ icon, label, status, statusColor, done, locked, onClick }) {
  return (
    <button
      onClick={locked ? undefined : onClick}
      disabled={locked}
      className={`flex items-center gap-3 w-full px-4 py-3 text-left rounded-lg transition ${
        locked
          ? 'opacity-40 cursor-not-allowed'
          : 'hover:bg-gray-50 cursor-pointer'
      }`}
    >
      {done ? (
        <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : (
        <span className="text-base shrink-0">{icon}</span>
      )}
      <span className={`text-sm font-medium flex-1 ${done ? 'text-green-700' : locked ? 'text-gray-400' : 'text-gray-900'}`}>
        {label}
      </span>
      <span className={`text-xs font-medium ${statusColor || 'text-gray-400'}`}>
        {status}
      </span>
      {!locked && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="text-gray-300 shrink-0">
          <path d="M9 18l6-6-6-6" />
        </svg>
      )}
    </button>
  );
}

// ---------------------------------------------------------------------------
// Guest pending action card
// ---------------------------------------------------------------------------
function GuestAction({ icon, text, actionLabel, onClick }) {
  return (
    <div className="flex items-center gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
      <span className="text-xl shrink-0">{icon}</span>
      <span className="text-sm text-amber-800 flex-1">{text}</span>
      <button
        onClick={onClick}
        className="shrink-0 px-3.5 py-1.5 text-xs font-semibold bg-amber-500 text-white rounded-lg hover:bg-amber-600 transition"
      >
        {actionLabel}
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest read-only status row
// ---------------------------------------------------------------------------
function GuestStatusRow({ icon, label, value, done }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      {done ? (
        <span className="w-5 h-5 rounded-full bg-green-500 text-white flex items-center justify-center shrink-0">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </span>
      ) : (
        <span className="text-base shrink-0">{icon}</span>
      )}
      <span className="text-sm text-gray-500 w-20 shrink-0">{label}</span>
      <span className={`text-sm font-medium flex-1 ${done ? 'text-green-700' : 'text-gray-600'}`}>{value}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------
export default function TripPlan({ onSwitchTab }) {
  const {
    trip, members, dateOptions, locations, options, stops,
    myMembership, permissions, setTrip,
    tripId, refetchTrip, refetchLiveStatus,
  } = useTripContext();

  const [section, setSection] = useState(null); // null = PlanHome

  const isHost = permissions.isHost;
  const invitesSent = !!trip?.invites_sent_at;
  const nonCreatorMembers = members.filter(m => m.role !== 'creator');
  const joinedMembers = members.filter(m => m.status === 'joined');
  const confirmedLocation = locations.find(l => l.is_confirmed);
  const hasDateOptions = dateOptions.length > 0;
  const hasLocations = locations.length > 0;
  const hasOptions = options.length > 0;
  const hasStops = stops.length > 0;

  // -- Pending action detection (for guest view) --
  const myVotedDateIds = new Set();
  dateOptions.forEach(opt => {
    (opt.trip_date_votes || []).forEach(v => {
      if (v.member_id === myMembership?.id) myVotedDateIds.add(opt.id);
    });
  });
  const unvotedDates = dateOptions.filter(o => !myVotedDateIds.has(o.id));
  const hasUnvotedDates = !trip?.confirmed_date && hasDateOptions && unvotedDates.length > 0;

  const myVotedLocationIds = new Set();
  locations.forEach(loc => {
    (loc.trip_location_votes || []).forEach(v => {
      if (v.member_id === myMembership?.id) myVotedLocationIds.add(loc.id);
    });
  });
  const unvotedLocations = locations.filter(l => !myVotedLocationIds.has(l.id));
  const hasUnvotedLocations = !trip?.confirmed_location_id && hasLocations && unvotedLocations.length > 0;

  const originNotSet = myMembership && !myMembership.origin_lat;

  // -- Compute the host's "next step" --
  function getNextStep() {
    if (nonCreatorMembers.length === 0) {
      return {
        icon: '👥',
        title: 'Add your guests',
        description: 'Build your guest list so you can start planning together.',
        actionLabel: 'Add Guests',
        action: () => onSwitchTab('people'),
      };
    }
    if (!hasDateOptions) {
      return {
        icon: '📅',
        title: 'Propose some dates',
        description: `${nonCreatorMembers.length} guest${nonCreatorMembers.length !== 1 ? 's' : ''} added. Now suggest when to meet.`,
        actionLabel: 'Propose Dates',
        action: () => setSection('dates'),
      };
    }
    if (!trip?.confirmed_date) {
      const totalVotes = dateOptions.reduce((n, o) => n + (o.trip_date_votes?.length || 0), 0);
      return {
        icon: '📅',
        title: 'Confirm a date',
        description: `${dateOptions.length} date${dateOptions.length !== 1 ? 's' : ''} proposed, ${totalVotes} vote${totalVotes !== 1 ? 's' : ''} in. Pick the winner.`,
        actionLabel: 'View Dates',
        action: () => setSection('dates'),
      };
    }
    if (!hasLocations && !confirmedLocation) {
      return {
        icon: '📍',
        title: 'Choose a location',
        description: 'Date is set! Now figure out where to meet.',
        actionLabel: 'Set Up Location',
        action: () => setSection('locations'),
      };
    }
    if (!confirmedLocation) {
      return {
        icon: '📍',
        title: 'Confirm a location',
        description: `${locations.length} location${locations.length !== 1 ? 's' : ''} proposed. Confirm one when the group is ready.`,
        actionLabel: 'View Locations',
        action: () => setSection('locations'),
      };
    }
    if (!hasStops) {
      return {
        icon: '📋',
        title: 'Build your itinerary',
        description: `Heading to ${confirmedLocation.name}. Add stops and activities.`,
        actionLabel: 'Build Itinerary',
        action: () => onSwitchTab('trip'),
      };
    }
    // Everything done
    return {
      icon: '🚀',
      title: 'Ready to go!',
      description: 'Date confirmed, location set, itinerary built. Start the trip when everyone is ready.',
      actionLabel: 'Start Trip',
      action: async () => {
        try {
          const updated = await startTrip(tripId);
          setTrip(updated);
          refetchTrip();
          refetchLiveStatus();
          onSwitchTab('trip');
        } catch (err) {
          console.error('Failed to start trip:', err);
        }
      },
    };
  }

  // =========================================================================
  // Sub-section views
  // =========================================================================
  if (section === 'dates') {
    return (
      <div>
        <BackHeader onBack={() => setSection(null)} />
        <DateVoting />
      </div>
    );
  }

  if (section === 'locations') {
    return (
      <div>
        <BackHeader onBack={() => setSection(null)} />
        <div className="space-y-6">
          {isHost && <LocationCriteria />}
          {!isHost && <LocationCriteria />}
          <LocationVoting />
        </div>
      </div>
    );
  }

  if (section === 'options') {
    return (
      <div>
        <BackHeader onBack={() => setSection(null)} />
        <TripOptions />
      </div>
    );
  }

  // =========================================================================
  // PlanHome — diverged host / guest views
  // =========================================================================

  // ---- Guest PlanHome ----
  if (!isHost) {
    const pendingActions = [];
    if (originNotSet) {
      pendingActions.push(
        <GuestAction
          key="origin"
          icon="📍"
          text="Set your starting location so the group can calculate drive times."
          actionLabel="Set Location"
          onClick={() => onSwitchTab('people')}
        />
      );
    }
    if (hasUnvotedDates) {
      pendingActions.push(
        <GuestAction
          key="dates"
          icon="📅"
          text={`You haven't voted on ${unvotedDates.length} date${unvotedDates.length !== 1 ? 's' : ''} yet.`}
          actionLabel="Vote Now"
          onClick={() => setSection('dates')}
        />
      );
    }
    if (hasUnvotedLocations) {
      pendingActions.push(
        <GuestAction
          key="locations"
          icon="📍"
          text={`You haven't voted on ${unvotedLocations.length} location${unvotedLocations.length !== 1 ? 's' : ''} yet.`}
          actionLabel="Vote Now"
          onClick={() => setSection('locations')}
        />
      );
    }

    return (
      <div className="space-y-5">
        {/* Pending actions */}
        {pendingActions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-amber-800">Things that need your attention</h3>
            {pendingActions}
          </div>
        )}

        {/* All caught up */}
        {pendingActions.length === 0 && (
          <div className="bg-green-50 border border-green-200 rounded-xl p-5 text-center">
            <span className="text-2xl block mb-2">✅</span>
            <p className="text-sm font-semibold text-green-800">You're all caught up!</p>
            <p className="text-xs text-green-600 mt-1">Nothing needs your attention right now.</p>
          </div>
        )}

        {/* Trip status summary */}
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          <GuestStatusRow
            icon="👥"
            label="People"
            value={`${joinedMembers.length} member${joinedMembers.length !== 1 ? 's' : ''} joined`}
            done={joinedMembers.length > 1}
          />
          <GuestStatusRow
            icon="📅"
            label="Date"
            value={
              trip?.confirmed_date
                ? format(parseISO(trip.confirmed_date.split('T')[0]), 'EEEE, MMMM d')
                : hasDateOptions
                  ? `${dateOptions.length} proposed — voting`
                  : 'Not decided yet'
            }
            done={!!trip?.confirmed_date}
          />
          <GuestStatusRow
            icon="📍"
            label="Location"
            value={
              confirmedLocation
                ? confirmedLocation.name
                : hasLocations
                  ? `${locations.length} proposed — voting`
                  : 'Not decided yet'
            }
            done={!!confirmedLocation}
          />
          {(hasOptions || confirmedLocation) && (
            <GuestStatusRow
              icon="⭐"
              label="Options"
              value={hasOptions ? `${options.length} saved` : 'None yet'}
              done={false}
            />
          )}
          {(hasStops || confirmedLocation) && (
            <GuestStatusRow
              icon="📋"
              label="Itinerary"
              value={hasStops ? `${stops.length} stops planned` : 'Not started'}
              done={false}
            />
          )}
        </div>

        {/* Browse sections links */}
        {(hasDateOptions || hasLocations || hasOptions) && (
          <div className="space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide px-1 mb-2">Browse</p>
            {hasDateOptions && (
              <button onClick={() => setSection('dates')} className="flex items-center gap-2 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 font-medium">
                📅 Dates <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-gray-300"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            )}
            {hasLocations && (
              <button onClick={() => setSection('locations')} className="flex items-center gap-2 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 font-medium">
                📍 Locations <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-gray-300"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            )}
            {hasOptions && (
              <button onClick={() => setSection('options')} className="flex items-center gap-2 w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition text-sm text-gray-700 font-medium">
                ⭐ Options <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="ml-auto text-gray-300"><path d="M9 18l6-6-6-6" /></svg>
              </button>
            )}
          </div>
        )}
      </div>
    );
  }

  // ---- Host PlanHome ----
  const nextStep = getNextStep();

  return (
    <div className="space-y-4">
      {/* Next Step hero */}
      <NextStepHero step={nextStep} onAction={nextStep.action} />

      {/* Status checklist */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        <ChecklistRow
          icon="👥"
          label="Guests"
          status={
            invitesSent
              ? `${joinedMembers.length} joined`
              : nonCreatorMembers.length > 0
                ? `${nonCreatorMembers.length} added`
                : 'None yet'
          }
          statusColor={invitesSent ? 'text-green-600' : nonCreatorMembers.length > 0 ? 'text-blue-600' : 'text-gray-400'}
          done={invitesSent}
          onClick={() => onSwitchTab('people')}
        />
        <ChecklistRow
          icon="📅"
          label="Dates"
          status={
            trip?.confirmed_date
              ? format(parseISO(trip.confirmed_date.split('T')[0]), 'MMM d')
              : hasDateOptions
                ? `${dateOptions.length} proposed`
                : 'Not started'
          }
          statusColor={trip?.confirmed_date ? 'text-green-600' : hasDateOptions ? 'text-blue-600' : 'text-gray-400'}
          done={!!trip?.confirmed_date}
          onClick={() => setSection('dates')}
        />
        <ChecklistRow
          icon="📍"
          label="Location"
          status={
            confirmedLocation
              ? confirmedLocation.name
              : hasLocations
                ? `${locations.length} proposed`
                : 'Not started'
          }
          statusColor={confirmedLocation ? 'text-green-600' : hasLocations ? 'text-blue-600' : 'text-gray-400'}
          done={!!confirmedLocation}
          onClick={() => setSection('locations')}
        />
        {/* Options — only visible after location work has begun */}
        {(hasLocations || confirmedLocation) && (
          <ChecklistRow
            icon="⭐"
            label="Options"
            status={hasOptions ? `${options.length} saved` : 'None yet'}
            statusColor={hasOptions ? 'text-blue-600' : 'text-gray-400'}
            done={false}
            onClick={() => setSection('options')}
          />
        )}
        <ChecklistRow
          icon="📋"
          label="Itinerary"
          status={hasStops ? `${stops.length} stops` : 'Not started'}
          statusColor={hasStops ? 'text-blue-600' : 'text-gray-400'}
          done={hasStops && !!confirmedLocation}
          locked={!confirmedLocation}
          onClick={() => onSwitchTab('trip')}
        />
      </div>

      {/* Voting toggle */}
      {isHost && (
        <VotingToggleInline trip={trip} refetchTrip={refetchTrip} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inline voting toggle (host only, inside Plan tab)
// ---------------------------------------------------------------------------
function VotingToggleInline({ trip, refetchTrip }) {
  const [toggling, setToggling] = useState(false);

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
    <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center gap-3">
      <span className="text-base">{trip.voting_open ? '🗳️' : '🔒'}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-gray-900">
          {trip.voting_open ? 'Voting is open' : 'Voting is closed'}
        </p>
        <p className="text-xs text-gray-500">
          {trip.voting_open
            ? 'All members can vote on dates and locations.'
            : 'Only paid members can vote. Toggle to let everyone vote.'}
        </p>
      </div>
      <button
        onClick={handleToggle}
        disabled={toggling}
        className={`shrink-0 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
          trip.voting_open
            ? 'bg-green-50 text-green-700 border border-green-200 hover:bg-green-100'
            : 'bg-gray-50 text-gray-600 border border-gray-200 hover:bg-gray-100'
        }`}
      >
        {trip.voting_open ? 'Close' : 'Open'}
      </button>
    </div>
  );
}
