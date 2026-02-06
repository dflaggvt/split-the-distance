import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://rwabiyqmhwebxkiyjkcc.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJ3YWJpeXFtaHdlYnhraXlqa2NjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzgxMzQzNTIsImV4cCI6MjA1MzcxMDM1Mn0.OBWS-F8GWydQHIpKxj2Y3X6AZfyqpjKNJr7wEqrv9Bc'
);

const { data, error } = await supabase
  .from('searches')
  .select('from_name, to_name, distance_miles, created_at')
  .order('created_at', { ascending: false })
  .limit(20);

if (error) {
  console.error('Error:', error);
} else {
  console.log('Recent searches (looking for failed/long routes):');
  data.forEach(s => {
    const dist = s.distance_miles?.toFixed(0) || 'NULL';
    console.log(`${s.from_name} → ${s.to_name} | ${dist} mi`);
  });
}
