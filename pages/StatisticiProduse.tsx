import React, { useState, useEffect } from 'react';
import ReactECharts from 'echarts-for-react';
import { useAuth } from '../contexts/AuthContext';

const dummyData = [
    {
        produs: 'Tricou Clasic Alb',
        comenzi: 142, drafturi: 18, bucatiVandute: 198,
        upsellComenziPct: 24, upsellComenziHistory: [12, 18, 20, 22, 19, 24, 24],
        upsellDrafturiPct: 39, upsellDrafturiHistory: [20, 25, 30, 33, 36, 38, 39],
        sanatate: 92,
    },
    {
        produs: 'Pantaloni Sport Negri',
        comenzi: 98, drafturi: 11, bucatiVandute: 134,
        upsellComenziPct: 21, upsellComenziHistory: [8, 10, 14, 17, 18, 20, 21],
        upsellDrafturiPct: 36, upsellDrafturiHistory: [15, 22, 28, 30, 32, 35, 36],
        sanatate: 87,
    },
    {
        produs: 'Geacă Impermeabilă',
        comenzi: 76, drafturi: 23, bucatiVandute: 89,
        upsellComenziPct: 20, upsellComenziHistory: [18, 22, 20, 16, 18, 19, 20],
        upsellDrafturiPct: 39, upsellDrafturiHistory: [28, 32, 40, 36, 38, 39, 39],
        sanatate: 74,
    },
    {
        produs: 'Șosete Premium 3-Pack',
        comenzi: 210, drafturi: 5, bucatiVandute: 630,
        upsellComenziPct: 28, upsellComenziHistory: [10, 14, 18, 22, 25, 27, 28],
        upsellDrafturiPct: 40, upsellDrafturiHistory: [20, 26, 30, 35, 38, 40, 40],
        sanatate: 97,
    },
    {
        produs: 'Bluză Lână Merinos',
        comenzi: 55, drafturi: 31, bucatiVandute: 61,
        upsellComenziPct: 16, upsellComenziHistory: [20, 18, 14, 12, 15, 14, 16],
        upsellDrafturiPct: 39, upsellDrafturiHistory: [30, 34, 38, 36, 40, 38, 39],
        sanatate: 61,
    },
];

function SparkBar({
    history, pct, color, trackColor, labelColor,
}: {
    history: number[]; pct: number; color: string; trackColor: string; labelColor: string;
}) {
    const max = Math.max(...history, 1);
    const w = 56, h = 28, barW = 5, gap = 2;
    const total = history.length * barW + (history.length - 1) * gap;
    const offsetX = (w - total) / 2;
    return (
        <div className="flex items-center gap-2">
            <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="overflow-visible">
                {history.map((v, i) => {
                    const barH = Math.max(2, (v / max) * (h - 4));
                    const x = offsetX + i * (barW + gap);
                    const y = h - barH;
                    const isLast = i === history.length - 1;
                    return (
                        <rect key={i} x={x} y={y} width={barW} height={barH} rx={1.5}
                            fill={isLast ? color : trackColor}
                            opacity={isLast ? 1 : 0.55 + i * 0.05}
                        />
                    );
                })}
            </svg>
            <span className={`text-[11px] font-num font-semibold ${labelColor}`}>{pct}%</span>
        </div>
    );
}

function HealthBar({ value }: { value: number }) {
    const color = value >= 85 ? 'bg-emerald-500' : value >= 65 ? 'bg-amber-500' : 'bg-red-500';
    const textColor = value >= 85 ? 'text-emerald-400' : value >= 65 ? 'text-amber-400' : 'text-red-400';
    return (
        <div className="flex items-center gap-2">
            <div className="h-1.5 bg-white/5 rounded-full overflow-hidden w-20">
                <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
            </div>
            <span className={`text-xs font-num font-medium ${textColor}`}>{value}%</span>
        </div>
    );
}

// ─── Types ────────────────────────────────────────────────────────────────────
interface ProductItem {
    denumire: string;
    idProdus: string;
    pret: number;
    pret_1_bucata?: string;
    pret_2_bucati?: string;
    pret_3_bucati?: string;
    pret_4_bucati?: string;
    pret_5_bucati?: string;
    status?: string;
    sku?: string;
}



export default function StatisticiProduse() {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];

    const today = new Date().toISOString().split('T')[0];
    const oneMonthAgo = (() => {
        const d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.toISOString().split('T')[0];
    })();
    const [startDate, setStartDate] = useState(oneMonthAgo);
    const [endDate, setEndDate] = useState(today);
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [products, setProducts] = useState<ProductItem[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);

    // Fire webhook & populate table from response
    useEffect(() => {
        if (!selectedBrand) return;
        setLoading(true);
        fetch('https://n8n.whimlets.com/webhook/products-list-vt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand: selectedBrand }),
        })
            .then(r => r.json())
            .then((data: ProductItem[]) => { if (Array.isArray(data)) setProducts(data); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [selectedBrand]);

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                {/* Title */}
                <div className="xl:min-w-[200px]">
                    <h2 className="text-3xl font-light dark:text-white mb-2 tracking-tight">Statistici Vanzari per Produs</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                        {selectedBrand ? `Date statistice pentru ${selectedBrand}` : 'Date statistice pe produse'}
                    </p>
                </div>

                {/* Controls */}
                <div className="flex flex-wrap gap-3 items-center justify-end">
                    {/* Date range */}
                    <div className="flex items-center gap-2 bg-[#13141a] p-1 rounded-xl border border-white/5 shadow-inner">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)}
                            className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                        <span className="text-gray-600">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)}
                            className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                    </div>

                    {/* Store selector */}
                    <div className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                            className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm min-w-[160px] flex justify-between items-center h-[42px] hover:text-white transition-all">
                            <span>{selectedBrand || 'Selectează'}</span>
                            <span className={`material-icons-round transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-full rounded-xl bg-[#13141a] border border-white/5 shadow-xl z-50 overflow-hidden backdrop-blur-md">
                                    {userStores.map(store => (
                                        <button key={store} onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedBrand === store ? 'bg-primary shadow-[0_0_8px_rgba(0,210,255,0.4)]' : 'bg-transparent border border-gray-600'}`} />
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="card-depth p-1 rounded-2xl overflow-hidden min-h-[400px] border border-white/5 relative">
                {loading && (
                    <div className="flex items-center justify-center h-48 text-gray-600 text-sm gap-2">
                        <span className="material-icons-round animate-spin text-base">autorenew</span> Se încarcă...
                    </div>
                )}
                {!loading && (
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800/50 bg-surface-dark-lighter/30">
                                    <th className="py-4 px-6 font-medium">Produs</th>
                                    <th className="py-4 px-6 font-medium">Pret 1 buc</th>
                                    <th className="py-4 px-6 font-medium">Pret 2 buc</th>
                                    <th className="py-4 px-6 font-medium">Pret 3 buc</th>
                                    <th className="py-4 px-6 font-medium">Pret 4 buc</th>
                                    <th className="py-4 px-6 font-medium">Pret 5 buc</th>
                                    <th className="py-4 px-6 font-medium">Trend Upsell</th>
                                    <th className="py-4 px-6 font-medium">Trend Drafturi</th>
                                    <th className="py-4 px-6 font-medium overflow-visible">
                                        <div className="relative inline-flex items-center gap-1 group/tip cursor-default">
                                            <span>Sanatate</span>
                                            <span className="material-icons-round text-gray-600 text-sm">info</span>
                                            <div className="pointer-events-none absolute top-full left-1/2 -translate-x-1/2 mt-2 w-64 p-3 rounded-xl bg-[#1a1b23] border border-white/10 shadow-2xl text-gray-300 text-[11px] font-light leading-relaxed normal-case tracking-normal opacity-0 group-hover/tip:opacity-100 transition-opacity duration-200 z-[999] whitespace-normal">
                                                Reprezintă cât de rentabil este să menții upsell-urile pe acest produs. Dacă este mică, înseamnă că trebuie să schimbi produsul.
                                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 border-4 border-transparent border-b-[#1a1b23]" />
                                            </div>
                                        </div>
                                    </th>
                                    <th className="py-4 px-6 font-medium overflow-visible">
                                        <div className="relative inline-flex items-center gap-1 group/tip2 cursor-default">
                                            <span>Acțiune</span>
                                            <span className="material-icons-round text-gray-600 text-sm">info</span>
                                            <div className="pointer-events-none absolute top-full right-0 mt-2 w-64 p-3 rounded-xl bg-[#1a1b23] border border-white/10 shadow-2xl text-gray-300 text-[11px] font-light leading-relaxed normal-case tracking-normal opacity-0 group-hover/tip2:opacity-100 transition-opacity duration-200 z-[999] whitespace-normal">
                                                Începe analiza apelurilor, ce a mers la upsell și ce nu a mers.
                                                <div className="absolute bottom-full right-4 border-4 border-transparent border-b-[#1a1b23]" />
                                            </div>
                                        </div>
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-800/50">
                                {products.length === 0 && !loading && (
                                    <tr><td colSpan={10} className="py-12 text-center text-gray-600 text-sm">Niciun produs găsit.</td></tr>
                                )}
                                {products.map((row, i) => {
                                    const sv = row.status === 'PORNIT' ? 92 : row.status === 'OPRIT' ? 40 : 70;
                                    return (
                                        <tr key={i} className="group hover:bg-white/5 transition-colors">
                                            <td className="py-4 px-6 text-gray-200 font-medium max-w-[200px]">
                                                <span className="leading-snug">{row.denumire}</span>
                                            </td>
                                            {[row.pret_1_bucata, row.pret_2_bucati, row.pret_3_bucati, row.pret_4_bucati, row.pret_5_bucati].map((p, pi) => (
                                                <td key={pi} className="py-4 px-6 font-num whitespace-nowrap">
                                                    {p ? (
                                                        <span className="px-2 py-0.5 rounded-lg text-base border font-semibold bg-emerald-800/20 text-emerald-400 border-emerald-700/30">{p} lei</span>
                                                    ) : <span className="text-gray-700">—</span>}
                                                </td>
                                            ))}
                                            <td className="py-4 px-6">
                                                <SparkBar
                                                    history={[0, 0, 0, 0, 0, 0, 0]}
                                                    pct={0}
                                                    color="bg-cyan-500"
                                                    trackColor="bg-cyan-500/20"
                                                    labelColor="text-cyan-400"
                                                />
                                            </td>
                                            <td className="py-4 px-6">
                                                <SparkBar
                                                    history={[0, 0, 0, 0, 0, 0, 0]}
                                                    pct={0}
                                                    color="bg-blue-500"
                                                    trackColor="bg-blue-500/20"
                                                    labelColor="text-blue-400"
                                                />
                                            </td>
                                            <td className="py-4 px-6"><HealthBar value={sv} /></td>
                                            <td className="py-4 px-6">
                                                <div className="flex items-center gap-2">
                                                    <button onClick={() => { }} className="btn-3d-secondary px-4 py-2 rounded-xl text-xs font-medium hover:text-white transition-all whitespace-nowrap">
                                                        Analizeaza vanzare
                                                    </button>
                                                    <button onClick={() => { }} className="btn-3d-secondary py-2 px-2 rounded-xl hover:text-white transition-all leading-none" title="Editeaza">
                                                        <span className="material-icons-round text-[18px] leading-none">edit</span>
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
