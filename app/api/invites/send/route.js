import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import TripInviteEmail from '@/components/emails/TripInviteEmail';

/**
 * POST /api/invites/send
 *
 * Sends invite emails to all pending/invited members of a trip who have
 * an email address. Called by the client after send_invites_rpc flips
 * the database status.
 *
 * Body: { tripId: string }
 * Auth: Bearer token (Supabase access token) — verified server-side
 */

// Lazy-init to avoid build failures when RESEND_API_KEY is not yet set
let _resend;
function getResend() {
  if (!_resend) {
    if (!process.env.RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY environment variable is not set');
    }
    _resend = new Resend(process.env.RESEND_API_KEY);
  }
  return _resend;
}

export async function POST(request) {
  try {
    // ---- Auth: extract Supabase token from Authorization header ----
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    // Verify the token by getting the user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // ---- Parse body ----
    const { tripId } = await request.json();
    if (!tripId) {
      return Response.json({ error: 'tripId is required' }, { status: 400 });
    }

    // ---- Fetch trip details ----
    const { data: trip, error: tripErr } = await supabase
      .from('trips')
      .select('id, title, description, invite_code, created_by')
      .eq('id', tripId)
      .single();

    if (tripErr || !trip) {
      return Response.json({ error: 'Trip not found' }, { status: 404 });
    }

    // Only the creator can send invites
    if (trip.created_by !== user.id) {
      return Response.json({ error: 'Only the trip creator can send invites' }, { status: 403 });
    }

    // ---- Get the host's display name ----
    const { data: hostMember } = await supabase
      .from('trip_members')
      .select('display_name')
      .eq('trip_id', tripId)
      .eq('user_id', user.id)
      .single();

    const hostName = hostMember?.display_name || user.email?.split('@')[0] || 'Someone';

    // ---- Fetch invited members with email addresses ----
    const { data: guests, error: guestErr } = await supabase
      .from('trip_members')
      .select('id, email, display_name, status')
      .eq('trip_id', tripId)
      .in('status', ['invited', 'pending'])
      .not('email', 'is', null);

    if (guestErr) {
      return Response.json({ error: 'Failed to fetch guests' }, { status: 500 });
    }

    if (!guests || guests.length === 0) {
      return Response.json({ sent: 0, message: 'No guests with email addresses to invite' });
    }

    // ---- Build invite URL ----
    const origin = request.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://splitthedistance.com';
    const inviteUrl = `${origin}/trips/join/${trip.invite_code}`;

    // ---- Send emails via Resend ----
    const fromAddress = process.env.RESEND_FROM_EMAIL || 'Split the Distance <invites@splitthedistance.com>';

    const resend = getResend();

    const results = await Promise.allSettled(
      guests.map((guest) =>
        resend.emails.send({
          from: fromAddress,
          to: guest.email,
          subject: `${hostName} invited you to "${trip.title}"`,
          react: TripInviteEmail({
            tripTitle: trip.title,
            hostName,
            inviteUrl,
            tripDescription: trip.description || '',
          }),
        }),
      ),
    );

    // Count successes and failures
    const sent = results.filter(r => r.status === 'fulfilled' && r.value?.data?.id).length;
    const failed = results.filter(r => r.status === 'rejected' || !r.value?.data?.id).length;

    if (failed > 0) {
      const errors = results
        .filter(r => r.status === 'rejected' || r.value?.error)
        .map(r => r.reason?.message || r.value?.error?.message || 'Unknown error');
      console.error('[Invites] Some emails failed:', errors);
    }

    return Response.json({
      sent,
      failed,
      total: guests.length,
      message: failed > 0
        ? `Sent ${sent} of ${guests.length} invites (${failed} failed)`
        : `All ${sent} invite${sent !== 1 ? 's' : ''} sent successfully`,
    });
  } catch (err) {
    console.error('[Invites] Unexpected error:', err);
    return Response.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
