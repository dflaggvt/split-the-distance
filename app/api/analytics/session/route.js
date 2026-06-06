import { createClient } from '@supabase/supabase-js';
import { getMissingEnv } from '@/lib/stripeServer';

const SESSION_ID_RE = /^sess_[a-z0-9]{8,48}$/i;
const VISITOR_ID_RE = /^vis_[a-z0-9]{8,48}$/i;
const MAX_SESSION_DURATION_SECONDS = 24 * 60 * 60;

function jsonError(message, status = 400) {
  return Response.json({ error: message }, { status });
}

function getSupabaseClients() {
  const missing = getMissingEnv([
    'NEXT_PUBLIC_SB_PROJECT_URL',
    'NEXT_PUBLIC_SB_PUBLISHABLE_KEY',
    'SUPABASE_SERVICE_ROLE_KEY',
  ]);

  if (missing.length > 0) {
    throw new Error(`Server misconfigured. Missing: ${missing.join(', ')}`);
  }

  return {
    authClient: createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    ),
    serviceClient: createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    ),
  };
}

function validateBrowserSession(body) {
  if (!SESSION_ID_RE.test(body.sessionId || '')) {
    return 'Invalid session ID.';
  }

  if (!VISITOR_ID_RE.test(body.visitorId || '')) {
    return 'Invalid visitor ID.';
  }

  return null;
}

function parseDuration(value) {
  const duration = Number.parseInt(value, 10);
  if (!Number.isFinite(duration) || duration < 0) return 0;
  return Math.min(duration, MAX_SESSION_DURATION_SECONDS);
}

async function handleEndSession(serviceClient, body) {
  const invalid = validateBrowserSession(body);
  if (invalid) return jsonError(invalid);

  const durationSeconds = parseDuration(body.durationSeconds);
  const endedAt = body.endedAt && !Number.isNaN(Date.parse(body.endedAt))
    ? body.endedAt
    : new Date().toISOString();

  const { error } = await serviceClient
    .from('sessions')
    .update({ ended_at: endedAt, duration_seconds: durationSeconds })
    .eq('session_id', body.sessionId)
    .eq('visitor_id', body.visitorId)
    .or(`duration_seconds.is.null,duration_seconds.lt.${durationSeconds}`);

  if (error) {
    throw new Error(`Failed to update session duration: ${error.message}`);
  }

  return Response.json({ success: true });
}

async function handleAssociateSession(request, authClient, serviceClient, body) {
  const invalid = validateBrowserSession(body);
  if (invalid) return jsonError(invalid);

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user }, error: authError } = await authClient.auth.getUser(token);

  if (authError || !user) {
    return jsonError('Authentication required.', 401);
  }

  if (body.userId && body.userId !== user.id) {
    return jsonError('Session user does not match authenticated user.', 403);
  }

  const { error: sessionError } = await serviceClient
    .from('sessions')
    .update({ user_id: user.id })
    .eq('session_id', body.sessionId)
    .eq('visitor_id', body.visitorId)
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  if (sessionError) {
    throw new Error(`Failed to associate session: ${sessionError.message}`);
  }

  const { error: eventsError } = await serviceClient
    .from('session_events')
    .update({ user_id: user.id })
    .eq('session_id', body.sessionId)
    .eq('visitor_id', body.visitorId)
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  if (eventsError && eventsError.code !== '42P01') {
    throw new Error(`Failed to associate session events: ${eventsError.message}`);
  }

  const { error: pageViewsError } = await serviceClient
    .from('page_views')
    .update({ user_id: user.id })
    .eq('session_id', body.sessionId)
    .or(`user_id.is.null,user_id.eq.${user.id}`);

  if (pageViewsError && !['42P01', '42703'].includes(pageViewsError.code)) {
    throw new Error(`Failed to associate page views: ${pageViewsError.message}`);
  }

  return Response.json({ success: true });
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { authClient, serviceClient } = getSupabaseClients();

    if (body.action === 'end') {
      return handleEndSession(serviceClient, body);
    }

    if (body.action === 'associate') {
      return handleAssociateSession(request, authClient, serviceClient, body);
    }

    return jsonError('Unknown analytics session action.');
  } catch (err) {
    console.error('[Analytics Session] Error:', err);
    return Response.json(
      { error: 'Failed to update analytics session.', detail: err.message },
      { status: 500 }
    );
  }
}
