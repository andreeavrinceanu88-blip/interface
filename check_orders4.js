import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function check() {
    const { data, error } = await supabase
        .from('orders')
        .select('phone_number')
        .ilike('phone_number', '%5548486')
        .limit(10);
    console.log("With % at start ONLY:");
    console.log("Error:", error);
    console.log("Data:", data);
    
    const { data: d2 } = await supabase
        .from('orders')
        .select('phone_number')
        .ilike('phone_number', '%5548486%')
        .limit(10);
    console.log("With % at BOTH sides:");
    console.log("Data:", d2);
}

check();
