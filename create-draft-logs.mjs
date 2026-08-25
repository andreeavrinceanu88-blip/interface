import { createClient } from '@supabase/supabase-js';

const sb = createClient(
  'https://gehpoyxsqvjfwhzuulby.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM'
);

async function createTable() {
  // Try creating the table via SQL
  const { data, error } = await sb.rpc('exec_sql', {
    sql: `CREATE TABLE IF NOT EXISTS draft_logs (
      id bigint generated always as identity primary key,
      order_id text,
      order_name text,
      store_name text,
      action text,
      message text,
      type text default 'info',
      operator_id uuid,
      created_at timestamptz default now()
    );`
  });
  
  if (error) {
    console.log('RPC failed (expected if exec_sql does not exist):', error.message);
    console.log('Please create the table manually in Supabase SQL Editor.');
  } else {
    console.log('Table created:', data);
  }
  
  // Test if the table already exists by trying to select from it
  const { data: testData, error: testError } = await sb.from('draft_logs').select('*').limit(1);
  if (testError) {
    console.log('Table does NOT exist yet:', testError.message);
    console.log('\n--- COPY THIS SQL INTO SUPABASE SQL EDITOR ---');
    console.log(`
CREATE TABLE IF NOT EXISTS draft_logs (
  id bigint generated always as identity primary key,
  order_id text,
  order_name text,
  store_name text,
  action text,
  message text,
  type text default 'info',
  operator_id uuid,
  created_at timestamptz default now()
);

-- Allow service role full access
ALTER TABLE draft_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role full access" ON draft_logs FOR ALL USING (true);
    `);
  } else {
    console.log('Table already exists! Rows:', testData.length);
  }
}

createTable();
