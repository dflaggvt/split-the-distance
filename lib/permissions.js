/**
 * Permission matrix for Collaborative Group Trips.
 *
 * Three roles determine what a member can do inside a trip:
 *   1. Host (creator) — full control
 *   2. Paid member (premium/enterprise plan) — full collaboration, host approves changes
 *   3. Free member — view-only + vote when voting is enabled by host
 */

/**
 * Compute permissions for a trip member.
 *
 * @param {'creator'|'member'} role       — trip_members.role
 * @param {'free'|'premium'|'enterprise'|'anonymous'} plan — user_profiles.plan
 * @param {boolean} votingOpen            — trips.voting_open
 * @returns {object} permissions object
 */
export function computePermissions(role, plan, votingOpen) {
  const isHost = role === 'creator';
  const isPaid = plan === 'premium' || plan === 'enterprise';

  return {
    // Trip management (only host)
    canManageTrip: isHost,
    canSendInvites: isHost,
    canAddGuests: isHost,
    canConfirm: isHost,            // confirm dates, locations, options
    canStartTrip: isHost,
    canCompleteTrip: isHost,
    canToggleVoting: isHost,

    // Proposing / adding content (host + paid)
    canProposeDates: isHost || isPaid,
    canProposeLocations: isHost || isPaid,
    canAddOptions: isHost || isPaid,
    canAddStops: isHost || isPaid,
    canEditItinerary: isHost || isPaid,
    canDeleteOwn: isHost || isPaid,

    // Voting (host + paid always, free only when voting is open)
    canVote: isHost || isPaid || votingOpen,

    // Chat (everyone)
    canChat: true,

    // View (everyone)
    canView: true,

    // Derived flags for UI
    isHost,
    isPaid,
    isFree: !isPaid && !isHost,
  };
}
