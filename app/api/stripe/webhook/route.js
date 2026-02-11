import { createClient } from '@supabase/supabase-js';

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
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

    // Use service role key for admin-level Supabase access
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SB_PROJECT_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY
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
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (!userId) {
          console.error('[Stripe Webhook] No supabase_user_id in session metadata');
          break;
        }

        // Fetch the subscription details from Stripe
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Upsert subscription record
        await supabase.from('subscriptions').upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId,
          plan: 'premium',
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: 'stripe_subscription_id' });

        // Update user profile plan
        await supabase.from('user_profiles').update({ plan: 'premium' }).eq('id', userId);

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

        const isActive = ['active', 'trialing'].includes(subscription.status);
        const plan = isActive ? 'premium' : 'free';

        // Update subscription record
        await supabase.from('subscriptions').update({
          status: subscription.status,
          plan,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }).eq('stripe_subscription_id', subscription.id);

        // Update user profile plan
        await supabase.from('user_profiles').update({ plan }).eq('id', userId);

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

        // Update subscription status
        await supabase.from('subscriptions').update({
          status: 'canceled',
          plan: 'free',
        }).eq('stripe_subscription_id', subscription.id);

        // Downgrade user profile
        await supabase.from('user_profiles').update({ plan: 'free' }).eq('id', userId);

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
