'use client';

/**
 * TripMembers — Members list with role badges, origin setting, and status.
 * Members can set their starting location (origin) for midpoint calculations.
 */

import { useState } from 'react';
import { useTripContext } from './TripProvider';
import { useAuth } from './AuthProvider';
import LocationInput from './LocationInput';
import { updateMemberOrigin } from '@/lib/trips';

const ROLE_BADGE = {
  creator: { label: 'Creator', className: 'bg-purple-100 text-purple-700' },
  member: { label: 'Member', className: 'bg-gray-100 text-gray-600' },
};

const STATUS_COLORS = {
  joined: 'text-green-600',
  invited: 'text-amber-600',
  declined: 'text-red-500',
};

export default function TripMembers() {
  const { members, myMembership, trip, reload } = useTripContext();
  const { user } = useAuth();
  const [editingOrigin, setEditingOrigin] = useState(false);
  const [originSearch, setOriginSearch] = useState('');
  const [savingOrigin, setSavingOrigin] = useState(false);

  const isCreator = trip?.creator_id === user?.id;

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
      reload();
    } catch (err) {
      console.error('Failed to set origin:', err);
    }
    setSavingOrigin(false);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-gray-900">
          Members ({members.filter(m => m.status === 'joined').length})
        </h2>
      </div>

      <div className="space-y-2">
        {members.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
            <div className="text-3xl mb-2">👥</div>
            <p className="text-sm text-gray-500">No members yet. Share the invite link to get started.</p>
          </div>
        ) : (
          members.map((member) => {
            const roleBadge = ROLE_BADGE[member.role] || ROLE_BADGE.member;
            const isMe = member.user_id === user?.id;

            return (
              <div
                key={member.id}
                className={`bg-white rounded-xl border p-4 ${
                  isMe ? 'border-teal-200 bg-teal-50/30' : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold shrink-0">
                      {member.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-gray-900">
                          {member.display_name}
                          {isMe && <span className="text-teal-600 ml-1">(you)</span>}
                        </span>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${roleBadge.className}`}>
                          {roleBadge.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-0.5">
                        <span className={`text-xs font-medium ${STATUS_COLORS[member.status] || 'text-gray-400'}`}>
                          {member.status === 'joined'
                            ? `Joined${member.joined_at ? ` · ${new Date(member.joined_at).toLocaleDateString()}` : ''}`
                            : member.status.charAt(0).toUpperCase() + member.status.slice(1)}
                        </span>
                        {member.origin_name ? (
                          <span className="text-xs text-gray-400 flex items-center gap-1 truncate">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {member.origin_name}
                          </span>
                        ) : isMe ? (
                          <span className="text-xs text-amber-500">No starting location set</span>
                        ) : (
                          <span className="text-xs text-gray-300">No location set</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Set origin button (for own member only) */}
                  {isMe && !editingOrigin && (
                    <button
                      onClick={() => setEditingOrigin(true)}
                      className="shrink-0 ml-2 px-2.5 py-1 text-xs font-medium text-teal-600 bg-teal-50 border border-teal-200 rounded-lg hover:bg-teal-100 transition"
                    >
                      {member.origin_name ? 'Change' : 'Set Location'}
                    </button>
                  )}
                </div>

                {/* Origin editing */}
                {isMe && editingOrigin && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <label className="text-xs font-medium text-gray-600 mb-1.5 block">
                      Where are you starting from?
                    </label>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 relative">
                        <LocationInput
                          value={originSearch}
                          onChange={setOriginSearch}
                          onSelect={handleOriginSelect}
                          onClear={() => setOriginSearch('')}
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
                        onClick={() => { setEditingOrigin(false); setOriginSearch(''); }}
                        className="shrink-0 px-2.5 py-2 text-xs text-gray-400 hover:text-gray-600 transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Hint about origins */}
      {myMembership && !myMembership.origin_name && (
        <div className="mt-4 p-3 bg-teal-50 border border-teal-200 rounded-xl text-sm text-teal-700">
          <strong>Tip:</strong> Set your starting location so the group can calculate drive times and find the perfect midpoint.
        </div>
      )}
    </div>
  );
}
