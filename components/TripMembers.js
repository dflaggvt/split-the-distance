'use client';

/**
 * TripMembers — Members list with role badges, origin info, and status.
 */

import { useTripContext } from './TripProvider';
import { useAuth } from './AuthProvider';

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
  const { members, myMembership, trip } = useTripContext();
  const { user } = useAuth();

  const isCreator = trip?.creator_id === user?.id;

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
                  <div className="flex items-center gap-3">
                    {/* Avatar placeholder */}
                    <div className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 flex items-center justify-center text-sm font-bold shrink-0">
                      {member.display_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
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
                        {member.origin_name && (
                          <span className="text-xs text-gray-400 flex items-center gap-1">
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                              <circle cx="12" cy="10" r="3" />
                            </svg>
                            {member.origin_name}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
