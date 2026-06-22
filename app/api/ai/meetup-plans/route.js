import { createClient } from '@supabase/supabase-js';
import { getMissingEnv } from '@/lib/stripeServer';

async function getAuthenticatedUser(request) {
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SB_PROJECT_URL,
    process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
  );

  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const { data: { user }, error } = await authClient.auth.getUser(token);

  if (error || !user) return null;
  return user;
}

export async function GET(request) {
  try {
    const missing = getMissingEnv([
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SB_PROJECT_URL',
      'NEXT_PUBLIC_SB_PUBLISHABLE_KEY',
    ]);

    if (missing.length > 0) {
      return Response.json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const user = await getAuthenticatedUser(request);
    if (!user) {
      return Response.json(
        { error: 'Authentication required.', reason: 'auth_required' },
        { status: 401 }
      );
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data, error } = await supabase
      .from('ai_meetup_plans')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new Error(error.message);

    return Response.json({ plans: data || [] });
  } catch (err) {
    console.error('[AI Plans] List error:', err);
    return Response.json(
      { error: 'Failed to load AI plans', detail: err.message },
      { status: 500 }
    );
  }
}
