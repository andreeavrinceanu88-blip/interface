import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTelnyx } from '../contexts/TelnyxContext';
import { supabase } from '../lib/supabaseClient';
import { syncOrderStatusWithShopify, syncOrderAddressWithShopify, syncOrderNoteWithShopify, updateShopifyLineItemQuantity, getProductImages, getAllProducts, updateShopifyLineItemsBulk } from '../services/shopify';

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
    oras?: string;
    judet?: string;
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
    'OFF': 'bg-[#13141a]/5 text-gray-300 border border-white/5',
    'nu-raspunde': 'bg-amber-100 text-amber-400 border border-amber-500/30',
    'de-revenit': 'bg-blue-100 text-blue-400 border border-blue-500/30',
    'confirmat': 'bg-emerald-100 text-emerald-400 border border-emerald-500/30',
    'anulat': 'bg-red-100 text-red-400 border border-red-500/30',
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
    { id: 'confirmat',   label: 'Confirmă',          style: 'bg-[#F0FDF4] border-emerald-500/30 text-emerald-400 hover:bg-emerald-100', icon: 'check' },
    { id: 'nu-raspunde', label: 'Nu răspunde',        style: 'bg-[#FFFBEB] border-amber-500/30 text-amber-400 hover:bg-amber-100',         icon: 'phone_missed' },
    { id: 'de-revenit',  label: 'Sună mai târziu',   style: 'bg-[#EFF6FF] border-blue-500/30 text-blue-400 hover:bg-blue-100',             icon: 'schedule' },
    { id: 'anulat',      label: 'Anulează',          style: 'bg-[#FEF2F2] border-red-500/30 text-red-400 hover:bg-red-100',                  icon: 'close' },
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

const formatPhoneNumber = (phone: string | null | undefined): string => {
    if (!phone) return '—';
    // Remove all non-digits
    let cleaned = phone.replace(/\D/g, '');
    
    // If it starts with 40 and has 11 digits, replace 40 with 0
    if (cleaned.startsWith('40') && cleaned.length === 11) {
        cleaned = '0' + cleaned.substring(2);
    }
    
    // If it's a 10 digit number starting with 0, format as 07xx xxx xxx
    if (cleaned.length === 10 && cleaned.startsWith('0')) {
        return `${cleaned.substring(0, 4)} ${cleaned.substring(4, 7)} ${cleaned.substring(7, 10)}`;
    }
    
    // Otherwise return original
    return phone;
};

// ─── Component ───────────────────────────────────────────────────────────────
const Drafturi = () => {
    const { profile } = useAuth();
    const userStores: string[] = profile?.stores || [];
    const { isReady, callState: telnyxCallState, makeCall, hangup, toggleMute, isMuted: telnyxMuted } = useTelnyx();

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
    const [orasText, setOrasText] = useState('');
    const [judetText, setJudetText] = useState('');
    const [savingAddress, setSavingAddress] = useState(false);
    const [toast, setToast] = useState<string>('');
    const [shopifyNotif, setShopifyNotif] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

    // ── Product editing
    const [editingProducts, setEditingProducts] = useState(false);
    const [editedProductsList, setEditedProductsList] = useState<any[]>([]);
    const [savingProducts, setSavingProducts] = useState(false);
    const [productImages, setProductImages] = useState<Record<string, string | null>>({});

    const [showAddProductModal, setShowAddProductModal] = useState(false);
    const [availableProducts, setAvailableProducts] = useState<any[]>([]);
    const [loadingProducts, setLoadingProducts] = useState(false);
    const [productSearchQuery, setProductSearchQuery] = useState('');

    // ── Dialer
    const [dialerOpen, setDialerOpen] = useState(false);
    const [phoneNumber, setPhoneNumber] = useState('');
    const clientRef = useRef<any>(null);
    const callRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const ringbackOscRef = useRef<any>(null);
    const audioCtxRef = useRef<any>(null);

    const [isConnecting, setIsConnecting] = useState(false);
    const [callDurationSeconds, setCallDurationSeconds] = useState(0);
    const callStateRef = useRef<'idle' | 'calling' | 'active' | 'rejected'>('idle');
    const userHungUpRef = useRef(false);
    // callState & isMuted come from TelnyxContext (global)
    const callState = telnyxCallState as 'idle' | 'calling' | 'active' | 'rejected';
    const isMuted = telnyxMuted;

    useEffect(() => {
        let interval: any = null;
        if (callState === 'active') {
            setCallDurationSeconds(0);
            interval = setInterval(() => {
                setCallDurationSeconds(prev => prev + 1);
            }, 1000);
        } else {
            setCallDurationSeconds(0);
        }
        return () => {
            if (interval) clearInterval(interval);
        };
    }, [callState]);

    const formatCallTimer = (sec: number) => {
        const mins = Math.floor(sec / 60);
        const remainder = sec % 60;
        const mm = String(mins).padStart(2, '0');
        const ss = String(remainder).padStart(2, '0');
        return `${mm}:${ss}`;
    };

    // ── Toast helper
    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(''), 2500);
    };

    // ── Shopify notification helper
    const showShopifyNotif = (msg: string, type: 'success' | 'error') => {
        setShopifyNotif({ msg, type });
        setTimeout(() => setShopifyNotif(null), type === 'error' ? 10000 : 5000);
    };

    // ── Init brand
    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) setSelectedBrand(userStores[0]);
    }, [userStores]);

    // ── Load orders
    const loadOrders = useCallback(async () => {
        if (!selectedBrand) { console.log('[Orders] no brand yet, skipping'); return; }
        setLoading(true);
        setError(null);
        try {
            const endOfDay = endDate + 'T23:59:59';
            console.log('[Orders] querying store:', selectedBrand, 'from', startDate, 'to', endDate);
            const { data, error: qErr } = await supabase
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
        const { error: uErr } = await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
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
                    .then(result => {
                        if (result.success) {
                            if (result.confirmed && result.orderName) {
                                const total = result.orderTotal ? ` · ${parseFloat(result.orderTotal).toFixed(2)} ${result.currency || 'RON'}` : '';
                                showShopifyNotif(`✓ Comandă creată: ${result.orderName}${total}`, 'success');
                            } else {
                                showShopifyNotif('Shopify sincronizat ✓ Tag-ul a fost adăugat', 'success');
                            }
                        } else {
                            let errMsg = (result as any).errorMessage
                                || result.errors?.map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`).join(' | ');
                                
                            if (!errMsg) {
                                // Fallback to raw JSON if we couldn't extract a friendly message
                                try {
                                    const rawToDisplay = result.raw || result;
                                    errMsg = typeof rawToDisplay === 'string' ? rawToDisplay : JSON.stringify(rawToDisplay, null, 2);
                                } catch(e) {
                                    errMsg = 'Eroare necunoscută de la Shopify';
                                }
                            } else if (result.raw) {
                                // Even if we have a friendly message, optionally append the raw JSON for full debugging context if it's there
                                try {
                                    errMsg += '\n\n' + JSON.stringify(result.raw, null, 2);
                                } catch(e) {}
                            }
                            
                            showShopifyNotif(`Eroare Shopify:\n${errMsg}`, 'error');
                        }
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
        const { error: nErr } = await supabase.from('orders').update({ notes: noteText }).eq('id', selectedOrder.id);
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
        const newOras = orasText.trim();
        const newJudet = judetText.trim();
        const { error: err } = await supabase.from('orders').update({ adresa: newAddress, oras: newOras, judet: newJudet }).eq('id', selectedOrder.id);
        if (!err) {
            setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, adresa: newAddress, oras: newOras, judet: newJudet } : o));
            showToast('Adresa a fost actualizată');
            setEditingAddressId(null);
            
            // Sync with Shopify if it's a draft order
            if (selectedOrder.type === 'draft') {
                const shopifyId = selectedOrder.order_id || selectedOrder.id.toString();
                const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                syncOrderAddressWithShopify(storeName, shopifyId, newAddress, newOras, newJudet).then(result => {
                    if (result.success) {
                        showShopifyNotif('Shopify sincronizat ✓ Adresa a fost actualizată', 'success');
                    } else {
                        let errMsg = (result as any).errorMessage
                            || result.errors?.map((e: any) => `${e.field ? e.field + ': ' : ''}${e.message}`).join(' | ');
                            
                        if (!errMsg) {
                            try {
                                errMsg = JSON.stringify(result.raw || result, null, 2);
                            } catch (e) {
                                errMsg = 'Eroare necunoscută de la Shopify';
                            }
                        }
                        showShopifyNotif(`Eroare Shopify la actualizare adresă:\n${errMsg}`, 'error');
                    }
                });
            }
        } else {
            console.error('[SaveAddress] error:', err);
            showToast('Eroare la salvarea adresei');
        }
        setSavingAddress(false);
    };

    // ── Dialer actions
    const formatDialerNumber = (val: string) => {
        const clean = val.replace(/[^\d+]/g, '');
        if (clean.startsWith('+40')) {
            let res = clean.slice(0, 6);
            if (clean.length > 6) res += ' ' + clean.slice(6, 9);
            if (clean.length > 9) res += ' ' + clean.slice(9, 12);
            if (clean.length > 12) res += ' ' + clean.slice(12);
            return res;
        }
        if (clean.startsWith('0')) {
            let res = clean.slice(0, 4);
            if (clean.length > 4) res += ' ' + clean.slice(4, 7);
            if (clean.length > 7) res += ' ' + clean.slice(7, 10);
            if (clean.length > 10) res += ' ' + clean.slice(10);
            return res;
        }
        return clean;
    };

    const handleKeypadPress = (key: string) => setPhoneNumber(prev => formatDialerNumber(prev + key));
    const handleDelete = () => setPhoneNumber(prev => formatDialerNumber(prev.trimEnd().slice(0, -1)));
    const handleCallAction = async () => {
        if (!phoneNumber) return;
        if (callState === 'idle' || callState === 'rejected') {
            if (!isReady) { alert('Conexiunea la serverul de telefonie nu a reușit. Contactați administratorul.'); return; }
            try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { alert('Este nevoie de acces la microfon pentru a suna!'); return; }
            const callerId = import.meta.env?.VITE_TELNYX_CALLER_ID ?? '+40751064714';
            const cleanDestination = phoneNumber.replace(/\s/g, '');
            makeCall(cleanDestination, callerId);
        } else {
            hangup();
        }
    };

    const callClient = (phone: string) => {
        setPhoneNumber(formatDialerNumber(phone));
        setDialerOpen(true);
    };

    // ── Render
    return (
        <div className="flex flex-col h-full overflow-hidden bg-[#0b0c10] text-white rounded-tl-3xl shadow-[-10px_0_30px_rgba(0,0,0,0.05)] border-l border-t border-white/5 absolute inset-0 pt-6 px-6">
            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-xl shadow-2xl animate-fade-in">
                    {toast}
                </div>
            )}

            {/* Shopify Notification Popup */}
            {shopifyNotif && (
                <div 
                    className={`fixed top-6 right-6 z-[100] flex items-start gap-3 px-5 py-3.5 rounded-2xl shadow-2xl border backdrop-blur-sm transition-all duration-300 animate-fade-in ${
                        shopifyNotif.type === 'success' 
                            ? 'bg-emerald-50/95 border-emerald-500/30 text-emerald-800' 
                            : 'bg-red-500/20/95 border-red-500/30 text-red-800'
                    }`}
                    style={{ minWidth: '300px', maxWidth: shopifyNotif.type === 'error' ? '520px' : '420px' }}
                >
                    <span className={`material-icons-round text-xl mt-0.5 shrink-0 ${
                        shopifyNotif.type === 'success' ? 'text-emerald-600' : 'text-red-500'
                    }`}>
                        {shopifyNotif.type === 'success' ? 'cloud_done' : 'cloud_off'}
                    </span>
                    <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-bold leading-tight">
                            {shopifyNotif.type === 'success' ? 'Sincronizare reușită' : 'Eroare sincronizare'}
                        </p>
                        <p className="text-[12px] font-medium opacity-80 mt-0.5 break-words whitespace-pre-wrap">{shopifyNotif.msg}</p>
                    </div>
                    <button onClick={() => setShopifyNotif(null)} className="text-gray-400 hover:text-gray-400 transition-colors ml-1 shrink-0">
                        <span className="material-icons-round text-[18px]">close</span>
                    </button>
                </div>
            )}

            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 shrink-0">
                <div className="flex items-center gap-4 flex-1">
                    <h1 className="text-2xl font-semibold text-white flex items-center gap-3">
                        Comenzi de sunat 
                        <span className="bg-indigo-500/20 text-indigo-400 text-sm font-bold px-2.5 py-0.5 rounded-full">{orders.length}</span>
                    </h1>
                    
                    {/* Brand dropdown */}
                    <div className="relative ml-4">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm min-w-[160px] flex justify-between items-center h-[42px] hover:text-white transition-all shadow-sm">
                            <span className="font-medium">{selectedBrand || 'Selectează'}</span>
                            <span className={`material-icons-round text-base text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                <div className="absolute left-0 top-full mt-2 w-full rounded-xl bg-[#13141a] border border-white/5 shadow-xl z-50 overflow-hidden">
                                    {userStores.map(store => (
                                        <button key={store} onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-300 hover:bg-indigo-500/20 transition-colors flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedBrand === store ? 'bg-indigo-600' : 'bg-transparent border border-white/10'}`} />
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* View Mode Toggle */}
                    <div className="flex bg-[#13141a]/5 p-1 rounded-xl shadow-inner">
                        <button 
                            onClick={() => setViewMode('drafturi')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'drafturi' ? 'btn-3d-secondary shadow-sm text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Drafturi
                        </button>
                        <button 
                            onClick={() => setViewMode('comenzi')}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${viewMode === 'comenzi' ? 'btn-3d-secondary shadow-sm text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Comenzi
                        </button>
                    </div>
                    
                    {/* Operators mock */}
                    <button className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 h-[42px] hover:text-white shadow-sm hidden sm:flex">
                        <span>Toți operatorii</span>
                        <span className="material-icons-round text-base text-gray-400">arrow_drop_down</span>
                    </button>
                    
                    {/* Priority mock */}
                    <button className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 h-[42px] hover:text-white shadow-sm hidden md:flex">
                        <span>Sortează: Prioritate</span>
                        <span className="material-icons-round text-base text-gray-400">arrow_drop_down</span>
                    </button>
                    
                    {/* Filters mock */}
                    <button className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm flex items-center gap-2 h-[42px] hover:text-white shadow-sm hidden md:flex">
                        <span className="material-icons-round text-base text-indigo-500">filter_list</span>
                        Filtre
                    </button>
                </div>

                <div className="flex flex-wrap gap-4 items-center justify-end">
                    {/* Status indicator */}
                    <div className="flex items-center gap-3 mr-4">
                        {isReady ? (
                            <div className="flex items-center gap-2 text-xs font-medium text-emerald-400 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-500/30">
                                <span className="w-2 h-2 rounded-full bg-emerald-500"></span> Online
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 text-xs font-medium text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30">
                                <span className="w-2 h-2 rounded-full bg-red-500"></span> Offline
                            </div>
                        )}
                    </div>

                    {/* Dialer toggle */}
                    <button onClick={() => setDialerOpen(!dialerOpen)} className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all h-[42px] shadow-sm ${dialerOpen ? 'btn-3d-secondary' : 'btn-3d-primary'}`}>
                        <span className="material-icons-round text-lg">dialpad</span>
                        Dialer
                    </button>
                </div>
            </div>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex gap-6 flex-1 min-h-0 pb-6">

                {/* ── Left: List ────────────────────────────────────────────── */}
                <div className="w-[420px] shrink-0 flex flex-col bg-[#13141a] rounded-2xl shadow-sm border border-white/5 overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-white/5 bg-[#13141a] overflow-x-auto scrollbar-hide px-2">
                        {TABS.map(tab => {
                            const count = typeFilteredOrders.filter(o => o.status === tab.id).length;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => { setActiveTab(tab.id); setActiveSearch(''); setSearchInput(''); }}
                                    className={`flex items-center gap-2 px-4 py-4 text-sm font-semibold whitespace-nowrap transition-all border-b-2 shrink-0 ${activeTab === tab.id ? 'border-indigo-600 text-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-white/10'}`}
                                >
                                    {tab.label}
                                    {count > 0 && (
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === tab.id ? 'bg-indigo-500/20 text-indigo-400' : 'bg-[#13141a]/5 text-gray-500'}`}>
                                            {count}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* Search */}
                    <div className="p-3 border-b border-white/5 bg-[#1a1b23]">
                         <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-400" style={{fontSize:'18px'}}>search</span>
                            <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setActiveSearch(searchInput)} placeholder="Caută..." className="w-full pl-9 pr-4 py-2 bg-[#13141a] border border-white/5 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 text-white" />
                        </div>
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#13141a]">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-24 bg-[#13141a] rounded-xl border border-white/5 animate-pulse" />
                            ))
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full text-red-500 py-16 gap-3 text-center px-4">
                                <span className="material-icons-round text-4xl">error_outline</span>
                                <span className="text-sm font-medium">{error}</span>
                                <button onClick={loadOrders} className="text-sm font-bold text-indigo-400 hover:underline">Reîncearcă</button>
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
                                    className={`w-full text-left p-4 rounded-xl border-2 transition-all shadow-sm relative ${selectedId === order.id ? 'border-indigo-400 bg-indigo-500/10' : 'border-transparent bg-[#13141a] hover:border-white/10'}`}
                                >
                                    <div className="flex justify-between items-start mb-2">
                                        <span className="text-xs font-semibold text-gray-400">#{order.id} <span className="font-normal ml-1 text-gray-400">{fmtDate(order.created_at).split(',')[0]}</span></span>
                                        {(!order.cerere_adresa || order.cerere_adresa.trim() === '' || order.cerere_adresa.trim() === '-') ? (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-emerald-50 text-emerald-400 tracking-wide border border-emerald-500/30" title="Adresă corectă">ADRESĂ OK</span>
                                        ) : (
                                            <span className="text-[10px] font-bold px-2.5 py-0.5 rounded bg-red-500/20 text-red-400 tracking-wide border border-red-500/30" title={`Adresă greșită: ${order.cerere_adresa}`}>ADRESĂ GREȘITĂ</span>
                                        )}
                                    </div>
                                    <div className="flex justify-between items-center mb-1.5">
                                        <p className="text-base font-bold text-white leading-tight truncate pr-2">{order.name || 'Client Nou'}</p>
                                        <span className="text-base font-bold text-white shrink-0">{money(order.value)}</span>
                                    </div>
                                    <p className="text-sm text-gray-500 font-medium mb-1">{formatPhoneNumber(order.phone_number)}</p>
                                    {order.produse && <p className="text-sm text-indigo-400 font-medium truncate">{produseDisplayText(order.produse)}</p>}
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
                            <div className="bg-[#13141a] rounded-2xl shadow-sm border border-white/5 h-full flex flex-col items-center justify-center text-gray-400 gap-4">
                                <span className="material-icons-round text-6xl text-gray-300">ads_click</span>
                                <p className="text-lg font-medium text-gray-500">Selectează o comandă pentru detalii.</p>
                            </div>
                        ) : (
                            <div className="space-y-6 pb-10">
                                {/* Header / Title */}
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-4">
                                        <h2 className="text-2xl font-bold text-white">Comanda {selectedOrder.client_personal_id || `#${selectedOrder.id}`}</h2>
                                        <span className={`text-sm font-bold px-3 py-1.5 rounded-md ${STATUS_STYLES[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>
                                    </div>
                                    <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
                                        Sursă: <span className="text-white">Facebook Ads</span>
                                        <button className="ml-2 w-8 h-8 flex items-center justify-center rounded hover:bg-[#13141a]/5 text-gray-400 transition-colors">
                                            <span className="material-icons-round">close</span>
                                        </button>
                                    </div>
                                </div>

                                {/* Main Action buttons */}
                                <div className="flex gap-4">
                                    <button onClick={() => callClient(selectedOrder.phone_number)} className="flex-1 flex items-center justify-center gap-2 btn-3d-primary py-3.5 rounded-xl transition-all shadow-[0_4px_14px_rgba(34,197,94,0.39)] text-[15px]">
                                        <span className="material-icons-round text-xl">call</span>
                                        Suna client
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 btn-3d-secondary py-3.5 rounded-xl transition-all shadow-sm text-[15px]">
                                        <span className="material-icons-round text-[#25D366]">chat</span>
                                        WhatsApp
                                    </button>
                                    <button className="flex-1 flex items-center justify-center gap-2 btn-3d-secondary py-3.5 rounded-xl transition-all shadow-sm text-[15px]">
                                        <span className="material-icons-round">history</span>
                                        Istoric apeluri
                                    </button>
                                </div>

                                {/* Info Grids */}
                                <div className="grid grid-cols-5 gap-6">
                                    {/* Client Details */}
                                    <div className="col-span-3 bg-[#13141a] rounded-2xl shadow-sm border border-white/5 p-5 relative">
                                        {editingAddressId !== selectedOrder.id && (
                                            <button onClick={() => { setEditingAddressId(selectedOrder.id); setAddressText(selectedOrder.adresa || ''); setOrasText(selectedOrder.oras || ''); setJudetText(selectedOrder.judet || ''); }} className="absolute top-6 right-6 text-indigo-400 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1">
                                                <span className="material-icons-round text-[16px]">edit</span> Editează
                                            </button>
                                        )}
                                        <h3 className="text-base font-bold text-white mb-6">Date client</h3>
                                        
                                        <div className="space-y-4">
                                            <Field label="Nume" value={selectedOrder.name} />
                                            <div>
                                                <p className="text-[12px] text-gray-500 font-medium mb-1">Telefon</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-base text-white font-bold">{formatPhoneNumber(selectedOrder.phone_number)}</span>
                                                    {selectedOrder.phone_number && (
                                                        <button onClick={() => { navigator.clipboard?.writeText(selectedOrder.phone_number); showToast('Copiat!'); }} className="text-gray-400 hover:text-gray-300 transition-colors">
                                                            <span className="material-icons-round text-[16px]">content_copy</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <Field label="Email" value={selectedOrder.email || 'nespecificat'} />
                                            <div>
                                                <p className="text-[12px] text-gray-500 font-medium mb-1">Adresă livrare</p>
                                                {editingAddressId === selectedOrder.id ? (
                                                    <div className="mt-2 space-y-3 relative z-10">
                                                        <div>
                                                            <label className="text-xs text-gray-500 font-medium mb-1 block">Adresă (Stradă, număr, bloc, etc.)</label>
                                                            <textarea
                                                                className="w-full text-sm font-medium text-white border border-white/10 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                rows={2}
                                                                value={addressText}
                                                                onChange={(e) => setAddressText(e.target.value)}
                                                                disabled={savingAddress}
                                                            />
                                                        </div>
                                                        <div className="flex gap-3">
                                                            <div className="flex-1">
                                                                <label className="text-xs text-gray-500 font-medium mb-1 block">Oraș</label>
                                                                <input
                                                                    type="text"
                                                                    className="w-full text-sm font-medium text-white border border-white/10 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                    value={orasText}
                                                                    onChange={(e) => setOrasText(e.target.value)}
                                                                    disabled={savingAddress}
                                                                />
                                                            </div>
                                                            <div className="flex-1">
                                                                <label className="text-xs text-gray-500 font-medium mb-1 block">Județ</label>
                                                                <input
                                                                    type="text"
                                                                    list="judete-list"
                                                                    className="w-full text-sm font-medium text-white border border-white/10 rounded-lg p-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
                                                                    value={judetText}
                                                                    onChange={(e) => setJudetText(e.target.value)}
                                                                    disabled={savingAddress}
                                                                />
                                                                <datalist id="judete-list">
                                                                    {['Alba', 'Arad', 'Argeș', 'Bacău', 'Bihor', 'Bistrița-Năsăud', 'Botoșani', 'Brașov', 'Brăila', 'Buzău', 'Caraș-Severin', 'Călărași', 'Cluj', 'Constanța', 'Covasna', 'Dâmbovița', 'Dolj', 'Galați', 'Giurgiu', 'Gorj', 'Harghita', 'Hunedoara', 'Ialomița', 'Iași', 'Ilfov', 'Maramureș', 'Mehedinți', 'Mureș', 'Neamț', 'Olt', 'Prahova', 'Satu Mare', 'Sălaj', 'Sibiu', 'Suceava', 'Teleorman', 'Timiș', 'Tulcea', 'Vaslui', 'Vâlcea', 'Vrancea', 'București'].map(j => <option key={j} value={j} />)}
                                                                </datalist>
                                                            </div>
                                                        </div>
                                                        <div className="flex gap-2 justify-end pt-1">
                                                            <button onClick={() => setEditingAddressId(null)} disabled={savingAddress} className="px-3 py-1.5 text-xs font-medium text-gray-400 hover:bg-[#13141a]/5 rounded-lg transition-colors disabled:opacity-50">Anulează</button>
                                                            <button onClick={handleSaveAddress} disabled={savingAddress} className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50">
                                                                {savingAddress ? 'Se salvează...' : 'Salvează'}
                                                            </button>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <>
                                                        <div className="space-y-3 mt-2">
                                                            <div className="flex flex-col">
                                                                <span className="text-[12px] text-gray-500 font-medium mb-1">Stradă/Număr</span>
                                                                <div className="bg-[#1a1b23] border border-white/5 rounded-xl p-3 text-[14px] font-medium text-white leading-relaxed whitespace-pre-line">
                                                                    {selectedOrder.adresa || '—'}
                                                                </div>
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <div className="flex flex-col flex-1">
                                                                    <span className="text-[12px] text-gray-500 font-medium mb-1">Oraș</span>
                                                                    <div className="bg-[#1a1b23] border border-white/5 rounded-xl p-3 text-[14px] font-medium text-white">
                                                                        {selectedOrder.oras || '—'}
                                                                    </div>
                                                                </div>
                                                                <div className="flex flex-col flex-1">
                                                                    <span className="text-[12px] text-gray-500 font-medium mb-1">Județ</span>
                                                                    <div className="bg-[#1a1b23] border border-white/5 rounded-xl p-3 text-[14px] font-medium text-white">
                                                                        {selectedOrder.judet || '—'}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-emerald-600 text-xs font-semibold mt-4 flex items-center gap-1">
                                                            <span className="material-icons-round text-[14px]">check</span> Adresă completă
                                                        </p>
                                                    </>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Order Details */}
                                    <div className="col-span-2 bg-[#13141a] rounded-2xl shadow-sm border border-white/5 p-5 relative">
                                        <button className="absolute top-6 right-6 text-indigo-400 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1">
                                            <span className="material-icons-round text-[16px]">edit</span> Editează
                                        </button>
                                        <h3 className="text-base font-bold text-white mb-6">Detalii comandă</h3>
                                        
                                        <div className="space-y-4">
                                            <DL label="Creată" value={fmtDate(selectedOrder.created_at)} />
                                            <DL label="Metodă plată" value="Ramburs" />
                                            <DL label="Metodă livrare" value="Curier rapid" />
                                            
                                            <div className="pt-4 mt-2 border-t border-white/5 space-y-3">
                                                <DL label="Valoare produse" value={money(selectedOrder.value)} />
                                                <DL label="Transport" value="0,00 lei" />
                                                <DL label={<span className="font-bold text-white text-sm">Total comandă</span>} value={<span className="font-bold text-indigo-400 text-base">{money(selectedOrder.value)}</span>} />
                                            </div>

                                            {selectedOrder.cerere && (
                                                <div className="mt-4 pt-4 border-t border-white/5">
                                                    <p className="text-[12px] text-gray-500 font-medium mb-1">Notițe client</p>
                                                    <p className="text-sm text-white">{selectedOrder.cerere}</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Products + Actions Row */}
                                <div className="grid grid-cols-5 gap-6">
                                    {/* Products */}
                                    <div className="col-span-3 bg-[#13141a] rounded-2xl shadow-sm border border-white/5 p-5 relative">
                                        {!editingProducts && (
                                            <button 
                                                onClick={() => {
                                                    const items = parseProduse(selectedOrder.produse);
                                                    if (items.length === 0) {
                                                        showToast('Nu sunt produse de editat');
                                                        return;
                                                    }
                                                    setEditingProducts(true);
                                                    setEditedProductsList([...items]);
                                                }}
                                                className="absolute top-6 right-6 text-indigo-400 hover:text-indigo-800 text-sm font-semibold flex items-center gap-1"
                                            >
                                                <span className="material-icons-round text-[16px]">edit</span> Editează produse
                                            </button>
                                        )}
                                        {editingProducts && (
                                            <div className="absolute top-6 right-6 flex gap-2">
                                                <button 
                                                    onClick={() => { setEditingProducts(false); setEditedProductsList([]); }}
                                                    className="text-gray-500 hover:text-gray-300 text-sm font-semibold flex items-center gap-1"
                                                >
                                                    <span className="material-icons-round text-[16px]">close</span> Anulează
                                                </button>
                                                <button 
                                                    disabled={savingProducts}
                                                    onClick={async () => {
                                                        setSavingProducts(true);
                                                        
                                                        const newProduse = JSON.stringify(editedProductsList);
                                                        
                                                        // Save to Supabase
                                                        const { error: dbErr } = await supabase.from('orders').update({ produse: newProduse }).eq('id', selectedOrder.id);
                                                        if (dbErr) {
                                                            showToast('Eroare la salvare în baza de date');
                                                            setSavingProducts(false);
                                                            return;
                                                        }
                                                        setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, produse: newProduse } : o));
                                                        
                                                        // Sync to Shopify
                                                        const shopifyId = selectedOrder.order_id || selectedOrder.id.toString();
                                                        const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                                                        
                                                        const shopifyItems = editedProductsList.map(it => ({
                                                            variant_id: it.variant_id,
                                                            quantity: it.quantity,
                                                        }));
                                                        
                                                        const result = await updateShopifyLineItemsBulk(storeName, shopifyId, shopifyItems);
                                                        if (result) {
                                                            showShopifyNotif('Shopify sincronizat ✓ Lista a fost actualizată', 'success');
                                                        } else {
                                                            showShopifyNotif('Eroare Shopify — Produsele nu au fost sincronizate', 'error');
                                                        }
                                                        
                                                        setSavingProducts(false);
                                                        setEditingProducts(false);
                                                    }}
                                                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 disabled:opacity-50"
                                                >
                                                    <span className="material-icons-round text-[16px]">save</span>
                                                    {savingProducts ? 'Se salvează...' : 'Salvează'}
                                                </button>

                                                <button 
                                                    onClick={async () => {
                                                        const storeName = selectedOrder.store_name || selectedBrand || 'Tamtrend';
                                                        setLoadingProducts(true);
                                                        setShowAddProductModal(true);
                                                        const prods = await getAllProducts(storeName);
                                                        if (prods) setAvailableProducts(prods);
                                                        setLoadingProducts(false);
                                                    }}
                                                    className="bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold px-4 py-1.5 rounded-lg flex items-center gap-1 ml-2 transition-colors"
                                                >
                                                    <span className="material-icons-round text-[16px]">add</span>
                                                    Adaugă produs
                                                </button>
                                            </div>
                                        )}
                                        <h3 className="text-base font-bold text-white mb-6">Produse comandate</h3>
                                        
                                        {(() => {
                                            const items = editingProducts ? editedProductsList : parseProduse(selectedOrder.produse);
                                            if (items.length === 0) {
                                                return (
                                                    <div className="text-sm font-medium text-gray-300 whitespace-pre-wrap leading-relaxed">
                                                        {selectedOrder.produse || <span className="text-gray-400 italic">Niciun produs specificat</span>}
                                                    </div>
                                                );
                                            }
                                            return (
                                                <div className="space-y-3">
                                                    {items.map((item, idx) => {
                                                        const qty = item.quantity;
                                                        const price = parseFloat(item.price);
                                                        const canRemove = editedProductsList.length > 1;
                                                        return (
                                                            <div key={item.id || idx} className="flex items-center gap-4 bg-[#1a1b23] rounded-xl p-4 border border-white/5">
                                                                {/* Product Image */}
                                                                <div className="w-16 h-16 rounded-lg bg-[#13141a] border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                                                                    {productImages[String(item.product_id)] ? (
                                                                        <img 
                                                                            src={productImages[String(item.product_id)]!} 
                                                                            alt={item.title}
                                                                            className="w-full h-full object-cover"
                                                                        />
                                                                    ) : (
                                                                        <span className="material-icons-round text-gray-300 text-2xl">inventory_2</span>
                                                                    )}
                                                                </div>
                                                                <div className="flex-1 min-w-0">
                                                                    <p className="text-base font-semibold text-white truncate">{item.title}</p>
                                                                    <p className="text-sm text-gray-500">{price.toFixed(2)} lei / buc{item.sku ? ` · ${item.sku}` : ''}</p>
                                                                </div>
                                                                {editingProducts ? (
                                                                    <div className="flex items-center gap-4 shrink-0">
                                                                        <div className="flex items-center gap-2">
                                                                            <button 
                                                                                onClick={() => {
                                                                                    if (qty > 1) {
                                                                                        const newList = [...editedProductsList];
                                                                                        newList[idx] = { ...newList[idx], quantity: qty - 1 };
                                                                                        setEditedProductsList(newList);
                                                                                    }
                                                                                }}
                                                                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#13141a] border border-white/10 text-gray-400 hover:bg-[#13141a]/5 transition-colors font-bold text-lg"
                                                                            >
                                                                                −
                                                                            </button>
                                                                            <input 
                                                                                type="number" 
                                                                                min={1}
                                                                                value={qty}
                                                                                onChange={(e) => {
                                                                                    const val = parseInt(e.target.value);
                                                                                    if (!isNaN(val) && val >= 1) {
                                                                                        const newList = [...editedProductsList];
                                                                                        newList[idx] = { ...newList[idx], quantity: val };
                                                                                        setEditedProductsList(newList);
                                                                                    }
                                                                                }}
                                                                                className="w-14 h-10 text-center text-base font-bold text-white border border-white/10 rounded-lg outline-none focus:ring-2 focus:ring-indigo-400 focus:border-indigo-400"
                                                                            />
                                                                            <button 
                                                                                onClick={() => {
                                                                                    const newList = [...editedProductsList];
                                                                                    newList[idx] = { ...newList[idx], quantity: qty + 1 };
                                                                                    setEditedProductsList(newList);
                                                                                }}
                                                                                className="w-10 h-10 flex items-center justify-center rounded-lg bg-[#13141a] border border-white/10 text-gray-400 hover:bg-[#13141a]/5 transition-colors font-bold text-lg"
                                                                            >
                                                                                +
                                                                            </button>
                                                                        </div>
                                                                        <button 
                                                                            onClick={() => {
                                                                                if (!canRemove) return;
                                                                                setEditedProductsList(prev => prev.filter((_, i) => i !== idx));
                                                                            }}
                                                                            disabled={!canRemove}
                                                                            className={`w-10 h-10 flex items-center justify-center rounded-lg border transition-colors ${canRemove ? 'bg-red-500/20 text-red-600 border-red-500/30 hover:bg-red-100' : 'bg-[#1a1b23] text-gray-300 border-white/5 cursor-not-allowed'}`}
                                                                        >
                                                                            <span className="material-icons-round text-[20px]">delete</span>
                                                                        </button>
                                                                    </div>
                                                                ) : (
                                                                    <span className="text-base font-semibold text-gray-400 shrink-0 px-2">x{qty}</span>
                                                                )}
                                                                <span className="text-base font-bold text-indigo-400 w-24 text-right">
                                                                    {(price * qty).toFixed(2)} lei
                                                                </span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            );
                                        })()}
                                        
                                        {selectedOrder.cerere_upsell && (
                                            <div className="mt-4 bg-amber-50 border border-amber-500/30 rounded-xl p-4">
                                                <p className="text-[11px] font-bold text-amber-400 uppercase tracking-wider mb-1">Oportunitate Upsell</p>
                                                <p className="text-sm font-medium text-amber-900">{selectedOrder.cerere_upsell}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Actions */}
                                    <div className="col-span-2 bg-[#13141a] rounded-2xl shadow-sm border border-white/5 p-5">
                                        <h3 className="text-base font-bold text-white mb-5">Acțiuni rapide</h3>
                                        <div className="flex flex-col gap-3">
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
                                <div className="bg-[#13141a] rounded-2xl shadow-sm border border-white/5 p-5">
                                    <h3 className="text-base font-bold text-white mb-4">Notițe apel</h3>
                                    <textarea
                                        value={noteText}
                                        onChange={e => setNoteText(e.target.value)}
                                        placeholder="Adaugă observații..."
                                        className="w-full min-h-[100px] bg-[#1a1b23] border border-white/5 rounded-xl p-4 text-sm text-white placeholder-gray-400 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 transition-all"
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
                        <div className="w-[340px] shrink-0 bg-[#13141a] rounded-3xl shadow-2xl border border-white/5 p-6 flex flex-col items-center h-[590px] justify-between">
                            <div className="w-full flex flex-col items-center pt-2">
                                {/* Reserved fixed height status & timer slot (prevents layout shifts) */}
                                <div className="h-7 flex items-center justify-center mb-2">
                                    {callState === 'active' ? (
                                        <div className="text-xs font-bold text-emerald-600 font-mono tracking-widest bg-emerald-50 px-3 py-1 rounded-full border border-emerald-500/30/60 animate-pulse">
                                            {formatCallTimer(callDurationSeconds)}
                                        </div>
                                    ) : callState === 'rejected' ? (
                                        <div className="text-xs font-bold tracking-wider uppercase px-4 py-1 rounded-full bg-red-100 text-red-400">
                                            Apel respins
                                        </div>
                                    ) : callState === 'calling' ? (
                                        <div className="text-xs font-bold tracking-wider uppercase px-4 py-1 rounded-full bg-amber-100 text-amber-400 animate-pulse">
                                            Apelează...
                                        </div>
                                    ) : null}
                                </div>
                                
                                {/* Phone display */}
                                <div className="w-full mb-6 min-h-[54px] flex items-center justify-center relative bg-[#1a1b23] rounded-2xl px-3 py-1">
                                    <input
                                        type="text"
                                        value={phoneNumber}
                                        onChange={e => setPhoneNumber(formatDialerNumber(e.target.value))}
                                        className="w-full bg-transparent border-none outline-none text-center text-3xl font-semibold text-white tracking-normal"
                                        placeholder=" "
                                        autoFocus
                                    />
                                    {phoneNumber && (
                                        <button onClick={handleDelete} className="absolute right-3 text-gray-400 hover:text-gray-300 transition-colors">
                                            <span className="material-icons-round">backspace</span>
                                        </button>
                                    )}
                                </div>

                                {/* Keypad */}
                                <div className={`grid grid-cols-3 gap-4 w-full mt-1 transition-opacity ${callState !== 'idle' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                    {[
                                        { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
                                        { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
                                        { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
                                        { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' }
                                    ].map(item => (
                                        <button key={item.key} onClick={() => handleKeypadPress(item.key)} className="flex flex-col items-center justify-center h-16 w-16 rounded-full bg-[#13141a]/5 hover:bg-[#13141a]/10 shadow-none transition-all active:scale-90 mx-auto">
                                            <span className="text-2xl font-semibold text-gray-200 leading-none">{item.key}</span>
                                            {item.sub && <span className="text-[9px] text-gray-400 font-bold tracking-widest mt-0.5">{item.sub}</span>}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Call button & controls - iOS Style */}
                            <div className="flex items-center justify-center gap-4 mb-2">
                                <button
                                    onClick={handleCallAction}
                                    disabled={!phoneNumber && (callState === 'idle' || callState === 'rejected')}
                                    className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed shadow-md ${
                                        (callState === 'idle' || callState === 'rejected') 
                                            ? 'bg-[#34C759] hover:bg-[#2FB34F] text-white' 
                                            : 'bg-[#FF3B30] hover:bg-[#E0332B] text-white'
                                    }`}
                                >
                                    <span className="material-icons-round text-white text-3xl">
                                        {(callState === 'idle' || callState === 'rejected') ? 'call' : 'call_end'}
                                    </span>
                                </button>

                                {/* Mute button (shown when call is active) */}
                                {callState === 'active' && (
                                    <button
                                        onClick={toggleMute}
                                        className={`w-12 h-12 rounded-full flex items-center justify-center transition-all active:scale-95 shadow-md ${
                                            isMuted ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-[#13141a]/5 hover:bg-[#13141a]/10 text-gray-300'
                                        }`}
                                        title={isMuted ? 'Activare microfon' : 'Dezactivare microfon (Mute)'}
                                    >
                                        <span className="material-icons-round text-2xl">{isMuted ? 'mic_off' : 'mic'}</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
            
            {/* Add Product Modal */}
            {showAddProductModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-gray-900/40 backdrop-blur-sm p-4">
                    <div className="bg-[#13141a] rounded-2xl shadow-xl border border-white/5 w-full max-w-2xl max-h-[80vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        <div className="flex items-center justify-between p-5 border-b border-white/5 bg-[#1a1b23]/50">
                            <h2 className="text-lg font-bold text-white">Adaugă produs în comandă</h2>
                            <button 
                                onClick={() => setShowAddProductModal(false)}
                                className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-[#13141a]/10 text-gray-500 transition-colors"
                            >
                                <span className="material-icons-round text-[20px]">close</span>
                            </button>
                        </div>
                        <div className="p-5 overflow-y-auto flex-1 bg-[#13141a]">
                            <div className="mb-4">
                                <div className="relative">
                                    <span className="material-icons-round absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">search</span>
                                    <input 
                                        type="text"
                                        placeholder="Caută produs (titlu sau SKU)..."
                                        value={productSearchQuery}
                                        onChange={(e) => setProductSearchQuery(e.target.value)}
                                        className="w-full pl-10 pr-4 py-2 border border-white/5 rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-shadow text-sm"
                                        autoFocus
                                    />
                                    {productSearchQuery && (
                                        <button 
                                            onClick={() => setProductSearchQuery('')}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-400 flex items-center justify-center"
                                        >
                                            <span className="material-icons-round text-[16px]">close</span>
                                        </button>
                                    )}
                                </div>
                            </div>

                            {loadingProducts ? (
                                <div className="py-12 flex flex-col items-center justify-center gap-3">
                                    <span className="material-icons-round text-indigo-500 animate-spin text-3xl">autorenew</span>
                                    <p className="text-sm font-medium text-gray-500">Se încarcă produsele...</p>
                                </div>
                            ) : (() => {
                                const q = productSearchQuery.toLowerCase();
                                const filtered = availableProducts.map(prod => {
                                    const matchingVariants = prod.variants?.edges?.filter((vEdge: any) => {
                                        const variant = vEdge.node;
                                        const t = (prod.title + ' ' + (variant.title !== 'Default Title' ? variant.title : '')).toLowerCase();
                                        const sku = (variant.sku || '').toLowerCase();
                                        return t.includes(q) || sku.includes(q);
                                    });
                                    return { ...prod, variants: { edges: matchingVariants } };
                                }).filter(prod => prod.variants.edges && prod.variants.edges.length > 0);

                                if (filtered.length === 0) {
                                    return (
                                        <div className="py-12 text-center">
                                            <p className="text-gray-500 font-medium">{productSearchQuery ? 'Nu s-au găsit produse pentru căutarea ta.' : 'Nu s-au găsit produse active.'}</p>
                                        </div>
                                    );
                                }

                                return (
                                    <div className="space-y-3">
                                        {filtered.map(prod => (
                                            prod.variants?.edges?.map((vEdge: any) => {
                                                const variant = vEdge.node;
                                                const imgUrl = prod.featuredImage?.url;
                                                const price = parseFloat(variant.price || '0');
                                                
                                                return (
                                                    <div key={variant.id} className="flex items-center gap-4 bg-[#1a1b23] hover:bg-[#13141a]/5 transition-colors rounded-xl p-3 border border-white/5">
                                                        <div className="w-12 h-12 rounded-lg bg-[#13141a] border border-white/5 overflow-hidden shrink-0 flex items-center justify-center">
                                                            {imgUrl ? (
                                                                <img src={imgUrl} alt={prod.title} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <span className="material-icons-round text-gray-300 text-xl">inventory_2</span>
                                                            )}
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <p className="text-sm font-semibold text-white truncate">{prod.title}</p>
                                                            <p className="text-xs text-gray-500 truncate">{variant.title !== 'Default Title' ? variant.title : ''} • {price.toFixed(2)} lei</p>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                setEditedProductsList(prev => {
                                                                    const numVariantId = variant.id.split('/').pop();
                                                                    const numProdId = prod.id.split('/').pop();
                                                                    const existingIdx = prev.findIndex(p => String(p.variant_id) === numVariantId);
                                                                    if (existingIdx >= 0) {
                                                                        const copy = [...prev];
                                                                        copy[existingIdx].quantity += 1;
                                                                        return copy;
                                                                    }
                                                                    return [...prev, {
                                                                        id: Date.now(),
                                                                        product_id: parseInt(numProdId),
                                                                        variant_id: parseInt(numVariantId),
                                                                        title: prod.title + (variant.title !== 'Default Title' ? ` - ${variant.title}` : ''),
                                                                        quantity: 1,
                                                                        price: price.toString(),
                                                                        sku: variant.sku || ''
                                                                    }];
                                                                });
                                                                setShowAddProductModal(false);
                                                                setProductSearchQuery(''); // reset search
                                                            }}
                                                            className="shrink-0 bg-[#13141a] border border-white/5 hover:border-indigo-400 hover:bg-indigo-500/20 hover:text-indigo-400 text-gray-400 text-sm font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1 transition-all"
                                                        >
                                                            <span className="material-icons-round text-[16px]">add</span> Adaugă
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        ))}
                                    </div>
                                );
                            })()}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

// ─── Sub-components ───────────────────────────────────────────────────────────
const Field = ({ label, value, highlight }: { label: string; value?: string | null; highlight?: boolean }) => (
    <div>
        <p className="text-[12px] text-gray-500 font-medium mb-1">{label}</p>
        <p className={`text-base font-bold ${highlight ? 'text-amber-600' : 'text-white'}`}>{value || '—'}</p>
    </div>
);

const DL = ({ label, value }: { label: string | React.ReactNode; value: React.ReactNode }) => (
    <div className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
        <span className="text-sm font-medium text-gray-500">{label}</span>
        <span className="text-sm font-semibold text-white text-right">{value}</span>
    </div>
);

export default Drafturi;
