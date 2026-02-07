import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'sb_publishable_wwlOMCpu4u3GwimJn2iXmA_fH8XT_jc'
);

// Get hourly breakdown since launch
const { data: searches } = await supabase
  .from('searches')
  .select('created_at')
  .eq('is_internal', false)
  .order('created_at', { ascending: true });

if (!searches || searches.length === 0) {
  console.log('No data');
  process.exit(0);
}

const firstSearch = new Date(searches[0].created_at);
const now = new Date();
const hoursLive = (now - firstSearch) / (1000 * 60 * 60);
const totalSearches = searches.length;

console.log('=== TRAFFIC ANALYSIS ===');
console.log(`Launch: ${firstSearch.toISOString()}`);
console.log(`Hours live: ${hoursLive.toFixed(1)}`);
console.log(`Total external searches: ${totalSearches}`);
console.log(`Avg searches/hour: ${(totalSearches / hoursLive).toFixed(1)}`);

// Get last 6 hours for recent trend
const sixHoursAgo = new Date(now - 6 * 60 * 60 * 1000);
const recentSearches = searches.filter(s => new Date(s.created_at) > sixHoursAgo).length;
const recentRate = recentSearches / 6;
console.log(`\nLast 6 hours: ${recentSearches} searches (${recentRate.toFixed(1)}/hr)`);

// Calculate days remaining in Feb
const endOfFeb = new Date('2026-02-28T23:59:59Z');
const hoursRemaining = (endOfFeb - now) / (1000 * 60 * 60);
const daysRemaining = hoursRemaining / 24;

console.log(`\nDays remaining in Feb: ${daysRemaining.toFixed(1)}`);

// Projections
const conservativeRate = totalSearches / hoursLive; // Current avg
const optimisticRate = recentRate; // Recent trend

const conservativeEOM = totalSearches + (conservativeRate * hoursRemaining);
const optimisticEOM = totalSearches + (optimisticRate * hoursRemaining);

console.log('\n=== END OF MONTH PROJECTIONS ===');
console.log(`Conservative (current avg ${conservativeRate.toFixed(1)}/hr): ${Math.round(conservativeEOM).toLocaleString()} searches`);
console.log(`If recent trend holds (${optimisticRate.toFixed(1)}/hr): ${Math.round(optimisticEOM).toLocaleString()} searches`);

// Sessions estimate (rough: 1 session = 1.5 searches avg)
console.log('\n=== ESTIMATED UNIQUE SESSIONS ===');
console.log(`Conservative: ~${Math.round(conservativeEOM / 1.5).toLocaleString()} sessions`);
console.log(`Optimistic: ~${Math.round(optimisticEOM / 1.5).toLocaleString()} sessions`);
