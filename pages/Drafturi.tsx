import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';

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
}

const TABS: { id: string; label: string }[] = [
    { id: 'ON',  label: 'De sunat' },
    { id: 'OFF', label: 'Procesate' },
];

const STATUS_STYLES: Record<string, string> = {
    'ON':  'bg-emerald-500/15 text-emerald-300 border border-emerald-500/20',
    'OFF': 'bg-gray-500/15 text-gray-400 border border-gray-500/20',
};

const STATUS_LABELS: Record<string, string> = {
    'ON':  'De sunat',
    'OFF': 'Procesat',
};

const QUICK_ACTIONS = [
    { id: 'confirmat',   label: 'Confirmă comanda',  style: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20', icon: 'check_circle' },
    { id: 'nu-raspunde', label: 'Nu răspunde',        style: 'bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20',         icon: 'phone_disabled' },
    { id: 'de-revenit',  label: 'Sună mai târziu',   style: 'bg-blue-500/10 border-blue-500/30 text-blue-300 hover:bg-blue-500/20',             icon: 'schedule' },
    { id: 'anulat',      label: 'Anulează comanda',  style: 'bg-red-500/10 border-red-500/30 text-red-300 hover:bg-red-500/20',                  icon: 'cancel' },
    { id: 'OFF',         label: 'Marchează procesat', style: 'bg-gray-500/10 border-gray-500/30 text-gray-300 hover:bg-gray-500/20',              icon: 'task_alt' },
    { id: 'ON',          label: 'Resetează (De sunat)', style: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20',           icon: 'refresh' },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
const money = (v: number | string) =>
    new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v || 0)) + ' lei';

const fmtDate = (d: string) => {
    try { return new Date(d).toLocaleString('ro-RO', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
    catch { return d; }
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
    const [toast, setToast] = useState<string>('');

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

    // Sync note text when selection changes
    useEffect(() => {
        if (selectedOrder) setNoteText(selectedOrder.notes || '');
    }, [selectedId]);

    // ── Update status
    const updateStatus = async (orderId: number, newStatus: string) => {
        setUpdatingStatus(true);
        const { error: uErr } = await supabaseAdmin.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (!uErr) {
            setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status: newStatus } : o));
            showToast(STATUS_LABELS[newStatus]);
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
        if (!nErr) { setOrders(prev => prev.map(o => o.id === selectedOrder.id ? { ...o, notes: noteText } : o)); showToast('Notiță salvată'); }
        else { console.error('[SaveNote] error:', nErr); setError('Eroare la salvarea notiței'); showToast('Eroare la salvare'); }
        setSavingNote(false);
    };

    // ── Dialer actions
    const handleKeypadPress = (key: string) => setPhoneNumber(prev => prev + key);
    const handleDelete = () => setPhoneNumber(prev => prev.slice(0, -1));
    const handleCallAction = async () => {
        if (!phoneNumber) return;
        if (callState === 'idle') {
            if (!clientRef.current) { alert('Conexiunea la serverul de telefonie nu a reușit. Contactați administratorul.'); return; }
            try { await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { alert('Este nevoie de acces la microfon pentru a suna!'); return; }
            const callerId = import.meta.env?.VITE_TELNYX_CALLER_ID ?? '+40775393060';
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
        <div className="flex flex-col h-full space-y-3">
            <audio ref={audioRef} style={{ display: 'none' }} />

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-[#1e1f2b] border border-white/10 text-white text-sm px-5 py-3 rounded-xl shadow-2xl animate-fade-in">
                    {toast}
                </div>
            )}

            {/* ── Top Bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-3">
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 flex-1">
                    {/* View toggle */}
                    <div className="flex bg-[#13141a] border border-white/5 rounded-xl p-1 shadow-inner h-[40px] shrink-0">
                        <button onClick={() => setViewMode('drafturi')} className={`px-4 py-1 text-sm font-medium rounded-lg transition-all ${viewMode === 'drafturi' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-200'}`}>Drafturi</button>
                        <button onClick={() => setViewMode('comenzi')} className={`px-4 py-1 text-sm font-medium rounded-lg transition-all ${viewMode === 'comenzi' ? 'bg-primary/20 text-primary' : 'text-gray-400 hover:text-gray-200'}`}>Comenzi</button>
                    </div>

                    {/* Search */}
                    <div className="max-w-sm w-full relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-500" style={{fontSize:'18px'}}>search</span>
                        <input type="text" value={searchInput} onChange={e => setSearchInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && setActiveSearch(searchInput)} placeholder="Caută comandă..." className="w-full pl-9 pr-20 py-2.5 bg-[#13141a] border border-white/5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-gray-200" />
                        <button onClick={() => setActiveSearch(searchInput)} className="absolute right-1.5 top-1.5 bottom-1.5 px-3 bg-surface-dark-lighter border border-white/5 text-gray-400 hover:text-white text-xs font-medium rounded-lg transition-colors">Caută</button>
                    </div>

                    {/* Status indicator */}
                    {isConnecting && <div className="flex items-center gap-2 text-xs text-gray-500 bg-black/20 px-3 py-1.5 rounded-full h-[40px] shrink-0"><span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span>Conectare telefonie...</div>}
                    {!isConnecting && !clientRef.current && <div className="flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full h-[40px] shrink-0"><span className="w-2 h-2 rounded-full bg-red-500"></span>Telefonie inactivă</div>}
                    {!isConnecting && clientRef.current && <div className="flex items-center gap-2 text-xs text-green-400 bg-green-500/10 px-3 py-1.5 rounded-full h-[40px] shrink-0"><span className="w-2 h-2 rounded-full bg-green-500"></span>Telefonie activă</div>}
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-end">
                    {/* Date range */}
                    <div className="flex items-center gap-2 bg-[#13141a] px-3 py-1.5 rounded-xl border border-white/5 h-[40px]">
                        <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                        <span className="text-gray-600">–</span>
                        <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                    </div>

                    {/* Brand dropdown */}
                    <div className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="btn-3d-secondary px-4 py-2 rounded-xl text-sm min-w-[140px] flex justify-between items-center h-[40px] hover:text-white transition-all">
                            <span>{selectedBrand || 'Selectează'}</span>
                            <span className={`material-icons-round text-base transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)} />
                                <div className="absolute right-0 top-full mt-2 w-full rounded-xl bg-[#13141a] border border-white/5 shadow-xl z-50 overflow-hidden">
                                    {userStores.map(store => (
                                        <button key={store} onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }} className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2">
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedBrand === store ? 'bg-primary' : 'bg-transparent border border-gray-600'}`} />
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>

                    {/* Dialer toggle */}
                    <button onClick={() => setDialerOpen(!dialerOpen)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border transition-all h-[40px] ${dialerOpen ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300' : 'bg-[#13141a] border-white/5 text-gray-400 hover:text-white'}`}>
                        <span className="material-icons-round text-base">dialpad</span>
                        Dialer
                    </button>
                </div>
            </div>

            {/* ── Main Content ─────────────────────────────────────────────── */}
            <div className="flex gap-4 flex-1 min-h-0">

                {/* ── Left: List ────────────────────────────────────────────── */}
                <div className="w-[400px] shrink-0 flex flex-col card-depth rounded-2xl overflow-hidden">
                    {/* Tabs */}
                    <div className="flex border-b border-white/5 bg-[#0d0e13] overflow-x-auto scrollbar-hide">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => { setActiveTab(tab.id); setActiveSearch(''); setSearchInput(''); }}
                                className={`flex items-center gap-1.5 px-3 py-3 text-xs font-medium whitespace-nowrap transition-all border-b-2 shrink-0 ${activeTab === tab.id ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-300'}`}
                            >
                                {tab.label}
                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${activeTab === tab.id ? 'bg-primary/20 text-primary' : 'bg-white/5 text-gray-500'}`}>
                                    {typeFilteredOrders.filter(o => o.status === tab.id).length}
                                </span>
                            </button>
                        ))}
                    </div>

                    {/* List */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-hide">
                        {loading ? (
                            Array.from({ length: 5 }).map((_, i) => (
                                <div key={i} className="h-20 bg-white/3 rounded-xl animate-pulse" />
                            ))
                        ) : error ? (
                            <div className="flex flex-col items-center justify-center h-full text-red-400 py-16 gap-3 text-center px-4">
                                <span className="material-icons-round text-4xl">error_outline</span>
                                <span className="text-sm">{error}</span>
                                <button onClick={loadOrders} className="text-xs underline text-gray-400 hover:text-white">Reîncearcă</button>
                            </div>
                        ) : filteredOrders.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-gray-600 py-16 gap-3">
                                <span className="material-icons-round text-4xl">inbox</span>
                                <span className="text-sm">Nicio comandă în această categorie.</span>
                            </div>
                        ) : (
                            filteredOrders.map(order => (
                                <button
                                    key={order.id}
                                    onClick={() => { setSelectedId(order.id); setNoteText(order.notes || ''); }}
                                    className={`w-full text-left p-3.5 rounded-xl border transition-all ${selectedId === order.id ? 'border-primary/50 bg-primary/5 shadow-[inset_3px_0_0_rgba(0,210,255,0.6)]' : 'border-white/5 bg-white/2 hover:border-white/10 hover:bg-white/4'}`}
                                >
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[11px] text-gray-500 font-mono">{order.client_personal_id || `#${order.id}`}</span>
                                        {order.status === 'ON' && <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 uppercase tracking-wide">NOU</span>}
                                    </div>
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="text-sm font-semibold text-white leading-tight">{order.name || '—'}</p>
                                            <p className="text-xs text-gray-500 mt-0.5">{order.phone_number || '—'}</p>
                                        </div>
                                        <span className="text-sm font-bold text-white">{money(order.value)}</span>
                                    </div>
                                    {order.produse && <p className="text-xs text-cyan-400/80 mt-1.5 truncate">{order.produse}</p>}
                                    <p className="text-[10px] text-gray-600 mt-1">{fmtDate(order.created_at)}</p>
                                </button>
                            ))
                        )}
                    </div>

                    {/* Footer */}
                    <div className="px-4 py-2 border-t border-white/5 text-xs text-gray-600">
                        {filteredOrders.length} comenzi afișate
                    </div>
                </div>

                {/* ── Right: Detail + Dialer ─────────────────────────────── */}
                <div className="flex-1 flex gap-4 min-h-0 min-w-0">

                    {/* Order Detail */}
                    <div className="flex-1 overflow-y-auto scrollbar-hide space-y-4 min-w-0">
                        {!selectedOrder ? (
                            <div className="card-depth rounded-2xl h-full flex flex-col items-center justify-center text-gray-600 gap-3">
                                <span className="material-icons-round text-5xl">touch_app</span>
                                <p className="text-sm">Selectează o comandă din stânga.</p>
                            </div>
                        ) : (
                            <>
                                {/* Header */}
                                <div className="card-depth rounded-2xl p-5">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-3">
                                            <h2 className="text-lg font-semibold text-white">Comanda {selectedOrder.client_personal_id || `#${selectedOrder.id}`}</h2>
                                            <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${STATUS_STYLES[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>
                                        </div>
                                        {selectedOrder.type && <span className="text-xs text-gray-500 bg-white/5 px-2.5 py-1 rounded-lg">{selectedOrder.type}</span>}
                                    </div>

                                    {/* Action buttons */}
                                    <div className="flex gap-3">
                                        <button onClick={() => callClient(selectedOrder.phone_number)} className="flex-1 flex items-center justify-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-white font-semibold py-3 rounded-xl transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                                            <span className="material-icons-round">call</span>
                                            Sună client
                                        </button>
                                        <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 font-medium py-3 px-5 rounded-xl transition-all">
                                            <span className="material-icons-round text-green-400">chat</span>
                                            WhatsApp
                                        </button>
                                        <button className="flex items-center justify-center gap-2 bg-white/5 hover:bg-white/10 border border-white/5 text-gray-300 font-medium py-3 px-5 rounded-xl transition-all">
                                            <span className="material-icons-round">history</span>
                                            Istoric
                                        </button>
                                    </div>
                                </div>

                                {/* Client + Order Info */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Client */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">person</span>Date client</h3>
                                        <div className="space-y-3">
                                            <Field label="Nume" value={selectedOrder.name} />
                                            <div>
                                                <p className="text-[11px] text-gray-500 mb-1">Telefon</p>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-white font-medium">{selectedOrder.phone_number || '—'}</span>
                                                    {selectedOrder.phone_number && (
                                                        <button onClick={() => { navigator.clipboard?.writeText(selectedOrder.phone_number); showToast('Copiat!'); }} className="text-gray-500 hover:text-white transition-colors">
                                                            <span className="material-icons-round" style={{fontSize:'15px'}}>content_copy</span>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                            <Field label="Adresă" value={selectedOrder.adresa} />
                                            {selectedOrder.cerere_adresa && <Field label="Cerere adresă" value={selectedOrder.cerere_adresa} highlight />}
                                        </div>
                                    </div>

                                    {/* Order details */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">receipt_long</span>Detalii comandă</h3>
                                        <div className="space-y-2">
                                            <DL label="Status" value={<span className={`text-xs font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[selectedOrder.status]}`}>{STATUS_LABELS[selectedOrder.status]}</span>} />
                                            <DL label="Creat la" value={fmtDate(selectedOrder.created_at)} />
                                            <DL label="Total comandă" value={<span className="text-cyan-400 font-bold">{money(selectedOrder.value)}</span>} />
                                            {selectedOrder.health && <DL label="Health" value={selectedOrder.health} />}
                                            {selectedOrder.tags && <DL label="Tags" value={selectedOrder.tags} />}
                                        </div>
                                    </div>
                                </div>

                                {/* Products + Quick Actions */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Products */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">shopping_cart</span>Produse comandate</h3>
                                        <div className="bg-white/3 rounded-xl p-3 text-sm text-gray-300 whitespace-pre-wrap leading-relaxed min-h-[60px]">
                                            {selectedOrder.produse || <span className="text-gray-600 italic">Niciun produs specificat</span>}
                                        </div>
                                        {selectedOrder.cerere_upsell && (
                                            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3">
                                                <p className="text-[11px] text-amber-400 font-semibold mb-1">Cerere upsell</p>
                                                <p className="text-sm text-amber-300">{selectedOrder.cerere_upsell}</p>
                                            </div>
                                        )}
                                        {selectedOrder.cerere && (
                                            <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3">
                                                <p className="text-[11px] text-blue-400 font-semibold mb-1">Cerere client</p>
                                                <p className="text-sm text-blue-300">{selectedOrder.cerere}</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Quick actions */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">bolt</span>Acțiuni rapide</h3>
                                        <div className="grid grid-cols-2 gap-2">
                                            {QUICK_ACTIONS.map(action => (
                                                <button
                                                    key={action.id}
                                                    onClick={() => updateStatus(selectedOrder.id, action.id as CallStatus)}
                                                    disabled={updatingStatus || selectedOrder.status === action.id}
                                                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border text-xs font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${action.style} ${selectedOrder.status === action.id ? 'ring-2 ring-current ring-offset-1 ring-offset-transparent' : ''}`}
                                                >
                                                    <span className="material-icons-round text-lg">{action.icon}</span>
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                {/* Notes + Script */}
                                <div className="grid grid-cols-2 gap-4">
                                    {/* Notes */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">edit_note</span>Notițe apel</h3>
                                        <textarea
                                            value={noteText}
                                            onChange={e => setNoteText(e.target.value)}
                                            placeholder="Adaugă o notiță despre apel..."
                                            className="w-full min-h-[100px] bg-white/3 border border-white/5 rounded-xl p-3 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:ring-1 focus:ring-primary/50"
                                        />
                                        <button onClick={saveNote} disabled={savingNote} className="mt-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 border border-primary/30 text-primary text-sm font-medium rounded-lg transition-all disabled:opacity-50">
                                            {savingNote ? 'Se salvează...' : 'Salvează notița'}
                                        </button>
                                    </div>

                                    {/* Script */}
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">record_voice_over</span>Script recomandat</h3>
                                        <div className="relative bg-primary/5 border border-primary/10 rounded-xl p-4 text-sm text-gray-300 leading-relaxed">
                                            <button onClick={() => { navigator.clipboard?.writeText(`Bună ziua! Vă sunăm de la ${selectedOrder.store_name || 'magazin'} pentru confirmarea comenzii ${selectedOrder.client_personal_id || `#${selectedOrder.id}`} pentru ${selectedOrder.produse || '[PRODUS]'}. Livrarea se face prin curier, plata ramburs. Adresa de livrare este ${selectedOrder.adresa || '[ADRESĂ]'}. Este totul în regulă?`); showToast('Script copiat!'); }} className="absolute top-3 right-3 text-gray-500 hover:text-white transition-colors">
                                                <span className="material-icons-round" style={{fontSize:'16px'}}>content_copy</span>
                                            </button>
                                            Bună ziua! Vă sunăm de la <b className="text-white">{selectedOrder.store_name}</b> pentru confirmarea comenzii <b className="text-white">{selectedOrder.client_personal_id || `#${selectedOrder.id}`}</b> pentru <b className="text-white">{selectedOrder.produse || '[PRODUS]'}</b>. Livrarea se face prin curier, plata ramburs. Adresa de livrare este <b className="text-white">{selectedOrder.adresa || '[ADRESĂ]'}</b>. Este totul în regulă?
                                        </div>
                                    </div>
                                </div>

                                {/* Historic */}
                                {selectedOrder.istoric && (
                                    <div className="card-depth rounded-2xl p-5">
                                        <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2"><span className="material-icons-round text-base text-gray-400">timeline</span>Istoric activitate</h3>
                                        <div className="text-sm text-gray-400 whitespace-pre-wrap leading-relaxed">{selectedOrder.istoric}</div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* ── Dialer Panel ───────────────────────────────────────── */}
                    {dialerOpen && (
                        <div className="w-[300px] shrink-0 card-depth rounded-2xl p-5 flex flex-col items-center">
                            {/* Phone display */}
                            <div className="w-full mb-6 min-h-[60px] flex items-center justify-center relative">
                                <input
                                    type="text"
                                    value={phoneNumber}
                                    onChange={e => setPhoneNumber(e.target.value)}
                                    className="w-full bg-transparent border-none outline-none text-center text-2xl font-light text-white tracking-widest"
                                    placeholder=" "
                                    autoFocus
                                />
                                {phoneNumber && (
                                    <button onClick={handleDelete} className="absolute right-0 text-gray-500 hover:text-white transition-colors">
                                        <span className="material-icons-round">backspace</span>
                                    </button>
                                )}
                            </div>

                            {/* Call state */}
                            {callState !== 'idle' && (
                                <div className={`mb-4 px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase animate-pulse ${callState === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                    {callState === 'active' ? 'Apel în curs...' : 'Apelează...'}
                                </div>
                            )}

                            {/* Keypad */}
                            <div className={`grid grid-cols-3 gap-3 w-full mb-5 transition-opacity ${callState !== 'idle' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                                {[
                                    { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
                                    { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
                                    { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
                                    { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' }
                                ].map(item => (
                                    <button key={item.key} onClick={() => handleKeypadPress(item.key)} className="flex flex-col items-center justify-center h-14 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95">
                                        <span className="text-xl font-light text-white">{item.key}</span>
                                        {item.sub && <span className="text-[8px] text-gray-500 font-medium tracking-widest">{item.sub}</span>}
                                    </button>
                                ))}
                            </div>

                            {/* Call button */}
                            <button
                                onClick={handleCallAction}
                                disabled={!phoneNumber && callState === 'idle'}
                                className={`w-14 h-14 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${callState === 'idle' ? 'bg-green-500 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]' : 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'}`}
                            >
                                <span className="material-icons-round text-white text-2xl">{callState === 'idle' ? 'call' : 'call_end'}</span>
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
        <p className="text-[11px] text-gray-500 mb-0.5">{label}</p>
        <p className={`text-sm font-medium ${highlight ? 'text-amber-300' : 'text-white'}`}>{value || '—'}</p>
    </div>
);

const DL = ({ label, value }: { label: string; value: React.ReactNode }) => (
    <div className="flex justify-between items-center py-1.5 border-b border-white/3 last:border-0">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-sm text-white">{value}</span>
    </div>
);

export default Drafturi;
