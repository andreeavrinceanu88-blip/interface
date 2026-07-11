import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';

const Drafturi = () => {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];

    // UI Filters
    const [viewMode, setViewMode] = useState<'drafturi' | 'comenzi'>('drafturi');
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7);
        return d.toISOString().split('T')[0];
    });
    const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
    const [searchInput, setSearchInput] = useState('');
    const [activeSearch, setActiveSearch] = useState('');

    // Keypad state
    const [phoneNumber, setPhoneNumber] = useState('');

    // Telnyx WebRTC State
    const clientRef = useRef<any>(null);
    const callRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const [isConnecting, setIsConnecting] = useState(false);
    const [callState, setCallState] = useState<'idle' | 'calling' | 'active'>('idle');

    // Init Telnyx
    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }

        // Credentials — hardcoded for ESM/importmap production environment
        // (import.meta.env is only available with Vite dev server)
        const username = import.meta.env?.VITE_TELNYX_SIP_USERNAME ?? 'vitadomus';
        const password = import.meta.env?.VITE_TELNYX_SIP_PASSWORD ?? 'vitadomus';

        if (!username || !password) {
            console.warn('Telnyx SIP credentials not configured — WebRTC dialer disabled.');
            return;
        }

        setIsConnecting(true);

        // Dynamic import prevents crash from CommonJS globals during module evaluation
        import('@telnyx/webrtc').then(({ TelnyxRTC }) => {
            const client = new TelnyxRTC({ login: username, password: password });

            client.on('telnyx.ready', () => {
                console.log('✅ Telnyx WebRTC ready');
                setIsConnecting(false);
            });

            client.on('telnyx.error', (error: any) => {
                console.error('❌ Telnyx error:', error);
                setIsConnecting(false);
            });

            client.on('telnyx.notification', (notification: any) => {
                const call = notification.call;
                if (notification.type === 'callUpdate') {
                    if (call.state === 'ringing') {
                        setCallState('calling');
                    } else if (call.state === 'active') {
                        setCallState('active');
                        if (audioRef.current && call.remoteStream) {
                            audioRef.current.srcObject = call.remoteStream;
                            audioRef.current.play().catch((e: any) => console.error('Audio play error', e));
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
        }).catch((err) => {
            console.error('Failed to load @telnyx/webrtc:', err);
            setIsConnecting(false);
        });

        return () => {
            if (clientRef.current) {
                clientRef.current.disconnect();
                clientRef.current = null;
            }
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps

    const handleKeypadPress = (key: string) => {
        setPhoneNumber(prev => prev + key);
    };

    const handleDelete = () => {
        setPhoneNumber(prev => prev.slice(0, -1));
    };

    const handleCallAction = async () => {
        if (!phoneNumber) return;

        if (callState === 'idle') {
            if (!clientRef.current) {
                alert("Conexiunea la serverul de apeluri nu a reușit. Verifică credențialele Telnyx în .env.");
                return;
            }
            
            try {
                await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (err) {
                alert("Este nevoie de acces la microfon pentru a suna!");
                return;
            }

            const callerId = import.meta.env?.VITE_TELNYX_CALLER_ID ?? '+40775393060';
            
            try {
                callRef.current = clientRef.current.newCall({
                    destinationNumber: phoneNumber,
                    callerNumber: callerId, // Specify Outbound Caller ID here
                    audio: true,
                    video: false,
                });
                setCallState('calling');
            } catch (err) {
                console.error("Call initiation failed", err);
                alert("A apărut o eroare la inițierea apelului.");
            }
        } else {
            // Hangup
            if (callRef.current) {
                callRef.current.hangup();
            }
            setCallState('idle');
        }
    };

    const dummyDrafts = [
        { id: '1001', name: 'Ion Popescu', phone: '0743568158', total: '149.99 RON', date: '2026-07-06 10:30', status: 'Abandonat' },
        { id: '1002', name: 'Maria Ionescu', phone: '0712345678', total: '299.00 RON', date: '2026-07-06 11:15', status: 'În așteptare' },
        { id: '1003', name: 'Andrei Radu', phone: '0798765432', total: '89.50 RON', date: '2026-07-06 12:45', status: 'Abandonat' },
        { id: '1004', name: 'Elena Vlad', phone: '0722222222', total: '450.00 RON', date: '2026-07-06 14:20', status: 'Abandonat' },
        { id: '1005', name: 'George Matei', phone: '0733333333', total: '120.00 RON', date: '2026-07-06 15:05', status: 'În așteptare' },
    ];

    const filteredDrafts = dummyDrafts.filter(d => 
        (d.id.includes(activeSearch) || d.name.toLowerCase().includes(activeSearch.toLowerCase()) || d.phone.includes(activeSearch))
    );

    return (
        <div className="flex flex-col h-full space-y-6">
            <audio ref={audioRef} style={{ display: 'none' }} />
            
            {/* Top Bar: Title & Filters */}
            <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
                
                <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
                    {/* View Mode Selector */}
                    <div className="flex bg-[#13141a] border border-white/5 rounded-xl p-1 shadow-inner h-[42px] shrink-0">
                        <button 
                            onClick={() => setViewMode('drafturi')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === 'drafturi' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(0,210,255,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Drafturi
                        </button>
                        <button 
                            onClick={() => setViewMode('comenzi')}
                            className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-all ${viewMode === 'comenzi' ? 'bg-primary/20 text-primary shadow-[0_0_10px_rgba(0,210,255,0.2)]' : 'text-gray-400 hover:text-gray-200'}`}
                        >
                            Comenzi
                        </button>
                    </div>

                    <div className="max-w-lg w-full relative group">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 material-icons-round text-gray-500">search</span>
                        <input
                            type="text"
                            value={searchInput}
                            onChange={(e) => setSearchInput(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && setActiveSearch(searchInput)}
                            placeholder="Caută draft..."
                            className="w-full pl-10 pr-24 py-3 bg-[#13141a] border border-white/5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-gray-200"
                        />
                        <button onClick={() => setActiveSearch(searchInput)} className="absolute right-1.5 top-1.5 bottom-1.5 px-4 bg-surface-dark-lighter border border-white/5 text-gray-400 hover:text-white text-xs font-medium rounded-lg transition-colors">Caută</button>
                    </div>
                </div>

                <div className="flex flex-wrap gap-3 items-center justify-end">
                    <div className="flex items-center gap-2 bg-[#13141a] p-1 rounded-xl border border-white/5 shadow-inner">
                        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                        <span className="text-gray-600">-</span>
                        <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none" />
                    </div>

                    <div className="relative">
                        <button onClick={() => setIsDropdownOpen(!isDropdownOpen)} className="btn-3d-secondary px-5 py-2.5 rounded-xl text-sm min-w-[160px] flex justify-between items-center h-[42px] hover:text-white transition-all">
                            <span>{selectedBrand || 'Selectează'}</span>
                            <span className={`material-icons-round transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isDropdownOpen && (
                            <>
                                <div className="fixed inset-0 z-40" onClick={() => setIsDropdownOpen(false)}></div>
                                <div className="absolute right-0 top-full mt-2 w-full rounded-xl bg-[#13141a] border border-white/5 shadow-xl z-50 overflow-hidden backdrop-blur-md">
                                    {userStores.map(store => (
                                        <button
                                            key={store}
                                            onClick={() => { setSelectedBrand(store); setIsDropdownOpen(false); }}
                                            className="w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                                        >
                                            <span className={`w-1.5 h-1.5 rounded-full ${selectedBrand === store ? 'bg-primary shadow-[0_0_8px_rgba(168,85,247,0.4)]' : 'bg-transparent border border-gray-600'}`}></span>
                                            {store}
                                        </button>
                                    ))}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6 flex-1 min-h-0">
                {/* Left Column: Draft Orders */}
                <div className="lg:w-2/3 card-depth p-6 rounded-2xl flex flex-col h-full overflow-hidden">
                    <h3 className="text-xl font-light text-white mb-4 tracking-tight">Comenzi Draft</h3>
                    <div className="overflow-y-auto pr-2 scrollbar-hide flex-1">
                        <div className="space-y-3">
                            {filteredDrafts.length === 0 ? (
                                <p className="text-gray-500 font-light italic text-sm text-center py-8">Nu s-au găsit drafturi.</p>
                            ) : (
                                filteredDrafts.map(draft => (
                                    <div key={draft.id} className="glass-panel-3d p-4 rounded-xl border border-white/5 flex items-center justify-between group hover:border-cyan-500/30 transition-all">
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-400">
                                                <span className="material-icons-round">shopping_cart</span>
                                            </div>
                                            <div>
                                                <h4 className="text-white font-medium text-sm">Comanda #{draft.id} - {draft.name}</h4>
                                                <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1"><span className="material-icons-round" style={{ fontSize: '14px' }}>payments</span>{draft.total}</span>
                                                    <span className="flex items-center gap-1"><span className="material-icons-round" style={{ fontSize: '14px' }}>schedule</span>{draft.date}</span>
                                                    <span className="flex items-center gap-1"><span className="material-icons-round" style={{ fontSize: '14px' }}>phone</span>{draft.phone}</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <span className={`px-2 py-1 rounded text-[10px] uppercase font-medium ${draft.status === 'Abandonat' ? 'text-red-400 bg-red-500/10' : 'text-yellow-400 bg-yellow-500/10'}`}>
                                                {draft.status}
                                            </span>
                                            <button 
                                                onClick={() => setPhoneNumber(draft.phone)}
                                                className="p-2 rounded-lg bg-white/5 hover:bg-cyan-500/20 text-gray-400 hover:text-cyan-400 transition-colors"
                                            >
                                                <span className="material-icons-round text-lg">call</span>
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Column: Cell Phone Keypad */}
                <div className="lg:w-1/3 card-depth p-6 rounded-2xl flex flex-col items-center justify-center h-full relative">
                    {isConnecting && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-gray-500 bg-black/20 px-3 py-1.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-yellow-500 animate-pulse"></span> Conectare Telnyx...
                        </div>
                    )}
                    {!isConnecting && !clientRef.current && (
                        <div className="absolute top-4 right-4 flex items-center gap-2 text-xs text-red-400 bg-red-500/10 px-3 py-1.5 rounded-full">
                            <span className="w-2 h-2 rounded-full bg-red-500"></span> Telnyx Inactiv
                        </div>
                    )}
                    
                    <div className="w-full max-w-[280px] flex flex-col items-center">
                        {/* Display */}
                        <div className="w-full mb-8 min-h-[72px] flex items-center justify-center relative">
                            <input
                                type="text"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                className="w-full bg-transparent border-none outline-none text-center text-3xl font-light text-white tracking-widest font-num"
                                placeholder=" "
                                autoFocus
                            />
                            {phoneNumber && (
                                <button onClick={handleDelete} className="absolute right-0 text-gray-500 hover:text-white transition-colors">
                                    <span className="material-icons-round">backspace</span>
                                </button>
                            )}
                        </div>

                        {/* Call Status Display */}
                        {callState !== 'idle' && (
                            <div className={`mb-6 px-4 py-1.5 rounded-full text-xs font-medium tracking-wider uppercase animate-pulse ${callState === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                                {callState === 'active' ? 'Apel în curs...' : 'Apelează...'}
                            </div>
                        )}

                        {/* Keypad Grid */}
                        <div className={`grid grid-cols-3 gap-4 w-full mb-8 transition-opacity ${callState !== 'idle' ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
                            {[
                                { key: '1', sub: '' }, { key: '2', sub: 'ABC' }, { key: '3', sub: 'DEF' },
                                { key: '4', sub: 'GHI' }, { key: '5', sub: 'JKL' }, { key: '6', sub: 'MNO' },
                                { key: '7', sub: 'PQRS' }, { key: '8', sub: 'TUV' }, { key: '9', sub: 'WXYZ' },
                                { key: '*', sub: '' }, { key: '0', sub: '+' }, { key: '#', sub: '' }
                            ].map((item) => (
                                <button
                                    key={item.key}
                                    onClick={() => handleKeypadPress(item.key)}
                                    className="flex flex-col items-center justify-center h-16 rounded-full bg-white/5 hover:bg-white/10 border border-white/5 transition-all active:scale-95"
                                >
                                    <span className="text-2xl font-light text-white">{item.key}</span>
                                    {item.sub && <span className="text-[9px] text-gray-500 font-medium tracking-widest">{item.sub}</span>}
                                </button>
                            ))}
                        </div>

                        {/* Call Action */}
                        <div className="flex justify-center w-full">
                            <button
                                onClick={handleCallAction}
                                disabled={!phoneNumber && callState === 'idle'}
                                className={`w-16 h-16 rounded-full flex items-center justify-center transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed ${
                                    callState === 'idle' 
                                        ? 'bg-green-500 hover:bg-green-400 shadow-[0_0_20px_rgba(34,197,94,0.3)]' 
                                        : 'bg-red-500 hover:bg-red-400 shadow-[0_0_20px_rgba(239,68,68,0.3)]'
                                }`}
                            >
                                <span className="material-icons-round text-white text-3xl">
                                    {callState === 'idle' ? 'call' : 'call_end'}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Drafturi;
