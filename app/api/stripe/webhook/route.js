import { createClient } from '@supabase/supabase-js';
import { expectSupabaseResult, getStripeId, throwIfMissingEnv } from '@/lib/stripeServer';

async function authUserExists(supabase, userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (!error) return Boolean(data?.user);
  if (error.status === 404 || error.message?.toLowerCase().includes('not found')) {
    return false;
  }
  throw error;
}

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for subscription lifecycle.
 * 
 * Events handled:
 *   - checkout.session.completed — new subscription created
 *   - customer.subscription.updated — plan/status changed
 *   - customer.subscription.deleted — subscription cancelled
 */
export async function POST(request) {
  try {
    throwIfMissingEnv(
      ['STRIPE_SECRET_KEY', 'STRIPE_WEBHOOK_SECRET', 'SUPABASE_SERVICE_ROLE_KEY', 'NEXT_PUBLIC_SB_PROJECT_URL'],
      'Stripe webhook misconfigured'
    );

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Use service role key for admin-level Supabase access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const body = await request.text();
    const sig = request.headers.get('stripe-signature');

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      console.error('[Stripe Webhook] Signature verification failed:', err.message);
      return Response.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('[Stripe Webhook] Event:', event.type);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const customerId = getStripeId(session.customer);
        const subscriptionId = getStripeId(session.subscription);

        if (!userId || !customerId || !subscriptionId) {
          console.error('[Stripe Webhook] Missing checkout session metadata or Stripe IDs');
          break;
        }

        // Fetch the subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        await expectSupabaseResult(
          supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            plan: 'premium',
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' }).select('id').single(),
          'Failed to upsert subscription'
        );

        await expectSupabaseResult(
          supabase.from('user_profiles').upsert({ id: userId, plan: 'premium' }, { onConflict: 'id' }).select('id').single(),
          'Failed to update user profile plan'
        );

        console.log('[Stripe Webhook] Subscription created for user:', userId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error('[Stripe Webhook] No supabase_user_id in subscription metadata');
          break;
        }

        if (!(await authUserExists(supabase, userId))) {
          console.log('[Stripe Webhook] User already deleted; skipping subscription update:', userId);
          break;
        }

        const isActive = ['active', 'trialing'].includes(subscription.status);
        const plan = isActive ? 'premium' : 'free';

        await expectSupabaseResult(
          supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: getStripeId(subscription.customer),
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            plan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' }).select('id').single(),
          'Failed to update subscription'
        );

        await expectSupabaseResult(
          supabase.from('user_profiles').upsert({ id: userId, plan }, { onConflict: 'id' }).select('id').single(),
          'Failed to update user profile plan'
        );

        console.log('[Stripe Webhook] Subscription updated for user:', userId, '→', plan);
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const userId = subscription.metadata?.supabase_user_id;

        if (!userId) {
          console.error('[Stripe Webhook] No supabase_user_id in subscription metadata');
          break;
        }

        if (!(await authUserExists(supabase, userId))) {
          console.log('[Stripe Webhook] User already deleted; skipping subscription cancellation:', userId);
          break;
        }

        await expectSupabaseResult(
          supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: getStripeId(subscription.customer),
            stripe_subscription_id: subscription.id,
            status: 'canceled',
            plan: 'free',
          }, { onConflict: 'stripe_subscription_id' }).select('id').single(),
          'Failed to cancel subscription'
        );

        await expectSupabaseResult(
          supabase.from('user_profiles').upsert({ id: userId, plan: 'free' }, { onConflict: 'id' }).select('id').single(),
          'Failed to downgrade user profile'
        );

        console.log('[Stripe Webhook] Subscription cancelled for user:', userId);
        break;
      }

      default:
        console.log('[Stripe Webhook] Unhandled event type:', event.type);
    }

    return Response.json({ received: true });
  } catch (err) {
    console.error('[Stripe Webhook] Error:', err);
    return Response.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
