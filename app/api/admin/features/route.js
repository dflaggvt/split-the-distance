import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

/**
 * Admin API for feature flag management.
 * Uses the service role key to bypass RLS — only the admin dashboard calls this.
 * Protected by checking the Referer header matches the obscured dashboard path.
 */
function getAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SB_PROJECT_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function isAdminRequest(request) {
  // Verify request comes from the admin dashboard page
  const referer = request.headers.get('referer') || '';
  return referer.includes('d4shb0ard-7x9k');
}

// GET /api/admin/features — fetch all feature flags + waitlist counts
export async function GET(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const supabase = getAdminClient();
    const [{ data: flags, error: flagsErr }, { data: waitlist, error: waitErr }] = await Promise.all([
      supabase.from('feature_flags').select('*').order('sort_order', { ascending: true }),
      supabase.from('feature_waitlist').select('feature_key'),
    ]);

    if (flagsErr) return NextResponse.json({ error: flagsErr.message }, { status: 500 });

    // Count waitlist signups per feature
    const waitlistCounts = {};
    (waitlist || []).forEach(w => {
      waitlistCounts[w.feature_key] = (waitlistCounts[w.feature_key] || 0) + 1;
    });

    return NextResponse.json({ flags, waitlistCounts });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

// PATCH /api/admin/features — update a feature flag field
export async function PATCH(request) {
  if (!isAdminRequest(request)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  try {
    const { key, field, value } = await request.json();

    // Validate allowed fields
    const ALLOWED_FIELDS = ['status', 'tier', 'enabled', 'label', 'description', 'emoji', 'sort_order'];
    if (!key || !field || !ALLOWED_FIELDS.includes(field)) {
      return NextResponse.json({ error: 'Invalid key or field' }, { status: 400 });
    }

    const supabase = getAdminClient();
    const { data, error } = await supabase
      .from('feature_flags')
      .update({ [field]: value })
      .eq('key', key)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ flag: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
