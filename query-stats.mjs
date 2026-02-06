import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'sb_publishable_wwlOMCpu4u3GwimJn2iXmA_fH8XT_jc'
);

// Total searches
const { count: totalSearches } = await supabase
  .from('searches')
  .select('*', { count: 'exact', head: true });

// External only
const { count: externalSearches } = await supabase
  .from('searches')
  .select('*', { count: 'exact', head: true })
  .eq('is_internal', false);

// Internal only
const { count: internalSearches } = await supabase
  .from('searches')
  .select('*', { count: 'exact', head: true })
  .eq('is_internal', true);

// Place clicks
const { count: placeClicks } = await supabase
  .from('place_clicks')
  .select('*', { count: 'exact', head: true })
  .eq('is_internal', false);

console.log(`Total searches: ${totalSearches}`);
console.log(`External: ${externalSearches}`);
console.log(`Internal: ${internalSearches}`);
console.log(`Place clicks: ${placeClicks}`);
