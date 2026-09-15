import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '../lib/supabaseClient';
import { queryKeys } from '../lib/queryClient';

export interface UseDashboardMetricsProps {
  storeName?: string;
}

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
      console.log('📈 [Metrics] Querying call_logs + orders (real-time) for:', { user_id: userId, store_name: storeName });
      
      // 1. Fetch all call_logs
      const { data: callLogs, error: clErr } = await supabaseAdmin
        .from('call_logs')
        .select('order_id, status, duration_secs, call_direction');
      
      if (clErr) {
        console.error('❌ [Metrics] call_logs error:', clErr);
        return null;
      }

      // 2. Fetch orders for this store
      const { data: orders, error: ordErr } = await supabaseAdmin
        .from('orders')
        .select('id, order_id, store_name, status, value, type')
        .ilike('store_name', storeName);
      
      if (ordErr) {
        console.error('❌ [Metrics] orders error:', ordErr);
        return null;
      }

      // Build order_id set for this store
      const orderIdSet = new Set<string>();
      orders?.forEach(o => {
        orderIdSet.add(String(o.order_id));
        orderIdSet.add(String(o.id));
      });

      // Filter call_logs that belong to this store
      const storeCalls = (callLogs || []).filter(cl => cl.order_id && orderIdSet.has(cl.order_id));

      // Count inbound calls
      const inboundCalls = (callLogs || []).filter(cl => 
        cl.call_direction === 'inbound' || (cl.order_id && cl.order_id.startsWith('INBOUND:'))
      );

      // Calculate call metrics
      const totalApeluri = storeCalls.length;
      const apeluriInitiate = storeCalls.filter(cl => cl.call_direction !== 'inbound').length;
      const apeluriPrimite = inboundCalls.length;
      const completed = storeCalls.filter(cl => cl.status === 'completed');
      const totalDurationSecs = completed.reduce((sum, cl) => sum + (cl.duration_secs || 0), 0);
      const minuteConsumate = Math.round(totalDurationSecs / 60);
      const rataConversie = totalApeluri > 0 ? Math.round((completed.length / totalApeluri) * 100) : 0;

      // Calculate order metrics
      const totalComenzi = orders?.length || 0;
      const confirmate = orders?.filter(o => o.status === 'confirmat') || [];
      const comenziConfirmate = confirmate.length;
      const vanzariGenerate = confirmate.reduce((sum, o) => sum + (o.value || 0), 0);
      
      // Draft conversion rate
      const drafts = orders?.filter(o => o.type === 'draft' || o.type === 'Noi') || [];
      const draftsConfirmate = drafts.filter(o => o.status === 'confirmat');
      const rataDrafturi = drafts.length > 0 ? Math.round((draftsConfirmate.length / drafts.length) * 100) : 0;

      // Cosuri abandonate / recuperate
      const cosuri = orders?.filter(o => o.type === 'abandoned_checkout' || o.type === 'Coșuri') || [];
      const cosuriRecuperate = cosuri.filter(o => o.status === 'confirmat').length;

      const metrics: CallMetrics = {
        id: 0,
        user_id: userId,
        created_at: new Date().toISOString(),
        total_apeluri: totalApeluri,
        apeluri_initiate: apeluriInitiate,
        apeluri_primite: apeluriPrimite,
        rata_conversie: rataConversie,
        rata_conversie_drafturi: rataDrafturi,
        minute_consumate: minuteConsumate,
        total_comenzi: totalComenzi,
        cosuri_abandonate: cosuri.length,
        cosuri_recuperate: cosuriRecuperate,
        vanzari_generate: vanzariGenerate,
        vanzari_upsell: 0,
        comenzi_confirmate: comenziConfirmate,
        store_name: storeName,
        nume_admin: undefined,
      };
      
      console.log('✅ [Metrics] Successfully calculated real-time metrics:', metrics);
      return metrics;
  } catch (err) {
      console.error('💥 [Metrics] Unexpected error:', err);
      return null;
  }
}

async function fetchMetricsHistory(userId: string, storeName: string, days: number = 7): Promise<CallMetrics[]> {
  if (!userId || !storeName) return [];
  try {
      console.log(`📊 [Metrics] Fetching real-time history for Store: ${storeName}`);
      
      const now = new Date();
      const startDate = new Date();
      startDate.setDate(now.getDate() - days);
      const startIso = startDate.toISOString();

      // Fetch call_logs for this period
      const { data: callLogs } = await supabaseAdmin
        .from('call_logs')
        .select('order_id, status, duration_secs, call_direction, created_at')
        .gte('created_at', startIso);

      // Fetch orders for this store
      const { data: orders } = await supabaseAdmin
        .from('orders')
        .select('id, order_id, store_name, status, value, created_at')
        .ilike('store_name', storeName)
        .gte('created_at', startIso);

      // Build order_id set
      const orderIdSet = new Set<string>();
      orders?.forEach(o => {
        orderIdSet.add(String(o.order_id));
        orderIdSet.add(String(o.id));
      });

      // Group by day
      const byDay: Record<string, { calls: any[], orders: any[] }> = {};
      for (let i = 0; i <= days; i++) {
        const d = new Date(startDate);
        d.setDate(d.getDate() + i);
        byDay[d.toISOString().slice(0, 10)] = { calls: [], orders: [] };
      }

      (callLogs || []).forEach(cl => {
        if (!cl.order_id || !orderIdSet.has(cl.order_id)) return;
        const day = cl.created_at.slice(0, 10);
        if (byDay[day]) byDay[day].calls.push(cl);
      });

      (orders || []).forEach(o => {
        const day = o.created_at.slice(0, 10);
        if (byDay[day]) byDay[day].orders.push(o);
      });

      const history: CallMetrics[] = Object.entries(byDay).sort().map(([day, data]) => {
        const completedCalls = data.calls.filter((cl: any) => cl.status === 'completed');
        const confirmateOrders = data.orders.filter((o: any) => o.status === 'confirmat');
        return {
          id: 0,
          user_id: userId,
          created_at: day + 'T12:00:00Z',
          total_apeluri: data.calls.length,
          apeluri_initiate: data.calls.length,
          apeluri_primite: 0,
          rata_conversie: data.calls.length > 0 ? Math.round((completedCalls.length / data.calls.length) * 100) : 0,
          rata_conversie_drafturi: 0,
          minute_consumate: Math.round(completedCalls.reduce((s: number, cl: any) => s + (cl.duration_secs || 0), 0) / 60),
          total_comenzi: data.orders.length,
          cosuri_abandonate: 0,
          cosuri_recuperate: 0,
          vanzari_generate: confirmateOrders.reduce((s: number, o: any) => s + (o.value || 0), 0),
          vanzari_upsell: 0,
          comenzi_confirmate: confirmateOrders.length,
          store_name: storeName,
        };
      });

      return history;
  } catch (err) {
      console.error('💥 [Metrics] Unexpected history error:', err);
      return [];
  }
}

export const useDashboardMetrics = (userId: string, storeName: string) => {
  const latestQuery = useQuery({
    queryKey: queryKeys.dashboard.latest(userId!, storeName!),
    queryFn: () => fetchLatestMetrics(userId!, storeName!),
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

