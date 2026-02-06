import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'sb_publishable_wwlOMCpu4u3GwimJn2iXmA_fH8XT_jc'
);

// Test if tables exist by trying to query them
const tables = ['sessions', 'shares', 'outbound_clicks', 'page_views'];

for (const table of tables) {
  const { error } = await supabase.from(table).select('id').limit(1);
  if (error) {
    console.log(`❌ ${table}: ${error.message}`);
  } else {
    console.log(`✅ ${table}: exists`);
  }
}
