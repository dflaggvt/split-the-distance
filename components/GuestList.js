'use client';

/**
 * GuestList — Build and manage a guest list before sending invites.
 * Host adds guests by email/name, then sends invites when ready.
 */

import { useState } from 'react';
import { useTripContext } from './TripProvider';
import { addGuest, removeGuest, sendInvites } from '@/lib/trips';

export default function GuestList() {
  const { trip, members, myMembership, permissions, tripId, refetchMembers, refetchTrip } = useTripContext();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showInviteLinks, setShowInviteLinks] = useState(false);

  const invitesSent = !!trip?.invites_sent_at;
  const isHost = permissions.isHost;

  // Guests = non-creator members
  const guests = members.filter(m => m.role !== 'creator');
  const pendingGuests = guests.filter(m => m.status === 'pending');
  const invitedGuests = guests.filter(m => m.status === 'invited');
  const joinedGuests = guests.filter(m => m.status === 'joined');
  const declinedGuests = guests.filter(m => m.status === 'declined');

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/trips/join/${trip?.invite_code}`
    : '';

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim() && !displayName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addGuest(tripId, {
        email: email.trim() || null,
        displayName: displayName.trim() || null,
      });
      setEmail('');
      setDisplayName('');
      refetchMembers();
    } catch (err) {
      console.error('Failed to add guest:', err);
      setError(err.message || 'Failed to add guest');
    }
    setAdding(false);
  };

  const handleRemove = async (memberId) => {
    try {
      await removeGuest(memberId);
      refetchMembers();
    } catch (err) {
      console.error('Failed to remove guest:', err);
    }
  };

  const handleSendInvites = async () => {
    if (!window.confirm('Send invites to all guests? They will receive an invite link.')) return;
    setSending(true);
    setError(null);
    try {
      await sendInvites(tripId);
      refetchTrip();
      refetchMembers();
      setShowInviteLinks(true);
    } catch (err) {
      console.error('Failed to send invites:', err);
      setError(err.message || 'Failed to send invites');
    }
    setSending(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(inviteUrl);
    } catch {
      // fallback
    }
  };

  return (
    <div className="space-y-5">
      {/* Add guest form (only host, before invites sent) */}
      {isHost && !invitesSent && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-semibold text-gray-900 mb-3">Add Guests</h3>
          <form onSubmit={handleAdd} className="space-y-3">
            <div className="flex gap-3">
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Name"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email (optional)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Add by name, email, or both.</p>
              <button
                type="submit"
                disabled={adding || (!email.trim() && !displayName.trim())}
                className="px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition disabled:opacity-50"
              >
                {adding ? 'Adding...' : 'Add Guest'}
              </button>
            </div>
          </form>
        </div>
      )}

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Guest list */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-gray-900">
            {invitesSent ? 'Members' : 'Guest List'}
            <span className="ml-2 text-xs text-gray-400 font-normal">({guests.length})</span>
          </h3>
          {isHost && !invitesSent && pendingGuests.length > 0 && (
            <button
              onClick={handleSendInvites}
              disabled={sending}
              className="px-4 py-2 bg-green-600 text-white text-sm font-semibold rounded-lg hover:bg-green-700 transition disabled:opacity-50"
            >
              {sending ? 'Sending...' : `Send Invites (${pendingGuests.length})`}
            </button>
          )}
        </div>

        {guests.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {isHost
              ? 'No guests yet. Add people above to build your guest list.'
              : 'No other members yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Joined members first */}
            {joinedGuests.map(g => (
              <GuestRow key={g.id} guest={g} status="joined" />
            ))}
            {/* Invited */}
            {invitedGuests.map(g => (
              <GuestRow key={g.id} guest={g} status="invited" />
            ))}
            {/* Pending (pre-invite) */}
            {pendingGuests.map(g => (
              <GuestRow
                key={g.id}
                guest={g}
                status="pending"
                onRemove={isHost ? () => handleRemove(g.id) : null}
              />
            ))}
            {/* Declined */}
            {declinedGuests.map(g => (
              <GuestRow key={g.id} guest={g} status="declined" />
            ))}
          </div>
        )}
      </div>

      {/* Invite link section (after invites sent, or as fallback) */}
      {(invitesSent || showInviteLinks) && inviteUrl && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5">
          <h3 className="font-semibold text-teal-800 text-sm mb-2">Share Invite Link</h3>
          <p className="text-xs text-teal-600 mb-3">
            Share this link with anyone you want to invite.
          </p>
          <div className="flex items-center gap-2">
            <div className="flex-1 px-3 py-2 bg-white border border-teal-200 rounded-lg text-sm text-gray-700 truncate font-mono">
              {inviteUrl}
            </div>
            <button
              onClick={handleCopyLink}
              className="shrink-0 px-4 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 transition"
            >
              Copy
            </button>
          </div>
        </div>
      )}

      {/* Tip for host before invites sent */}
      {isHost && !invitesSent && guests.length > 0 && (
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-700">
          <strong>Tip:</strong> Finish setting up dates, location, and options before sending invites.
          Guests will see the full trip when they join.
        </div>
      )}
    </div>
  );
}

// ---- Guest row sub-component ----
const STATUS_BADGE = {
  pending: { label: 'Pending', className: 'bg-gray-100 text-gray-600' },
  invited: { label: 'Invited', className: 'bg-yellow-100 text-yellow-700' },
  joined: { label: 'Joined', className: 'bg-green-100 text-green-700' },
  declined: { label: 'Declined', className: 'bg-red-100 text-red-600' },
};

function GuestRow({ guest, status, onRemove }) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.pending;
  const initials = (guest.display_name || guest.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('');

  return (
    <div className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full bg-teal-100 text-teal-700 flex items-center justify-center text-xs font-bold shrink-0">
        {initials}
      </div>

      {/* Name + email */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {guest.display_name || 'Guest'}
        </p>
        {guest.email && (
          <p className="text-xs text-gray-400 truncate">{guest.email}</p>
        )}
      </div>

      {/* Status badge */}
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>

      {/* Remove button (only for pending, only host) */}
      {onRemove && (
        <button
          onClick={onRemove}
          className="text-gray-300 hover:text-red-500 transition"
          title="Remove guest"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}
