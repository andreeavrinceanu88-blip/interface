import React, { useEffect, useState, useMemo } from 'react';
import { supabaseAdmin } from '../lib/supabaseClient';
import { useAuth } from '../contexts/AuthContext';

interface Profile {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
    role: string;
}

interface CallLog {
    id: number;
    operator_id: string;
    order_id: string | null;
    duration_secs: number;
    status: string | null;
    caller_id?: string | null;
    created_at: string;
}

interface OrderStat {
    processed_by: string;
    store_name?: string | null;
}

export default function Operatori() {
    const { profile } = useAuth();
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [orderStats, setOrderStats] = useState<OrderStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('7days');
    const [selectedStore, setSelectedStore] = useState<string>('all');
    const [isStoreDropdownOpen, setIsStoreDropdownOpen] = useState(false);

    const userStores = useMemo(() => {
        if (!profile?.stores) return ['Vitadomus', 'Tamtrend'];
        if (Array.isArray(profile.stores)) return profile.stores;
        return profile.stores.split(',').map((s: string) => s.trim()).filter(Boolean);
    }, [profile?.stores]);

    useEffect(() => {
        fetchData();
    }, [dateRange, selectedStore]);

    const fetchAllRows = async <T,>(
        fetchPage: (from: number, to: number) => Promise<{ data: T[] | null; error: any }>,
        pageSize = 1000
    ): Promise<T[]> => {
        const allRows: T[] = [];
        let from = 0;
        while (true) {
            const { data, error } = await fetchPage(from, from + pageSize - 1);
            if (error) {
                console.error('Error fetching page:', error);
                break;
            }
            if (!data || data.length === 0) break;
            allRows.push(...data);
            if (data.length < pageSize) break;
            from += pageSize;
        }
        return allRows;
    };

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch profiles
            const { data: profData, error: profErr } = await supabaseAdmin.from('profiles').select('id, full_name, avatar_url, role');
            if (profErr) throw profErr;

            // 2. Fetch call logs based on date with pagination (bypasses Supabase 1000 row limit)
            const callsData = await fetchAllRows<CallLog>((from, to) => {
                let callsQuery = supabaseAdmin
                    .from('call_logs')
                    .select('id, operator_id, order_id, duration_secs, status, caller_id, created_at');
                if (dateRange !== 'all') {
                    const now = new Date();
                    const past = new Date();
                    if (dateRange === 'today') past.setHours(0, 0, 0, 0);
                    else if (dateRange === '7days') past.setDate(now.getDate() - 7);
                    else if (dateRange === '30days') past.setDate(now.getDate() - 30);
                    callsQuery = callsQuery.gte('created_at', past.toISOString());
                }
                return callsQuery.order('id', { ascending: false }).range(from, to);
            });

            // 3. Filter call_logs by store if selectedStore !== 'all'
            let filteredCalls = callsData || [];
            if (selectedStore !== 'all' && callsData && callsData.length > 0) {
                const targetStore = selectedStore.toLowerCase();
                const uniqueOrderIds = [...new Set(callsData.map(l => l.order_id).filter(id => id && !id.startsWith('INBOUND:') && !id.startsWith('OUTBOUND:') && !id.startsWith('ERR:')))];
                
                const storeMap = new Map<string, string>();
                const chunks: (string | null)[][] = [];
                for (let i = 0; i < uniqueOrderIds.length; i += 500) {
                    chunks.push(uniqueOrderIds.slice(i, i + 500));
                }
                await Promise.all(chunks.map(async chunk => {
                    const { data: ords } = await supabaseAdmin.from('orders').select('id, order_id, store_name').in('order_id', chunk);
                    ords?.forEach(o => {
                        if (o.store_name) {
                            storeMap.set(String(o.order_id), o.store_name.toLowerCase());
                            storeMap.set(String(o.id), o.store_name.toLowerCase());
                        }
                    });
                }));

                filteredCalls = callsData.filter(l => {
                    let logStore: string | null = null;
                    if (l.order_id && storeMap.has(String(l.order_id))) {
                        logStore = storeMap.get(String(l.order_id))!;
                    } else if (l.caller_id) {
                        if (l.caller_id.includes('751') || l.caller_id.includes('312')) logStore = 'vitadomus';
                        else if (l.caller_id.includes('775') || l.caller_id.includes('373') || l.caller_id.includes('363')) logStore = 'tamtrend';
                    }
                    return logStore === targetStore;
                });
            }

            // 4. Fetch processed orders with pagination (bypasses Supabase 1000 row limit)
            const ordData = await fetchAllRows<OrderStat>((from, to) => {
                let ordersQuery = supabaseAdmin.from('orders').select('processed_by, store_name').not('processed_by', 'is', null);
                if (selectedStore !== 'all') {
                    ordersQuery = ordersQuery.ilike('store_name', selectedStore);
                }
                return ordersQuery.range(from, to);
            });

            setProfiles(profData || []);
            setCallLogs(filteredCalls);
            setOrderStats(ordData || []);
        } catch (err) {
            console.error('Error fetching operator stats:', err);
        } finally {
            setLoading(false);
        }
    };

    const statsByOperator = useMemo(() => {
        const stats: Record<string, {
            callsMade: number;
            callsAnswered: number;
            totalDuration: number;
            draftsProcessed: number;
        }> = {};

        profiles.forEach(p => {
            stats[p.id] = { callsMade: 0, callsAnswered: 0, totalDuration: 0, draftsProcessed: 0 };
        });

        callLogs.forEach(log => {
            if (stats[log.operator_id]) {
                stats[log.operator_id].callsMade += 1;
                const dur = log.duration_secs || 0;
                if (dur > 0) {
                    stats[log.operator_id].callsAnswered += 1;
                    stats[log.operator_id].totalDuration += dur;
                }
            }
        });

        orderStats.forEach(ord => {
            if (stats[ord.processed_by]) {
                stats[ord.processed_by].draftsProcessed += 1;
            }
        });

        return stats;
    }, [profiles, callLogs, orderStats]);

    const formatDuration = (secs: number) => {
        if (!secs) return '0s';
        const h = Math.floor(secs / 3600);
        const m = Math.floor((secs % 3600) / 60);
        const s = secs % 60;
        if (h > 0) return `${h}h ${m}m ${s}s`;
        if (m > 0) return `${m}m ${s}s`;
        return `${s}s`;
    };

    return (
        <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-light dark:text-white tracking-tight">Performanță Operatori</h2>
                    <p className="text-gray-400 font-light mt-1 text-sm md:text-base">Monitorizează eficiența echipei tale în preluarea drafturilor și apeluri.</p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    {/* Store Selector Dropdown */}
                    <div className="relative z-30">
                        <button
                            onClick={() => setIsStoreDropdownOpen(!isStoreDropdownOpen)}
                            className="bg-[#1a1b23] border border-white/10 px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-2.5 text-white hover:border-white/20 transition-all min-w-[170px] justify-between h-[38px] shadow-sm"
                        >
                            <div className="flex items-center gap-2 truncate">
                                <span className="material-icons-round text-base text-cyan-400">storefront</span>
                                <span className="truncate">
                                    {selectedStore === 'all' ? 'Toate magazinele' : selectedStore}
                                </span>
                            </div>
                            <span className={`material-icons-round text-lg text-gray-400 transition-transform ${isStoreDropdownOpen ? 'rotate-180' : ''}`}>
                                expand_more
                            </span>
                        </button>
                        {isStoreDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsStoreDropdownOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-full min-w-[190px] rounded-xl bg-[#13141a] border border-white/10 shadow-2xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                                    <button
                                        onClick={() => { setSelectedStore('all'); setIsStoreDropdownOpen(false); }}
                                        className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2.5 hover:bg-white/5 ${selectedStore === 'all' ? 'text-white bg-white/5 font-semibold' : 'text-gray-400'}`}
                                    >
                                        <span className={`w-2 h-2 rounded-full ${selectedStore === 'all' ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-transparent border border-gray-600'}`} />
                                        Toate magazinele
                                    </button>
                                    {userStores.map(store => (
                                        <button
                                            key={store}
                                            onClick={() => { setSelectedStore(store); setIsStoreDropdownOpen(false); }}
                                            className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-2.5 hover:bg-white/5 ${selectedStore.toLowerCase() === store.toLowerCase() ? 'text-white bg-white/5 font-semibold' : 'text-gray-400'}`}
                                        >
                                            <span className={`w-2 h-2 rounded-full ${selectedStore.toLowerCase() === store.toLowerCase() ? 'bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.5)]' : 'bg-transparent border border-gray-600'}`} />
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Date Range Buttons */}
                    <div className="flex bg-[#1a1b23] border border-white/10 rounded-xl overflow-hidden p-1">
                        <button onClick={() => setDateRange('today')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === 'today' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>Azi</button>
                        <button onClick={() => setDateRange('7days')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === '7days' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>7 Zile</button>
                        <button onClick={() => setDateRange('30days')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === '30days' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>30 Zile</button>
                        <button onClick={() => setDateRange('all')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === 'all' ? 'bg-cyan-500/20 text-cyan-400 font-semibold' : 'text-gray-400 hover:text-white'}`}>All-time</button>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="py-20 flex flex-col items-center justify-center gap-4">
                    <span className="material-icons-round text-cyan-500 animate-spin text-4xl">autorenew</span>
                    <p className="text-gray-400">Se încarcă datele...</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                    {profiles.map(profile => {
                        const s = statsByOperator[profile.id] || { callsMade: 0, callsAnswered: 0, totalDuration: 0, draftsProcessed: 0 };
                        const avgDuration = s.callsAnswered > 0 ? Math.round(s.totalDuration / s.callsAnswered) : 0;

                        return (
                            <div key={profile.id} className="bg-[#13141a] rounded-2xl border border-white/5 shadow-xl overflow-hidden flex flex-col group hover:border-white/10 transition-colors">
                                {/* Header / Profile info */}
                                <div className="p-6 flex items-center gap-4 border-b border-white/5 bg-gradient-to-r from-transparent to-white/[0.02]">
                                    {profile.avatar_url ? (
                                        <img src={profile.avatar_url} alt={profile.full_name || 'Operator'} className="w-14 h-14 rounded-full ring-2 ring-white/10 object-cover" />
                                    ) : (
                                        <div className="w-14 h-14 rounded-full ring-2 ring-cyan-500/30 bg-gradient-to-br from-cyan-600 to-blue-700 flex items-center justify-center text-white text-xl font-bold">
                                            {(profile.full_name || 'U')[0].toUpperCase()}
                                        </div>
                                    )}
                                    <div className="flex-1 min-w-0">
                                        <h3 className="text-lg font-medium text-white truncate">{profile.full_name || 'Utilizator Necunoscut'}</h3>
                                        <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-0.5 rounded-full bg-white/5 border border-white/10 text-xs text-gray-400">
                                            <span className={`w-1.5 h-1.5 rounded-full ${s.callsMade > 0 ? 'bg-green-500' : 'bg-gray-500'}`}></span>
                                            {profile.role === 'admin' ? 'Admin / Owner' : 'Operator'}
                                        </span>
                                    </div>
                                </div>

                                {/* Metrics Grid */}
                                <div className="p-6 grid grid-cols-2 gap-4 flex-1">
                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <span className="material-icons-round text-[16px] text-emerald-400">check_circle</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">Drafturi Procesate</span>
                                        </div>
                                        <span className="text-2xl font-bold text-white">{s.draftsProcessed}</span>
                                        <span className="text-[10px] text-gray-500">
                                            {selectedStore === 'all' ? 'Total all-time' : `${selectedStore} (all-time)`}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <span className="material-icons-round text-[16px] text-cyan-400">phone_callback</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">Apeluri Inițiate</span>
                                        </div>
                                        <span className="text-2xl font-bold text-white">{s.callsMade}</span>
                                        <span className="text-[10px] text-gray-500">
                                            {s.callsAnswered} răspunse ({s.callsMade > 0 ? Math.round((s.callsAnswered / s.callsMade) * 100) : 0}%)
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <span className="material-icons-round text-[16px] text-indigo-400">timer</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">Timp Total</span>
                                        </div>
                                        <span className="text-xl font-bold text-white">{formatDuration(s.totalDuration)}</span>
                                        <span className="text-[10px] text-gray-500">Convorbiri efective</span>
                                    </div>

                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <span className="material-icons-round text-[16px] text-amber-400">functions</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">Medie / Apel Răspuns</span>
                                        </div>
                                        <span className="text-xl font-bold text-white">{formatDuration(avgDuration)}</span>
                                        <span className="text-[10px] text-gray-500">
                                            {s.callsAnswered > 0 ? `${s.callsAnswered} apeluri conectate` : 'Niciun apel răspuns'}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
