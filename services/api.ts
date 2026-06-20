import { supabaseAdmin } from '../lib/supabaseClient';

export const getProfile = async (userId: string) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (error) {
    return null;
  }
  return data;
};

export const getProfileByEmail = async (email: string) => {
  const { data, error } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('email', email)
    .maybeSingle();

  if (error) {
    console.error('Error fetching profile by email:', error);
    return null;
  }
  return data;
};