import { createClient } from '@supabase/supabase-js';
import { expectSupabaseResult, getMissingEnv, isNoRowsError } from '@/lib/stripeServer';

/**
 * DELETE /api/account/delete
 * Permanently deletes a user's account:
 *   1. Cancels any active Stripe subscription
 *   2. Deletes user data from subscriptions, user_profiles, feature_waitlist
 *   3. Deletes the Supabase Auth user (cascades remaining FK references)
 *
 * The client should sign the user out after receiving a success response.
 */
export async function DELETE(request) {
  try {
    const missing = getMissingEnv([
      'STRIPE_SECRET_KEY',
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

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

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
        { error: 'Authentication required. Please sign in first.' },
        { status: 401 }
      );
    }

    const userId = user.id;
    console.log('[Account Delete] Starting deletion for user:', userId);

    const { data: sub, error: subError } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, status')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (subError && !isNoRowsError(subError)) {
      throw new Error(`Failed to look up subscription: ${subError.message}`);
    }

    if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        console.log('[Account Delete] Stripe subscription cancelled:', sub.stripe_subscription_id);
      } catch (stripeErr) {
        console.error('[Account Delete] Stripe cancel error:', stripeErr.message);
        return Response.json(
          { error: 'Could not cancel your active subscription. Please contact support before deleting your account.' },
          { status: 502 }
        );
      }
    }

    await expectSupabaseResult(
      supabase.from('subscriptions').delete().eq('user_id', userId),
      'Failed to delete subscriptions'
    );
    console.log('[Account Delete] Deleted subscriptions for user:', userId);

    await expectSupabaseResult(
      supabase.from('credit_transactions').delete().eq('user_id', userId),
      'Failed to delete credit transactions'
    );
    console.log('[Account Delete] Deleted credit transactions for user:', userId);

    await expectSupabaseResult(
      supabase.from('user_search_credits').delete().eq('user_id', userId),
      'Failed to delete search credits'
    );
    console.log('[Account Delete] Deleted search credits for user:', userId);

    await expectSupabaseResult(
      supabase.from('stripe_customers').delete().eq('user_id', userId),
      'Failed to delete Stripe customer mapping'
    );
    console.log('[Account Delete] Deleted Stripe customer mapping for user:', userId);

    await expectSupabaseResult(
      supabase.from('user_profiles').delete().eq('id', userId),
      'Failed to delete user profile'
    );
    console.log('[Account Delete] Deleted user_profiles for user:', userId);

    await expectSupabaseResult(
      supabase.from('feature_waitlist').delete().eq('user_id', userId),
      'Failed to delete feature waitlist entries'
    );
    console.log('[Account Delete] Deleted feature_waitlist entries for user:', userId);

    await expectSupabaseResult(
      supabase.from('search_history').delete().eq('user_id', userId),
      'Failed to delete search history'
    );
    console.log('[Account Delete] Deleted search_history entries for user:', userId);

    const { error: deleteAuthError } = await supabase.auth.admin.deleteUser(userId);

    if (deleteAuthError) {
      console.error('[Account Delete] Failed to delete auth user:', deleteAuthError.message);
      return Response.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    console.log('[Account Delete] Auth user deleted:', userId);

    return Response.json({ success: true });
  } catch (err) {
    console.error('[Account Delete] Error:', err);
    return Response.json(
      { error: 'Failed to delete account', detail: err.message },
      { status: 500 }
    );
  }
}
