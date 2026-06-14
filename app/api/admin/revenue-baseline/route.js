import { createClient } from '@supabase/supabase-js';
import { getMissingEnv } from '@/lib/stripeServer';

const PAGE_SIZE = 1000;
const MAX_ROWS = 100000;

function centsFromMetadata(row) {
  return Number(row.metadata?.stripe_amount_total || 0);
}

function packKeyFromRow(row) {
  const metadataPack = row.metadata?.credit_pack;
  if (metadataPack) return metadataPack;

  const amount = Number(row.amount || 0);
  if (amount === 10) return 'credits_10';
  if (amount === 30) return 'credits_30';
  if (amount === 100) return 'credits_100';

  return 'unknown';
}

async function fetchRows(queryFactory) {
  const rows = [];

  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    const to = from + PAGE_SIZE - 1;
    const { data, error } = await queryFactory().range(from, to);

    if (error) throw error;
    if (!data?.length) break;

    rows.push(...data);
    if (data.length < PAGE_SIZE) break;
  }

  return {
    rows,
    rowLimitReached: rows.length >= MAX_ROWS,
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

    const url = new URL(request.url);
    const sinceParam = url.searchParams.get('since');
    const parsedSince = sinceParam ? new Date(sinceParam) : null;
    const since = parsedSince && Number.isFinite(parsedSince.getTime())
      ? parsedSince.toISOString()
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const last30Since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [
      purchasesResult,
      debitsResult,
      { data: creditRows, error: creditsError },
      { count: last30Sessions, error: sessionsError },
      { count: last30PageViews, error: pageViewsError },
    ] = await Promise.all([
      fetchRows(() => adminClient
        .from('credit_transactions')
        .select('user_id, amount, stripe_price_id, description, metadata, created_at')
        .eq('transaction_type', 'purchase')
        .gte('created_at', since)
        .order('created_at', { ascending: false })),
      fetchRows(() => adminClient
        .from('credit_transactions')
        .select('user_id, amount, metadata, created_at')
        .eq('transaction_type', 'search_debit')
        .gte('created_at', since)
        .order('created_at', { ascending: false })),
      adminClient
        .from('user_search_credits')
        .select('user_id, balance, lifetime_purchased, lifetime_used'),
      adminClient
        .from('sessions')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last30Since)
        .eq('is_internal', false),
      adminClient
        .from('page_views')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', last30Since)
        .eq('is_internal', false),
    ]);

    if (creditsError) throw new Error(`Failed to load credit balances: ${creditsError.message}`);
    if (sessionsError) throw new Error(`Failed to load monthly sessions: ${sessionsError.message}`);
    if (pageViewsError) throw new Error(`Failed to load monthly page views: ${pageViewsError.message}`);

    const purchases = purchasesResult.rows;
    const debits = debitsResult.rows;
    const buyers = new Set(purchases.map((row) => row.user_id).filter(Boolean));
    const paidSearchUsers = new Set(debits.map((row) => row.user_id).filter(Boolean));
    const packCounts = {};
    const packSpendCents = {};
    const packCredits = {};

    purchases.forEach((row) => {
      const packKey = packKeyFromRow(row);
      packCounts[packKey] = (packCounts[packKey] || 0) + 1;
      packSpendCents[packKey] = (packSpendCents[packKey] || 0) + centsFromMetadata(row);
      packCredits[packKey] = (packCredits[packKey] || 0) + Math.max(Number(row.amount || 0), 0);
    });

    const creditBalance = (creditRows || []).reduce((sum, row) => sum + Number(row.balance || 0), 0);
    const lifetimePurchased = (creditRows || []).reduce((sum, row) => sum + Number(row.lifetime_purchased || 0), 0);
    const lifetimeUsed = (creditRows || []).reduce((sum, row) => sum + Number(row.lifetime_used || 0), 0);
    const totalSpendCents = purchases.reduce((sum, row) => sum + centsFromMetadata(row), 0);
    const totalCreditsPurchased = purchases.reduce((sum, row) => sum + Math.max(Number(row.amount || 0), 0), 0);
    const paidSearchesPerBuyer = buyers.size > 0 ? debits.length / buyers.size : null;

    return Response.json({
      selectedRange: {
        since,
        purchases: purchases.length,
        buyers: buyers.size,
        paidSearches: debits.length,
        paidSearchUsers: paidSearchUsers.size,
        paidSearchesPerBuyer,
        totalSpendCents,
        currency: purchases.find((row) => row.metadata?.stripe_currency)?.metadata?.stripe_currency || 'usd',
        totalCreditsPurchased,
        packCounts,
        packSpendCents,
        packCredits,
        rowLimitReached: purchasesResult.rowLimitReached || debitsResult.rowLimitReached,
      },
      currentCredits: {
        usersWithCredits: (creditRows || []).filter((row) => Number(row.balance || 0) > 0).length,
        creditBalance,
        lifetimePurchased,
        lifetimeUsed,
      },
      monthly: {
        since: last30Since,
        sessions: last30Sessions || 0,
        pageViews: last30PageViews || 0,
      },
    });
  } catch (err) {
    console.error('[Admin Revenue Baseline] Error:', err);
    return Response.json(
      { error: 'Failed to load revenue baseline', detail: err.message },
      { status: 500 }
    );
  }
}
