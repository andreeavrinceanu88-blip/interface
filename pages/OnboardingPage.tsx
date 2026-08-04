import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabaseClient';

interface ShopifyProduct {
    id: number;
    title: string;
    vendor: string;
    product_type: string;
    status: string;
    variants: { price: string }[];
    image?: { src: string };
}

export default function OnboardingPage() {
    const { profile } = useAuth();
    const [view, setView] = useState<'list' | 'add'>(profile?.stores && profile.stores.length > 0 ? 'list' : 'add');
    const [websiteUrl, setWebsiteUrl] = useState('');
    const [storeNickname, setStoreNickname] = useState('');
    const [step, setStep] = useState(1);
    const [loading, setLoading] = useState(false);
    const [loadingMsg, setLoadingMsg] = useState('');
    const [storeType, setStoreType] = useState<'shopify' | 'wordpress' | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
    const [products, setProducts] = useState<ShopifyProduct[]>([]);
    const [selectedProducts, setSelectedProducts] = useState<Set<number>>(new Set());
    const [fetchError, setFetchError] = useState<string | null>(null);
    const [activationModes, setActivationModes] = useState<Set<'confirmare' | 'draft'>>(new Set());
    const [upsellType, setUpsellType] = useState<Record<'confirmare' | 'draft', 'multi' | 'surpriza' | null>>({ confirmare: null, draft: null });
    const [credentials, setCredentials] = useState({
        shopifyClientId: '',
        shopifyClientSecret: '',
        shopifySubdomain: '',
        wordpressApiKey: ''
    });

    const navigate = useNavigate();

    const normalizeUrl = (url: string) => {
        const trimmed = url.trim();
        if (!trimmed) return "";
        if (/^https?:\/\//i.test(trimmed)) return trimmed;
        // If it looks like a domain (e.g., example.com), add https://
        return `https://${trimmed}`;
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        
        const normalized = normalizeUrl(websiteUrl);
        setWebsiteUrl(normalized);
        
        setLoading(true);
        // Simulate progress/validation
        setTimeout(() => {
            setLoading(false);
            setStep(step + 1);
        }, 800);
    };

    const saveStoreToSupabase = async () => {
        if (!profile?.id || !storeNickname.trim()) return;
        const nickname = storeNickname.trim();
        try {
            // 1. Append nickname to profiles.stores (comma-separated)
            const currentStores = profile.stores || [];
            if (!currentStores.includes(nickname)) {
                const updated = [...currentStores, nickname].join(',');
                const { error: profileErr } = await supabase
                    .from('profiles')
                    .update({ stores: updated })
                    .eq('id', profile.id);
                if (profileErr) console.error('[Setup] profile update error:', profileErr);
            }

            // 2. Create initial call_metrics row for this store
            const { error: metricsErr } = await supabase
                .from('call_metrics')
                .insert({
                    user_id: profile.effectiveUserId,
                    store_name: nickname,
                    total_apeluri: 0,
                    apeluri_initiate: 0,
                    apeluri_primite: 0,
                    rata_conversie: 0,
                    rata_conversie_drafturi: 0,
                    minute_consumate: 0,
                    total_comenzi: 0,
                    cosuri_abandonate: 0,
                    cosuri_recuperate: 0,
                    vanzari_generate: 0,
                    comenzi_confirmate: 0,
                });
            if (metricsErr) console.error('[Setup] call_metrics insert error:', metricsErr);
        } catch (err) {
            console.error('[Setup] Supabase save error:', err);
        }
    };

    const toggleProduct = (id: number) => {
        setSelectedProducts(prev => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const toggleAll = () => {
        setSelectedProducts(prev =>
            prev.size === products.length
                ? new Set()
                : new Set(products.map(p => p.id))
        );
    };

    const MOCK_PRODUCTS: ShopifyProduct[] = [
        { id: 1, title: 'Tricou Premium', vendor: 'Brand X', product_type: 'Îmbrăcăminte', status: 'active', variants: [{ price: '149.99' }] },
        { id: 2, title: 'Pantaloni Slim Fit', vendor: 'Brand X', product_type: 'Îmbrăcăminte', status: 'active', variants: [{ price: '249.00' }] },
        { id: 3, title: 'Geacă de Iarnă', vendor: 'Brand Y', product_type: 'Îmbrăcăminte', status: 'active', variants: [{ price: '599.00' }] },
        { id: 4, title: 'Adidași Sport', vendor: 'Brand Z', product_type: 'Încălțăminte', status: 'active', variants: [{ price: '399.99' }] },
        { id: 5, title: 'Rucsac Urban', vendor: 'Brand X', product_type: 'Accesorii', status: 'active', variants: [{ price: '179.00' }] },
    ];

    const handleImportFinal = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setFetchError(null);

        try {
            // Strip .myshopify.com suffix if user included it, keep just the slug
            const shopSlug = credentials.shopifySubdomain
                .replace(/\/$/, '')
                .replace(/\.myshopify\.com$/i, '');

            // Step 1: Get access token via Vite proxy (avoids CORS)
            setLoadingMsg('Se obține tokenul de acces...');
            const tokenRes = await fetch(`/shopify-proxy/${shopSlug}.myshopify.com/admin/oauth/access_token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    client_id: credentials.shopifyClientId,
                    client_secret: credentials.shopifyClientSecret,
                    grant_type: 'client_credentials',
                }),
            });

            if (!tokenRes.ok) {
                const body = await tokenRes.text().catch(() => '(no body)');
                throw new Error(`[Token] HTTP ${tokenRes.status} ${tokenRes.statusText}\n${body}`);
            }
            const tokenData = await tokenRes.json();
            const accessToken: string = tokenData.access_token;
            if (!accessToken) {
                throw new Error(`[Token] Răspuns fără access_token:\n${JSON.stringify(tokenData, null, 2)}`);
            }

            // Step 2: Fetch products via Vite proxy
            setLoadingMsg('Se încarcă produsele...');
            const productsRes = await fetch(
                `/shopify-proxy/${shopSlug}.myshopify.com/admin/api/2024-01/products.json?limit=250`,
                { headers: { 'X-Shopify-Access-Token': accessToken } }
            );

            if (!productsRes.ok) {
                const body = await productsRes.text().catch(() => '(no body)');
                throw new Error(`[Products] HTTP ${productsRes.status} ${productsRes.statusText}\n${body}`);
            }
            const productsData = await productsRes.json();
            setProducts(productsData.products || []);
            setFetchError(null);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('Shopify API error:', message);
            setFetchError(message);
            setProducts(MOCK_PRODUCTS);
        } finally {
            setLoading(false);
            setLoadingMsg('');
            setStep(4);
        }
    };

    return (
        <div className="fixed inset-0 z-[100] bg-[#0a0b14] flex items-center justify-center overflow-hidden">

            {/* Delete Confirmation Modal */}
            {deleteTarget && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center" onClick={() => setDeleteTarget(null)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div
                        className="relative w-full max-w-sm mx-4 glass-panel-3d rounded-2xl p-8 border border-red-500/20 shadow-[0_0_40px_rgba(239,68,68,0.1)] animate-in fade-in zoom-in-95 duration-200"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <div className="flex flex-col items-center text-center gap-4">
                            <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                                <span className="material-icons-round text-red-400 text-3xl">delete_forever</span>
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white mb-2" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Ștergi magazinul?</h2>
                                <p className="text-gray-400 text-sm leading-relaxed">
                                    Ești sigur că vrei să ștergi <span className="text-white font-medium">{deleteTarget}</span>? Această acțiune nu poate fi anulată.
                                </p>
                            </div>
                            <div className="flex gap-3 w-full mt-2">
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 btn-3d-secondary py-3 rounded-xl text-gray-400 font-semibold text-sm"
                                >
                                    ANULEAZĂ
                                </button>
                                <button
                                    onClick={() => setDeleteTarget(null)}
                                    className="flex-1 py-3 rounded-xl text-white font-semibold text-sm bg-red-500/20 border border-red-500/40 hover:bg-red-500/30 hover:border-red-500/60 transition-all"
                                >
                                    DA, ȘTERGE
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
             {/* Background Effects */}
             <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0">
                <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-cyan-900/20 blur-[120px] rounded-full animate-pulse"></div>
                <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-blue-900/10 blur-[120px] rounded-full animate-pulse" style={{ animationDelay: '1s' }}></div>
                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.03]"></div>
            </div>

            <div className="w-full max-w-3xl p-8 relative z-10">
                <div className="glass-panel-3d rounded-2xl p-10 border border-white/5 shadow-2xl relative overflow-hidden">
                    
                    {/* Header */}
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-bold tracking-tight text-white mb-3" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>
                            {view === 'list' ? "Magazinele Tale" : "Configurare Magazin"}
                        </h1>
                        <p className="text-gray-400 text-lg font-light max-w-md mx-auto">
                            {view === 'list' 
                                ? "Gestionați conexiunile magazinelor asociate contului dumneavoastră." 
                                : step === 1 ? "Începeți prin a introduce adresa magazinului."
                                : step === 2 ? "Selectați platforma pe care este construit magazinul."
                                : step === 3 ? `Introduceți datele de conectare pentru ${storeType === 'shopify' ? 'Shopify' : 'WordPress'}.`
                                : step === 4 ? 'Selectați produsele pe care doriți să le activați.'
                                : step === 5 ? 'Configurați modul de activare al botului.'
                                : 'Totul este gata!'
                            }
                        </p>
                    </div>

                    {/* Step Indicator / List Header */}
                    {view === 'add' && step < 6 && (
                        <div className="flex items-center justify-center gap-3 mb-10">
                            {[1, 2, 3, 4, 5].map((s) => (
                                <div 
                                    key={s}
                                    className={`h-1.5 rounded-full transition-all duration-500 ${s === step ? 'w-12 bg-cyan-500 shadow-[0_0_15px_rgba(0,210,255,0.5)]' : s < step ? 'w-4 bg-cyan-500/40' : 'w-4 bg-white/10'}`}
                                />
                            ))}
                        </div>
                    )}

                    <div className="min-h-[320px] flex flex-col justify-center">
                        {view === 'list' ? (
                            <div className="animate-in fade-in zoom-in-95 duration-500 space-y-6">
                                <div className="grid grid-cols-1 gap-4 max-h-[400px] overflow-y-auto pr-2 scrollbar-hide">
                                    {(profile?.stores || []).map((store) => (
                                        <div key={store} className="glass-panel-3d p-6 rounded-xl border border-white/5 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                                            <div className="flex items-center gap-4">
                                                <div className="w-12 h-12 rounded-lg bg-cyan-500/10 flex items-center justify-center text-cyan-400">
                                                    <span className="material-icons-round">store</span>
                                                </div>
                                                <div>
                                                    <h3 className="text-white font-medium">{store}</h3>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.4)]"></span>
                                                        <span className="text-xs text-gray-500 font-light">Sincronizat</span>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button className="w-10 h-10 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all">
                                                    <span className="material-icons-round text-lg">settings</span>
                                                </button>
                                                <button
                                                    onClick={() => setDeleteTarget(store)}
                                                    className="w-10 h-10 rounded-lg bg-red-500/5 border border-red-500/20 flex items-center justify-center text-red-400/60 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/40 transition-all"
                                                >
                                                    <span className="material-icons-round text-lg">delete_outline</span>
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                
                                <button 
                                    onClick={() => setView('add')}
                                    className="w-full btn-3d-primary py-4 rounded-xl text-white font-semibold text-base tracking-wide flex items-center justify-center gap-3 mt-4"
                                >
                                    <span className="material-icons-round text-xl">add_circle</span>
                                    ADĂUGĂ MAGAZIN NOU
                                </button>
                            </div>
                        ) : (
                            <>
                                {step === 1 && (
                            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                                <form onSubmit={handleNextStep} className="space-y-8">
                                    <div className="space-y-4">
                                        <label className="text-sm text-gray-400 font-medium ml-1">Adresa Website</label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-cyan-500/50 to-blue-500/50 rounded-xl blur opacity-30 group-focus-within:opacity-70 transition duration-300"></div>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-xl">language</span>
                                                <input
                                                    type="text"
                                                    value={websiteUrl}
                                                    onChange={(e) => setWebsiteUrl(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-base focus:outline-none focus:ring-1 focus:ring-cyan-500/50 transition-all font-sans"
                                                    placeholder="magazin.ro"
                                                    required
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="space-y-4">
                                        <label className="text-sm text-gray-400 font-medium ml-1">Nickname Magazin</label>
                                        <div className="relative group">
                                            <div className="absolute -inset-0.5 bg-gradient-to-r from-violet-500/40 to-cyan-500/40 rounded-xl blur opacity-25 group-focus-within:opacity-60 transition duration-300"></div>
                                            <div className="relative">
                                                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 material-icons-round text-xl">badge</span>
                                                <input
                                                    type="text"
                                                    value={storeNickname}
                                                    onChange={(e) => setStoreNickname(e.target.value)}
                                                    className="w-full pl-12 pr-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-base focus:outline-none focus:ring-1 focus:ring-violet-500/50 transition-all font-sans"
                                                    placeholder="ex: VitaDomus, MagazinulMeu"
                                                    required
                                                />
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-600 ml-1 flex items-center gap-1.5">
                                            <span className="material-icons-round" style={{ fontSize: '13px' }}>info_outline</span>
                                            Acest nume va fi folosit pentru filtrarea metricilor pe magazine
                                        </p>
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="w-full btn-3d-primary py-4 rounded-xl text-white font-semibold text-base tracking-wide flex items-center justify-center gap-3 disabled:opacity-50"
                                    >
                                        {loading ? <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span> : "CONTINUĂ"}
                                        {!loading && <span className="material-icons-round text-xl">arrow_forward</span>}
                                    </button>
                                </form>
                            </div>
                        )}

                        {step === 2 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-8">
                                <div className="grid grid-cols-2 gap-6">
                                    <PlatformCard 
                                        name="Shopify" 
                                        icon="shopping_bag" 
                                        selected={storeType === 'shopify'} 
                                        onClick={() => setStoreType('shopify')} 
                                    />
                                    <PlatformCard 
                                        name="WordPress" 
                                        icon="language" 
                                        selected={storeType === 'wordpress'} 
                                        onClick={() => setStoreType('wordpress')} 
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <button
                                        onClick={() => setStep(1)}
                                        className="flex-1 btn-3d-secondary py-4 rounded-xl text-gray-400 font-semibold"
                                    >
                                        ÎNAPOI
                                    </button>
                                    <button
                                        disabled={!storeType}
                                        onClick={() => setStep(3)}
                                        className="flex-[2] btn-3d-primary py-4 rounded-xl text-white font-semibold tracking-wide flex items-center justify-center gap-3 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        CONTINUĂ
                                        <span className="material-icons-round text-xl">arrow_forward</span>
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 3 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500">
                                <form onSubmit={handleImportFinal} className="space-y-6">
                                    {storeType === 'shopify' ? (
                                        <>
                                            <div className="bg-cyan-500/5 border border-cyan-500/20 rounded-xl p-4 mb-6">
                                                <p className="text-xs text-cyan-400 flex items-center gap-2">
                                                    <span className="material-icons-round text-sm">info</span>
                                                    Mergi la shopify {'->'} setări {'->'} apps și creează un app nou
                                                </p>
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 font-medium ml-1 uppercase tracking-wider">Shopify Client ID</label>
                                                <input
                                                    type="text"
                                                    value={credentials.shopifyClientId}
                                                    onChange={(e) => setCredentials({...credentials, shopifyClientId: e.target.value})}
                                                    className="w-full px-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                                    placeholder="Introduceți Client ID"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 font-medium ml-1 uppercase tracking-wider">Shopify Client Secret</label>
                                                <input
                                                    type="password"
                                                    value={credentials.shopifyClientSecret}
                                                    onChange={(e) => setCredentials({...credentials, shopifyClientSecret: e.target.value})}
                                                    className="w-full px-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                                    placeholder="••••••••••••••••"
                                                    required
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-xs text-gray-500 font-medium ml-1 uppercase tracking-wider">Subdomeniu Magazin Shopify</label>
                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        value={credentials.shopifySubdomain}
                                                        onChange={(e) => setCredentials({...credentials, shopifySubdomain: e.target.value})}
                                                        className="w-full px-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                                        placeholder="abcdef-gh.myshopify.com"
                                                        required
                                                    />
                                                </div>
                                                <p className="text-xs text-gray-600 ml-1 flex items-center gap-1.5">
                                                    <span className="material-icons-round" style={{ fontSize: '13px' }}>help_outline</span>
                                                    Găsești subdomeniul în Shopify Admin → Setări → Domenii
                                                </p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="space-y-2">
                                            <label className="text-xs text-gray-500 font-medium ml-1 uppercase tracking-wider">WordPress Admin API Key</label>
                                            <input
                                                type="text"
                                                value={credentials.wordpressApiKey}
                                                onChange={(e) => setCredentials({...credentials, wordpressApiKey: e.target.value})}
                                                className="w-full px-4 py-4 rounded-xl bg-[#13151d] border border-white/10 text-white placeholder-gray-600 text-sm focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
                                                placeholder="Introduceți API Key"
                                                required
                                            />
                                        </div>
                                    )}

                                    <div className="flex gap-4 pt-4">
                                        <button
                                            type="button"
                                            onClick={() => setStep(2)}
                                            className="flex-1 btn-3d-secondary py-4 rounded-xl text-gray-400 font-semibold"
                                        >
                                            ÎNAPOI
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="flex-[2] btn-3d-primary py-4 rounded-xl text-white font-semibold flex items-center justify-center gap-3 disabled:opacity-50"
                                        >
                                            {loading
                                                ? <><span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>{loadingMsg && <span className="text-sm ml-2 opacity-70">{loadingMsg}</span>}</>
                                                : 'FINALIZEAZĂ IMPORTUL'
                                            }
                                            {!loading && <span className="material-icons-round text-xl">check_circle</span>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        )}

                        {step === 4 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-4">
                                {fetchError && (
                                    <div className="bg-red-500/5 border border-red-500/30 rounded-xl p-4 space-y-2">
                                        <div className="flex items-center gap-2">
                                            <span className="material-icons-round text-red-400 text-sm">error_outline</span>
                                            <span className="text-xs text-red-400 font-semibold uppercase tracking-wider">Eroare API — se afișează date demonstrative</span>
                                        </div>
                                        <pre className="text-xs text-red-300/80 whitespace-pre-wrap break-all font-mono bg-black/20 rounded-lg p-3 max-h-32 overflow-y-auto">{fetchError}</pre>
                                    </div>
                                )}

                                {/* Product table */}
                                <div className="rounded-xl border border-white/10 overflow-hidden">
                                    {/* Table header */}
                                    <div className="bg-white/5 px-4 py-3 flex items-center gap-3 border-b border-white/10">
                                        {/* Round select-all checkbox */}
                                        <div
                                            onClick={toggleAll}
                                            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center cursor-pointer flex-shrink-0 transition-all ${
                                                selectedProducts.size === products.length && products.length > 0
                                                    ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(0,210,255,0.4)]'
                                                    : 'border-white/20 hover:border-cyan-500/50'
                                            }`}
                                        >
                                            {selectedProducts.size === products.length && products.length > 0 && (
                                                <span className="material-icons-round text-white" style={{ fontSize: '12px' }}>check</span>
                                            )}
                                        </div>
                                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider flex-1">Produs</span>
                                        <span className="text-xs text-gray-400 font-medium uppercase tracking-wider w-24 text-right">Preț</span>
                                    </div>

                                    {/* Rows */}
                                    <div className="max-h-[260px] overflow-y-auto scrollbar-hide divide-y divide-white/5">
                                        {products.map(product => (
                                            <div
                                                key={product.id}
                                                onClick={() => toggleProduct(product.id)}
                                                className={`flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors ${
                                                    selectedProducts.has(product.id)
                                                        ? 'bg-cyan-500/10'
                                                        : 'hover:bg-white/5'
                                                }`}
                                            >
                                                {/* Round checkbox */}
                                                <div
                                                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                                                        selectedProducts.has(product.id)
                                                            ? 'bg-cyan-500 border-cyan-500 shadow-[0_0_8px_rgba(0,210,255,0.3)]'
                                                            : 'border-white/20'
                                                    }`}
                                                    onClick={e => { e.stopPropagation(); toggleProduct(product.id); }}
                                                >
                                                    {selectedProducts.has(product.id) && (
                                                        <span className="material-icons-round text-white" style={{ fontSize: '12px' }}>check</span>
                                                    )}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-sm text-white font-medium truncate">{product.title}</p>
                                                    <p className="text-xs text-gray-500 truncate">{product.vendor} · {product.product_type || '—'}</p>
                                                </div>
                                                <span className="text-sm text-cyan-400 font-medium w-24 text-right flex-shrink-0">
                                                    {product.variants?.[0]?.price ? `${product.variants[0].price} RON` : '—'}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Selection counter */}
                                <p className="text-xs text-gray-500 text-center">
                                    {selectedProducts.size} / {products.length} produse selectate
                                </p>

                                {/* Actions */}
                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setStep(3)}
                                        className="flex-1 btn-3d-secondary py-3.5 rounded-xl text-gray-400 font-semibold text-sm"
                                    >
                                        ÎNAPOI
                                    </button>
                                    <button
                                        disabled={selectedProducts.size === 0}
                                        onClick={() => setStep(5)}
                                        className="flex-[2] btn-3d-primary py-3.5 rounded-xl text-white font-semibold text-xs flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap"
                                    >
                                        <span className="material-icons-round text-base flex-shrink-0">smart_toy</span>
                                        ACTIVEAZĂ BOTUL PE PRODUSELE SELECTATE
                                    </button>
                                </div>
                            </div>
                        )}

                        {step === 5 && (
                            <div className="animate-in fade-in slide-in-from-right-4 duration-500 space-y-5">
                                <div className="grid grid-cols-2 gap-4">
                                    {(['confirmare', 'draft'] as const).map((mode) => {
                                        const isActive = activationModes.has(mode);
                                        const currentUpsell = upsellType[mode];
                                        const toggleMode = () => setActivationModes(prev => {
                                            const n = new Set(prev);
                                            n.has(mode) ? n.delete(mode) : n.add(mode);
                                            if (!n.has(mode)) setUpsellType(p => ({ ...p, [mode]: null }));
                                            return n;
                                        });
                                        const selectUpsell = (type: 'multi' | 'surpriza') => {
                                            if (!isActive) return;
                                            setUpsellType(p => ({ ...p, [mode]: p[mode] === type ? null : type }));
                                        };

                                        const UPSELL_OPTIONS = [
                                            {
                                                key: 'multi' as const,
                                                label: 'Upsell cu mai multe produse',
                                                sub: 'Recomandat consumabilelor',
                                                icon: 'add_shopping_cart',
                                            },
                                            {
                                                key: 'surpriza' as const,
                                                label: 'Upsell produs surpriză',
                                                sub: 'Recomandat neconsumabilelor',
                                                icon: 'card_giftcard',
                                            },
                                        ];

                                        return (
                                            <div key={mode} className="flex flex-col gap-2">
                                                {/* Main mode card */}
                                                <div
                                                    onClick={toggleMode}
                                                    className={`flex flex-col items-center text-center gap-3 p-5 rounded-xl border cursor-pointer transition-all ${
                                                        isActive
                                                            ? 'bg-cyan-500/10 border-cyan-500/60 shadow-[0_0_20px_rgba(0,210,255,0.12)]'
                                                            : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
                                                    }`}
                                                >
                                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center transition-all ${
                                                        isActive ? 'bg-cyan-500 text-white shadow-[0_0_12px_rgba(0,210,255,0.4)]' : 'bg-[#13151d] text-gray-500'
                                                    }`}>
                                                        <span className="material-icons-round text-2xl">
                                                            {mode === 'confirmare' ? 'check_circle' : 'edit_note'}
                                                        </span>
                                                    </div>
                                                    <div>
                                                        <p className={`font-semibold text-sm ${isActive ? 'text-white' : 'text-gray-300'}`}>
                                                            {mode === 'confirmare' ? 'Confirmare Comenzi' : 'Draft'}
                                                        </p>
                                                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                                                            {mode === 'confirmare'
                                                                ? 'Botul apelează clientul pentru a confirma comanda'
                                                                : 'Comanda rămâne în draft până la confirmare'}
                                                        </p>
                                                    </div>
                                                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                        isActive ? 'bg-cyan-500 border-cyan-500' : 'border-white/20'
                                                    }`}>
                                                        {isActive && <span className="material-icons-round text-white" style={{ fontSize: '12px' }}>check</span>}
                                                    </div>
                                                </div>

                                                {/* Upsell options — pick max 1 */}
                                                {UPSELL_OPTIONS.map(opt => {
                                                    const isSelected = currentUpsell === opt.key;
                                                    return (
                                                        <div
                                                            key={opt.key}
                                                            onClick={() => selectUpsell(opt.key)}
                                                            className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all ${
                                                                !isActive
                                                                    ? 'opacity-25 cursor-not-allowed border-white/5 bg-white/[0.02]'
                                                                    : isSelected
                                                                        ? 'bg-violet-500/10 border-violet-500/50 cursor-pointer shadow-[0_0_10px_rgba(139,92,246,0.15)]'
                                                                        : 'bg-white/[0.03] border-white/10 cursor-pointer hover:border-violet-500/30 hover:bg-violet-500/5'
                                                            }`}
                                                        >
                                                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 transition-all ${
                                                                isSelected && isActive ? 'bg-violet-500 text-white' : 'bg-white/5 text-gray-500'
                                                            }`}>
                                                                <span className="material-icons-round" style={{ fontSize: '15px' }}>{opt.icon}</span>
                                                            </div>
                                                            <div className="flex-1 min-w-0">
                                                                <p className={`text-xs font-semibold leading-tight ${ isSelected && isActive ? 'text-violet-300' : 'text-gray-400'}`}>{opt.label}</p>
                                                                <p className="text-[10px] text-gray-600 mt-0.5 truncate">{opt.sub}</p>
                                                            </div>
                                                            <div className={`w-3.5 h-3.5 rounded-full border-2 flex-shrink-0 transition-all ${
                                                                isSelected && isActive ? 'bg-violet-500 border-violet-500' : 'border-white/20'
                                                            }`} />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        );
                                    })}
                                </div>

                                <div className="flex gap-3 pt-1">
                                    <button
                                        onClick={() => setStep(4)}
                                        className="flex-1 btn-3d-secondary py-3.5 rounded-xl text-gray-400 font-semibold text-sm"
                                    >
                                        ÎNAPOI
                                    </button>
                                    <button
                                        disabled={activationModes.size === 0}
                                        onClick={() => setStep(6)}
                                        className="flex-[2] btn-3d-primary py-3.5 rounded-xl text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-30 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-icons-round text-base">rocket_launch</span>
                                        FINALIZEAZĂ CONFIGURAREA
                                    </button>
                                </div>
                            </div>
                        )}

                                {step === 6 && (
                                    <div className="text-center py-6 animate-in fade-in zoom-in-95 duration-500">
                                        <span className="material-icons-round text-7xl text-green-400 mb-6 drop-shadow-[0_0_15px_rgba(74,222,128,0.3)]">task_alt</span>
                                        <h2 className="text-3xl font-bold text-white mb-3" style={{ fontFamily: '"Space Grotesk", sans-serif' }}>Configurare Completă!</h2>
                                        <p className="text-gray-400 mb-1 max-w-sm mx-auto">
                                            Botul a fost activat pe {selectedProducts.size} {selectedProducts.size === 1 ? 'produs' : 'produse'}.
                                        </p>
                                        {storeNickname && (
                                            <p className="text-xs text-cyan-400/70 mb-6">
                                                Magazin „{storeNickname}” înregistrat în metrici.
                                            </p>
                                        )}
                                        <button
                                            onClick={async () => {
                                                await saveStoreToSupabase();
                                                setStep(1); setView('list');
                                                setSelectedProducts(new Set()); setProducts([]);
                                                setActivationModes(new Set()); setUpsellType({ confirmare: null, draft: null });
                                                setStoreNickname(''); setWebsiteUrl('');
                                            }}
                                            className="w-full btn-3d-primary py-4 rounded-xl text-white font-semibold text-base"
                                        >
                                            REVENIȚI LA LISTĂ
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>

                <div className="mt-10 text-center">
                    <button 
                        onClick={() => view === 'add' ? setView('list') : navigate('/')}
                        className="text-gray-500 hover:text-cyan-400 text-sm font-light transition-all flex items-center gap-2 mx-auto"
                    >
                        <span className="material-icons-round text-sm">{view === 'add' ? 'arrow_back' : 'dashboard'}</span>
                        {view === 'add' ? 'Anulează și revino la listă' : 'Sari peste și mergi la Dashboard'}
                    </button>
                </div>
            </div>
        </div>
    );
}

function PlatformCard({ name, icon, selected, onClick }: { name: string; icon: string; selected: boolean; onClick: () => void }) {
    return (
        <button
            onClick={onClick}
            className={`flex flex-col items-center justify-center p-8 rounded-2xl border transition-all duration-300 gap-4 group ${
                selected 
                ? 'bg-cyan-500/10 border-cyan-500 shadow-[0_0_20px_rgba(0,210,255,0.2)]' 
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/[0.07]'
            }`}
        >
            <div className={`w-16 h-16 rounded-xl flex items-center justify-center transition-all ${
                selected ? 'bg-cyan-500 text-white shadow-glow' : 'bg-[#13151d] text-gray-500 group-hover:text-gray-300'
            }`}>
                <span className="material-icons-round text-3xl">{icon}</span>
            </div>
            <span className={`text-lg font-semibold ${selected ? 'text-white' : 'text-gray-400'}`}>{name}</span>
            {selected && (
                <div className="absolute top-3 right-3">
                    <span className="material-icons-round text-cyan-500 text-xl">check_circle</span>
                </div>
            )}
        </button>
    );
}
