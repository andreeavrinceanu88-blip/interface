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
    const [isRobotStopped, setIsRobotStopped] = useState(false);
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
            await fetch('https://n8n.voisero.info/webhook/control-robot-vt', {
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
            await fetch('https://n8n.voisero.info/webhook/control-robot-vt', {
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
            await fetch('https://n8n.voisero.info/webhook/product-control-vt', {
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
            await fetch('https://n8n.voisero.info/webhook/product-control-vt', {
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

    const handleFullStopToggle = () => {
        const message = isRobotStopped
            ? "Ești sigur că vrei să repornești robotul?"
            : "Ești sigur că vrei să oprești complet robotul?";

        if (window.confirm(message)) {
            setIsRobotStopped(!isRobotStopped);
            // No backend action for now as requested
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
                        Atentie, trebuie sa introduci o comanda cu tag-ul 'n-a raspuns', altfel clientul va fi sunat de mai multe ori
                    </p>

                    <div className="max-w-2xl flex flex-col gap-4">
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

                <div className="bg-surface-light dark:bg-surface-dark-lighter p-8 rounded-2xl border border-gray-200 dark:border-white/5 shadow-lg flex items-center justify-between">
                    <div>
                        <p className="text-xl text-gray-800 dark:text-gray-200 mb-2">Oprire completa</p>
                        <p className="text-sm text-gray-400 font-light">
                            Ascunde sau dezactivează complet funcționalitatea robotului.
                        </p>
                    </div>

                    <button
                        onClick={handleFullStopToggle}
                        className={`w-14 h-8 rounded-full p-1 transition-colors duration-300 ${isRobotStopped ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-700'}`}
                    >
                        <div className={`w-6 h-6 rounded-full bg-white shadow-md transform transition-transform duration-300 ${isRobotStopped ? 'translate-x-6' : 'translate-x-0'}`}></div>
                    </button>
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
