import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: users, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error('Auth error:', authError);
        return;
    }
    
    const user = users.users.find(u => u.email === 'unosuper35@gmail.com');
    if (!user) {
        console.log('User not found in auth.users');
        return;
    }
    console.log('User found in auth.users:', user.id);
    
    const { data: profile } = await supabaseAdmin.from('profiles').select('*').eq('id', user.id).single();
    console.log('Profile:', profile);
}
run();
