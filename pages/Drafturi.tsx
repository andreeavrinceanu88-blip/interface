import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { syncOrderStatusWithShopify, syncOrderAddressWithShopify, syncOrderNoteWithShopify, updateShopifyLineItemQuantity, getProductImages } from '../services/shopify';

// ─── Types ───────────────────────────────────────────────────────────────────
type CallStatus = 'ON' | 'OFF';

interface Order {
    id: number;
    order_id: string;
    name: string;
    phone_number: string;
    store_name: string;
    value: number;
    status: string;
    created_at: string;
    produse: string;
    adresa: string;
    cerere: string;
    cerere_adresa: string;
    cerere_upsell: string;
    notes: string;
    tags: string;
    type: string;
    health: string;
    istoric: string;
    client_personal_id: string;
    email: string;
}

const TABS: { id: string; label: string }[] = [
    { id: 'ON',  label: 'De sunat' },
    { id: 'nu-raspunde', label: 'Nu răspunde' },
    { id: 'de-revenit', label: 'De revenit' },
    { id: 'confirmat', label: 'Confirmate' },
    { id: 'anulat', label: 'Anulate' },
    { id: 'OFF', label: 'Altele (OFF)' },
];

const STATUS_STYLES: Record<string, string> = {
    'ON':  'bg-pink-100 text-pink-700 border border-pink-200',
    'OFF': 'bg-gray-100 text-gray-700 border border-gray-200',
    'nu-raspunde': 'bg-amber-100 text-amber-700 border border-amber-200',
    'de-revenit': 'bg-blue-100 text-blue-700 border border-blue-200',
    'confirmat': 'bg-emerald-100 text-emerald-700 border border-emerald-200',
    'anulat': 'bg-red-100 text-red-700 border border-red-200',
};

const STATUS_LABELS: Record<string, string> = {
    'ON':  'Neapelat',
    'OFF': 'Altele (OFF)',
    'nu-raspunde': 'Nu răspunde',
    'de-revenit': 'De revenit',
    'confirmat': 'Confirmat',
    'anulat': 'Anulat',
};

const QUICK_ACTIONS = [
    { id: 'confirmat',   label: 'Confirmă',          style: 'bg-[#F0FDF4] border-emerald-200 text-emerald-700 hover:bg-emerald-100', icon: 'check' },
    { id: 'nu-raspunde', label: 'Nu răspunde',        style: 'bg-[#FFFBEB] border-amber-200 text-amber-700 hover:bg-amber-100',         icon: 'phone_missed' },
    { id: 'de-revenit',  label: 'Sună mai târziu',   style: 'bg-[#EFF6FF] border-blue-200 text-blue-700 hover:bg-blue-100',             icon: 'schedule' },
    { id: 'anulat',      label: 'Anulează',          style: 'bg-[#FEF2F2] border-red-200 text-red-700 hover:bg-red-100',                  icon: 'close' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const money = (v: number | string) =>
    new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0)) + ' lei';

const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
};

interface ProduseItem {
    id: number;
    variant_id: number;
    title: string;
    variant_title: string | null;
    quantity: number;
    price: string;
    sku: string;
    admin_graphql_api_id: string;
    [key: string]: any;
}

const parseProduse = (produse: string): ProduseItem[] => {
    if (!produse) return [];
    try {
        const parsed = JSON.parse(produse);
        if (Array.isArray(parsed)) return parsed;
        return [];
    } catch {
        return [];
    }
};

const produseDisplayText = (produse: string): string => {
    const items = parseProduse(produse);
    if (items.length === 0) return produse || '';
    return items.map(it => `${it.title} x${it.quantity}`).join(', ');
};

// ─── Component ───────────────────────────────────────────────────────────────
const Drafturi = () => {
    const { profile } = useAuth();
    const userStores: string[] = profile?.stores || [];

    // ── Filters
    const [viewMode, setViewMode] = useState<'drafturi' | 'comenzi'>('drafturi');
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<string>('ON');
    const [startDate, setStartDate] = useState(() => { const d = new Date(); d.setDate(d.getDate() - 7); return d.toISOString().split('T')[0]; });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    // ── Data
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [noteText, setNoteText] = useState('');
    const [savingNote, setSavingNote] = useState(false);
    const [updatingStatus, setUpdatingStatus] = useState(false);
    const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
    const [addressText, setAddressText] = useState('');
    const [savingAddress, setSavingAddress] = useState(false);
    const [toast, setToast] = useState<string>('');
    const [shopifyNotif, setShopifyNotif] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ── Product editing
    const [editingProducts, setEditingProducts] = useState(false);
    const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>({});
    const [savingProducts, setSavingProducts] = useState(false);
    const [productImages, setProductImages] = useState<Record<string, string | null>>({});

    // ── Dialer
    const [dialerOpen, setDialerOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const clientRef = useRef<any>(null);
    const callRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [callState, setCallState] = useState<'idle' | 'calling' | 'active'>('idle');

    // ── Toast helper
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    // ── Shopify notification helper
    const showShopifyNotif = (msg: string, type: 'success' | 'error') => {
        setShopifyNotif({ msg, type });
        setTimeout(() => setShopifyNotif(null), 4000);
    };

    // ── Init brand
    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) setSelectedBrand(userStores[0]);
    }, [userStores]);

    // ── Init Telnyx
    useEffect(() => {
        const username = import.meta.env?.VITE_TELNYX_SIP_USERNAME ?? 'vitadomus';
        const password = import.meta.env?.VITE_TELNYX_SIP_PASSWORD ?? 'vitadomus';
        if (!username || !password) return;
        setIsConnecting(true);
        import('@telnyx/webrtc').then(({ TelnyxRTC }) => {
            const client = new TelnyxRTC({ login: username, password: password });
            client.on('telnyx.ready', () => setIsConnecting(false));
            client.on('telnyx.error', () => setIsConnecting(false));
            client.on('telnyx.notification', (notification: any) => {
                const call = notification.call;
                if (notification.type === 'callUpdate') {
                    if (call.state === 'ringing') setCallState('calling');
                    else if (call.state === 'active') {
                        setCallState('active');
                        if (audioRef.current && call.remoteStream) {
                            audioRef.current.srcObject = call.remoteStream;
                            audioRef.current.play().catch(() => {});
                        }
                    } else if (call.state === 'destroy') {
                        setCallState('idle');
                        callRef.current = null;
                        if (audioRef.current) audioRef.current.srcObject = null;
                    }
                }
            });
            client.connect();
            clientRef.current = client;
        }).catch(() => setIsConnecting(false));
        return () => { if (clientRef.current) { clientRef.current.disconnect(); clientRef.current = null; } };
    }, []);

    // ── Load orders
    const loadOrders = useCallback(async () => {
        if (!selectedBrand) { console.log('[Orders] no brand yet, skipping'); return; }
        setLoading(true);
        setError(null);
        try {
            const endOfDay = endDate + 'T23:59:59';
            console.log('[Orders] querying store:', selectedBrand, 'from', startDate, 'to', endDate);
            const { data, error: qErr } = await supabaseAdmin
                .from('orders')
                .select('*')
                .ilike('store_name', selectedBrand)
                .gte('created_at', startDate + 'T00:00:00')
                .lte('created_at', endOfDay)
                .order('created_at', { ascending: false });

            if (qErr) throw qErr;
            const all: Order[] = (data || []).map(o => ({
                ...o,
                status: o.status || 'ON'
            }));
            console.log('[Orders] fetched', all.length, 'rows');
            setOrders(all);

        } catch (err: any) {
            console.error('[Orders] error:', err);
            setError(err?.message || 'Eroare la încărcarea comenzilor');
        } finally {
            setLoading(false);
        }
    }, [selectedBrand, startDate, endDate]);

    useEffect(() => { loadOrders(); }, [loadOrders]);

    // ── Filtered list for current tab + search
    const typeFilteredOrders = orders.filter(o => viewMode === 'drafturi' ? o.type === 'draft' : o.type !== 'draft');
    const tabOrders = typeFilteredOrders.filter(o => o.status === activeTab);
    const filteredOrders = activeSearch
        ? tabOrders.filter(o =>
            o.name?.toLowerCase().includes(activeSearch.toLowerCase()) ||
            o.phone_number?.includes(activeSearch) ||
            o.client_personal_id?.includes(activeSearch)
        )
        : tabOrders;

    // ── Selected order
    const selectedOrder = orders.find(o => o.id === selectedId) || null;

    // Auto-select first when tab changes
    useEffect(() => {
        const first = tabOrders[0];
        if (first) { setSelectedId(first.id); setNoteText(first.notes || ''); }
        else { setSelectedId(null); setNoteText(''); }
    }, [activeTab, orders]);

    // ── Fetch product images when selected order changes
    useEffect(() => {
        if (!selectedOrder) return;
        const items = parseProduse(selectedOrder.produse);
        if (items.length === 0) return;
        // Only fetch for product IDs we don't already have
        const missingIds = items
            .map(it => it.product_id)
            .filter(pid => pid && !(String(pid) in productImages));
        if (missingIds.length === 0) return;
        const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
        getProductImages(storeName, missingIds).then(imgs => {
            if (imgs) setProductImages(prev => ({ ...prev, ...imgs }));
        });
    }, [selectedId, selectedOrder?.produse]);

    // Sync note text when selection changes
    useEffect(() => {
        if (selectedOrder) setNoteText(selectedOrder.notes || '');
    }, [selectedId]);

    const updateStatus = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(true);
        const { error: uErr } = await supabaseAdmin.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (!uErr) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            showToast(STATUS_LABELS[newStatus]);

            // Sync with Shopify
            const orderToSync = orders.find(o => o.id === orderId);
            if (orderToSync) {
                const shopifyId = orderToSync.order_id || orderToSync.id.toString();
                const storeName = orderToSync.store_name || selectedBrand || 'Tamtrend';
                // We call it in the background to not block the UI completely, 
                // but we can await it if we want to show a toast.
                syncOrderStatusWithShopify(storeName, shopifyId, newStatus, orderToSync.notes || undefined)
                    .then(success => {
                        if (success) showShopifyNotif('Shopify sincronizat ✓ Tag-ul a fost adăugat', 'success');
                        else showShopifyNotif('Eroare Shopify — Tag-ul nu a fost sincronizat', 'error');
                    });
            }

            // Auto-select next in same tab
            const remaining = tabOrders.filter(o => o.id !== orderId);
            if (remaining.length > 0) { setSelectedId(remaining[0].id); setNoteText(remaining[0].notes || ''); }
            else { setSelectedId(null); }
        } else {
            showToast('Eroare la salvare');
        }
        setUpdatingStatus(false);
    };

    // ── Save note
    const saveNote = async () => {
        if (!selectedOrder) return;
        setSavingNote(true);
        const { error: nErr } = await supabaseAdmin.from('orders').update({ notes: noteText }).eq('id', selectedOrder.id);
        if (!nErr) {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, notes: noteText } : o));
            showToast('Notiță salvată');

            // Sync with Shopify
            if (selectedOrder.type === 'draft') {
                const shopifyId = selectedOrder.order_id || selectedOrder.id.toString();
                const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                syncOrderNoteWithShopify(storeName, shopifyId, noteText).then(success => {
                    if (success) showShopifyNotif('Shopify sincronizat ✓ Notița a fost actualizată', 'success');
                    else showShopifyNotif('Eroare Shopify — Notița nu a fost sincronizată', 'error');
                });
            }
        } else {
            console.error('[SaveNote] error:', nErr);
            setError('Eroare la salvarea notiței');
            showToast('Eroare la salvare');
        }
        setSavingNote(false);
    };

    // ── Save address
    const handleSaveAddress = async () => {
        if (!selectedOrder) return;
        setSavingAddress(true);
        const newAddress = addressText.trim();
        const { error: err } = await supabaseAdmin.from('orders').update({ adresa: newAddress }).eq('id', selectedOrder.id);
        if (!err) {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, adresa: newAddress } : o));
            showToast('Adresa a fost actualizată');
            setEditingAddressId(null);
            
            // Sync with Shopify if it's a draft order
            if (selectedOrder.type === 'draft') {
                const shopifyId = selectedOrder.order_id || selectedOrder.id.toString();
                const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                syncOrderAddressWithShopify(storeName, shopifyId, newAddress).then(success => {
                    if (success) showShopifyNotif('Shopify sincronizat ✓ Adresa a fost actualizată', 'success');
                    else showShopifyNotif('Eroare Shopify — Adresa nu a fost sincronizată', 'error');
                });
            }
        } else {
            console.error('[SaveAddress] error:', err);
            showToast('Eroare la salvarea adresei');
        }
        setSavingAddress(false);
    };

    // ── Dialer actions
    const handleKeypadPress = (key: string) => setPhoneNumber(prev => prev + key);
    const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));
    const handleCallAction = async () => {
        if (!phoneNumber) return;
        if (callState === 'idle') {
            if (!clientRef.current) { alert('Conexiunea la serverul de telefonie nu a reușit. Contactați administratorul.'); return; }
            try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { alert('Este nevoie de acces la microfon pentru a suna!'); return; }
            const callerId = import.meta.env?.VITE_TELNYX_CALLER_ID ?? '+40751064714';
            try { callRef.current = clientRef.current.newCall({ destinationNumber: phoneNumber, callerNumber: callerId, audio: true, video: false }); setCallState('calling'); }
            catch (err) { console.error('Call failed', err); alert('A apărut o eroare la inițierea apelului.'); }
        } else {
            if (callRef.current) callRef.current.hangup();
            setCallState('idle');
        }
    };

    const callClient = (phone: string) => {
        setPhoneNumber(phone.replace(/\s/g, ''));
        setDialerOpen(true);
    };

    // ── Render
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#F9FAFB] text-gray-900 rounded-tl-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-t border-gray-200 absolute inset-0 pt-6 px-6">
            <audio ref={audioRef} style={{ display: 'none' }} />

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl animate-fade-in">
                    {toast}
                </div>
            )}

            {/* Shopify Notification Popup */}
            {shopifyNotif && (
                <div 
                    className={`fixed top-6 right-6 z-[100] flex items-center gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-sm transition-all duration-300 animate-fade-in ${
                        shopifyNotif.type === 'success' 
                            ? 'bg-emerald-50/95 border-emerald-200 text-emerald-800' 
                            : 'bg-red-50/95 border-red-200 text-red-800'
                    }`}
                    style={{ minWidth: '300px', maxWidth: '420px' }}
                >
                    <span className={`material-icons-round text-xl ${
                        shopifyNotif.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                        {shopifyNotif.type === 'success' ? 'cloud_done' : 'cloud_off'}
                    </span>
                    <div className="flex-1">
                        <p className="text-[13px] font-bold leading-tight">
                            {shopifyNotif.type === 'success' ? 'Sincronizare reușită' : 'Eroare sincronizare'}
                        </p>
                        <p className="text-[12px] font-medium opacity-80 mt-0.5">{shopifyNotif.msg}</p>
                    </div>
                    <button onClick={() => setShopifyNotif(null)} className="text-gray-400 hover:text-gray-600 transition-colors ml-1">
                        <span className="material-icons-round text-[18px]">close</span>
                    </button>
                </div>
            )}

            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <h1 className="text-2xl font-semibold text-gray-900 flex items-center gap-3">
                        Comenzi de sunat 
                        <span className="bg-indigo-100 text-indigo-700 text-sm font-bold px-2.5 py-0.5 rounded-full">{orders.length}</span>
                    </h1>
                    
                    {/* Brand dropdown */}
                    <div className="relative ml-4">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm min-w-[140px] flex justify-between items-center h-[40px] text-gray-700 hover:bg-gray-50 transition-all shadow-sm">
                            <span className="font-medium">{selectedBrand || 'Selectează'}</span>
                            <span className={`material-icons-round text-base text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                <div className="absolute left-0 top-full mt-2 w-full rounded-xl bg-white border border-gray-200 shadow-xl z-50 overflow-hidden">
                                    {userStores.map(store => (
                                        <button key={store} onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-700 hover:bg-indigo-50 transition-colors flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedBrand === store ? 'bg-indigo-600' : 'bg-transparent border border-gray-300'}`} />
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex bg-gray-100 p-1 rounded-xl shadow-inner">
                        <button 
                            onClick={() => setViewMode('drafturi')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'drafturi' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Drafturi
                        </button>
                        <button 
                            onClick={() => setViewMode('comenzi')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'comenzi' ? 'bg-white text-indigo-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                        >
                            Comenzi
                        </button>
                    </div>
                    
                    {/* Operators mock */}
                    <button className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm flex items-center gap-2 h-[40px] text-gray-700 hover:bg-gray-50 shadow-sm hidden sm:flex">
                        <span>Toți operatorii</span>
                        <span className="material-icons-round text-base text-gray-400">arrow_drop_down</span>
                    </button>
                    
                    {/* Priority mock */}
                    <button className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm flex items-center gap-2 h-[40px] text-gray-700 hover:bg-gray-50 shadow-sm hidden md:flex">
                        <span>Sortează: Prioritate</span>
                        <span className="material-icons-round text-base text-gray-400">arrow_drop_down</span>
                    </button>
                    
                    {/* Filters mock */}
                    <button className="bg-white border border-gray-200 px-4 py-2 rounded-xl text-sm flex items-center gap-2 h-[40px] text-gray-700 hover:bg-gray-50 shadow-sm hidden md:flex">
                        <span className="material-icons-round text-base text-indigo-500">filter_list</span>
                        Filtre
                    </button>
                </div>

                <div className="flex flex-wrap gap-4 items-center justify-end">
                    {/* Status indicator */}
                    <div className="flex items-center gap-3 mr-4">
                        {!isConnecting && clientRef.current ? (
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-200">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-medium text-red-700 bg-red-50 px-3 py-1.5 rounded-full border border-red-200">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span> Offline
                            </div>
                        )}
                    </div>

                    {/* Dialer toggle */}
                    <button onClick={() => setDialerOpen(!dialerOpen)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all h-[42px] shadow-sm ${dialerOpen ? 'bg-indigo-100 text-indigo-700 border-indigo-200' : 'bg-[#5B4FDB] text-white hover:bg-indigo-700'}`}>
                        <span className="material-icons-round text-lg">dialpad</span>
                        Dialer
                    </button>
                </div>
            </div>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex gap-6 flex-1 min-h-0 pb-6">

                {/* ── Left: List ────────────────────────────────────────────── */}
                <div className="w-[420px] shrink-0 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-gray-200 bg-white overflow-x-auto scrollbar-hide px-2">
                        {TABS.map(tab => {
                            const count = typeFilteredOrders.filter(o => o.status === tab.id).length;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setActiveSearch(''); setSearchInput(''); }}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold whitespace-nowrap transition-all border-b-2 shrink-0 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
                                >
                                    {tab.label}
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-gray-100 bg-gray-50">
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400" style={{fontSize:'18px'}}>search</span>
                            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setActiveSearch(searchInput)} placeholder="Caută..." className="w-full pl-9 pr-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-gray-900" />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#F9FAFB]">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-24 bg-white rounded-xl border border-gray-200 animate-pulse" />
                            ))
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full text-red-500 py-16 gap-3 text-center px-4">
                                <span className="material-icons-round text-4xl">error_outline</span>
                                <span className="text-sm font-medium">{error}</span>
                                <button onClick={loadOrders} className="text-sm font-bold text-indigo-600 hover:underline">Reîncearcă</button>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-400 py-16 gap-3">
                                <span className="material-icons-round text-4xl">inbox</span>
                                <span className="text-sm">Nicio comandă aici.</span>
                            </div>
                        ) : (
                            filteredOrders.map(order => (
                                <button
                                    key={order.id}
                                    onClick={() => { setSelectedId(order.id); setNoteText(order.notes || ''); }}
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all shadow-sm relative ${selectedId === order.id ? 'border-indigo-400 bg-indigo-50/30' : 'border-transparent bg-white hover:border-gray-300'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-semibold text-gray-400">#{order.id} <span className="font-normal ml-1 text-gray-400">{fmtDate(order.created_at).split(',')[0]}</span></span>
                                        {(!order.cerere_adresa || order.cerere_adresa.trim() === '' || order.cerere_adresa.trim() === '-') ? (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-700 tracking-wide border border-emerald-200" title="Adresă corectă">ADRESĂ OK</span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-red-50 text-red-700 tracking-wide border border-red-200" title={`Adresă greșită: ${order.cerere_adresa}`}>ADRESĂ GREȘITĂ</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <p className="text-base font-bold text-gray-900 leading-tight truncate pr-2">{order.name || 'Client Nou'}</p>
                                        <span className="text-base font-bold text-gray-900 shrink-0">{money(order.value)}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">{order.phone_number || '—'}</p>
                                    {order.produse && <p className="text-sm text-indigo-600 font-medium truncate">{produseDisplayText(order.produse)}</p>}
                                </button>
                            ))
                        )}
                    </div>
                </div>

                {/* ── Right: Detail + Dialer ─────────────────────────────── */}
                <div className="flex-1 flex gap-6 min-h-0 min-w-0">

                    {/* Order Detail */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide min-w-0 pr-2">
                        {!selectedOrder ? (
                            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <span className="material-icons-round text-6xl text-gray-300">ads_click</span>
                                <p className="text-lg font-medium text-gray-500">Selectează o comandă pentru detalii.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-10">
                                {/* Header / Title */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-2xl font-bold text-gray-900">Comanda {selectedOrder.client_personal_id || `#${selectedOrder.id}`}</h2>
                                        <span className={`text-xs font-bold px-2.5 py-1 rounded-md ${STATUS_STYLES[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                        Sursă: <span className="text-gray-900">Facebook Ads</span>
                                        <button className="ml-2 w-8 h-8 flex items-center justify-center rounded hover:bg-gray-100 text-gray-400 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Main Action buttons */}
                                <div className="flex gap-4">
                                    <button onClick={() => callClient(selectedOrder.phone_number)} className="flex-1 flex items-center justify-center gap-2 bg-[#22C55E] hover:bg-[#16A34A] text-white font-bold py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(34,197,94,0.39)] text-[15px]">
                                        <span className="material-icons-round text-xl">call</span>
                                        Suna client
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-all shadow-sm text-[15px]">
                                        <span className="material-icons-round text-[#25D366]">chat</span>
                                        WhatsApp
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-semibold py-3.5 rounded-xl transition-all shadow-sm text-[15px]">
                                        <span className="material-icons-round">history</span>
                                        Istoric apeluri
                                    </button>
                                </div>

                                {/* Info Grids */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Client Details */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
                                        {editingAddressId !== selectedOrder.id && (
                                            <button onClick={() => { setEditingAddressId(selectedOrder.id); setAddressText(selectedOrder.adresa || ''); }} className="absolute top-6 right-6 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1">
                                                <span className="material-icons-round text-[16px]">edit</span> Editează
                                            </button>
                                        )}
                                        <h3 className="text-base font-bold text-gray-900 mb-6">Date client</h3>
                                        
                                        <div className="space-y-4">
                                            <Field label="Nume" value={selectedOrder.name} />
                                            <div>
                                                <p className="text-[12px] text-gray-500 font-medium mb-1">Telefon</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base text-gray-900 font-bold">{selectedOrder.phone_number || '—'}</span>
                                                    {selectedOrder.phone_number && (
                                                        <button onClick={() => { navigator.clipboard?.writeText(selectedOrder.phone_number); showToast('Copiat!'); }} className="text-gray-400 hover:text-gray-700 transition-colors">
                                                            <span className="material-icons-round text-[16px]">content_copy</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <Field label="Email" value={selectedOrder.email || 'nespecificat'} />
                                            <div>
                                                <p className="text-[12px] text-gray-500 font-medium mb-1">Adresă livrare</p>
                                                {editingAddressId === selectedOrder.id ? (
                                                    <div className="mt-2 space-y-2 relative z-10">
                                                        <textarea
                                                            className="w-full text-sm font-medium text-gray-900 border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                            rows={3}
                                                            value={addressText}
                                                            onChange={(e) => setAddressText(e.target.value)}
                                                            disabled={savingAddress}
                                                        />
                                                        <div className="flex gap-2 justify-end">
                                                            <button onClick={() => setEditingAddressId(null)} disabled={savingAddress} className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50">Anulează</button>
                                                            <button onClick={handleSaveAddress} disabled={savingAddress} className="px-3 py-1 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                                                {savingAddress ? 'Se salvează...' : 'Salvează'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <p className="text-sm font-medium text-gray-900 leading-relaxed whitespace-pre-line">{selectedOrder.adresa || '—'}</p>
                                                        <p className="text-emerald-600 text-xs font-semibold mt-2 flex items-center gap-1">
                                                            <span className="material-icons-round text-[14px]">check</span> Adresă completă
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Details */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
                                        <button className="absolute top-6 right-6 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1">
                                            <span className="material-icons-round text-[16px]">edit</span> Editează
                                        </button>
                                        <h3 className="text-base font-bold text-gray-900 mb-6">Detalii comandă</h3>
                                        
                                        <div className="space-y-4">
                                            <DL label="Status" value={<span className={`text-[11px] font-bold px-2 py-0.5 rounded ${STATUS_STYLES[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>} />
                                            <DL label="Creată" value={fmtDate(selectedOrder.created_at)} />
                                            <DL label="Metodă plată" value="Ramburs" />
                                            <DL label="Metodă livrare" value="Curier rapid" />
                                            
                                            <div className="pt-4 mt-2 border-t border-gray-100 space-y-3">
                                                <DL label="Valoare produse" value={money(selectedOrder.value)} />
                                                <DL label="Transport" value="0,00 lei" />
                                                <DL label={<span className="font-bold text-gray-900 text-sm">Total comandă</span>} value={<span className="font-bold text-indigo-600 text-base">{money(selectedOrder.value)}</span>} />
                                            </div>

                                            {selectedOrder.cerere && (
                                                <div className="mt-4 pt-4 border-t border-gray-100">
                                                    <p className="text-[12px] text-gray-500 font-medium mb-1">Notițe client</p>
                                                    <p className="text-sm text-gray-900">{selectedOrder.cerere}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Products + Actions Row */}
                                <div className="grid grid-cols-2 gap-6">
                                    {/* Products */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 relative">
                                        {!editingProducts && (
                                            <button 
                                                onClick={() => {
                                                    const items = parseProduse(selectedOrder.produse);
                                                    if (items.length === 0) {
                                                        showToast('Nu sunt produse de editat');
                                                        return;
                                                    }
                                                    setEditingProducts(true);
                                                    const qMap: Record<string, number> = {};
                                                    items.forEach(it => { qMap[String(it.variant_id)] = it.quantity; });
                                                    setEditedQuantities(qMap);
                                                }}
                                                className="absolute top-6 right-6 text-indigo-600 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1"
                                            >
                                                <span className="material-icons-round text-[16px]">edit</span> Editează produse
                                            </button>
                                        )}
                                        {editingProducts && (
                                            <div className="absolute top-6 right-6 flex gap-2">
                                                <button 
                                                    onClick={() => { setEditingProducts(false); setEditedQuantities({}); }}
                                                    className="text-gray-500 hover:text-gray-700 text-sm font-semibold flex items-center gap-1"
                                                >
                                                    <span className="material-icons-round text-[16px]">close</span> Anulează
                                                </button>
                                                <button 
                                                    disabled={savingProducts}
                                                    onClick={async () => {
                                                        setSavingProducts(true);
                                                        const items = parseProduse(selectedOrder.produse);
                                                        // Update JSON with new quantities
                                                        const updatedJson = items.map(it => ({
                                                            ...it,
                                                            quantity: editedQuantities[String(it.variant_id)] ?? it.quantity,
                                                        }));
                                                        const newProduse = JSON.stringify(updatedJson);
                                                        
                                                        // Save to Supabase
                                                        const { error: dbErr } = await supabaseAdmin.from('orders').update({ produse: newProduse }).eq('id', selectedOrder.id);
                                                        if (dbErr) {
                                                            showToast('Eroare la salvare în baza de date');
                                                            setSavingProducts(false);
                                                            return;
                                                        }
                                                        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, produse: newProduse } : o));
                                                        
                                                        // Sync to Shopify
                                                        const shopifyId = selectedOrder.order_id || selectedOrder.id.toString();
                                                        const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                                                        const shopifyItems = updatedJson.map(it => ({
                                                            variantId: `gid://shopify/ProductVariant/${it.variant_id}`,
                                                            quantity: it.quantity,
                                                        }));
                                                        const result = await updateShopifyLineItemQuantity(storeName, shopifyId, shopifyItems);
                                                        if (result) {
                                                            showShopifyNotif('Shopify sincronizat ✓ Cantitățile au fost actualizate', 'success');
                                                        } else {
                                                            showShopifyNotif('Eroare Shopify — Cantitățile nu au fost sincronizate', 'error');
                                                        }
                                                        
                                                        setSavingProducts(false);
                                                        setEditingProducts(false);
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <span className="material-icons-round text-[16px]">save</span>
                                                    {savingProducts ? 'Se salvează...' : 'Salvează'}
                                                </button>
                                            </div>
                                        )}
                                        <h3 className="text-base font-bold text-gray-900 mb-6">Produse comandate</h3>
                                        
                                        {(() => {
                                            const items = parseProduse(selectedOrder.produse);
                                            if (items.length === 0) {
                                                return (
                                                    <div className="text-sm font-medium text-gray-700 whitespace-pre-wrap leading-relaxed">
                                                        {selectedOrder.produse || <span className="text-gray-400 italic">Niciun produs specificat</span>}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="space-y-3">
                                                    {items.map((item) => {
                                                        const qty = editingProducts ? (editedQuantities[String(item.variant_id)] ?? item.quantity) : item.quantity;
                                                        const price = parseFloat(item.price);
                                                        return (
                                                            <div key={item.id} className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 border border-gray-200">
                                                                {/* Product Image */}
                                                                <div className="w-12 h-12 rounded-lg bg-white border border-gray-200 overflow-hidden shrink-0 flex items-center justify-center">
                                                                    {productImages[String(item.product_id)] ? (
                                                                        <img 
                                                                            src={productImages[String(item.product_id)]!} 
                                                                            alt={item.title}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <span className="material-icons-round text-gray-300 text-xl">inventory_2</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-sm font-semibold text-gray-900 truncate">{item.title}</p>
                                                                    <p className="text-xs text-gray-500">{price.toFixed(2)} lei / buc{item.sku ? ` · ${item.sku}` : ''}</p>
                                                                </div>
                                                                {editingProducts ? (
                                                                    <div className="flex items-center gap-1.5 shrink-0">
                                                                        <button 
                                                                            onClick={() => {
                                                                                const cur = editedQuantities[String(item.variant_id)] ?? item.quantity;
                                                                                if (cur > 1) setEditedQuantities(prev => ({ ...prev, [String(item.variant_id)]: cur - 1 }));
                                                                            }}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors font-bold text-lg"
                                                                        >
                                                                            −
                                                                        </button>
                                                                        <input 
                                                                            type="number" 
                                                                            min={1}
                                                                            value={qty}
                                                                            onChange={(e) => {
                                                                                const val = parseInt(e.target.value);
                                                                                if (!isNaN(val) && val >= 1) setEditedQuantities(prev => ({ ...prev, [String(item.variant_id)]: val }));
                                                                            }}
                                                                            className="w-12 h-8 text-center text-sm font-bold text-gray-900 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                                                                        />
                                                                        <button 
                                                                            onClick={() => {
                                                                                const cur = editedQuantities[String(item.variant_id)] ?? item.quantity;
                                                                                setEditedQuantities(prev => ({ ...prev, [String(item.variant_id)]: cur + 1 }));
                                                                            }}
                                                                            className="w-8 h-8 flex items-center justify-center rounded-lg bg-white border border-gray-300 text-gray-600 hover:bg-gray-100 transition-colors font-bold text-lg"
                                                                        >
                                                                            +
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-sm font-semibold text-gray-600 shrink-0">x{qty}</span>
                                                                )}
                                                                <span className="text-sm font-bold text-indigo-600 w-20 text-right">
                                                                    {(price * qty).toFixed(2)} lei
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                        
                                        {selectedOrder.cerere_upsell && (
                                            <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4">
                                                <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider mb-1">Oportunitate Upsell</p>
                                                <p className="text-sm font-medium text-amber-900">{selectedOrder.cerere_upsell}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                        <h3 className="text-base font-bold text-gray-900 mb-6">Acțiuni rapide</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            {QUICK_ACTIONS.map(action => (
                                                <button
                                                    key={action.id}
                                                    onClick={() => updateStatus(selectedOrder.id, action.id as CallStatus)}
                                                    disabled={updatingStatus || selectedOrder.status === action.id}
                                                    className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border-2 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${action.style} ${selectedOrder.status === action.id ? 'ring-2 ring-current ring-offset-2' : 'border-transparent'}`}
                                                >
                                                    <span className="material-icons-round text-lg">{action.icon}</span>
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                
                                {/* Notes */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
                                    <h3 className="text-base font-bold text-gray-900 mb-4">Notițe apel</h3>
                                    <textarea
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        placeholder="Adaugă observații..."
                                        className="w-full min-h-[100px] bg-gray-50 border border-gray-200 rounded-xl p-4 text-sm text-gray-900 placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
                                    />
                                    <button onClick={saveNote} disabled={savingNote} className="mt-3 px-6 py-2.5 bg-gray-900 hover:bg-black text-white text-sm font-semibold rounded-xl transition-all disabled:opacity-50">
                                        {savingNote ? 'Se salvează...' : 'Salvează'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* ── Dialer Panel ───────────────────────────────────────── */}
                    {dialerOpen && (
                        <div className="w-[300px] shrink-0 bg-white rounded-2xl shadow-xl border border-gray-200 p-6 flex flex-col items-center h-[520px]">
                            <h3 className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-6">Dialer</h3>
                            
                            {/* Phone display */}
                            <div className="w-full mb-8 min-h-[50px] flex items-center justify-center relative bg-gray-50 rounded-xl">
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-center text-3xl font-medium text-gray-900 tracking-wider"
                                    placeholder=" "
                                    autoFocus
                                />
                                {phoneNumber && (
                                    <button onClick={handleDelete} className="absolute right-3 text-gray-400 hover:text-gray-700 transition-colors">
                                        <span className="material-icons-round">backspace</span>
                                    </button>
                                )}
                            </div>

                            {/* Call state */}
                            {callState !== 'idle' && (
                                <div className={`mb-6 px-5 py-2 rounded-full text-xs font-bold tracking-wider uppercase animate-pulse ${callState === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>
                                    {callState === 'active' ? 'Apel în curs...' : 'Apelează...'}
                                </div>
                            )}

                            {/* Keypad */}
                            <div className={`grid grid-cols-3 gap-4 w-full mb-8 transition-opacity ${callState !== 'idle' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                {[
                                    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
                                    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
                                    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
                                    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' }
                                ].map(item => (
                                    <button key={item.key} onClick={() => handleKeypadPress(item.key)} className="flex flex-col items-center justify-center h-16 w-16 rounded-full bg-white hover:bg-gray-50 border border-gray-200 shadow-sm transition-all active:scale-95 mx-auto">
                                        <span className="text-2xl font-semibold text-gray-700">{item.key}</span>
                                        {item.sub && <span className="text-[9px] text-gray-400 font-bold tracking-widest">{item.sub}</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Call button */}
                            <button
                                onClick={handleCallAction}
                                disabled={!phoneNumber && callState === 'idle'}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg ${callState === 'idle' ? 'bg-[#22C55E] hover:bg-[#16A34A]' : 'bg-red-500 hover:bg-red-600'}`}
                            >
                                <span className="material-icons-round text-white text-3xl">{callState === 'idle' ? 'call' : 'call_end'}</span>
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Field = ({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) => (
    <div>
        <p className="text-[12px] text-gray-500 font-medium mb-1">{label}</p>
        <p className={`text-base font-bold ${highlight ? 'text-amber-600' : 'text-gray-900'}`}>{value || '—'}</p>
    </div>
);

const DL = ({ label, value }: { label: string | React.ReactNode; value: React.ReactNode }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-gray-900 text-right">{value}</span>
    </div>
);

export default Drafturi;
