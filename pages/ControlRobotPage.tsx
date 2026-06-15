import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import StoreSelector from '../components/StoreSelector';

const ControlRobotPage = () => {
    const { profile } = useAuth();
    const userStores = profile?.stores || [];
    const [selectedBrand, setSelectedBrand] = useState<string>('');
    const [orderNumber, setOrderNumber] = useState('');
    const [tipComanda, setTipComanda] = useState<'draft' | 'comanda'>('comanda');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [isLoadingCall, setIsLoadingCall] = useState(false);
    const [isLoadingActivate, setIsLoadingActivate] = useState(false);
    const [sentOrders, setSentOrders] = useState<{ orderNumber: string; tipComanda: string; shop: string; time: string }[]>([]);
    const [isRobotStopped, setIsRobotStopped] = useState(() =>
        JSON.parse(localStorage.getItem('callControl_stop_all') ?? 'false')
    );
    const [isDraftsStopped, setIsDraftsStopped] = useState(() =>
        JSON.parse(localStorage.getItem('callControl_stop_drafts') ?? 'false')
    );
    const [isComenziStopped, setIsComenziStopped] = useState(() =>
        JSON.parse(localStorage.getItem('callControl_stop_comenzi') ?? 'false')
    );
    const [callingStartTime, setCallingStartTime] = useState('08:00');
    const [callingEndTime, setCallingEndTime] = useState('22:30');
    const [productId, setProductId] = useState('');
    const [isLoadingStopProduct, setIsLoadingStopProduct] = useState(false);
    const [isLoadingStartProduct, setIsLoadingStartProduct] = useState(false);

    useEffect(() => {
        if (userStores.length > 0 && !selectedBrand) {
            setSelectedBrand(userStores[0]);
        }
    }, [userStores, selectedBrand]);

    const handleCallAction = async () => {
        if (!orderNumber || !selectedBrand) {
            alert("Te rugăm să selectezi un magazin, tipul comenzii și să introduci numărul comenzii.");
            return;
        }

        setIsLoadingCall(true);
        try {
            await fetch('https://n8n.whimlets.com/webhook/control-robot-vt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shop: selectedBrand,
                    order_number: orderNumber,
                    tip_comanda: tipComanda,
                    action: 'call'
                }),
            });
            alert("Comanda de apelare a fost trimisă cu succes!");
            setSentOrders(prev => [{
                orderNumber,
                tipComanda,
                shop: selectedBrand,
                time: new Date().toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            }, ...prev]);
            setOrderNumber('');
            setTipComanda('comanda');
        } catch (error) {
            console.error("Eroare la trimiterea comenzii:", error);
            alert("A apărut o eroare la trimiterea comenzii.");
        } finally {
            setIsLoadingCall(false);
        }
    };

    const handleActivateAction = async () => {
        if (!phoneNumber || !selectedBrand) {
            alert("Te rugăm să selectezi un magazin și să introduci numărul de telefon.");
            return;
        }

        setIsLoadingActivate(true);
        try {
            await fetch('https://n8n.whimlets.com/webhook/control-robot-vt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shop: selectedBrand,
                    phone_number: phoneNumber,
                    action: 'activate'
                }),
            });
            alert("Comanda de activare a fost trimisă cu succes!");
            setPhoneNumber('');
        } catch (error) {
            console.error("Eroare la trimiterea comenzii:", error);
            alert("A apărut o eroare la trimiterea comenzii.");
        } finally {
            setIsLoadingActivate(false);
        }
    };

    const handleStopProductAction = async () => {
        if (!productId || !selectedBrand) {
            alert("Te rugăm să selectezi un magazin și să introduci ID-ul produsului.");
            return;
        }

        setIsLoadingStopProduct(true);
        try {
            await fetch('https://n8n.whimlets.com/webhook/product-control-vt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shop: selectedBrand,
                    product_id: productId,
                    action: 'stop_product'
                }),
            });
            alert("Comanda de oprire a produsului a fost trimisă cu succes!");
            setProductId('');
        } catch (error) {
            console.error("Eroare la trimiterea comenzii:", error);
            alert("A apărut o eroare la trimiterea comenzii.");
        } finally {
            setIsLoadingStopProduct(false);
        }
    };

    const handleStartProductAction = async () => {
        if (!productId || !selectedBrand) {
            alert("Te rugăm să selectezi un magazin și să introduci ID-ul produsului.");
            return;
        }

        setIsLoadingStartProduct(true);
        try {
            await fetch('https://n8n.whimlets.com/webhook/product-control-vt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    shop: selectedBrand,
                    product_id: productId,
                    action: 'start_product'
                }),
            });
            alert("Comanda de pornire a produsului a fost trimisă cu succes!");
            setProductId('');
        } catch (error) {
            console.error("Eroare la trimiterea comenzii:", error);
            alert("A apărut o eroare la trimiterea comenzii.");
        } finally {
            setIsLoadingStartProduct(false);
        }
    };

    const handleFullStopToggle = async () => {
        const newValue = !isRobotStopped;
        const message = newValue
            ? "Ești sigur că vrei să oprești complet robotul?"
            : "Ești sigur că vrei să repornești robotul?";
        if (!window.confirm(message)) return;
        try {
            await fetch('https://n8n.whimlets.com/webhook/ai-bot-call-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop: selectedBrand,
                    action: 'stop_all',
                    stopped: newValue,
                }),
            });
            setIsRobotStopped(newValue);
            localStorage.setItem('callControl_stop_all', JSON.stringify(newValue));
        } catch (error) {
            console.error('Eroare la trimiterea comenzii:', error);
            alert('A apărut o eroare. Starea robotului nu a fost modificată.');
        }
    };

    const handleDraftsStopToggle = async () => {
        const newValue = !isDraftsStopped;
        const message = newValue
            ? "Ești sigur că vrei să oprești apelurile pentru drafturi?"
            : "Ești sigur că vrei să repornești apelurile pentru drafturi?";
        if (!window.confirm(message)) return;
        try {
            await fetch('https://n8n.whimlets.com/webhook/ai-bot-call-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop: selectedBrand,
                    action: 'stop_drafts',
                    stopped: newValue,
                }),
            });
            setIsDraftsStopped(newValue);
            localStorage.setItem('callControl_stop_drafts', JSON.stringify(newValue));
        } catch (error) {
            console.error('Eroare la trimiterea comenzii:', error);
            alert('A apărut o eroare. Starea nu a fost modificată.');
        }
    };

    const handleComenziStopToggle = async () => {
        const newValue = !isComenziStopped;
        const message = newValue
            ? "Ești sigur că vrei să oprești apelurile pentru comenzi?"
            : "Ești sigur că vrei să repornești apelurile pentru comenzi?";
        if (!window.confirm(message)) return;
        try {
            await fetch('https://n8n.whimlets.com/webhook/ai-bot-call-control', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shop: selectedBrand,
                    action: 'stop_comenzi',
                    stopped: newValue,
                }),
            });
            setIsComenziStopped(newValue);
            localStorage.setItem('callControl_stop_comenzi', JSON.stringify(newValue));
        } catch (error) {
            console.error('Eroare la trimiterea comenzii:', error);
            alert('A apărut o eroare. Starea nu a fost modificată.');
        }
    };

    return (
        <div className="flex flex-col h-full">
            <header className="flex items-center justify-between px-8 py-6 mb-8">
                <h1 className="text-3xl font-light dark:text-white tracking-tight">Control Robot</h1>
                <StoreSelector
                    selectedBrand={selectedBrand}
                    setSelectedBrand={setSelectedBrand}
                    userStores={userStores}
                />
            </header>

            <div className="flex-1 px-8 space-y-6">
                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
                    <p className="text-xl text-gray-800 dark:text-gray-200 mb-2">Actiune apelare comanda</p>
                    <p className="text-sm text-yellow-500 font-light flex items-center gap-2 mb-6">
                        <span className="material-icons-round text-base">warning</span>
                        Pentru orice comanda/draft fara tag ce trebuie sunata
                    </p>

                    <div className="flex gap-6 items-start">
                        {/* ── Left: form ── */}
                        <div className="flex-1 min-w-0 flex flex-col gap-4">
                        <div className="flex gap-4 items-center">
                            <label className="text-sm text-gray-500 dark:text-gray-400 font-light whitespace-nowrap">Tip comanda</label>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => setTipComanda('comanda')}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                        tipComanda === 'comanda'
                                            ? 'bg-primary text-white border-primary shadow-md'
                                            : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-white/10 hover:border-primary/50'
                                    }`}
                                >
                                    Comanda
                                </button>
                                <button
                                    onClick={() => setTipComanda('draft')}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                                        tipComanda === 'draft'
                                            ? 'bg-primary text-white border-primary shadow-md'
                                            : 'bg-transparent text-gray-600 dark:text-gray-300 border-gray-300 dark:border-white/10 hover:border-primary/50'
                                    }`}
                                >
                                    Draft
                                </button>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <input
                                type="text"
                                value={orderNumber}
                                onChange={(e) => setOrderNumber(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && handleCallAction()}
                                placeholder="numar comanda, de exemplu 4545"
                                className="flex-1 px-4 py-3 rounded-xl bg-background-light dark:bg-[#0a0b14] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-light"
                            />
                            <button
                                onClick={handleCallAction}
                                disabled={isLoadingCall}
                                className={`btn-3d-primary px-6 py-3 rounded-xl text-white font-medium text-sm tracking-wide flex items-center gap-2 transition-all ${isLoadingCall ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                            >
                                {isLoadingCall ? (
                                    <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                                ) : (
                                    "Apeleaza"
                                )}
                            </button>
                        </div>
                        </div>

                        {/* ── Right: sent orders sidebar ── */}
                        <div className="w-64 flex-shrink-0 flex flex-col gap-2">
                            <div className="flex items-center justify-between mb-1">
                                <p className="text-xs text-gray-500 uppercase tracking-widest font-medium">Trimise în sesiune</p>
                                {sentOrders.length > 0 && (
                                    <span className="text-[11px] px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 font-medium">{sentOrders.length}</span>
                                )}
                            </div>
                            <div className="h-40 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin">
                                {sentOrders.length === 0 ? (
                                    <div className="h-full flex items-center justify-center">
                                        <p className="text-xs text-gray-600 italic text-center">Nicio comandă trimisă încă</p>
                                    </div>
                                ) : (
                                    sentOrders.map((o, i) => (
                                        <div key={i} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-black/30 border border-white/5">
                                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                                o.tipComanda === 'draft' ? 'bg-blue-400' : 'bg-emerald-400'
                                            }`} />
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-num text-white truncate">#{o.orderNumber}</p>
                                                <p className="text-[10px] text-gray-500">{o.tipComanda} · {o.time}</p>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
                    <p className="text-xl text-gray-800 dark:text-gray-200 mb-2">Oprire apeluri asupra unui client</p>
                    <p className="text-sm text-yellow-500 font-light flex items-center gap-2 mb-6">
                        <span className="material-icons-round text-base">warning</span>
                        Atentie, pentru urmatoarele 5 zile, clientul nu va mai fi sunat deloc
                    </p>

                    <div className="max-w-md flex gap-4">
                        <input
                            type="text"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value)}
                            placeholder="0733333333"
                            className="flex-1 px-4 py-3 rounded-xl bg-background-light dark:bg-[#0a0b14] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-light"
                        />
                        <button
                            onClick={handleActivateAction}
                            disabled={isLoadingActivate}
                            className={`btn-3d-primary px-6 py-3 rounded-xl text-white font-medium text-sm tracking-wide flex items-center gap-2 transition-all ${isLoadingActivate ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            {isLoadingActivate ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                "Activeaza"
                            )}
                        </button>
                    </div>
                </div>

                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
                    <p className="text-xl text-gray-800 dark:text-gray-200 mb-1">Oprire sunat</p>
                    <p className="text-sm text-gray-500 font-light mb-6">Controlează ce tipuri de apeluri efectuează robotul.</p>

                    <div className="flex flex-col sm:flex-row gap-4">
                        {/* Oprire completă */}
                        <div className={`flex-1 flex items-center justify-between gap-4 p-5 rounded-2xl border transition-colors duration-300 ${
                            isRobotStopped
                                ? 'bg-red-500/10 border-red-500/30'
                                : 'bg-black/20 border-white/5'
                        }`}>
                            <div>
                                <p className="text-sm font-medium text-gray-200">Oprire completă</p>
                                <p className="text-xs text-gray-500 font-light mt-0.5">Oprește toate apelurile robotului</p>
                            </div>
                            <button
                                onClick={handleFullStopToggle}
                                className={`flex-shrink-0 w-14 h-8 rounded-full p-1 transition-colors duration-300 ${
                                    isRobotStopped ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                    isRobotStopped ? 'translate-x-6' : 'translate-x-0'
                                }`}></div>
                            </button>
                        </div>

                        {/* Oprire sunat drafturi */}
                        <div className={`flex-1 flex items-center justify-between gap-4 p-5 rounded-2xl border transition-colors duration-300 ${
                            isDraftsStopped
                                ? 'bg-amber-500/10 border-amber-500/30'
                                : 'bg-black/20 border-white/5'
                        }`}>
                            <div>
                                <p className="text-sm font-medium text-gray-200">Oprire sunat drafturi</p>
                                <p className="text-xs text-gray-500 font-light mt-0.5">Oprește apelurile pentru comenzi draft</p>
                            </div>
                            <button
                                onClick={handleDraftsStopToggle}
                                className={`flex-shrink-0 w-14 h-8 rounded-full p-1 transition-colors duration-300 ${
                                    isDraftsStopped ? 'bg-amber-500' : 'bg-gray-300 dark:bg-gray-700'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                    isDraftsStopped ? 'translate-x-6' : 'translate-x-0'
                                }`}></div>
                            </button>
                        </div>

                        {/* Oprire sunat comenzi */}
                        <div className={`flex-1 flex items-center justify-between gap-4 p-5 rounded-2xl border transition-colors duration-300 ${
                            isComenziStopped
                                ? 'bg-orange-500/10 border-orange-500/30'
                                : 'bg-black/20 border-white/5'
                        }`}>
                            <div>
                                <p className="text-sm font-medium text-gray-200">Oprire sunat comenzi</p>
                                <p className="text-xs text-gray-500 font-light mt-0.5">Oprește apelurile pentru comenzi confirmate</p>
                            </div>
                            <button
                                onClick={handleComenziStopToggle}
                                className={`flex-shrink-0 w-14 h-8 rounded-full p-1 transition-colors duration-300 ${
                                    isComenziStopped ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-700'
                                }`}
                            >
                                <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${
                                    isComenziStopped ? 'translate-x-6' : 'translate-x-0'
                                }`}></div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Interval Sunat */}
                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
                    <p className="text-xl text-gray-800 dark:text-gray-200 mb-1">Interval sunat</p>
                    <p className="text-sm text-gray-500 font-light mb-6">Robotul va efectua apeluri doar în intervalul orar setat.</p>

                    <div className="flex flex-col sm:flex-row gap-4 max-w-lg">
                        <div className="flex-1 space-y-1.5">
                            <label className="text-xs text-gray-500 uppercase tracking-widest font-medium">De la</label>
                            <div className="flex items-center gap-3 bg-[#0a0b14] px-4 py-3 rounded-xl border border-white/10 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                                <span className="material-icons-round text-primary/60 text-base">schedule</span>
                                <input
                                    type="time"
                                    value={callingStartTime}
                                    onChange={e => setCallingStartTime(e.target.value)}
                                    className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 outline-none flex-1 cursor-pointer"
                                />
                            </div>
                        </div>
                        <div className="flex items-end pb-3 text-gray-600 text-lg font-light hidden sm:flex">—</div>
                        <div className="flex-1 space-y-1.5">
                            <label className="text-xs text-gray-500 uppercase tracking-widest font-medium">Până la</label>
                            <div className="flex items-center gap-3 bg-[#0a0b14] px-4 py-3 rounded-xl border border-white/10 focus-within:ring-2 focus-within:ring-primary/50 transition-all">
                                <span className="material-icons-round text-primary/60 text-base">schedule</span>
                                <input
                                    type="time"
                                    value={callingEndTime}
                                    onChange={e => setCallingEndTime(e.target.value)}
                                    className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 outline-none flex-1 cursor-pointer"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg">
                    <p className="text-xl text-gray-800 dark:text-gray-200 mb-2">Oprire sunat produs</p>
                    <p className="text-sm text-gray-400 font-light mb-6">
                        Pe acest produs robotul nu va mai suna. Introdu ID-ul produsului din Shopify, se gaseste in link-ul acestuia
                    </p>

                    <div className="max-w-md flex gap-4">
                        <input
                            type="text"
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            placeholder="ID Produs Shopify"
                            className="flex-1 px-4 py-3 rounded-xl bg-background-light dark:bg-[#0a0b14] border border-gray-200 dark:border-white/10 text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all font-light"
                        />
                        <button
                            onClick={handleStopProductAction}
                            disabled={isLoadingStopProduct}
                            className={`btn-3d-primary min-w-[100px] px-6 py-3 rounded-xl text-white font-medium text-sm tracking-wide flex items-center justify-center gap-2 transition-all ${isLoadingStopProduct ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            {isLoadingStopProduct ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                "Opreste"
                            )}
                        </button>
                        <button
                            onClick={handleStartProductAction}
                            disabled={isLoadingStartProduct}
                            className={`btn-3d-primary min-w-[100px] px-6 py-3 rounded-xl text-white font-medium text-sm tracking-wide flex items-center justify-center gap-2 transition-all ${isLoadingStartProduct ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                        >
                            {isLoadingStartProduct ? (
                                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                            ) : (
                                "Porneste"
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ControlRobotPage;
