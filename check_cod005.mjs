import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

// Get the env variables directly from .env since dotenvx is missing in standard node
const envContent = fs.readFileSync('.env', 'utf-8');
const VITE_SUPABASE_URL = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1].trim();
const VITE_SUPABASE_ANON_KEY = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1].trim();

const supabaseAdmin = createClient(VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY);

async function run() {
    const { data: pData } = await supabaseAdmin.from('products').select('sku, discountCode, title').eq('sku', 'COD005');
    console.log("COD005 discountCode:", pData);
}
run();
