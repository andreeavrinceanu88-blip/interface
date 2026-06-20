import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '../lib/supabaseClient';
import { queryKeys } from '../lib/queryClient';

export interface CallMetrics {
  id: number;
  user_id: string;
  created_at: string;
  total_apeluri: number;
  apeluri_initiate: number;
  apeluri_primite: number;
  rata_conversie: number;
  rata_conversie_drafturi: number;
  minute_consumate: number;
  total_comenzi: number;
  cosuri_abandonate: number;
  cosuri_recuperate: number;
  vanzari_generate: number;
  vanzari_upsell: number;
  comenzi_confirmate: number;
  store_name?: string;
  nume_admin?: string;
}

async function fetchLatestMetrics(userId: string, storeName: string): Promise<CallMetrics | null> {
  if (!userId || !storeName) {
      console.warn('⏳ [Metrics] Skipping fetch - missing userId or storeName.');
      return null;
  }
  
  try {
      console.log('📈 [Metrics] Querying call_metrics for:', { user_id: userId, store_name: storeName });
      
      const { data, error } = await supabaseAdmin
        .from('call_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('store_name', storeName)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) {
        console.error('❌ [Metrics] Supabase error:', error);
        return null;
      }
      
      if (data) {
          console.log('✅ [Metrics] Successfully pulled metrics:', data);
      } else {
          console.warn(`👀 [Metrics] No record found for User: ${userId} and Store: ${storeName}`);
      }
      return data;
  } catch (err) {
      console.error('💥 [Metrics] Unexpected error:', err);
      return null;
  }
}

async function fetchMetricsHistory(userId: string, storeName: string, days: number = 7): Promise<CallMetrics[]> {
  if (!userId || !storeName) return [];
  try {
      console.log(`📊 [Metrics] Fetching history for Store: ${storeName}`);
      const { data, error } = await supabaseAdmin
        .from('call_metrics')
        .select('*')
        .eq('user_id', userId)
        .eq('store_name', storeName)
        .order('created_at', { ascending: false })
        .limit(days);

      if (error) {
          console.error('❌ [Metrics] History fetch error:', error);
          return [];
      }
      return (data || []).reverse();
  } catch (err) {
      console.error('💥 [Metrics] Unexpected history error:', err);
      return [];
  }
}

export const useDashboardMetrics = (userId: string, storeName: string) => {
  const latestQuery = useQuery({
    queryKey: queryKeys.dashboard.latest(userId, storeName),
    queryFn: () => fetchLatestMetrics(userId, storeName),
    enabled: !!userId && !!storeName,
    staleTime: 30_000, 
    retry: 1, 
  });

  const historyQuery = useQuery({
    queryKey: queryKeys.dashboard.history(userId, storeName),
    queryFn: () => fetchMetricsHistory(userId, storeName),
    enabled: !!userId && !!storeName,
    staleTime: 5 * 60_000,
    retry: 1,
  });

  return {
    latestMetrics: latestQuery.data,
    historyMetrics: historyQuery.data || [],
    loading: latestQuery.isLoading,
    historyLoading: historyQuery.isLoading,
    error: latestQuery.error || historyQuery.error,
  };
};
