import React from 'react';
import { useTelnyx } from '../contexts/TelnyxContext';

export default function IncomingCallBanner() {
    const { incomingCall, incomingCallerInfo, answerIncoming, rejectIncoming, callState, hangup, activeCall, toggleMute, isMuted } = useTelnyx();

    const showActiveInbound = callState === 'active' && activeCall && activeCall.direction === 'inbound';
    const showIncoming = !!incomingCall;

    if (!showActiveInbound && !showIncoming) return null;

    return (
        <div className="fixed top-0 left-0 right-0 z-[9999] p-4 flex flex-col items-center gap-3 animate-slideDown">
            {/* Active inbound call widget (always on top) */}
            {showActiveInbound && (
                <div className="bg-[#13141a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-2xl flex flex-col w-full max-w-3xl overflow-hidden">
                    <div className="p-4 flex items-center gap-6">
                        <div className="bg-emerald-500/10 p-3 rounded-xl">
                            <span className="material-icons-round text-emerald-400 text-3xl animate-pulse">phone_in_talk</span>
                        </div>
                        
                        <div className="flex-1">
                            <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider mb-1">Apel Activ (Inbound)</p>
                            <p className="text-xl text-white font-light truncate">
                                {incomingCallerInfo?.name || activeCall.options.remoteCallerNumber}
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
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
                    {(incomingCallerInfo?.recentOrders && incomingCallerInfo.recentOrders.length > 0) ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 flex gap-3 overflow-x-auto scrollbar-hide">
                            {incomingCallerInfo.recentOrders.map((o, i) => {
                                const safeStatus = o.status || 'NOU';
                                const statusColor = safeStatus === 'confirmat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : safeStatus === 'anulat' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                    : safeStatus === 'ON' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                    : safeStatus === 'NOU' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    : 'text-gray-400 bg-white/5 border-white/10';
                                const typeLabel = o.type === 'draft' ? 'Draft' : 'Comandă';
                                const typeColor = o.type === 'draft' ? 'text-amber-400' : 'text-cyan-400';
                                
                                let parsedProducts = o.produse || 'Fără produse';
                                try {
                                    if (parsedProducts.startsWith('[')) {
                                        const arr = JSON.parse(parsedProducts);
                                        parsedProducts = arr.map((item: any) => item.name || item.title || 'Produs').join(', ');
                                    }
                                } catch(e) {}
                                
                                return (
                                    <div key={i} className="bg-[#13141a] border border-white/10 rounded-xl p-3 flex-1 min-w-[280px]">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
                                                <span className="text-white text-sm font-medium">{o.order_number}</span>
                                            </div>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusColor}`}>{safeStatus}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-2" title={parsedProducts}>{parsedProducts}</p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span className="capitalize">{o.store_name}</span>
                                            <span className="flex items-center gap-2">
                                                <span>{new Date(o.created_at).toLocaleDateString('ro-RO')}</span>
                                                {o.value > 0 && <span className="text-indigo-400 font-medium">{o.value} RON</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : incomingCallerInfo && !incomingCallerInfo.recentOrders ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 text-center">
                            <p className="text-xs text-gray-500 italic">Client necunoscut — fără comenzi în sistem</p>
                        </div>
                    ) : null}
                </div>
            )}

            {/* Incoming call banner (below active call if both exist) */}
            {showIncoming && (
                <div className="bg-[#13141a] border border-cyan-500/30 shadow-[0_0_20px_rgba(0,210,255,0.2)] rounded-2xl flex flex-col w-full max-w-3xl overflow-hidden">
                    {/* Top Row: Caller Info & Buttons */}
                    <div className="p-4 flex items-center gap-5">
                        <div className="bg-cyan-500/10 p-3 rounded-xl animate-pulse shrink-0">
                            <span className="material-icons-round text-cyan-400 text-3xl">ring_volume</span>
                        </div>
                        
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-cyan-400 font-bold uppercase tracking-wider mb-0.5">Apel Primit</p>
                            <p className="text-xl text-white font-medium truncate">
                                {incomingCallerInfo?.number || 'Număr Necunoscut'}
                            </p>
                            {incomingCallerInfo?.name && (
                                <p className="text-sm text-gray-400 mt-0.5 truncate">
                                    {incomingCallerInfo.name}
                                </p>
                            )}
                        </div>

                        <div className="flex items-center gap-3 shrink-0">
                            <button 
                                onClick={rejectIncoming}
                                className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-5 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                <span className="material-icons-round">call_end</span>
                                Refuză
                            </button>
                            <button 
                                onClick={answerIncoming}
                                className="bg-emerald-500 hover:bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-medium shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
                            >
                                <span className="material-icons-round">call</span>
                                Răspunde
                            </button>
                        </div>
                    </div>

                    {/* Bottom Row: Recent Orders */}
                    {(incomingCallerInfo?.recentOrders && incomingCallerInfo.recentOrders.length > 0) ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 flex gap-3 overflow-x-auto scrollbar-hide">
                            {incomingCallerInfo.recentOrders.map((o, i) => {
                                const safeStatus = o.status || 'NOU';
                                const statusColor = safeStatus === 'confirmat' ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                                    : safeStatus === 'anulat' ? 'text-red-400 bg-red-500/10 border-red-500/20'
                                    : safeStatus === 'ON' ? 'text-pink-400 bg-pink-500/10 border-pink-500/20'
                                    : safeStatus === 'NOU' ? 'text-blue-400 bg-blue-500/10 border-blue-500/20'
                                    : 'text-gray-400 bg-white/5 border-white/10';
                                const typeLabel = o.type === 'draft' ? 'Draft' : 'Comandă';
                                const typeColor = o.type === 'draft' ? 'text-amber-400' : 'text-cyan-400';
                                
                                // Parse JSON products
                                let parsedProducts = o.produse || 'Fără produse';
                                try {
                                    if (parsedProducts.startsWith('[')) {
                                        const arr = JSON.parse(parsedProducts);
                                        parsedProducts = arr.map((item: any) => item.name || item.title || 'Produs').join(', ');
                                    }
                                } catch(e) {}
                                
                                return (
                                    <div key={i} className="bg-[#13141a] border border-white/10 rounded-xl p-3 flex-1 min-w-[280px]">
                                        <div className="flex justify-between items-center mb-1.5">
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] font-bold ${typeColor}`}>{typeLabel}</span>
                                                <span className="text-white text-sm font-medium">{o.order_number}</span>
                                            </div>
                                            <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded border uppercase ${statusColor}`}>{safeStatus}</span>
                                        </div>
                                        <p className="text-xs text-gray-400 truncate mb-2" title={parsedProducts}>{parsedProducts}</p>
                                        <div className="flex justify-between items-center text-xs text-gray-500">
                                            <span className="capitalize">{o.store_name}</span>
                                            <span className="flex items-center gap-2">
                                                <span>{new Date(o.created_at).toLocaleDateString('ro-RO')}</span>
                                                {o.value > 0 && <span className="text-indigo-400 font-medium">{o.value} RON</span>}
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : incomingCallerInfo && !incomingCallerInfo.recentOrders ? (
                        <div className="bg-white/5 border-t border-white/5 p-3 text-center">
                            <p className="text-xs text-gray-500 italic">Client necunoscut — fără comenzi în sistem</p>
                        </div>
                    ) : null}
                </div>
            )}
        </div>
    );
}
