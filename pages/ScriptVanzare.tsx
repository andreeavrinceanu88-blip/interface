import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';

interface ProductScript {
    denumire: string;
    idProdus: string;
    pret_1_bucata?: string;
    pret_2_bucati?: string;
    pret_3_bucati?: string;
    pret_4_bucati?: string;
    pret_5_bucati?: string;
    prompt_1_bucata?: string;
    prompt_2_bucati?: string;
    prompt_3_bucati?: string;
    prompt_4_bucati?: string;
    prompt_5_bucati?: string;
}

interface PromptModal {
    title: string;
    text: string;
}

export default function ScriptVanzare() {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];

    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [products, setProducts] = useState<ProductScript[]>([]);
    const [loading, setLoading] = useState(false);
    const [modal, setModal] = useState<PromptModal | null>(null);

    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);

    useEffect(() => {
        if (!selectedBrand) return;
        setLoading(true);
        fetch('https://n8n.whimlets.com/webhook/products-list-vt', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ brand: selectedBrand }),
        })
            .then(r => r.json())
            .then((data: ProductScript[]) => { if (Array.isArray(data)) setProducts(data); })
            .catch(() => { })
            .finally(() => setLoading(false));
    }, [selectedBrand]);

    const prices = (row: ProductScript) => [
        row.pret_1_bucata, row.pret_2_bucati, row.pret_3_bucati, row.pret_4_bucati, row.pret_5_bucati,
    ];
    const prompts = (row: ProductScript) => [
        { label: 'Script 1 bucata', val: row.prompt_1_bucata },
        { label: 'Script 2 bucati', val: row.prompt_2_bucati },
        { label: 'Script 3 bucati', val: row.prompt_3_bucati },
        { label: 'Script 4 bucati', val: row.prompt_4_bucati },
        { label: 'Script 5 bucati', val: row.prompt_5_bucati },
    ];

    return (
        <div className="space-y-6 relative">
            {/* Full-text modal */}
            {modal && (
                <div
                    className="fixed inset-0 z-[999] flex items-center justify-center p-6"
                    onClick={() => setModal(null)}
                >
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative z-10 bg-[#13141a] border border-white/10 rounded-2xl shadow-2xl max-w-xl w-full p-6 flex flex-col gap-4"
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="flex items-center justify-between">
                            <h3 className="text-sm font-semibold text-gray-200 uppercase tracking-widest">{modal.title}</h3>
                            <button
                                onClick={() => setModal(null)}
                                className="material-icons-round text-gray-500 hover:text-white transition-colors text-xl"
                            >close</button>
                        </div>
                        <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{modal.text}</p>
                    </div>
                </div>
            )}

            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="xl:min-w-[200px]">
                    <h2 className="text-3xl font-light dark:text-white mb-2 tracking-tight">Script Vanzare</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-light">
                        {selectedBrand ? `Scripturi pentru ${selectedBrand}` : 'Scripturi și prețuri per produs'}
                    </p>
                </div>

                <div className="relative">
                    <button
                        onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                        className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm min-w-[160px] flex justify-between items-center h-[42px] hover:text-white transition-all"
                    >
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

            <div className="card-depth p-1 rounded-2xl overflow-visible border border-white/5 relative">
                {loading && (
                    <div className="flex items-center justify-center h-48 text-gray-600 text-sm gap-2">
                        <span className="material-icons-round animate-spin text-base">autorenew</span> Se încarcă...
                    </div>
                )}
                {!loading && (
                    <div className="overflow-x-auto overflow-y-visible">
                        <table className="w-full text-left border-collapse text-sm">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800/50 bg-surface-dark-lighter/30">
                                    <th className="py-4 px-4 font-medium sticky left-0 bg-[#0d0e19] z-10">Produs</th>
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <th key={n} className="py-4 px-4 font-medium whitespace-nowrap">Pret {n} buc</th>
                                    ))}
                                    {[1, 2, 3, 4, 5].map(n => (
                                        <th key={n} className="py-4 px-4 font-medium whitespace-nowrap">
                                            Script {n} {n === 1 ? 'bucata' : 'bucati'}
                                        </th>
                                    ))}
                                    <th className="py-4 px-4 font-medium whitespace-nowrap text-cyan-400">ID Produs</th>
                                    <th className="py-4 px-4 font-medium">Actiune</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-800/50">
                                {products.length === 0 && (
                                    <tr><td colSpan={13} className="py-12 text-center text-gray-600 text-sm">Niciun produs găsit.</td></tr>
                                )}
                                {products.map((row, i) => (
                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                        {/* Produs */}
                                        <td className="py-4 px-4 text-gray-200 font-medium sticky left-0 bg-[#0d0e19] group-hover:bg-[#13141a] transition-colors z-10 min-w-[180px]">
                                            <span className="leading-snug text-sm">{row.denumire}</span>
                                        </td>
                                        {/* Prices */}
                                        {prices(row).map((p, pi) => (
                                            <td key={pi} className="py-4 px-4 font-num whitespace-nowrap">
                                                {p
                                                    ? <span className="px-2 py-0.5 rounded-lg text-base border font-semibold bg-emerald-800/20 text-emerald-400 border-emerald-700/30">{p} lei</span>
                                                    : <span className="text-gray-700">—</span>}
                                            </td>
                                        ))}
                                        {/* Script prompts — click to expand */}
                                        {prompts(row).map((s, si) => (
                                            <td key={si} className="py-4 px-4 max-w-[160px]">
                                                {s.val ? (
                                                    <button
                                                        onClick={() => setModal({ title: `${row.denumire} — ${s.label}`, text: s.val! })}
                                                        className="text-left w-full group/cell"
                                                        title="Click pentru preview complet"
                                                    >
                                                        <span className="line-clamp-2 text-xs leading-relaxed text-gray-400 group-hover/cell:text-gray-200 transition-colors underline underline-offset-2 decoration-dashed decoration-gray-600">
                                                            {s.val}
                                                        </span>
                                                    </button>
                                                ) : <span className="text-gray-700 text-xs">—</span>}
                                            </td>
                                        ))}
                                        {/* ID */}
                                        <td className="py-4 px-4">
                                            <span className="px-2 py-0.5 rounded-lg text-[11px] border font-mono font-medium bg-cyan-500/10 text-cyan-400 border-cyan-500/20">
                                                {row.idProdus}
                                            </span>
                                        </td>
                                        {/* Actiune */}
                                        <td className="py-4 px-4">
                                            <button onClick={() => { }} className="btn-3d-secondary py-2 px-2 rounded-xl hover:text-white transition-all leading-none" title="Editeaza">
                                                <span className="material-icons-round text-[18px] leading-none">edit</span>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
