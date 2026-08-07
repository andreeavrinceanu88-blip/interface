import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const envContent = fs.readFileSync('.env', 'utf-16le');
let url = '', key = '';
envContent.split('\n').forEach(line => {
    if (line.includes('VITE_SUPABASE_URL')) url = line.split('=')[1].trim();
    if (line.includes('VITE_SUPABASE_SERVICE_ROLE_KEY')) key = line.split('=')[1].trim();
    if (line.includes('V I T E _ S U P A B A S E _ U R L')) url = line.replace(/\s/g, '').split('=')[1].trim();
    if (line.includes('V I T E _ S U P A B A S E _ S E R V I C E _ R O L E _ K E Y')) key = line.replace(/\s/g, '').split('=')[1].trim();
});

const supabase = createClient(url, key);

async function run() {
    // Just select 1 row from profiles
    const { data, error } = await supabase.from('profiles').select('*').limit(1);
    console.log(error || data);
}
run();
