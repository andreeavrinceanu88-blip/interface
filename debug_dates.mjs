import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://gehpoyxsqvjfwhzuulby.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM'
);

async function checkLatest() {
  const { data, error } = await supabase
    .from('orders')
    .select('id, store_name, status, created_at, name')
    .order('created_at', { ascending: false })
    .limit(10);

  if (error) {
    console.error('Error:', error);
  } else {
    console.log('Latest 10 orders:');
    console.table(data);
  }
}

checkLatest();
