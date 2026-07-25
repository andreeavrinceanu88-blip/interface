import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

export default function StatisticiProduse() {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];

    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [products, setProducts] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [previewCell, setPreviewCell] = useState<{ col: string; val: string; rowId: any } | null>(null);
    const [editVal, setEditVal] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const handleSaveCell = async () => {
        if (!previewCell || !previewCell.rowId) return;
        setIsSaving(true);
        const { error } = await supabase
            .from('products')
            .update({ [previewCell.col]: editVal })
            .eq('id', previewCell.rowId);
            
        if (!error) {
            setProducts(prev => prev.map(p => 
                p.id === previewCell.rowId ? { ...p, [previewCell.col]: editVal } : p
            ));
            setPreviewCell(null);
        } else {
            console.error('Error updating cell:', error);
            alert('A apărut o eroare la salvare.');
        }
        setIsSaving(false);
    };

    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);

    useEffect(() => {
        if (!profile?.id || !selectedBrand) return;
        
        setLoading(true);
        supabase
            .from('products')
            .select('*')
            .eq('user_id', profile.id)
            .eq('store', selectedBrand)
            .then(({ data, error }) => {
                if (error) {
                    console.error('Error fetching products:', error);
                } else if (data) {
                    setProducts(data);
                }
            })
            .finally(() => setLoading(false));
    }, [selectedBrand, profile?.id]);

    const columns = products.length > 0 ? Object.keys(products[0]).filter(col => col !== 'user_id' && col !== 'created_at') : [];

    const filteredProducts = products.filter(row => {
        if (!searchQuery) return true;
        return columns.some(col => {
            const val = row[col];
            if (val === null || val === undefined) return false;
            return String(val).toLowerCase().includes(searchQuery.toLowerCase());
        });
    });

    return (
        <div className="space-y-6 relative">
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                <div className="xl:min-w-[200px]">
                    <h2 className="text-3xl font-light dark:text-white mb-2 tracking-tight">Date Produse</h2>
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-end">
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

            {/* Mock Mini-Dashboard */}
            {products.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-2">
                    <div className="bg-[#13141a] border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-primary/20 transition-all"></div>
                        <div className="flex items-center gap-3 mb-2 text-gray-400">
                            <span className="material-icons-round text-primary bg-primary/10 p-2 rounded-xl text-[20px]">trending_up</span>
                            <span className="text-sm font-medium uppercase tracking-wider">Rată Upsell (Mock)</span>
                        </div>
                        <div className="text-3xl font-light text-white mb-1">24.5%</div>
                        <div className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="material-icons-round text-[14px]">arrow_upward</span>
                            +2.3% față de luna trecută
                        </div>
                        <div className="mt-4 text-xs text-gray-500 font-mono truncate border-t border-white/5 pt-3">
                            Produs: {products[0].denumire || products[0].id || 'N/A'}
                        </div>
                    </div>

                    <div className="bg-[#13141a] border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-amber-500/20 transition-all"></div>
                        <div className="flex items-center gap-3 mb-4 text-gray-400">
                            <span className="material-icons-round text-amber-500 bg-amber-500/10 p-2 rounded-xl text-[20px]">record_voice_over</span>
                            <span className="text-sm font-medium uppercase tracking-wider">Obiecții (Mock)</span>
                        </div>
                        
                        <div className="flex items-center gap-4">
                            {/* Circle Diagram (Donut) */}
                            <div className="relative w-20 h-20 shrink-0">
                                <svg viewBox="0 0 36 36" className="w-full h-full transform -rotate-90">
                                    {/* Background Circle */}
                                    <path
                                        className="text-white/5"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    />
                                    {/* Lipsa incredere (40%) */}
                                    <path
                                        className="text-amber-500"
                                        strokeDasharray="40, 100"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    />
                                    {/* Lipsa bani (30%) - starts at 40 */}
                                    <path
                                        className="text-primary"
                                        strokeDasharray="30, 100"
                                        strokeDashoffset="-40"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    />
                                    {/* Lipsa informatii (20%) - starts at 70 */}
                                    <path
                                        className="text-indigo-500"
                                        strokeDasharray="20, 100"
                                        strokeDashoffset="-70"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    />
                                    {/* Nespecificat (10%) - starts at 90 */}
                                    <path
                                        className="text-emerald-500"
                                        strokeDasharray="10, 100"
                                        strokeDashoffset="-90"
                                        d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                        fill="none"
                                        stroke="currentColor"
                                        strokeWidth="3.5"
                                    />
                                </svg>
                                <div className="absolute inset-0 flex items-center justify-center flex-col">
                                    <span className="text-white text-[13px] font-bold">40%</span>
                                </div>
                            </div>
                            
                            {/* Legend */}
                            <div className="flex-1 flex flex-col gap-1 justify-center">
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0"></span>
                                    <span className="text-gray-300 truncate">Lipsă încredere</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0"></span>
                                    <span className="text-gray-400 truncate">Lipsă bani</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-indigo-500 shrink-0"></span>
                                    <span className="text-gray-500 truncate">Lipsă informații</span>
                                </div>
                                <div className="flex items-center gap-2 text-[11px]">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0"></span>
                                    <span className="text-gray-500 truncate">Nespecificat</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[#13141a] border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-emerald-500/20 transition-all"></div>
                        <div className="flex items-center gap-3 mb-2 text-gray-400">
                            <span className="material-icons-round text-emerald-500 bg-emerald-500/10 p-2 rounded-xl text-[20px]">check_circle</span>
                            <span className="text-sm font-medium uppercase tracking-wider">Rată Confirmare (Mock)</span>
                        </div>
                        <div className="text-3xl font-light text-white mb-1">68.2%</div>
                        <div className="text-xs text-emerald-400 flex items-center gap-1">
                            <span className="material-icons-round text-[14px]">arrow_upward</span>
                            Stabilitate excelentă
                        </div>
                        <div className="mt-4 text-xs text-gray-500 font-mono truncate border-t border-white/5 pt-3">
                            Din total comenzi generate
                        </div>
                    </div>

                    <div className="bg-[#13141a] border border-white/5 p-5 rounded-2xl shadow-lg relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-cyan-500/20 transition-all"></div>
                        <div className="flex items-center gap-3 mb-2 text-gray-400">
                            <span className="material-icons-round text-cyan-500 bg-cyan-500/10 p-2 rounded-xl text-[20px]">assignment_turned_in</span>
                            <span className="text-sm font-medium uppercase tracking-wider">Recuperare Draft (Mock)</span>
                        </div>
                        <div className="text-3xl font-light text-white mb-1">15.4%</div>
                        <div className="text-xs text-cyan-400 flex items-center gap-1">
                            <span className="material-icons-round text-[14px]">arrow_upward</span>
                            +1.2% creștere
                        </div>
                        <div className="mt-4 text-xs text-gray-500 font-mono truncate border-t border-white/5 pt-3">
                            Din coșuri abandonate
                        </div>
                    </div>
                </div>
            )}

            {/* Search Bar */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-lg">search</span>
                    <input 
                        type="text" 
                        placeholder="Caută în toate coloanele..." 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-[#13141a] border border-white/10 text-white text-sm rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all placeholder-gray-500 shadow-inner"
                    />
                </div>
            </div>

            <div className="card-depth p-1 rounded-2xl overflow-hidden min-h-[400px] border border-white/5 relative">
                {loading && (
                    <div className="flex items-center justify-center h-48 text-gray-600 text-sm gap-2">
                        <span className="material-icons-round animate-spin text-base">autorenew</span> Se încarcă...
                    </div>
                )}
                {!loading && (
                    <div className="overflow-x-auto overflow-y-visible max-w-full">
                        <table className="w-max text-left border-collapse">
                            <thead>
                                <tr className="text-xs text-gray-500 uppercase tracking-widest border-b border-gray-800/50 bg-surface-dark-lighter/30">
                                    {columns.map(col => (
                                        <th key={col} className="py-4 px-6 font-medium whitespace-nowrap">{col}</th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="text-sm divide-y divide-gray-800/50">
                                {filteredProducts.length === 0 && (
                                    <tr><td colSpan={columns.length || 1} className="py-12 text-center text-gray-600 text-sm">Niciun rezultat găsit.</td></tr>
                                )}
                                {filteredProducts.map((row, i) => (
                                    <tr key={i} className="group hover:bg-white/5 transition-colors">
                                        {columns.map(col => {
                                            const val = row[col];
                                            const strVal = val === null || val === undefined ? '-' : String(val);
                                            const truncated = strVal.length > 50 ? strVal.substring(0, 50) + '...' : strVal;
                                            return (
                                                <td 
                                                    key={col} 
                                                    onClick={() => {
                                                        setPreviewCell({ col, val: strVal, rowId: row.id });
                                                        setEditVal(strVal === '-' ? '' : strVal);
                                                    }}
                                                    className="py-4 px-6 text-gray-300 whitespace-nowrap font-mono text-[13px] cursor-pointer hover:bg-white/10 transition-colors" 
                                                    title={strVal}
                                                >
                                                    {truncated}
                                                </td>
                                            );
                                        })}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {/* Cell Preview Modal */}
            {previewCell && (
                <>
                    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => !isSaving && setPreviewCell(null)}>
                        <div className="glass-panel-3d rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between p-4 border-b border-white/5 bg-white/5 shrink-0">
                                <h3 className="text-lg font-medium text-white">Editează: {previewCell.col}</h3>
                                <button onClick={() => setPreviewCell(null)} disabled={isSaving} className="text-gray-400 hover:text-white transition-colors disabled:opacity-50">
                                    <span className="material-icons-round">close</span>
                                </button>
                            </div>
                            <div className="p-6 overflow-y-auto flex-1 flex flex-col min-h-[300px]">
                                <textarea
                                    value={editVal}
                                    onChange={(e) => setEditVal(e.target.value)}
                                    className="w-full flex-1 bg-[#1a1b23] border border-white/10 rounded-xl p-4 text-sm text-gray-200 font-mono resize-none focus:outline-none focus:ring-2 focus:ring-primary/40 focus:border-primary transition-all"
                                    placeholder="Introduceți valoarea..."
                                />
                            </div>
                            <div className="p-4 border-t border-white/5 bg-white/5 shrink-0 flex justify-end gap-3">
                                <button onClick={() => setPreviewCell(null)} disabled={isSaving} className="px-5 py-2.5 rounded-xl text-sm font-medium text-gray-400 hover:text-white hover:bg-white/5 transition-colors disabled:opacity-50">
                                    Anulează
                                </button>
                                <button onClick={handleSaveCell} disabled={isSaving} className="btn-3d-primary px-6 py-2.5 rounded-xl text-sm font-medium shadow-lg disabled:opacity-50 flex items-center gap-2">
                                    {isSaving ? <span className="material-icons-round animate-spin text-sm">autorenew</span> : <span className="material-icons-round text-sm">save</span>}
                                    {isSaving ? 'Se salvează...' : 'Salvează'}
                                </button>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
