import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabaseAdmin = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY);

async function run() {
    // Check if columns exist by trying to select them
    const { data, error } = await supabaseAdmin.from('call_metrics').select('first_call_at, last_call_at, mesaje_trimise').limit(1);
    
    if (error && error.message.includes('column')) {
        console.log('Columns missing. You need to run this SQL in Supabase dashboard:');
        console.log(`
ALTER TABLE call_metrics 
ADD COLUMN first_call_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN last_call_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN mesaje_trimise INTEGER DEFAULT 0;
        `);
    } else {
        console.log('Columns already exist or another error occurred:', error || 'Success');
    }
}
run();
