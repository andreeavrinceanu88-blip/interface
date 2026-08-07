import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';

const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
const supabaseAnonKey = import.meta?.env ? "..." : ""; // actually I can just use a fake token or service key, but wait, the client uses anon key with a session!

async function testInsert() {
    const { data: userData } = await supabaseAdmin.auth.admin.listUsers();
    const testUser = userData?.users[0];
    
    console.log("Testing insert with admin key (ignores RLS):");
    const { error: err1 } = await supabaseAdmin.from('call_logs').insert({
        operator_id: testUser.id,
        duration_secs: 10,
    });
    console.log("Admin insert error:", err1?.message || "Success");

    // But the client uses anon key with user session. If RLS is enabled without a policy, it will fail for the client.
    // If it fails for admin too, then the table structure is wrong.
}
testInsert();
