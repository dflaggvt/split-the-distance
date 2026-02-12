import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/stripe/portal
 * Creates a Stripe Billing Portal session so the user can manage their subscription
 * (cancel, update payment method, view invoices).
 * 
 * Returns: { url: string } — redirect URL for Stripe Billing Portal
 */
export async function POST(request) {
  try {
    // Validate required env vars
    const missing = ['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SB_PROJECT_URL', 'NEXT_PUBLIC_SB_PUBLISHABLE_KEY']
      .filter(k => !process.env[k]);
    if (missing.length > 0) {
      return Response.json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Auth client — uses public key to validate user token
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    );

    // Admin client — uses service role key to bypass RLS
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // Get current user from Supabase auth
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';

    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json(
        { error: 'Authentication required. Please sign in first.' },
        { status: 401 }
      );
    }

    // Look up the user's Stripe customer ID
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (!sub?.stripe_customer_id) {
      return Response.json(
        { error: 'No subscription found. You have not subscribed yet.' },
        { status: 404 }
      );
    }

    // Create a Billing Portal session
    const origin = request.headers.get('origin') || 'https://www.splitthedistance.com';
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: origin,
    });

    return Response.json({ url: portalSession.url });
  } catch (err) {
    console.error('[Stripe Portal] Error:', err);
    return Response.json(
      { error: 'Failed to create portal session', detail: err.message },
      { status: 500 }
    );
  }
}
