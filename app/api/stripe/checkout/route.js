import { createClient } from '@supabase/supabase-js';
import {
  getCanonicalSiteUrl,
  getMissingEnv,
  isNoRowsError,
} from '@/lib/stripeServer';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for subscription upgrades.
 * 
 * Body: { priceType: 'monthly' | 'yearly' }
 * 
 * Returns: { url: string } — redirect URL for Stripe Checkout
 */
export async function POST(request) {
  try {
    // Validate required env vars
    const missing = getMissingEnv(['STRIPE_SECRET_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SB_PROJECT_URL', 'NEXT_PUBLIC_SB_PUBLISHABLE_KEY']);
    if (missing.length > 0) {
      return Response.json(
        { error: `Server misconfigured. Missing: ${missing.join(', ')}` },
        { status: 500 }
      );
    }

    // Lazy-import Stripe (server-side only)
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Auth client — uses public key to validate user token
    const authClient = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
    );

    // Admin client — uses service role key to bypass RLS for DB queries
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

    const { priceType } = await request.json();
    if (!['monthly', 'yearly'].includes(priceType)) {
      return Response.json(
        { error: 'Invalid price type.' },
        { status: 400 }
      );
    }

    // Map price type to Stripe Price ID (set these in env vars)
    const priceId = priceType === 'yearly'
      ? process.env.STRIPE_PRICE_YEARLY
      : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return Response.json(
        { error: 'Pricing not configured. Please contact support.' },
        { status: 500 }
      );
    }

    // Check if user already has a Stripe customer ID
    const { data: existingSub, error: existingSubError } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();

    if (existingSubError && !isNoRowsError(existingSubError)) {
      throw new Error(`Failed to look up subscription: ${existingSubError.message}`);
    }

    let customerId = existingSub?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    // Create checkout session
    const siteUrl = getCanonicalSiteUrl();
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${siteUrl}?upgrade=success`,
      cancel_url: `${siteUrl}?upgrade=cancelled`,
      metadata: { supabase_user_id: user.id },
      subscription_data: {
        metadata: { supabase_user_id: user.id },
      },
    });

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err);
    return Response.json(
      { error: 'Failed to create checkout session', detail: err.message },
      { status: 500 }
    );
  }
}
