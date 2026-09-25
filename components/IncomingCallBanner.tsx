import React from 'react';
import { useTelnyx, detectStoreFromNumber, CallerInfo } from '../contexts/TelnyxContext';

const getShopifyStoreCode = (storeName?: string) => {
    const name = (storeName || '').toLowerCase();
    if (name === 'vitadomus') return 'z10zqc-mz';
    if (name === 'tamtrend') return 'k7agxh-7y';
    return name || 'vitadomus';
};

const formatDisplayPhone = (raw?: string | null): string => {
    if (!raw) return '';
    const clean = raw.replace(/\D/g, '');
    let local = clean;
    if (local.startsWith('40') && local.length >= 11) {
        local = '0' + local.slice(2);
    }
    if (local.length === 10 && local.startsWith('0')) {
        return `${local.slice(0, 4)} ${local.slice(4, 7)} ${local.slice(7)}`;
    }
    return raw;
};

const resolveStoreInfo = (info?: CallerInfo | null, call?: any) => {
    let store = info?.store || null;

    const rawCalled = info?.calledNumber || 
                      call?.options?.destinationNumber || 
                      call?.destinationNumber || 
                      call?.calledNumber || 
                      call?.options?.calledNumber ||
                      call?.options?.to ||
                      call?.to ||
                      call?.options?.calleeNumber ||
                      null;
    
    const calledNumberStr = rawCalled ? String(rawCalled).replace(/^sip:/i, '').split('@')[0] : null;

    if (!store && calledNumberStr) {
        store = detectStoreFromNumber(calledNumberStr);
    }

    if (!store && info?.recentOrders && info.recentOrders.length > 0 && info.recentOrders[0].store_name) {
        store = info.recentOrders[0].store_name;
    }

    return {
        store: store || null,
        calledNumber: calledNumberStr
    };
};

const StoreBadge = ({ store, calledNumber }: { store?: string | null; calledNumber?: string | null }) => {
    const s = (store || '').toLowerCase();
    const isVita = s.includes('vita');
    const isTam = s.includes('tam');
    const formattedCalled = calledNumber ? formatDisplayPhone(calledNumber) : null;

    if (isVita) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-blue-500/20 border border-blue-400/60 shadow-[0_0_12px_rgba(59,130,246,0.3)] text-blue-200">
                <span className="material-icons-round text-base text-blue-400">storefront</span>
                <span className="font-extrabold text-xs tracking-wider uppercase">VITADOMUS</span>
                {formattedCalled && (
                    <span className="text-[11px] font-mono text-blue-300 bg-blue-950/80 px-1.5 py-0.5 rounded border border-blue-500/40">
                        {formattedCalled}
                    </span>
                )}
            </div>
        );
    }

    if (isTam) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-pink-500/20 border border-pink-400/60 shadow-[0_0_12px_rgba(236,72,153,0.3)] text-pink-200">
                <span className="material-icons-round text-base text-pink-400">storefront</span>
                <span className="font-extrabold text-xs tracking-wider uppercase">TAMTREND</span>
                {formattedCalled && (
                    <span className="text-[11px] font-mono text-pink-300 bg-pink-950/80 px-1.5 py-0.5 rounded border border-pink-500/40">
                        {formattedCalled}
                    </span>
                )}
            </div>
        );
    }

    if (store) {
        return (
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-purple-500/20 border border-purple-400/60 text-purple-200">
                <span className="material-icons-round text-base text-purple-400">storefront</span>
                <span className="font-extrabold text-xs tracking-wider uppercase">{store}</span>
                {formattedCalled && (
                    <span className="text-[11px] font-mono text-purple-300 bg-purple-950/80 px-1.5 py-0.5 rounded border border-purple-500/40">
                        {formattedCalled}
                    </span>
                )}
            </div>
        );
    }

    return (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gray-700/40 border border-gray-600/50 text-gray-300">
            <span className="material-icons-round text-sm text-gray-400">store</span>
            <span className="font-bold text-xs tracking-wider uppercase">Magazin</span>
            {formattedCalled && (
                <span className="text-[11px] font-mono text-gray-300 bg-black/50 px-1.5 py-0.5 rounded border border-gray-700">
                    {formattedCalled}
                </span>
            )}
        </div>
    );
};

const parseOrderProducts = (rawProducts?: string): string => {
    let parsedProducts = rawProducts || 'Fără produse';
    if (typeof parsedProducts === 'string') {
        let tempProducts = '';
        if (parsedProducts.startsWith('[') || parsedProducts.startsWith('{')) {
            try {
                const parsed = JSON.parse(parsedProducts);
                if (Array.isArray(parsed)) {
                    tempProducts = parsed.map((item: any) => item.name || item.title || 'Produs').join(', ');
                } else if (parsed?.edges) {
                    tempProducts = parsed.edges.map((edge: any) => edge.node?.name || edge.node?.title || 'Produs').join(', ');
                } else if (parsed?.line_items) {
                    tempProducts = parsed.line_items.map((item: any) => item.name || item.title || 'Produs').join(', ');
                }
            } catch (e) {}
        }
        if (!tempProducts) {
            const matches = Array.from(parsedProducts.matchAll(/(?:\\|)"(?:title|name)(?:\\|)"\s*:\s*(?:\\|)"([^"\\]+)(?:\\|)"/g));
            if (matches.length > 0) {
                tempProducts = matches.map(m => m[1]).join(', ');
            }
        }
        if (tempProducts) {
            parsedProducts = tempProducts;
        }
    }
    return parsedProducts;
};

export default function IncomingCallBanner() {
    const { incomingCalls, callerInfos, answerIncoming, rejectIncoming, callState, hangup, activeCall, toggleMute, isMuted, markForCallback } = useTelnyx();

    const showActiveInbound = callState === 'active' && activeCall && (activeCall.direction === 'inbound' || activeCall.direction !== 'outbound');
    
    // For active call we can use the callerInfos map if it was inbound
    const activeCallId = activeCall ? (activeCall.id || activeCall.options?.callSessionId) : null;
    const activeCallerInfo = activeCallId ? callerInfos[activeCallId] : null;
    const activeStoreInfo = resolveStoreInfo(activeCallerInfo, activeCall);

    if (!showActiveInbound && incomingCalls.length === 0) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] p-4 flex flex-col items-center gap-3 animate-slideDown pointer-events-none">
            {/* Active inbound call widget (always on top) */}
            {showActiveInbound && (
                <div className="bg-[#13141a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-2xl flex flex-col w-full max-w-3xl overflow-hidden pointer-events-auto">
                    <div className="p-4 flex items-center gap-5">
                        <div className="bg-emerald-500/10 p-3 rounded-xl shrink-0">
                            <span className="material-icons-round text-emerald-400 text-3xl animate-pulse">phone_in_talk</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                <span className="text-xs text-emerald-400 font-bold uppercase tracking-wider">Apel Activ (Inbound)</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-xs text-gray-400 font-medium">Sună la magazinul:</span>
                                <StoreBadge store={activeStoreInfo.store} calledNumber={activeStoreInfo.calledNumber} />
                            </div>
                            
                            <div className="flex items-baseline gap-2">
                                <p className="text-xl text-white font-semibold truncate">
                                    {activeCallerInfo?.name || formatDisplayPhone(activeCallerInfo?.number || activeCall?.options?.remoteCallerNumber || activeCall?.options?.callerNumber) || 'Client'}
                                </p>
                                {activeCallerInfo?.name && (
                                    <span className="text-sm text-gray-400 font-mono">
                                        ({formatDisplayPhone(activeCallerInfo.number || activeCall?.options?.remoteCallerNumber)})
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={() => { markForCallback(); }}
                                title="Salvează în Sunați"
                                className="px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 bg-amber-500/10 text-amber-500 hover:bg-amber-500/20"
                            >
                                <span className="material-icons-round">schedule</span>
                            </button>
                            <button 
                                onClick={toggleMute}
                                className={`px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2 ${isMuted ? 'bg-amber-500/20 text-amber-500' : 'bg-white/5 text-gray-300 hover:bg-white/10'}`}
                            >
                                <span className="material-icons-round">{isMuted ? 'mic_off' : 'mic'}</span>
                            </button>
                            <button 
                                onClick={hangup}
                                className="bg-red-500 hover:bg-red-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all flex items-center gap-2"
                            >
                                <span className="material-icons-round">call_end</span>
                                Închide
                            </button>
                        </div>
                    </div>
                    {/* Render Recent Orders for Active Call */}
                    {(activeCallerInfo?.recentOrders && activeCallerInfo.recentOrders.length > 0) ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 flex gap-3 overflow-x-auto scrollbar-hide">
                            {activeCallerInfo.recentOrders.map((o, i) => {
                                const safeStatus = o.status || 'NOU';
                                const statusColor = safeStatus === 'confirmat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : safeStatus === 'anulat' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                    : safeStatus === 'ON' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                    : safeStatus === 'NOU' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    : 'text-gray-400 bg-white/5 border-white/10';
                                const typeLabel = o.type === 'draft' ? 'Draft' : 'Comandă';
                                const typeColor = o.type === 'draft' ? 'text-amber-400' : 'text-cyan-400';
                                const parsedProducts = parseOrderProducts(o.produse);
                                const isVitaOrder = (o.store_name || '').toLowerCase().includes('vita');
                                
                                return (
                                    <div key={i} className="bg-[#13141a] border border-white/10 rounded-xl p-3 flex-1 min-w-[280px]">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
                                                <a 
                                                    href={`https://admin.shopify.com/store/${getShopifyStoreCode(o.store_name)}/${o.type === 'draft' ? 'draft_orders' : 'orders'}/${o.order_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-white text-sm font-medium hover:text-cyan-400 hover:underline cursor-pointer"
                                                >
                                                    {o.order_number}
                                                </a>
                                            </div>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusColor}`}>{safeStatus}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-2" title={parsedProducts}>{parsedProducts}</p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span className={`capitalize font-semibold text-[11px] px-2 py-0.5 rounded border ${isVitaOrder ? 'text-blue-300 bg-blue-500/15 border-blue-500/30' : 'text-pink-300 bg-pink-500/15 border-pink-500/30'}`}>
                                                🏪 {o.store_name}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span>{new Date(o.created_at).toLocaleDateString('ro-RO')}</span>
                                                {o.value > 0 && <span className="text-indigo-400 font-medium">{o.value} RON</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white/5 border-t border-white/5 px-4 py-2 text-center">
                            <p className="text-xs text-gray-500 italic">Client fără comenzi anterioare înregistrate</p>
                        </div>
                    )}
                </div>
            )}

            {/* Incoming call banners (below active call if both exist) */}
            {incomingCalls.map(call => {
                const callId = call.id || call.options?.callSessionId;
                const info = callerInfos[callId];
                const storeInfo = resolveStoreInfo(info, call);
                
                return (
                <div key={callId} className="bg-[#13141a] border border-cyan-500/30 shadow-[0_0_20px_rgba(0,210,255,0.2)] rounded-2xl flex flex-col w-full max-w-3xl overflow-hidden pointer-events-auto">
                    {/* Top Row: Caller Info & Buttons */}
                    <div className="p-4 flex items-center gap-5">
                        <div className="bg-cyan-500/10 p-3 rounded-xl animate-pulse shrink-0">
                            <span className="material-icons-round text-cyan-400 text-3xl">ring_volume</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2.5 mb-1.5 flex-wrap">
                                <span className="text-xs text-cyan-400 font-bold uppercase tracking-wider animate-pulse">Apel Primit</span>
                                <span className="text-gray-600">•</span>
                                <span className="text-xs text-gray-400 font-medium">Sună la magazinul:</span>
                                <StoreBadge store={storeInfo.store} calledNumber={storeInfo.calledNumber} />
                            </div>

                            <div className="flex items-baseline gap-2">
                                <p className="text-xl text-white font-semibold truncate">
                                    {info?.name ? info.name : (formatDisplayPhone(info?.number || call?.options?.remoteCallerNumber || call?.remoteCallerNumber) || 'Număr Necunoscut')}
                                </p>
                                {info?.name && (
                                    <span className="text-sm text-gray-400 font-mono">
                                        ({formatDisplayPhone(info.number || call?.options?.remoteCallerNumber || call?.remoteCallerNumber)})
                                    </span>
                                )}
                            </div>
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button
                                onClick={() => { markForCallback(); rejectIncoming(callId); }}
                                title="Salvează în Sunați"
                                className="bg-amber-500/10 hover:bg-amber-500/20 text-amber-500 px-4 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons-round">schedule</span>
                            </button>
                            <button 
                                onClick={() => rejectIncoming(callId)}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons-round">call_end</span>
                                Refuză
                            </button>
                            <button 
                                onClick={() => answerIncoming(callId)}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
                            >
                                <span className="material-icons-round">call</span>
                                Răspunde
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Recent Orders */}
                    {(info?.recentOrders && info.recentOrders.length > 0) ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 flex gap-3 overflow-x-auto scrollbar-hide">
                            {info.recentOrders.map((o, i) => {
                                const safeStatus = o.status || 'NOU';
                                const statusColor = safeStatus === 'confirmat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : safeStatus === 'anulat' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                    : safeStatus === 'ON' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                    : safeStatus === 'NOU' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    : 'text-gray-400 bg-white/5 border-white/10';
                                const typeLabel = o.type === 'draft' ? 'Draft' : 'Comandă';
                                const typeColor = o.type === 'draft' ? 'text-amber-400' : 'text-cyan-400';
                                const parsedProducts = parseOrderProducts(o.produse);
                                const isVitaOrder = (o.store_name || '').toLowerCase().includes('vita');
                                
                                return (
                                    <div key={i} className="bg-[#13141a] border border-white/10 rounded-xl p-3 flex-1 min-w-[280px]">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
                                                <a 
                                                    href={`https://admin.shopify.com/store/${getShopifyStoreCode(o.store_name)}/${o.type === 'draft' ? 'draft_orders' : 'orders'}/${o.order_id}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-white text-sm font-medium hover:text-cyan-400 hover:underline cursor-pointer"
                                                >
                                                    {o.order_number}
                                                </a>
                                            </div>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusColor}`}>{safeStatus}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-2" title={parsedProducts}>{parsedProducts}</p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span className={`capitalize font-semibold text-[11px] px-2 py-0.5 rounded border ${isVitaOrder ? 'text-blue-300 bg-blue-500/15 border-blue-500/30' : 'text-pink-300 bg-pink-500/15 border-pink-500/30'}`}>
                                                🏪 {o.store_name}
                                            </span>
                                            <span className="flex items-center gap-2">
                                                <span>{new Date(o.created_at).toLocaleDateString('ro-RO')}</span>
                                                {o.value > 0 && <span className="text-indigo-400 font-medium">{o.value} RON</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="bg-white/5 border-t border-white/5 px-4 py-2 text-center">
                            <p className="text-xs text-gray-500 italic">Client fără comenzi anterioare înregistrate</p>
                        </div>
                    )}
                </div>
                );
            })}
        </div>
    );
}
