'use client';

/**
 * GuestList — Build and manage a guest list before sending invites.
 * Host adds guests by email/name, then sends invites when ready.
 */

import { useState } from 'react';
import { useTripContext } from './TripProvider';
import { useAuth } from './AuthProvider';
import LocationInput from './LocationInput';
import { supabase } from '@/lib/supabase';
import { addGuest, removeGuest, sendInvites, updateMemberOrigin } from '@/lib/trips';

export default function GuestList() {
  const { trip, members, myMembership, permissions, tripId, refetchMembers, refetchTrip } = useTripContext();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [adding, setAdding] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [showInviteLinks, setShowInviteLinks] = useState(false);
  // Origin setting
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originSearch, setOriginSearch] = useState('');
  const [savingOrigin, setSavingOrigin] = useState(false);

  const handleOriginSelect = async (place) => {
    if (!myMembership || !place?.lat) return;
    setSavingOrigin(true);
    try {
      await updateMemberOrigin(myMembership.id, {
        lat: place.lat,
        lng: place.lng || place.lon,
        name: place.formattedAddress || place.name,
      });
      setEditingOrigin(false);
      setOriginSearch('');
      refetchMembers();
    } catch (err) {
      console.error('Failed to set origin:', err);
    }
    setSavingOrigin(false);
  };

  const invitesSent = !!trip?.invites_sent_at;
  const isHost = permissions.isHost;

  // Creator (host) is always shown at the top
  const creator = members.find(m => m.role === 'creator');
  // Guests = non-creator members (for add/remove management)
  const guests = members.filter(m => m.role !== 'creator');
  const pendingGuests = guests.filter(m => m.status === 'pending');
  const invitedGuests = guests.filter(m => m.status === 'invited');
  const joinedGuests = guests.filter(m => m.status === 'joined');
  const declinedGuests = guests.filter(m => m.status === 'declined');
  const allDisplayCount = (creator ? 1 : 0) + guests.length;

  const inviteUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/trips/join/${trip?.invite_code}`
    : '';

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await addGuest(tripId, {
        email: email.trim(),
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
    const guestsWithEmail = members.filter(m => m.role !== 'creator' && m.status === 'pending' && m.email);
    const guestsWithoutEmail = members.filter(m => m.role !== 'creator' && m.status === 'pending' && !m.email);

    const confirmMsg = guestsWithoutEmail.length > 0
      ? `Send invites to ${guestsWithEmail.length} guest${guestsWithEmail.length !== 1 ? 's' : ''} with email addresses? (${guestsWithoutEmail.length} guest${guestsWithoutEmail.length !== 1 ? 's' : ''} without email will need the invite link shared manually.)`
      : `Send invite emails to ${guestsWithEmail.length} guest${guestsWithEmail.length !== 1 ? 's' : ''}?`;

    if (!window.confirm(confirmMsg)) return;
    setSending(true);
    setError(null);
    try {
      // 1. Flip database status (pending → invited, set invites_sent_at)
      await sendInvites(tripId);

      // 2. Send actual emails via Resend
      if (guestsWithEmail.length > 0) {
        const { data: { session } } = await supabase.auth.getSession();
        const token = session?.access_token;
        if (token) {
          const res = await fetch('/api/invites/send', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ tripId }),
          });
          const result = await res.json();
          if (result.failed > 0) {
            setError(`${result.sent} email${result.sent !== 1 ? 's' : ''} sent, ${result.failed} failed. Share the invite link with those guests manually.`);
          }
        }
      }

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
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                required
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Name (optional)"
                className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-gray-400">Email is required so they can receive their invite.</p>
              <button
                type="submit"
                disabled={adding || !email.trim()}
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
            <span className="ml-2 text-xs text-gray-400 font-normal">({allDisplayCount})</span>
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

        {guests.length === 0 && !creator ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {isHost
              ? 'No guests yet. Add people above to build your guest list.'
              : 'No other members yet.'}
          </div>
        ) : (
          <div className="space-y-2">
            {/* Creator / host always shown first */}
            {creator && (
              <GuestRow
                key={creator.id}
                guest={creator}
                status="joined"
                isCreator
                isMe={creator.user_id === user?.id}
                editingOrigin={creator.user_id === user?.id ? editingOrigin : false}
                onEditOrigin={() => setEditingOrigin(true)}
                onCancelOrigin={() => { setEditingOrigin(false); setOriginSearch(''); }}
                originSearch={originSearch}
                onOriginSearchChange={setOriginSearch}
                onOriginSelect={handleOriginSelect}
                savingOrigin={savingOrigin}
              />
            )}
            {/* Joined members */}
            {joinedGuests.map(g => (
              <GuestRow
                key={g.id}
                guest={g}
                status="joined"
                isMe={g.user_id === user?.id}
                editingOrigin={g.user_id === user?.id ? editingOrigin : false}
                onEditOrigin={() => setEditingOrigin(true)}
                onCancelOrigin={() => { setEditingOrigin(false); setOriginSearch(''); }}
                originSearch={originSearch}
                onOriginSearchChange={setOriginSearch}
                onOriginSelect={handleOriginSelect}
                savingOrigin={savingOrigin}
              />
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

      {/* Hint: set your starting location */}
      {myMembership && !myMembership.origin_name && (
        <div className="p-3 bg-teal-50 border border-teal-200 rounded-xl text-xs text-teal-700 flex items-center gap-2">
          <span className="shrink-0">📍</span>
          <span>
            <strong>Tip:</strong> Set your starting location so the group can calculate drive times and find the perfect midpoint.
          </span>
          <button
            onClick={() => setEditingOrigin(true)}
            className="shrink-0 ml-auto px-3 py-1 bg-teal-600 text-white font-semibold rounded-lg hover:bg-teal-700 transition text-xs"
          >
            Set Location
          </button>
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

function GuestRow({
  guest, status, onRemove, isCreator, isMe,
  editingOrigin, onEditOrigin, onCancelOrigin,
  originSearch, onOriginSearchChange, onOriginSelect, savingOrigin,
}) {
  const badge = STATUS_BADGE[status] || STATUS_BADGE.pending;
  const initials = (guest.display_name || guest.email || '?')
    .split(/[\s@]/)
    .filter(Boolean)
    .slice(0, 2)
    .map(s => s[0]?.toUpperCase())
    .join('');

  return (
    <div className={`py-2 px-3 rounded-lg transition ${isMe ? 'bg-teal-50/40 border border-teal-100' : 'hover:bg-gray-50'}`}>
      <div className="flex items-center gap-3">
        {/* Avatar */}
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
          isCreator ? 'bg-purple-100 text-purple-700' : 'bg-teal-100 text-teal-700'
        }`}>
          {initials}
        </div>

        {/* Name + email + origin */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-900 truncate">
              {guest.display_name || 'Guest'}
              {isMe && <span className="text-teal-600 ml-1 text-xs">(you)</span>}
            </p>
            {isCreator && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                Host
              </span>
            )}
          </div>
          {guest.email && (
            <p className="text-xs text-gray-400 truncate">{guest.email}</p>
          )}
          {/* Origin location display (for joined members) */}
          {status === 'joined' && (
            <div className="flex items-center gap-1 mt-0.5">
              {guest.origin_name ? (
                <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {guest.origin_name}
                </span>
              ) : isMe ? (
                <span className="text-xs text-amber-500">No starting location set</span>
              ) : (
                <span className="text-xs text-gray-300">No location set</span>
              )}
            </div>
          )}
        </div>

        {/* Set origin button (for current user) */}
        {isMe && !editingOrigin && status === 'joined' && (
          <button
            onClick={onEditOrigin}
            className="shrink-0 ml-2 px-2.5 py-1 text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition"
          >
            {guest.origin_name ? 'Change' : 'Set Location'}
          </button>
        )}

        {/* Status badge */}
        <span className={`px-2 py-0.5 rounded-full text-xs font-medium shrink-0 ${badge.className}`}>
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

      {/* Inline origin editor */}
      {isMe && editingOrigin && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <label className="text-xs font-medium text-gray-600 mb-1.5 block">
            Where are you starting from?
          </label>
          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <LocationInput
                value={originSearch}
                onChange={onOriginSearchChange}
                onSelect={onOriginSelect}
                onClear={() => onOriginSearchChange('')}
                placeholder="Enter your city or address..."
                variant="from"
              />
              {savingOrigin && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <svg className="animate-spin h-4 w-4 text-teal-600" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
            </div>
            <button
              onClick={onCancelOrigin}
              className="shrink-0 px-2.5 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
