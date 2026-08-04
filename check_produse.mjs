import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env.local', 'utf-8').trim();
const vars = envContent.split('\n');
let VITE_SUPABASE_URL = '';
let VITE_SUPABASE_ANON_KEY = '';
for (const line of vars) {
    if (line.startsWith('VITE_SUPABASE_URL=')) VITE_SUPABASE_URL = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) VITE_SUPABASE_ANON_KEY = line.split('=')[1].trim();
}

const supabaseAdmin = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: orders } = await supabaseAdmin.from('orders').select('produse, id').limit(3).order('created_at', { ascending: false });
    console.log(orders.map(o => o.produse));
}
run();
