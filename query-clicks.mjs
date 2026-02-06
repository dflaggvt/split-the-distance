import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'sb_publishable_wwlOMCpu4u3GwimJn2iXmA_fH8XT_jc'
);

// Get all clicks (external only)
const { data: allClicks, count: totalClicks } = await supabase
  .from('place_clicks')
  .select('place_name, place_category, is_internal', { count: 'exact' })
  .eq('is_internal', false);

const { count: internalClicks } = await supabase
  .from('place_clicks')
  .select('*', { count: 'exact', head: true })
  .eq('is_internal', true);

console.log(`\n📊 PLACE CLICKS SUMMARY`);
console.log(`========================`);
console.log(`Total external clicks: ${totalClicks}`);
console.log(`Total internal clicks: ${internalClicks}`);

if (allClicks && allClicks.length > 0) {
  // Count by place
  const placeCounts = {};
  const categoryCounts = {};
  
  allClicks.forEach(click => {
    placeCounts[click.place_name] = (placeCounts[click.place_name] || 0) + 1;
    if (click.place_category) {
      categoryCounts[click.place_category] = (categoryCounts[click.place_category] || 0) + 1;
    }
  });
  
  // Sort and display top 15 places
  const sortedPlaces = Object.entries(placeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);
  
  console.log(`\n🏆 TOP 15 PLACES CLICKED:`);
  sortedPlaces.forEach(([name, count], i) => {
    console.log(`${i + 1}. ${name} — ${count} clicks`);
  });
  
  // Sort and display categories
  const sortedCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1]);
  
  console.log(`\n📁 BY CATEGORY:`);
  sortedCategories.forEach(([cat, count]) => {
    console.log(`• ${cat}: ${count} clicks`);
  });
}
