import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWJpeXFtaHdlYnhraXlqa2NjIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MDI5MjI1MiwiZXhwIjoyMDg1ODY4MjUyfQ.pr8F-Uwjcz4aUBKSdtWydGXlTL1wxc-A39wk5ZiGSDQ'
);

const sql = `
-- Add session_id to existing tables
ALTER TABLE searches ADD COLUMN IF NOT EXISTS session_id TEXT;
ALTER TABLE place_clicks ADD COLUMN IF NOT EXISTS session_id TEXT;

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT NOT NULL,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER,
  user_agent TEXT,
  referrer TEXT,
  device_type TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shares table
CREATE TABLE IF NOT EXISTS shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  share_type TEXT NOT NULL,
  from_name TEXT,
  to_name TEXT,
  share_url TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Outbound clicks table
CREATE TABLE IF NOT EXISTS outbound_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  click_type TEXT NOT NULL,
  place_name TEXT,
  place_category TEXT,
  destination_url TEXT,
  from_search_route TEXT,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Page views table
CREATE TABLE IF NOT EXISTS page_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id TEXT,
  page_path TEXT,
  referrer TEXT,
  user_agent TEXT,
  screen_width INTEGER,
  screen_height INTEGER,
  is_internal BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// Execute SQL using the rpc function
const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

if (error) {
  console.log('RPC method not available, trying direct approach...');
  
  // Try individual table creations via REST
  const tables = ['sessions', 'shares', 'outbound_clicks', 'page_views'];
  
  for (const table of tables) {
    const { error: testError } = await supabase.from(table).select('id').limit(1);
    if (testError?.message?.includes('does not exist')) {
      console.log(`Table ${table} needs to be created`);
    } else if (testError) {
      console.log(`Table ${table}: ${testError.message}`);
    } else {
      console.log(`✅ Table ${table} exists`);
    }
  }
  
  console.log('\nNeed to use postgres directly. Trying psql...');
} else {
  console.log('✅ SQL executed successfully');
}
