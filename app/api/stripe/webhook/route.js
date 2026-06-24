import { createClient } from '@supabase/supabase-js';
import {
  CREDIT_PACKS,
  expectSupabaseResult,
  getStripeId,
  isNoRowsError,
  throwIfMissingEnv,
} from '@/lib/stripeServer';

async function authUserExists(supabase, userId) {
  const { data, error } = await supabase.auth.admin.getUserById(userId);
  if (!error) return Boolean(data?.user);
  if (error.status === 404 || error.message?.toLowerCase().includes('not found')) {
    return false;
  }
  throw error;
}

async function hasPurchasedSearchCredits(supabase, userId) {
  const { data, error } = await supabase
    .from('user_search_credits')
    .select('lifetime_purchased')
    .eq('user_id', userId)
    .single();

  if (error) {
    if (isNoRowsError(error)) return false;
    throw new Error(`Failed to load credit purchase status: ${error.message}`);
  }

  return Number(data?.lifetime_purchased || 0) > 0;
}

async function updateUserProfilePlan(supabase, userId, plan, label = 'Failed to update user profile plan') {
  return expectSupabaseResult(
    supabase.from('user_profiles').upsert({ id: userId, plan }, { onConflict: 'id' }).select('id').single(),
    label
  );
}

async function getProfilePlanForSubscriptionStatus(supabase, userId, isActiveSubscription) {
  if (isActiveSubscription) return 'premium';
  return (await hasPurchasedSearchCredits(supabase, userId)) ? 'premium' : 'free';
}

/**
 * POST /api/stripe/webhook
 * Handles Stripe webhook events for credit purchases and subscription lifecycle.
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
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        const customerId = getStripeId(session.customer);

        if (!userId || !customerId) {
          console.error('[Stripe Webhook] Missing checkout session metadata or Stripe IDs');
          break;
        }

        await expectSupabaseResult(
          supabase.from('stripe_customers').upsert({
            user_id: userId,
            stripe_customer_id: customerId,
          }, { onConflict: 'user_id' }).select('user_id').single(),
          'Failed to upsert Stripe customer'
        );

        if (session.mode === 'payment' && session.metadata?.type === 'search_credits') {
          if (session.payment_status !== 'paid') {
            console.log('[Stripe Webhook] Credit checkout completed before payment; waiting for payment success:', session.id);
            break;
          }

          const creditPack = session.metadata.credit_pack;
          const pack = CREDIT_PACKS[creditPack];
          const credits = Number(session.metadata.credits || pack?.credits || 0);

          if (!pack || credits <= 0) {
            console.error('[Stripe Webhook] Invalid credit pack metadata:', session.metadata);
            break;
          }

          const { data: grantResult, error: grantError } = await supabase.rpc('grant_search_credits', {
            p_user_id: userId,
            p_amount: credits,
            p_transaction_type: 'purchase',
            p_stripe_checkout_session_id: session.id,
            p_stripe_payment_intent_id: getStripeId(session.payment_intent),
            p_stripe_price_id: pack.envKey ? process.env[pack.envKey]?.trim() : null,
            p_description: `${pack.label} credit pack`,
            p_metadata: {
              credit_pack: creditPack,
              stripe_customer_id: customerId,
              stripe_amount_total: session.amount_total,
              stripe_currency: session.currency,
            },
          });

          if (grantError) {
            throw new Error(`Failed to grant credits: ${grantError.message}`);
          }

          const grant = Array.isArray(grantResult) ? grantResult[0] : grantResult;
          await updateUserProfilePlan(
            supabase,
            userId,
            'premium',
            'Failed to mark credit buyer as premium'
          );

          console.log('[Stripe Webhook] Credits processed for user:', userId, {
            credits,
            granted: grant?.granted,
            balance: grant?.balance,
          });
          break;
        }

        const subscriptionId = getStripeId(session.subscription);
        if (!subscriptionId) {
          console.log('[Stripe Webhook] Completed checkout without subscription; no subscription action needed.');
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

        await updateUserProfilePlan(supabase, userId, 'premium');

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
        const subscriptionPlan = isActive ? 'premium' : 'free';
        const profilePlan = await getProfilePlanForSubscriptionStatus(supabase, userId, isActive);

        await expectSupabaseResult(
          supabase.from('subscriptions').upsert({
            user_id: userId,
            stripe_customer_id: getStripeId(subscription.customer),
            stripe_subscription_id: subscription.id,
            status: subscription.status,
            plan: subscriptionPlan,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, { onConflict: 'stripe_subscription_id' }).select('id').single(),
          'Failed to update subscription'
        );

        await updateUserProfilePlan(supabase, userId, profilePlan);

        console.log('[Stripe Webhook] Subscription updated for user:', userId, {
          subscriptionPlan,
          profilePlan,
        });
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

        const profilePlan = await getProfilePlanForSubscriptionStatus(supabase, userId, false);
        await updateUserProfilePlan(
          supabase,
          userId,
          profilePlan,
          'Failed to update user profile after subscription cancellation'
        );

        console.log('[Stripe Webhook] Subscription cancelled for user:', userId, 'profile plan:', profilePlan);
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
