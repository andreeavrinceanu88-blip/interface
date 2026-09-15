import { useQuery } from '@tanstack/react-query';
import { supabaseAdmin } from '../lib/supabaseClient';

export type ChartPeriod = 'day' | 'week' | 'month';

interface ChartDataPoint {
  name: string;
  calls: number;
  orders: number;
  drafts: number;
  sales: number;
  fullDate?: string; // For sorting/merging
}

async function fetchChartData(userId: string, storeName: string, period: ChartPeriod): Promise<ChartDataPoint[]> {
  if (!userId || !storeName) return [];
  
  console.log('📉 [ChartData] Aggregating chart (real-time) for:', { user_id: userId, store: storeName, period });

  const now = new Date();
  let startDate = new Date();
  let dateFormat: Intl.DateTimeFormatOptions = { weekday: 'short' };

  if (period === 'day') {
    startDate.setHours(0, 0, 0, 0); 
    dateFormat = { hour: '2-digit', minute: '2-digit' };
  } else if (period === 'week') {
    startDate.setDate(now.getDate() - 7);
    dateFormat = { weekday: 'short' };
  } else if (period === 'month') {
    startDate.setDate(now.getDate() - 30);
    dateFormat = { day: '2-digit', month: 'short' };
  }

  const startIso = startDate.toISOString();

  // Fetch call_logs for this period
  const { data: callLogs, error: clErr } = await supabaseAdmin
    .from('call_logs')
    .select('order_id, status, created_at')
    .gte('created_at', startIso);

  // Fetch orders for this store in period
  const { data: orders, error: ordErr } = await supabaseAdmin
    .from('orders')
    .select('id, order_id, store_name, status, value, type, created_at')
    .ilike('store_name', storeName)
    .gte('created_at', startIso);

  if (clErr || ordErr) {
    console.error('❌ [ChartData] Error pulling data:', { clErr, ordErr });
  }

  // Build order_id set for this store
  const orderIdSet = new Set<string>();
  orders?.forEach(o => {
    orderIdSet.add(String(o.order_id));
    orderIdSet.add(String(o.id));
  });

  // Filter call_logs to this store
  const storeCalls = (callLogs || []).filter(cl => cl.order_id && orderIdSet.has(cl.order_id));

  console.log(`📊 [ChartData] Pulled ${storeCalls.length} store calls and ${orders?.length || 0} orders for analysis.`);

  const groupedData: Record<string, ChartDataPoint> = {};

  if (period === 'day') {
    for (let i = 0; i < 24; i++) {
      const d = new Date(startDate);
      d.setHours(i, 0, 0, 0);
      const key = d.getHours().toString().padStart(2, '0') + ':00';
      groupedData[key] = { name: key, calls: 0, orders: 0, drafts: 0, sales: 0 };
    }
  } else {
    const days = period === 'week' ? 7 : 30;
    for (let i = 0; i <= days; i++) {
       const d = new Date(startDate);
       d.setDate(d.getDate() + i);
       const key = d.toISOString().split('T')[0];
       const name = d.toLocaleDateString('ro-RO', dateFormat);
       groupedData[key] = { name, calls: 0, orders: 0, drafts: 0, sales: 0, fullDate: key };
    }
  }

  const getBucketKey = (dateStr: string) => {
    const d = new Date(dateStr);
    if (period === 'day') return d.getHours().toString().padStart(2, '0') + ':00';
    return dateStr.split('T')[0];
  };

  storeCalls.forEach(cl => {
    const key = getBucketKey(cl.created_at);
    if (groupedData[key]) groupedData[key].calls += 1;
  });

  (orders || []).forEach(ord => {
    const key = getBucketKey(ord.created_at);
    if (groupedData[key]) {
      if (ord.status === 'confirmat') {
        groupedData[key].orders += 1;
        groupedData[key].sales += (ord.value || 0);
      }
      if (ord.type === 'draft' || ord.type === 'Noi') {
        groupedData[key].drafts += 1;
      }
    }
  });

  let result = Object.values(groupedData);
  if (period === 'day') {
    result.sort((a, b) => parseInt(a.name) - parseInt(b.name));
  } else {
    result.sort((a, b) => (a.fullDate && b.fullDate ? a.fullDate.localeCompare(b.fullDate) : 0));
  }
  
  return result;
}

export const useChartData = (userId: string, storeName: string, period: ChartPeriod) => {
  return useQuery({
    queryKey: ['chart-data', userId, storeName, period],
    queryFn: () => fetchChartData(userId, storeName, period),
    enabled: !!userId && !!storeName,
    staleTime: 60 * 1000,
  });
};

