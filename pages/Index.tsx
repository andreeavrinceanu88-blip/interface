import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useDashboardMetrics } from '../hooks/useDashboardMetrics';
import { useCallRecordingsOptimized } from '../hooks/useCallRecordings';
import { useChartData, ChartPeriod } from '../hooks/useChartData';
import { useAuth } from '../contexts/AuthContext';

const Index = () => {
    const { profile, loading: authLoading } = useAuth();
    const userId = profile?.id || '';
    const userStores = profile?.stores || [];
    
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);

    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);
    
    const { latestMetrics, historyMetrics, loading: metricsLoading } = useDashboardMetrics(userId, selectedBrand);
    
    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);
    const [chartPeriod, setChartPeriod] = useState<ChartPeriod>('week');
    
    const { data: chartData, isLoading: isChartLoading } = useChartData(userId, selectedBrand, chartPeriod);

    const { recordings: recentRecordings, loading: recordingsLoading } = useCallRecordingsOptimized(
        userId,
        selectedBrand,
        startDate,
        endDate,
        1,
        3
    );

    const isInitialLoading = metricsLoading && !latestMetrics;

    if (authLoading) return null;

    // Wait for profile to load before showing the "No stores" error
    if (!profile && !authLoading) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh]">
                <span className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></span>
            </div>
        );
    }

    if (userStores.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-[70vh] text-center">
                <span className="material-icons-round text-6xl text-gray-700 mb-4 p-4 rounded-full bg-surface-dark-lighter border border-white/5">storefront</span>
                <h2 className="text-2xl font-light text-white mb-2">Niciun magazin configurat</h2>
                <p className="text-gray-500 max-w-md font-light">Contactați echipa Nanoassist pentru a configura accesul la magazine.</p>
            </div>
        );
    }

    const conversionRate = latestMetrics?.rata_conversie || 0;
    const abandonedRate = 100 - conversionRate;
    const conversionData = [
        { name: 'Finalizate', value: conversionRate },
        { name: 'Abandonate', value: abandonedRate < 0 ? 0 : abandonedRate },
    ];
    const conversionColors = ['#00d2ff', '#374151'];

    const draftConversionRate = latestMetrics?.rata_conversie_drafturi || 0;
    const draftAbandonedRate = 100 - draftConversionRate;
    const draftData = [
        { name: 'Finalizate', value: draftConversionRate },
        { name: 'Abandonate', value: draftAbandonedRate < 0 ? 0 : draftAbandonedRate },
    ];
    const draftColors = ['#10b981', '#374151'];

    const totalComenzi = latestMetrics?.total_comenzi || 0;
    const cosuriRecuperate = latestMetrics?.cosuri_recuperate || 0;
    const comenziConfirmate = latestMetrics?.comenzi_confirmate || 0; 
    const vanzariGenerate = latestMetrics?.vanzari_generate || 0;
    const vanzariUpsell = latestMetrics?.vanzari_upsell || 0;

    const displayValue = (val: number | string) => isInitialLoading ? '...' : val;

    const formatDuration = (seconds: number | null) => {
        if (!seconds) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleString('ro-RO', { hour: '2-digit', minute: '2-digit' });
    };

    return (
        <>
            <div className="mb-6 flex flex-col gap-3">
                <div>
                    <h2 className="text-2xl md:text-3xl font-light dark:text-white tracking-tight">Bine ai revenit, {latestMetrics?.nume_admin || profile?.full_name || 'Utilizator'}!</h2>
                </div>
                <div className="flex flex-wrap gap-2 relative z-50">
                    <div className="flex items-center gap-1 bg-[#13141a] p-1 rounded-xl border border-white/5 shadow-inner flex-1 min-w-0">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="flex-1 min-w-0 pl-2 pr-1 py-2 bg-transparent text-gray-200 text-xs md:text-sm border-none focus:ring-0 cursor-pointer font-num outline-none" />
                        <span className="text-gray-600 flex-shrink-0">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="flex-1 min-w-0 pl-1 pr-2 py-2 bg-transparent text-gray-200 text-xs md:text-sm border-none focus:ring-0 cursor-pointer font-num outline-none" />
                    </div>

                    <div className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="btn-3d-secondary px-3 md:px-5 py-2.5 rounded-xl text-sm font-normal flex items-center gap-2 hover:text-white transition-all min-w-[140px] justify-between h-[42px]">
                            <div className="flex items-center gap-2">
                                <span className="material-icons-round text-lg text-primary">store</span>
                                <span className="text-sm truncate max-w-[80px] md:max-w-none">{selectedBrand || 'Selectează'}</span>
                            </div>
                            <span className={`material-icons-round text-xl transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-full rounded-xl bg-[#13141a] border border-white/5 shadow-xl z-50 overflow-hidden backdrop-blur-xl animate-in fade-in zoom-in-95 duration-100">
                                    {userStores.map((store) => (
                                        <button key={store} onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }} className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center gap-3 hover:bg-white/5 ${selectedBrand === store ? 'text-white bg-white/5' : 'text-gray-400'}`}>
                                            <span className={`w-2 h-2 rounded-full ${selectedBrand === store ? 'bg-primary shadow-[0_0_8px_rgba(0,210,255,0.5)]' : 'bg-transparent border border-gray-600'}`}></span>
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-5 gap-3 md:gap-4 mb-6 md:mb-8">
                {/* ROAS bars (NEW) */}
                <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="relative z-10 h-full flex items-end justify-around pt-2">
                        {/* Initial ROAS */}
                        <div className="flex flex-col items-center gap-3 h-full justify-end w-1/2">
                            <span className="text-sm md:text-base font-medium text-white">{(latestMetrics as any)?.roas_initial || '3.5'}x</span>
                            <div className="w-10 md:w-12 h-32 md:h-40 bg-[#13141a] rounded-full overflow-hidden border border-white/5 relative flex flex-col justify-end">
                                <div className="w-full bg-blue-500 rounded-full" style={{ height: '40%' }}></div>
                            </div>
                            <p className="text-[10px] md:text-sm text-gray-400 font-light text-center">Inițial</p>
                        </div>
                        {/* Robot ROAS */}
                        <div className="flex flex-col items-center gap-3 h-full justify-end w-1/2">
                            <span className="text-sm md:text-base font-medium text-emerald-400">{(latestMetrics as any)?.roas_robot || '6.8'}x</span>
                            <div className="w-10 md:w-12 h-32 md:h-40 bg-[#13141a] rounded-full overflow-hidden border border-emerald-500/20 shadow-[0_0_10px_rgba(16,185,129,0.2)] relative flex flex-col justify-end">
                                <div className="w-full bg-emerald-500 rounded-full" style={{ height: '80%' }}></div>
                            </div>
                            <p className="text-[10px] md:text-sm text-emerald-400 font-light text-center">Robot</p>
                        </div>
                    </div>
                </div>

                {/* 3 small stat cards */}
                <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="relative z-10">
                        <div className="icon-cart-v3 mb-2 md:mb-4" style={{ width: '36px', height: '36px', borderRadius: '10px' }}><span className="material-icons-round icon-cart-v3-symbol" style={{ fontSize: '20px' }}>shopping_cart</span></div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-light mb-1">Comenzi Totale</p>
                        <h3 className="text-xl md:text-3xl font-light dark:text-white tracking-tight font-num glow-text">{displayValue(totalComenzi.toLocaleString())}</h3>
                    </div>
                </div>
                <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="relative z-10">
                        <div className="icon-cart-v3 mb-2 md:mb-4" style={{ width: '36px', height: '36px', borderRadius: '10px' }}><span className="material-icons-round icon-symbol-blue" style={{ fontSize: '20px' }}>check_circle</span></div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-light mb-1">Coșuri Recuperate</p>
                        <h3 className="text-xl md:text-3xl font-light dark:text-white tracking-tight font-num glow-text">{displayValue(cosuriRecuperate.toLocaleString())}</h3>
                    </div>
                </div>
                <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl relative overflow-hidden group hover:-translate-y-1 transition-transform">
                    <div className="relative z-10">
                        <div className="icon-cart-v3 mb-2 md:mb-4" style={{ width: '36px', height: '36px', borderRadius: '10px' }}><span className="material-icons-round icon-symbol-emerald" style={{ fontSize: '20px' }}>verified</span></div>
                        <p className="text-[10px] md:text-xs text-gray-400 font-light mb-1">Comenzi Confirmate</p>
                        <h3 className="text-xl md:text-3xl font-light dark:text-white tracking-tight font-num glow-text">{displayValue(comenziConfirmate.toLocaleString())}</h3>
                    </div>
                </div>
                {/* Sales cards */}
                <div className="col-span-1 md:col-span-1 grid grid-cols-2 md:grid-cols-1 gap-3">
                    <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl bg-gradient-to-b from-[#090a0e] from-10% via-[#001f3f] to-[#006bb3] text-white group hover:-translate-y-1 transition-transform relative overflow-hidden flex flex-col">
                        <div className="relative z-10 flex-shrink-0">
                            <div className="icon-cart-v3 mb-2" style={{ width: '36px', height: '36px', borderRadius: '10px' }}><span className="material-icons-round icon-symbol-laser-blue" style={{ fontSize: '20px' }}>payments</span></div>
                            <p className="text-[10px] md:text-xs text-cyan-200 font-light mb-1">Vânzări Generate</p>
                            <h3 className="text-lg md:text-2xl font-light font-num glow-text">{displayValue(metricsLoading && !latestMetrics ? '...' : `${vanzariGenerate.toLocaleString()} RON`)}</h3>
                        </div>
                        <div className="relative flex-1 mt-2 -mx-3 md:-mx-5 -mb-3 md:-mb-5 min-h-[60px] opacity-70">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyMetrics && historyMetrics.length > 0 ? historyMetrics : [{vanzari_generate: 0}, {vanzari_generate: vanzariGenerate}]}>
                                    <defs><linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d2ff" stopOpacity={0.6}/><stop offset="95%" stopColor="#00d2ff" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(22, 24, 34, 0.9)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="vanzari_generate" name="Vânzări" stroke="#00d2ff" strokeWidth={2} fillOpacity={1} fill="url(#colorSales)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div className="widget-sculpted-3d p-3 md:p-5 rounded-2xl bg-gradient-to-b from-[#090a0e] from-10% via-[#0d2d1a] to-[#1a5c34] text-white group hover:-translate-y-1 transition-transform relative overflow-hidden flex flex-col">
                        <div className="relative z-10 flex-shrink-0">
                            <div className="icon-cart-v3 mb-2" style={{ width: '36px', height: '36px', borderRadius: '10px' }}><span className="material-icons-round icon-symbol-emerald" style={{ fontSize: '20px' }}>trending_up</span></div>
                            <p className="text-[10px] md:text-xs text-emerald-200 font-light mb-1">Vânzări Upsell</p>
                            <h3 className="text-lg md:text-2xl font-light font-num glow-text">{displayValue(metricsLoading && !latestMetrics ? '...' : `${vanzariUpsell.toLocaleString()} RON`)}</h3>
                        </div>
                        <div className="relative flex-1 mt-2 -mx-3 md:-mx-5 -mb-3 md:-mb-5 min-h-[60px] opacity-70">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={historyMetrics && historyMetrics.length > 0 ? historyMetrics : [{vanzari_upsell: 0}, {vanzari_upsell: vanzariUpsell}]}>
                                    <defs><linearGradient id="colorUpsell" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#10b981" stopOpacity={0.6}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(22, 24, 34, 0.9)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="vanzari_upsell" name="Upsell" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorUpsell)" isAnimationActive={false} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 mb-6 md:mb-8">
                <div className="md:col-span-2 card-depth p-4 md:p-6 rounded-2xl">
                    <div className="flex justify-between items-center mb-4 md:mb-6">
                        <h3 className="text-lg md:text-xl font-light dark:text-white tracking-tight">Volum</h3>
                        <div className="flex p-1 bg-surface-dark-lighter rounded-xl border border-white/5">
                            {['day', 'week', 'month'].map((p) => (
                                <button key={p} onClick={() => setChartPeriod(p as ChartPeriod)} className={`px-3 md:px-4 py-1.5 text-xs rounded-lg transition-colors capitalize ${chartPeriod === p ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'}`}>
                                    {p === 'day' ? 'Zi' : p === 'week' ? 'Săpt.' : 'Lună'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="h-48 md:h-64 w-full">
                        <ResponsiveContainer width="100%" height="100%">
                            {isChartLoading ? <div className="flex items-center justify-center h-full text-gray-500 font-light">Se încarcă graficul...</div> :
                                <AreaChart data={chartData || []}>
                                    <defs><linearGradient id="colorCalls" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#00d2ff" stopOpacity={0.6}/><stop offset="95%" stopColor="#00d2ff" stopOpacity={0}/></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="0" vertical={false} stroke="rgba(255,255,255,0.03)" />
                                    <XAxis dataKey="name" tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} />
                                    <YAxis tick={{fill: '#6b7280', fontSize: 11}} axisLine={false} tickLine={false} />
                                    <Tooltip contentStyle={{ backgroundColor: 'rgba(22, 24, 34, 0.9)', borderColor: 'rgba(255, 255, 255, 0.1)', color: '#fff', borderRadius: '12px' }} />
                                    <Area type="monotone" dataKey="calls" name="Apeluri" stroke="#00d2ff" strokeWidth={3} fillOpacity={1} fill="url(#colorCalls)" />
                                </AreaChart>
                            }
                        </ResponsiveContainer>
                    </div>
                </div>
                <div className="md:col-span-1 card-depth p-4 md:p-6 rounded-2xl flex flex-col">
                    <h3 className="text-lg md:text-xl font-light dark:text-white mb-4">Conversie Drafturi</h3>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
                            <div style={{ filter: 'drop-shadow(0 0 10px #10b981) drop-shadow(0 0 22px rgba(16,185,129,0.45))' }} className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart><Pie data={draftData} innerRadius={56} outerRadius={70} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>{draftData.map((_, index) => <Cell key={`cell-${index}`} fill={draftColors[index]} />)}</Pie></PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center flex-col z-20">
                                <span className="text-2xl md:text-3xl font-light dark:text-white font-num" style={{ textShadow: '0 0 16px rgba(16,185,129,0.7)' }}>{displayValue(draftConversionRate.toFixed(2))}%</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="md:col-span-1 card-depth p-4 md:p-6 rounded-2xl flex flex-col">
                    <h3 className="text-lg md:text-xl font-light dark:text-white mb-4">Conversie Upsell</h3>
                    <div className="flex-1 flex items-center justify-center">
                        <div className="relative w-40 h-40 md:w-48 md:h-48 flex items-center justify-center">
                            <div style={{ filter: 'drop-shadow(0 0 10px #00d2ff) drop-shadow(0 0 22px rgba(0,210,255,0.45))' }} className="absolute inset-0">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart><Pie data={conversionData} innerRadius={56} outerRadius={70} dataKey="value" stroke="none" startAngle={90} endAngle={-270}>{conversionData.map((_, index) => <Cell key={`cell-${index}`} fill={conversionColors[index]} />)}</Pie></PieChart>
                                </ResponsiveContainer>
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center flex-col z-20">
                                <span className="text-2xl md:text-3xl font-light dark:text-white font-num" style={{ textShadow: '0 0 16px rgba(0,210,255,0.7)' }}>{displayValue(conversionRate.toFixed(2))}%</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="card-depth p-4 md:p-6 rounded-2xl mb-8">
                <div className="flex justify-between items-center mb-4 md:mb-6">
                    <h3 className="text-lg md:text-xl font-light dark:text-white tracking-tight">Activitate Recentă</h3>
                    <a className="text-sm text-primary hover:text-cyan-300 font-normal flex items-center gap-1 transition-colors" href="/#/call-recordings">Vezi toate<span className="material-icons-round text-base">arrow_forward</span></a>
                </div>
                <div className="overflow-x-auto -mx-4 md:mx-0">
                    <div className="min-w-[500px] px-4 md:px-0">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-xs font-normal text-gray-500 uppercase tracking-wider border-b border-gray-800"><th className="py-3 px-3">ID</th><th className="py-3 px-3">Telefon</th><th className="py-3 px-3">Tip</th><th className="py-3 px-3">Durată</th><th className="py-3 px-3">Dată</th><th className="py-3 px-3 text-right">Înregistrare</th></tr>
                        </thead>
                        <tbody className="text-sm">
                            {recordingsLoading ? <tr><td colSpan={6} className="py-8 text-center text-gray-500 italic">Se încarcă...</td></tr> :
                                recentRecordings.length === 0 ? <tr><td colSpan={6} className="py-8 text-center text-gray-500 italic">Nicio activitate.</td></tr> :
                                recentRecordings.map((rec) => (
                                    <tr key={rec.id} className="group hover:bg-white/5 transition-colors border-b border-gray-800/50 last:border-0">
                                        <td className="py-3 px-3 dark:text-white font-num text-xs">{rec.client_personal_id || '-'}</td>
                                        <td className="py-3 px-3 font-light text-xs">{rec.phone_number || 'Necunoscut'}</td>
                                        <td className="py-3 px-3"><span className={`px-2 py-0.5 rounded text-[10px] uppercase font-medium ${rec.direction === 'inbound' ? 'text-green-400 bg-green-500/10' : 'text-blue-400 bg-blue-500/10'}`}>{rec.direction === 'inbound' ? 'Primit' : 'Inițiat'}</span></td>
                                        <td className="py-3 px-3 font-num text-xs">{formatDuration(rec.duration_seconds)}</td>
                                        <td className="py-3 px-3 text-gray-500 font-light text-xs">{formatDate(rec.created_at)}</td>
                                        <td className="py-3 px-3 text-right"><audio controls className="h-6 w-28 inline-block opacity-40 hover:opacity-100 transition-opacity" src={rec.recording_url} /></td>
                                    </tr>
                                ))
                            }
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Index;