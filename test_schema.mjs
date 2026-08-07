import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';
const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function checkSchema() {
    const { data, error } = await supabase.from('orders').select('*').limit(1);
    if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    }
}
checkSchema();
