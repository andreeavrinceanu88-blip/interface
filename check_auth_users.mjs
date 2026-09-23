
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';
const admin = createClient(supabaseUrl, supabaseServiceKey);

async function checkUser() {
    const { data: users, error } = await admin.auth.admin.listUsers();
    if (error) {
        console.error("Error fetching users:", error);
        return;
    }
    
    const user = users.users.find(u => u.email === 'suport@vitadomus.rro' || u.email === 'suport@vitadomus.ro');
    if (user) {
        console.log("Found user:", user.email, "ID:", user.id);
    } else {
        console.log("User not found.");
        console.log("All emails:", users.users.map(u => u.email));
    }
}
checkUser();
