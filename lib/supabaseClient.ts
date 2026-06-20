import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://gehpoyxsqvjfwhzuulby.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlaHBveXhzcXZqZndoenV1bGJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAwNzE2MzIsImV4cCI6MjA5NTY0NzYzMn0.k_IBdtXqV2OnGLXszyYigdAZ7EmLgiwAwtmPey6DUK0';

export const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false // Prevent auto-login from URL fragments which can cause logout loops
  }
});