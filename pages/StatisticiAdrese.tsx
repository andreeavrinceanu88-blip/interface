import React, { useEffect, useState, useMemo, useCallback } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import { useAuth } from '../contexts/AuthContext';
import StoreSelector from '../components/StoreSelector';
import { supabase } from '../lib/supabaseClient';

interface CountyData {
    name: string;
    value: number;
}

interface Order {
    id: number;
    judet: string | null;
    oras: string | null;
}

const normalizeCountyName = (name: string | null): string => {
    if (!name) return 'Unknown';
    let n = name.toLowerCase().trim();
    // Remove diacritics
    n = n.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    
    if (n.includes('bucuresti') || n.includes('bucharest')) return 'Bucharest';
    if (n === 'cluj') return 'Cluj';
    if (n === 'timis') return 'Timis';
    if (n === 'iasi') return 'Iasi';
    if (n === 'brasov') return 'Brasov';
    if (n === 'constanta') return 'Constanta';
    if (n === 'suceava') return 'Suceava';
    if (n === 'bacau') return 'Bacau';
    if (n === 'arges') return 'Arges';
    if (n === 'bihor') return 'Bihor';
    if (n === 'prahova') return 'Prahova';
    if (n === 'dolj') return 'Dolj';
    if (n === 'galati') return 'Galati';
    if (n === 'maramures') return 'Maramures';
    if (n === 'mures') return 'Mures';
    if (n === 'sibiu') return 'Sibiu';
    if (n === 'arad') return 'Arad';
    if (n === 'alba') return 'Alba';
    if (n === 'bistrita-nasaud' || n.includes('bistrita')) return 'Bistrita-Nasaud';
    if (n === 'botosani') return 'Botosani';
    if (n === 'caras-severin' || n.includes('caras')) return 'Caras-Severin';
    if (n === 'calarasi') return 'Calarasi';
    if (n === 'covasna') return 'Covasna';
    if (n === 'dambovita') return 'Dambovita';
    if (n === 'giurgiu') return 'Giurgiu';
    if (n === 'gorj') return 'Gorj';
    if (n === 'harghita') return 'Harghita';
    if (n === 'hunedoara') return 'Hunedoara';
    if (n === 'ialomita') return 'Ialomita';
    if (n === 'ilfov') return 'Ilfov';
    if (n === 'mehedinti') return 'Mehedinti';
    if (n === 'neamt') return 'Neamt';
    if (n === 'olt') return 'Olt';
    if (n === 'salaj') return 'Salaj';
    if (n === 'satu mare' || n === 'satu-mare') return 'Satu Mare';
    if (n === 'teleorman') return 'Teleorman';
    if (n === 'tulcea') return 'Tulcea';
    if (n === 'vaslui') return 'Vaslui';
    if (n === 'valcea') return 'Valcea';
    if (n === 'vrancea') return 'Vrancea';
    if (n === 'braila') return 'Braila';
    if (n === 'buzau') return 'Buzau';
    
    // Capitalize first letter of each word as fallback
    return n.split(/[\s-]+/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('-');
};

export default function StatisticiAdrese() {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];

    const today = new Date().toISOString().split('T')[0];
    const [startDate, setStartDate] = useState(today);
    const [endDate, setEndDate] = useState(today);

    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [mapLoaded, setMapLoaded] = useState(false);
    const [mapError, setMapError] = useState<string | null>(null);

    const [selectedCounty, setSelectedCounty] = useState<string | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loadingData, setLoadingData] = useState(false);

    // Auto-select first store
    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);

    useEffect(() => {
        const fetchGeoJson = async () => {
            try {
                const res = await fetch('/romania-counties.json');
                if (!res.ok) throw new Error('Network response was not ok');
                const geojson = await res.json();
                echarts.registerMap('ROMANIA_COUNTIES', geojson);
                setMapLoaded(true);
            } catch (e) {
                console.warn('Failed to fetch local GeoJSON', e);
                setMapError('Nu s-a putut încărca harta județelor (Eroare rețea).');
            }
        };
        fetchGeoJson();
    }, []);

    const fetchOrders = useCallback(async () => {
        if (!selectedBrand || !profile?.id) return;
        setLoadingData(true);
        try {
            const endOfDay = endDate + 'T23:59:59';
            const { data, error } = await supabase
                .from('orders')
                .select('id, judet, oras')
                .ilike('store_name', selectedBrand)
                .eq('user_id', profile.id)
                .gte('created_at', startDate + 'T00:00:00')
                .lte('created_at', endOfDay);

            if (error) throw error;
            setOrders(data || []);
        } catch (e) {
            console.error('Error fetching orders for map:', e);
        } finally {
            setLoadingData(false);
        }
    }, [selectedBrand, startDate, endDate, profile?.id]);

    useEffect(() => {
        fetchOrders();
    }, [fetchOrders]);

    // Process data for the map and side panel
    const { countyData, countyCityMap, maxOrders } = useMemo(() => {
        const cMap: Record<string, number> = {};
        const cityMap: Record<string, Record<string, number>> = {};
        
        orders.forEach(o => {
            if (!o.judet) return;
            const normCounty = normalizeCountyName(o.judet);
            const city = o.oras ? o.oras.trim().charAt(0).toUpperCase() + o.oras.trim().slice(1).toLowerCase() : 'Necunoscut';
            
            cMap[normCounty] = (cMap[normCounty] || 0) + 1;
            if (!cityMap[normCounty]) cityMap[normCounty] = {};
            cityMap[normCounty][city] = (cityMap[normCounty][city] || 0) + 1;
        });

        const cData: CountyData[] = Object.keys(cMap).map(k => ({ name: k, value: cMap[k] }));
        const max = cData.length > 0 ? Math.max(...cData.map(c => c.value)) : 100;

        return { countyData: cData, countyCityMap: cityMap, maxOrders: max };
    }, [orders]);

    const getEchartsOption = () => {
        return {
            backgroundColor: 'transparent',
            tooltip: {
                trigger: 'item',
                backgroundColor: 'rgba(19, 20, 26, 0.95)',
                borderColor: 'rgba(255, 255, 255, 0.1)',
                textStyle: { color: '#e5e7eb', fontFamily: 'Inter, sans-serif' },
                padding: [12, 16],
                formatter: (params: any) => {
                    const value = params.value || 0;
                    let countyName = params.name || 'Necunoscut';
                    if (countyName === 'Bucharest') countyName = 'București';
                    if (countyName === 'Timis') countyName = 'Timiș';

                    return `
                        <div style="font-weight: 600; margin-bottom: 4px; color: #00d2ff;">${countyName}</div>
                        <div style="font-size: 13px; color: #9ca3af;">
                            Total comenzi: <span style="color: #fff; font-weight: 600;">${value}</span>
                        </div>
                    `;
                }
            },
            visualMap: {
                min: 0,
                max: maxOrders > 0 ? maxOrders : 100,
                left: 'right',
                bottom: '10%',
                text: [maxOrders.toString(), '0'],
                textStyle: { color: '#9ca3af' },
                calculable: true,
                inRange: {
                    color: ['#1e1f2e', '#0074e4', '#00b0ff', '#00d2ff', '#00e5ff']
                },
                itemWidth: 15,
                itemHeight: 120,
            },
            series: [
                {
                    name: 'Comenzi',
                    type: 'map',
                    map: 'ROMANIA_COUNTIES',
                    roam: false,
                    zoom: 1.1,
                    aspectScale: 1.1,
                    itemStyle: {
                        borderColor: 'rgba(255, 255, 255, 0.05)',
                        borderWidth: 1,
                        areaColor: '#1e1f2e',
                    },
                    emphasis: {
                        itemStyle: {
                            areaColor: '#3b82f6',
                            shadowBlur: 10,
                            shadowColor: 'rgba(59, 130, 246, 0.5)'
                        },
                        label: { show: true, color: '#fff', fontWeight: 'bold' }
                    },
                    select: {
                        itemStyle: { areaColor: '#00d2ff' },
                        label: { show: true, color: '#fff' }
                    },
                    data: countyData
                }
            ]
        };
    };

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="xl:min-w-[200px]">
                    <h2 className="text-3xl font-light dark:text-white mb-2 tracking-tight">Statistici Adrese</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                        {selectedBrand ? `Distribuția comenzilor pe județe pentru ${selectedBrand}` : 'Distribuția pe județe a comenzilor sosite'}
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2 bg-[#13141a] p-1 rounded-xl border border-white/5 shadow-inner">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="pl-3 pr-3 py-2 bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer font-num outline-none" />
                        <span className="text-gray-600">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="pl-3 pr-3 py-2 bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer font-num outline-none" />
                    </div>

                    <StoreSelector
                        selectedBrand={selectedBrand}
                        setSelectedBrand={setSelectedBrand}
                        userStores={userStores}
                    />
                </div>
            </div>

            <div className="card-depth rounded-2xl border border-white/5 relative flex-1 min-h-[500px] flex items-center justify-center overflow-hidden">
                <div className="absolute top-6 right-6 z-10 bg-[#13141a]/90 backdrop-blur-md p-5 rounded-2xl border border-white/10 shadow-lg min-w-[280px] max-w-xs pointer-events-auto max-h-[80%] flex flex-col">
                    {!selectedCounty ? (
                        <p className="text-gray-300 text-sm font-medium leading-relaxed">
                            {loadingData ? 'Se încarcă datele...' : 'Selecteaza judetul pentru a vedea orasele cu cele mai multe comenzi.'}
                        </p>
                    ) : (
                        <div className="space-y-3 flex-1 flex flex-col overflow-hidden">
                            <div className="flex justify-between items-center shrink-0">
                                <h3 className="text-lg font-medium text-white tracking-tight">{selectedCounty === 'Bucharest' ? 'București' : selectedCounty === 'Timis' ? 'Timiș' : selectedCounty}</h3>
                                <button onClick={() => setSelectedCounty(null)} className="text-gray-500 hover:text-white transition-colors flex items-center justify-center">
                                    <span className="material-icons-round text-sm">close</span>
                                </button>
                            </div>
                            <div className="flex flex-col gap-2 pt-2 border-t border-white/10 shrink-0">
                                <div className="flex justify-between items-center text-sm">
                                    <span className="text-gray-400">Total comenzi județ:</span>
                                    <span className="font-num font-semibold text-cyan-400 text-base">
                                        {countyData.find(c => c.name === selectedCounty)?.value || 0}
                                    </span>
                                </div>
                            </div>
                            <div className="pt-2 border-t border-white/10 flex-1 overflow-y-auto pr-1">
                                <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Top Orașe</h4>
                                <div className="space-y-2">
                                    {Object.entries(countyCityMap[selectedCounty] || {})
                                        .sort((a, b) => b[1] - a[1])
                                        .map(([city, count]) => (
                                            <div key={city} className="flex justify-between items-center text-sm bg-white/5 p-2 rounded-lg border border-white/5">
                                                <span className="text-gray-300 truncate mr-2" title={city}>{city}</span>
                                                <span className="font-num font-medium text-white">{count}</span>
                                            </div>
                                        ))}
                                    {(!countyCityMap[selectedCounty] || Object.keys(countyCityMap[selectedCounty]).length === 0) && (
                                        <div className="text-gray-500 text-sm italic">Nu există date detaliate.</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {mapError && (
                    <div className="text-red-400 text-sm">{mapError}</div>
                )}

                {!mapLoaded && !mapError && (
                    <div className="flex flex-col items-center gap-3 text-gray-500">
                        <span className="material-icons-round animate-spin text-2xl text-cyan-500">autorenew</span>
                        <span className="text-sm">Se încarcă harta județelor...</span>
                    </div>
                )}

                {mapLoaded && (
                    <div className="absolute inset-0 w-full h-full p-2">
                        <ReactECharts
                            option={getEchartsOption()}
                            style={{ height: '100%', width: '100%' }}
                            notMerge={true}
                            lazyUpdate={true}
                            onEvents={{
                                click: (params: any) => {
                                    if (params.name) {
                                        setSelectedCounty(params.name);
                                    }
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
