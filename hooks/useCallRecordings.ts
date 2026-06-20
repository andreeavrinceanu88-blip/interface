import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';

export interface CallRecording {
  id: number;
  user_id: string;
  created_at: string;
  duration_seconds: number | null;
  recording_url: string;
  phone_number: string | null;
  direction: string | null;
  store_name?: string;
  client_personal_id?: string | null;
  recording_transcript?: string | null;
  status?: string | null;
  type?: string | null;
}

async function fetchRecordingsByDateRange(
  userId: string,
  storeName: string,
  startDate: string,
  endDate: string,
  page: number,
  pageSize: number,
  searchQuery: string = '',
  statusFilter: string = 'all'
): Promise<{ data: CallRecording[], count: number }> {
  const cleanUserId = userId?.trim();
  const cleanStoreName = storeName?.trim();

  if (!cleanUserId || !cleanStoreName) {
    console.warn('⏳ [Recordings] Skipping fetch - missing userId or storeName.', { userId, storeName });
    return { data: [], count: 0 };
  }

  console.log('🎙️ [Recordings] Requesting data for Tab/Dashboard:', {
    user_id: cleanUserId,
    store: cleanStoreName,
    range: `${startDate} to ${endDate}`,
    page,
    pageSize,
    search: searchQuery || 'none',
    status: statusFilter
  });

  const startTimestamp = `${startDate}T00:00:00`;
  const endTimestamp = `${endDate}T23:59:59`;
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  try {
    let query = supabaseAdmin
      .from('call_recordings')
      .select('id,user_id,created_at,duration_seconds,recording_url,phone_number,direction,store_name,client_personal_id,recording_transcript,status,type', { count: 'exact' })
      .eq('user_id', cleanUserId)
      .eq('store_name', cleanStoreName);

    if (searchQuery && searchQuery.trim() !== '') {
      const term = searchQuery.trim();
      const isLettersOnly = /^[^\d]+$/.test(term);
      console.log(`🔍 [Recordings] Applying search filter for term: "${term}" (letters-only: ${isLettersOnly})`);
      if (isLettersOnly) {
        query = query.or(`client_personal_id.ilike.%${term}%,phone_number.ilike.%${term}%,recording_transcript.ilike.%${term}%`);
      } else {
        query = query.or(`client_personal_id.ilike.%${term}%,phone_number.ilike.%${term}%`);
      }
    } else {
      query = query.gte('created_at', startTimestamp)
        .lte('created_at', endTimestamp);
    }

    if (statusFilter && statusFilter !== 'all') {
      const statusMap: Record<string, string> = {
        'confirmata': 'Confirmata',
        'anulata': 'Anulata',
        'neraspuns': 'Neraspuns',
        'upsell': 'Upsell'
      };
      const dbStatus = statusMap[statusFilter] || (statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1));
      query = query.eq('status', dbStatus);
    }

    const { data, error, count } = await query
      .order('created_at', { ascending: false })
      .range(from, to);

    if (error) {
      console.error('❌ [Recordings] Supabase error during fetch:', error);
      throw error;
    }

    console.log(`✨ [Recordings] SUCCESS: Found ${data?.length || 0} items for current view. Total matching in DB: ${count}`);
    return { data: (data as CallRecording[]) || [], count: count || 0 };
  } catch (err) {
    console.error('💥 [Recordings] Critical fetch failure:', err);
    return { data: [], count: 0 };
  }
}

export const useCallRecordingsOptimized = (
  userId: string,
  storeName: string,
  startDate: string,
  endDate: string,
  page: number = 1,
  pageSize: number = 10,
  searchQuery: string = '',
  statusFilter: string = 'all'
) => {
  const queryClient = useQueryClient();
  const realtimeChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const query = useQuery({
    queryKey: ['call-recordings', 'range', userId, storeName, startDate, endDate, page, pageSize, searchQuery, statusFilter],
    queryFn: () => fetchRecordingsByDateRange(userId, storeName, startDate, endDate, page, pageSize, searchQuery, statusFilter),
    enabled: !!userId && !!storeName && (!!searchQuery || (!!startDate && !!endDate)),
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    refetchOnWindowFocus: true,
    refetchOnMount: true,
  });

  useEffect(() => {
    if (!userId || !query.data) return;

    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }

    const debouncedRefetch = () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
      debounceTimerRef.current = setTimeout(() => {
        console.log('🔄 [Recordings] Real-time notification received. Invaliding queries...');
        queryClient.invalidateQueries({ queryKey: ['call-recordings'] });
      }, 500);
    };

    const channel = supabaseAdmin
      .channel(`call_recordings_range_${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'call_recordings',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          if (payload.new && (payload.new as any).store_name === storeName) {
            debouncedRefetch();
          }
        }
      )
      .subscribe();

    realtimeChannelRef.current = channel;

    return () => {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      if (realtimeChannelRef.current) supabase.removeChannel(realtimeChannelRef.current);
    };
  }, [userId, queryClient, query.data, storeName]);

  return {
    recordings: query.data?.data || [],
    totalCount: query.data?.count || 0,
    loading: query.isLoading,
    isFetching: query.isFetching,
    error: query.error ? (query.error as Error).message : null,
    isRefetching: query.isRefetching,
    refetch: query.refetch,
  };
};
