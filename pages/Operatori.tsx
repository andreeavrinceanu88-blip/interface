import React, { useEffect, useState, useMemo } from 'react';
import { supabaseAdmin } from '../lib/supabaseClient';

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
    duration_decs: number;
    status: string | null;
    created_at: string;
}

interface OrderStat {
    processed_by: string;
}

export default function Operatori() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [callLogs, setCallLogs] = useState<CallLog[]>([]);
    const [orderStats, setOrderStats] = useState<OrderStat[]>([]);
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState<'today' | '7days' | '30days' | 'all'>('today');

    useEffect(() => {
        fetchData();
    }, [dateRange]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Fetch profiles
            const { data: profData, error: profErr } = await supabaseAdmin.from('profiles').select('id, full_name, avatar_url, role');
            if (profErr) throw profErr;

            // 2. Fetch call logs based on date
            let callsQuery = supabaseAdmin.from('call_logs').select('*');
            if (dateRange !== 'all') {
                const now = new Date();
                const past = new Date();
                if (dateRange === 'today') past.setHours(0, 0, 0, 0);
                else if (dateRange === '7days') past.setDate(now.getDate() - 7);
                else if (dateRange === '30days') past.setDate(now.getDate() - 30);
                callsQuery = callsQuery.gte('created_at', past.toISOString());
            }
            const { data: callsData, error: callsErr } = await callsQuery;
            if (callsErr && callsErr.code !== 'PGRST204') { // Ignore missing column gracefully
                console.error("Calls fetch error:", callsErr);
            }

            // 3. Fetch processed orders (we don't have processed_at, so we just fetch all-time, or if we do, we can't filter easily. We'll fetch all)
            const { data: ordData, error: ordErr } = await supabaseAdmin.from('orders').select('processed_by').not('processed_by', 'is', null);
            if (ordErr) console.error("Orders fetch error:", ordErr);

            setProfiles(profData || []);
            setCallLogs(callsData || []);
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
            totalDuration: number;
            draftsProcessed: number;
        }> = {};

        profiles.forEach(p => {
            stats[p.id] = { callsMade: 0, totalDuration: 0, draftsProcessed: 0 };
        });

        callLogs.forEach(log => {
            if (stats[log.operator_id]) {
                stats[log.operator_id].callsMade += 1;
                stats[log.operator_id].totalDuration += (log.duration_decs || 0);
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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                    <h2 className="text-2xl md:text-3xl font-light dark:text-white tracking-tight">Performanță Operatori</h2>
                    <p className="text-gray-400 font-light mt-1 text-sm md:text-base">Monitorizează eficiența echipei tale în preluarea drafturilor și apeluri.</p>
                </div>

                <div className="flex bg-[#1a1b23] border border-white/10 rounded-xl overflow-hidden p-1">
                    <button onClick={() => setDateRange('today')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === 'today' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>Azi</button>
                    <button onClick={() => setDateRange('7days')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === '7days' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>7 Zile</button>
                    <button onClick={() => setDateRange('30days')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === '30days' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>30 Zile</button>
                    <button onClick={() => setDateRange('all')} className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${dateRange === 'all' ? 'bg-cyan-500/20 text-cyan-400' : 'text-gray-400 hover:text-white'}`}>All-time</button>
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
                        const s = statsByOperator[profile.id] || { callsMade: 0, totalDuration: 0, draftsProcessed: 0 };
                        const avgDuration = s.callsMade > 0 ? Math.round(s.totalDuration / s.callsMade) : 0;

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
                                        <span className="text-[10px] text-gray-500">Total all-time</span>
                                    </div>

                                    <div className="flex flex-col gap-1 p-3 rounded-xl bg-black/20 border border-white/5">
                                        <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                                            <span className="material-icons-round text-[16px] text-cyan-400">phone_callback</span>
                                            <span className="text-xs font-medium uppercase tracking-wider">Apeluri Inițiate</span>
                                        </div>
                                        <span className="text-2xl font-bold text-white">{s.callsMade}</span>
                                        <span className="text-[10px] text-gray-500">Filtrat ({dateRange})</span>
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
                                            <span className="text-xs font-medium uppercase tracking-wider">Medie/Apel</span>
                                        </div>
                                        <span className="text-xl font-bold text-white">{formatDuration(avgDuration)}</span>
                                        <span className="text-[10px] text-gray-500">Durată per apel</span>
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
