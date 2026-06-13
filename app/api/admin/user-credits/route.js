import { createClient } from '@supabase/supabase-js';
import { getMissingEnv } from '@/lib/stripeServer';

function currencyFromCents(cents, currency = 'usd') {
  return {
    cents,
    currency,
  };
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

    const supabaseUrl = process.env.NEXT_PUBLIC_SB_PROJECT_URL.trim();
    const publishableKey = process.env.NEXT_PUBLIC_SB_PUBLISHABLE_KEY.trim();
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY.trim();

    const authClient = createClient(supabaseUrl, publishableKey);
    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '') || '';
    const { data: { user }, error: authError } = await authClient.auth.getUser(token);

    if (authError || !user) {
      return Response.json({ error: 'Authentication required.' }, { status: 401 });
    }

    if (user.app_metadata?.role !== 'admin') {
      return Response.json({ error: 'Admin access required.' }, { status: 403 });
    }

    const [{ data: creditRows, error: creditsError }, { data: purchaseRows, error: purchasesError }] =
      await Promise.all([
        adminClient
          .from('user_search_credits')
          .select('user_id, balance, lifetime_purchased, lifetime_used, updated_at'),
        adminClient
          .from('credit_transactions')
          .select('user_id, amount, balance_after, stripe_price_id, description, metadata, created_at')
          .eq('transaction_type', 'purchase')
          .order('created_at', { ascending: false }),
      ]);

    if (creditsError) {
      throw new Error(`Failed to load credit balances: ${creditsError.message}`);
    }
    if (purchasesError) {
      throw new Error(`Failed to load credit purchases: ${purchasesError.message}`);
    }

    const byUser = {};

    for (const row of creditRows || []) {
      byUser[row.user_id] = {
        userId: row.user_id,
        balance: row.balance || 0,
        lifetimePurchased: row.lifetime_purchased || 0,
        lifetimeUsed: row.lifetime_used || 0,
        purchaseCount: 0,
        creditsPurchased: 0,
        totalSpend: currencyFromCents(0),
        lastPurchaseAt: null,
        lastPurchaseDescription: null,
        lastPurchaseCredits: 0,
      };
    }

    for (const row of purchaseRows || []) {
      const existing = byUser[row.user_id] || {
        userId: row.user_id,
        balance: 0,
        lifetimePurchased: 0,
        lifetimeUsed: 0,
        purchaseCount: 0,
        creditsPurchased: 0,
        totalSpend: currencyFromCents(0),
        lastPurchaseAt: null,
        lastPurchaseDescription: null,
        lastPurchaseCredits: 0,
      };

      const amountTotal = Number(row.metadata?.stripe_amount_total || 0);
      const currency = row.metadata?.stripe_currency || existing.totalSpend.currency || 'usd';

      existing.purchaseCount += 1;
      existing.creditsPurchased += Math.max(Number(row.amount || 0), 0);
      existing.totalSpend = currencyFromCents(existing.totalSpend.cents + amountTotal, currency);

      if (!existing.lastPurchaseAt || new Date(row.created_at) > new Date(existing.lastPurchaseAt)) {
        existing.lastPurchaseAt = row.created_at;
        existing.lastPurchaseDescription = row.description || null;
        existing.lastPurchaseCredits = Math.max(Number(row.amount || 0), 0);
      }

      byUser[row.user_id] = existing;
    }

    return Response.json({
      users: Object.values(byUser),
    });
  } catch (err) {
    console.error('[Admin User Credits] Error:', err);
    return Response.json(
      { error: 'Failed to load user credit data', detail: err.message },
      { status: 500 }
    );
  }
}
