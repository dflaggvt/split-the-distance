import { createClient } from '@supabase/supabase-js';
import {
  CREDIT_PACKS,
  getCanonicalSiteUrl,
  getMissingEnv,
  isNoRowsError,
} from '@/lib/stripeServer';

/**
 * POST /api/stripe/checkout
 * Creates a Stripe Checkout Session for credit packs or legacy subscription upgrades.
 * 
 * Body: { priceType: 'credits_10' | 'credits_30' | 'credits_100' | 'monthly' | 'yearly' }
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
    const isCreditPack = Boolean(CREDIT_PACKS[priceType]);
    const isLegacySubscription = ['monthly', 'yearly'].includes(priceType);

    if (!isCreditPack && !isLegacySubscription) {
      return Response.json(
        { error: 'Invalid price type.' },
        { status: 400 }
      );
    }

    // Map price type to Stripe Price ID (set these in env vars)
    const priceId = isCreditPack
      ? process.env[CREDIT_PACKS[priceType].envKey]
      : priceType === 'yearly'
        ? process.env.STRIPE_PRICE_YEARLY
        : process.env.STRIPE_PRICE_MONTHLY;

    if (!priceId) {
      return Response.json(
        { error: 'Pricing not configured. Please contact support.' },
        { status: 500 }
      );
    }

    const [{ data: existingCustomer, error: existingCustomerError }, { data: existingSub, error: existingSubError }] =
      await Promise.all([
        supabase
          .from('stripe_customers')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
        supabase
          .from('subscriptions')
          .select('stripe_customer_id')
          .eq('user_id', user.id)
          .limit(1)
          .single(),
      ]);

    if (existingCustomerError && !isNoRowsError(existingCustomerError)) {
      throw new Error(`Failed to look up Stripe customer: ${existingCustomerError.message}`);
    }
    if (existingSubError && !isNoRowsError(existingSubError)) {
      throw new Error(`Failed to look up subscription: ${existingSubError.message}`);
    }

    let customerId = existingCustomer?.stripe_customer_id || existingSub?.stripe_customer_id;

    // Create Stripe customer if not exists
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { supabase_user_id: user.id },
      });
      customerId = customer.id;
    }

    await supabase.from('stripe_customers').upsert({
      user_id: user.id,
      stripe_customer_id: customerId,
    }, { onConflict: 'user_id' });

    // Create checkout session
    const siteUrl = getCanonicalSiteUrl();
    const sessionConfig = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
    };

    if (isCreditPack) {
      const pack = CREDIT_PACKS[priceType];
      Object.assign(sessionConfig, {
        mode: 'payment',
        success_url: `${siteUrl}?credits=success`,
        cancel_url: `${siteUrl}?credits=cancelled`,
        metadata: {
          type: 'search_credits',
          credit_pack: priceType,
          credits: String(pack.credits),
          supabase_user_id: user.id,
        },
      });
    } else {
      Object.assign(sessionConfig, {
        mode: 'subscription',
        success_url: `${siteUrl}?upgrade=success`,
        cancel_url: `${siteUrl}?upgrade=cancelled`,
        metadata: { supabase_user_id: user.id },
        subscription_data: {
          metadata: { supabase_user_id: user.id },
        },
      });
    }

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return Response.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe Checkout] Error:', err);
    return Response.json(
      { error: 'Failed to create checkout session', detail: err.message },
      { status: 500 }
    );
  }
}
