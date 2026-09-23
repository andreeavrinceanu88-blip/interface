import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseServiceKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MDA3MTYzMiwiZXhwIjoyMDk1NjQ3NjMyfQ.LxV5goMVAMcnwbNW965pd7Zq99g8wjLeydLHW_7qbRM';
const admin = createClient(supabaseUrl, supabaseServiceKey);

async function deleteUser() {
    const { data, error } = await admin.auth.admin.deleteUser('2e608323-53eb-49ea-bbbc-4b9d8a984de6');
    if (error) {
        console.error("Error deleting user:", error);
    } else {
        console.log("User deleted successfully!", data);
    }
}
deleteUser();
