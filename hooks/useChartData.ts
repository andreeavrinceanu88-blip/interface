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
  
  console.log('📉 [ChartData] Aggregating chart for:', { user_id: userId, store: storeName, period });

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

  const { data: recordings, error: recError } = await supabaseAdmin
    .from('call_recordings')
    .select('created_at')
    .eq('user_id', userId)
    .eq('store_name', storeName)
    .gte('created_at', startIso);

  const { data: metrics, error: metError } = await supabaseAdmin
    .from('call_metrics')
    .select('created_at, comenzi_confirmate, cosuri_abandonate, vanzari_generate')
    .eq('user_id', userId)
    .eq('store_name', storeName)
    .gte('created_at', startIso);

  if (recError || metError) {
    console.error('❌ [ChartData] Error pulling raw data:', { recError, metError });
  }

  console.log(`📊 [ChartData] Pulled ${recordings?.length || 0} recordings and ${metrics?.length || 0} metric records for analysis.`);

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

  (recordings || []).forEach(rec => {
    const key = getBucketKey(rec.created_at);
    if (groupedData[key]) groupedData[key].calls += 1;
  });

  (metrics || []).forEach(met => {
    const key = getBucketKey(met.created_at);
    if (groupedData[key]) {
      groupedData[key].orders += met.comenzi_confirmate || 0;
      groupedData[key].drafts += met.cosuri_abandonate || 0;
      groupedData[key].sales += met.vanzari_generate || 0;
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
