'use client';

/**
 * DateVoting — Date proposal + voting UI for Collaborative Group Trips.
 * Uses react-day-picker for calendar and Supabase Realtime for live updates.
 */

import { useState } from 'react';
import { DayPicker } from 'react-day-picker';
import { format, isSameDay, parseISO } from 'date-fns';
import 'react-day-picker/style.css';
import { useTripContext } from './TripProvider';
import { proposeDate, voteDateOption, deleteDateOption, confirmTripDate } from '@/lib/trips';

const VOTE_COLORS = {
  yes: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-300', icon: '✓' },
  maybe: { bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-300', icon: '?' },
  no: { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-300', icon: '✗' },
};

export default function DateVoting() {
  const { trip, setTrip, dateOptions, members, myMembership, tripId } = useTripContext();
  const [selectedDate, setSelectedDate] = useState(null);
  const [label, setLabel] = useState('');
  const [proposing, setProposing] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const isCreator = myMembership?.role === 'creator';

  // Dates that already have proposals
  const proposedDates = dateOptions.map(o => parseISO(o.date_start));

  // ---- Propose a date ----
  const handlePropose = async () => {
    if (!selectedDate || !myMembership) return;
    setProposing(true);
    try {
      await proposeDate(tripId, myMembership.id, {
        dateStart: format(selectedDate, 'yyyy-MM-dd'),
        label: label.trim() || null,
      });
      setSelectedDate(null);
      setLabel('');
    } catch (err) {
      console.error('Failed to propose date:', err);
    }
    setProposing(false);
  };

  // ---- Cast a vote ----
  const handleVote = async (dateOptionId, vote) => {
    if (!myMembership) return;
    try {
      await voteDateOption(dateOptionId, myMembership.id, vote);
    } catch (err) {
      console.error('Failed to vote:', err);
    }
  };

  // ---- Delete a date option ----
  const handleDelete = async (dateOptionId) => {
    try {
      await deleteDateOption(dateOptionId);
    } catch (err) {
      console.error('Failed to delete date:', err);
    }
  };

  // ---- Confirm a date ----
  const handleConfirm = async (dateStr) => {
    setConfirming(dateStr);
    try {
      const updated = await confirmTripDate(tripId, dateStr);
      setTrip(updated);
    } catch (err) {
      console.error('Failed to confirm date:', err);
    }
    setConfirming(null);
  };

  // ---- Get vote summary for a date option ----
  const getVoteSummary = (dateOption) => {
    const votes = dateOption.trip_date_votes || [];
    const summary = { yes: 0, maybe: 0, no: 0 };
    votes.forEach(v => { if (summary[v.vote] !== undefined) summary[v.vote]++; });
    return summary;
  };

  // ---- Get my vote for a date option ----
  const getMyVote = (dateOption) => {
    if (!myMembership) return null;
    const votes = dateOption.trip_date_votes || [];
    const myVote = votes.find(v => v.member_id === myMembership.id);
    return myVote?.vote || null;
  };

  // ---- Calendar modifiers for proposed dates ----
  const modifiers = {
    proposed: proposedDates,
    confirmed: trip?.confirmed_date ? [parseISO(trip.confirmed_date.split('T')[0])] : [],
  };

  const modifiersClassNames = {
    proposed: 'rdp-day_proposed',
    confirmed: 'rdp-day_confirmed',
  };

  return (
    <div>
      {/* Confirmed date banner */}
      {trip?.confirmed_date && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl">
          <div className="flex items-center gap-2">
            <span className="text-green-600 text-lg">✓</span>
            <div>
              <div className="font-semibold text-green-800">Date Confirmed</div>
              <div className="text-sm text-green-700">
                {format(parseISO(trip.confirmed_date.split('T')[0]), 'EEEE, MMMM d, yyyy')}
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Calendar for proposing dates */}
        {!trip?.confirmed_date && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-semibold text-gray-900 mb-3">Propose a Date</h3>
            <DayPicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              modifiers={modifiers}
              modifiersClassNames={modifiersClassNames}
              disabled={{ before: new Date() }}
              className="mx-auto"
            />
            {selectedDate && (
              <div className="mt-4 space-y-3">
                <div className="text-sm text-gray-600">
                  Selected: <strong>{format(selectedDate, 'EEEE, MMM d, yyyy')}</strong>
                </div>
                <input
                  type="text"
                  placeholder="Label (optional, e.g. 'Memorial Day Weekend')"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
                <button
                  onClick={handlePropose}
                  disabled={proposing}
                  className="w-full py-2 px-4 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition disabled:opacity-50"
                >
                  {proposing ? 'Proposing...' : 'Propose This Date'}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Date options list with voting */}
        <div className={trip?.confirmed_date ? 'md:col-span-2' : ''}>
          <div className="space-y-3">
            {dateOptions.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <div className="text-3xl mb-2">📅</div>
                <div className="text-gray-500 text-sm">
                  No dates proposed yet. Use the calendar to suggest when to meet.
                </div>
              </div>
            ) : (
              dateOptions.map((option) => {
                const summary = getVoteSummary(option);
                const myVote = getMyVote(option);
                const dateStr = option.date_start;
                const proposer = members.find(m => m.id === option.proposed_by);

                return (
                  <div key={option.id} className="bg-white rounded-xl border border-gray-200 p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <div className="font-semibold text-gray-900">
                          {format(parseISO(dateStr), 'EEEE, MMM d, yyyy')}
                        </div>
                        {option.label && (
                          <div className="text-xs text-gray-500">{option.label}</div>
                        )}
                        <div className="text-xs text-gray-400 mt-0.5">
                          Proposed by {proposer?.display_name || 'Unknown'}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {/* Vote summary badges */}
                        {Object.entries(summary).map(([vote, count]) => (
                          count > 0 && (
                            <span
                              key={vote}
                              className={`text-xs font-bold px-2 py-0.5 rounded-full ${VOTE_COLORS[vote].bg} ${VOTE_COLORS[vote].text}`}
                            >
                              {VOTE_COLORS[vote].icon} {count}
                            </span>
                          )
                        ))}
                      </div>
                    </div>

                    {/* Voting buttons */}
                    {!trip?.confirmed_date && myMembership && (
                      <div className="flex items-center gap-2">
                        {['yes', 'maybe', 'no'].map((vote) => {
                          const isActive = myVote === vote;
                          const colors = VOTE_COLORS[vote];
                          return (
                            <button
                              key={vote}
                              onClick={() => handleVote(option.id, vote)}
                              className={`flex-1 py-1.5 rounded-lg text-xs font-semibold border transition ${
                                isActive
                                  ? `${colors.bg} ${colors.text} ${colors.border}`
                                  : 'bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100'
                              }`}
                            >
                              {colors.icon} {vote.charAt(0).toUpperCase() + vote.slice(1)}
                            </button>
                          );
                        })}

                        {/* Confirm button (creator only) */}
                        {isCreator && (
                          <button
                            onClick={() => handleConfirm(dateStr)}
                            disabled={confirming === dateStr}
                            className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700 transition disabled:opacity-50"
                          >
                            {confirming === dateStr ? '...' : 'Confirm'}
                          </button>
                        )}

                        {/* Delete button (proposer or creator) */}
                        {(isCreator || (myMembership && option.proposed_by === myMembership.id)) && (
                          <button
                            onClick={() => handleDelete(option.id)}
                            className="px-2 py-1.5 rounded-lg text-xs text-gray-400 hover:text-red-500 hover:bg-red-50 transition"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    )}

                    {/* Per-member vote breakdown */}
                    {(option.trip_date_votes || []).length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap gap-2">
                        {(option.trip_date_votes || []).map((v) => {
                          const member = members.find(m => m.id === v.member_id);
                          const colors = VOTE_COLORS[v.vote];
                          return (
                            <span
                              key={v.id}
                              className={`text-xs px-2 py-0.5 rounded-full ${colors.bg} ${colors.text}`}
                            >
                              {member?.display_name || 'Unknown'}: {v.vote}
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
        </div>
      </div>

      {/* Custom styles for react-day-picker */}
      <style jsx global>{`
        .rdp-day_proposed {
          background-color: #ccfbf1 !important;
          border-radius: 100%;
        }
        .rdp-day_confirmed {
          background-color: #86efac !important;
          color: #166534 !important;
          font-weight: bold;
          border-radius: 100%;
        }
      `}</style>
    </div>
  );
}
