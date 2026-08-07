import React, { createContext, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabaseClient';
import { getProfile } from '../services/api';

export interface UserProfile {
  id: string; 
  parent_id?: string | null;
  effectiveUserId: string; // The ID to use for fetching data (parent_id if exists, else id)
  role: 'admin' | 'user';
  full_name?: string | null;
  avatar_url?: string | null;
  stores: string[];
  email: string;
}

interface AuthContextType {
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children?: React.ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const parseStores = (storesStr: string | null): string[] => {
    if (!storesStr) return [];
    return storesStr.split(',').map(s => s.trim()).filter(Boolean);
  };

  const fetchProfileAndSet = async (authUserId: string, email: string) => {
    console.log(`🛰️ [AuthContext] Background fetch for profile: ${authUserId}`);
    try {
      // We don't block the UI for this fetch anymore
      const profileData = await getProfile(authUserId);
      if (profileData) {
        // Since we don't have parent_id in schema, we hardcode the owner ID for operators for now
        const OWNER_ID = 'c5c39d1f-3b13-4009-986c-5cd24c3fab00';
        const isOwner = email === 'contact@whimlets.com';
        
        setProfile({
          id: profileData.id, 
          parent_id: isOwner ? null : OWNER_ID,
          effectiveUserId: isOwner ? profileData.id : OWNER_ID,
          email: email,
          role: (profileData.role as 'admin' | 'user') ?? 'user',
          full_name: profileData.full_name,
          avatar_url: profileData.avatar_url,
          stores: parseStores(profileData.stores),
        });
        console.log('✅ [AuthContext] Profile loaded.');
      } else {
        const OWNER_ID = 'c5c39d1f-3b13-4009-986c-5cd24c3fab00';
        const isOwner = email === 'contact@whimlets.com';
        setProfile({ id: authUserId, effectiveUserId: isOwner ? authUserId : OWNER_ID, email, role: 'user', stores: [] });
      }
    } catch (error) {
      console.error('❌ [AuthContext] Profile fetch error:', error);
      // Fallback to basic profile so UI doesn't break
      setProfile({ id: authUserId, effectiveUserId: authUserId, email, role: 'user', stores: [] });
    }
  };

  const refreshProfile = async () => {
    if (session?.user) {
      await fetchProfileAndSet(session.user.id, session.user.email || '');
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await supabase.auth.signOut();
    } finally {
      setSession(null);
      setProfile(null);
      setLoading(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    // Use only the listener - it handles initial session check automatically in v2
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, newSession) => {
      if (!mounted) return;
      
      console.log('🔔 [AuthContext] Auth Event:', event);
      setSession(newSession);

      if (newSession?.user) {
        // 1. Immediately stop blocking the UI if we have a user
        setLoading(false); 
        // 2. Load profile details in background
        fetchProfileAndSet(newSession.user.id, newSession.user.email || '');
      } else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, profile, loading, refreshProfile, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};