import { createClient } from '@supabase/supabase-js';

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

    // Admin client — uses service role key to bypass RLS and use admin auth
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

    const userId = user.id;
    console.log('[Account Delete] Starting deletion for user:', userId);

    // Step 1: Cancel active Stripe subscription (if any)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id, status')
      .eq('user_id', userId)
      .limit(1)
      .single();

    if (sub?.stripe_subscription_id && ['active', 'trialing', 'past_due'].includes(sub.status)) {
      try {
        await stripe.subscriptions.cancel(sub.stripe_subscription_id);
        console.log('[Account Delete] Stripe subscription cancelled:', sub.stripe_subscription_id);
      } catch (stripeErr) {
        // Log but don't block deletion — subscription may already be cancelled
        console.error('[Account Delete] Stripe cancel error (continuing):', stripeErr.message);
      }
    }

    // Step 2: Delete user data from tables
    // subscriptions table has ON DELETE CASCADE, but explicit delete ensures clean logging
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    console.log('[Account Delete] Deleted subscriptions for user:', userId);

    await supabase.from('user_profiles').delete().eq('id', userId);
    console.log('[Account Delete] Deleted user_profiles for user:', userId);

    // feature_waitlist has ON DELETE SET NULL, but clean up explicitly
    await supabase.from('feature_waitlist').delete().eq('user_id', userId);
    console.log('[Account Delete] Deleted feature_waitlist entries for user:', userId);

    // Step 3: Delete the Supabase Auth user (this cascades any remaining FK references)
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
