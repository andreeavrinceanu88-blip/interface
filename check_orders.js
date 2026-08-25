import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
    const { data, error } = await supabase
        .from('orders')
        .select('phone_number')
        .ilike('phone_number', '%5548486%');
    console.log("Error:", error);
    console.log("Data:", data);
}

check();
