import { createClient } from '@supabase/supabase-js';
import { getMissingEnv, isNoRowsError } from '@/lib/stripeServer';

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

    const authClient = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    );

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: 'Authentication required.', reason: 'auth_required' },
        { status: 401 }
      );
    }

    const [{ data: credits, error: creditsError }, { data: subscription, error: subError }] =
      await Promise.all([
        supabase
          .from('user_search_credits')
          .select('balance, lifetime_purchased, lifetime_used')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
        supabase
          .from('subscriptions')
          .select('plan, status, current_period_end, cancel_at_period_end')
          .eq('user_id', user.id)
          .in('status', ['active', 'trialing', 'past_due'])
          .limit(1)
          .single(),
      ]);

    if (creditsError && !isNoRowsError(creditsError)) {
      throw new Error(`Failed to load credits: ${creditsError.message}`);
    }
    if (subError && !isNoRowsError(subError)) {
      throw new Error(`Failed to load subscription: ${subError.message}`);
    }

    const hasActiveSubscription =
      subscription?.plan && ['premium', 'enterprise'].includes(subscription.plan);

    return Response.json({
      authenticated: true,
      credits: credits?.balance || 0,
      lifetimePurchased: credits?.lifetime_purchased || 0,
      lifetimeUsed: credits?.lifetime_used || 0,
      hasActiveSubscription,
      subscription: subscription || null,
    });
  } catch (err) {
    console.error('[Credits Status] Error:', err);
    return Response.json(
      { error: 'Failed to load credit status', detail: err.message },
      { status: 500 }
    );
  }
}
