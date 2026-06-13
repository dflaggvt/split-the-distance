import { createClient } from '@supabase/supabase-js';
import { getMissingEnv } from '@/lib/stripeServer';

export async function POST(request) {
  try {
    const missing = getMissingEnv([
      'NEXT_PUBLIC_SB_PROJECT_URL',
      'NEXT_PUBLIC_SB_PUBLISHABLE_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
    ]);

    if (missing.length > 0) {
      return Response.json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    if (!token) {
      return Response.json(
        { error: 'Authentication required.', reason: 'auth_required' },
        { status: 401 }
      );
    }

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    );

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);
    if (authError || !user) {
      return Response.json(
        { error: 'Authentication required.', reason: 'auth_required' },
        { status: 401 }
      );
    }

    const { metadata = {} } = await request.json().catch(() => ({}));
    const { data, error } = await supabase.rpc('consume_search_credit', {
      p_user_id: user.id,
      p_metadata: metadata,
    });

    if (error) {
      throw new Error(error.message);
    }

    const result = Array.isArray(data) ? data[0] : data;
    if (!result?.allowed) {
      return Response.json(
        {
          allowed: false,
          credits: result?.balance || 0,
          reason: result?.reason || 'no_credits',
          grandfathered: false,
        },
        { status: 402 }
      );
    }

    return Response.json({
      allowed: true,
      credits: result.balance || 0,
      reason: result.reason,
      grandfathered: Boolean(result.grandfathered),
    });
  } catch (err) {
    console.error('[Credits Consume] Error:', err);
    return Response.json(
      { error: 'Failed to consume search credit', detail: err.message },
      { status: 500 }
    );
  }
}
