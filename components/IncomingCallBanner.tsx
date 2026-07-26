import React from 'react';
import { useTelnyx } from '../contexts/TelnyxContext';

export default function IncomingCallBanner() {
    const { incomingCall, incomingCallerInfo, answerIncoming, rejectIncoming, callState, hangup, activeCall, toggleMute, isMuted } = useTelnyx();

    if (!incomingCall && callState !== 'active') return null;
    
    // Once the call is active, it's no longer incoming, it's an active call. 
    // We only want to show the incoming call banner when someone is calling us.
    // If the call is active and was inbound, we might want a global active call banner, 
    // but the dialer in Drafturi handles active calls. Let's provide a basic active call banner globally as well.

    if (incomingCall) {
        return (
            <div className="fixed top-0 left-0 right-0 z-[9999] p-4 flex justify-center animate-slideDown">
                <div className="bg-[#13141a] border border-cyan-500/30 shadow-[0_0_20px_rgba(0,210,255,0.2)] rounded-2xl p-4 flex items-center gap-6 max-w-2xl w-full">
                    <div className="bg-cyan-500/10 p-3 rounded-xl animate-pulse">
                        <span className="material-icons-round text-cyan-400 text-3xl">ring_volume</span>
                    </div>
                    
                    <div className="flex-1">
                        <p className="text-sm text-cyan-400 font-medium uppercase tracking-wider mb-1">Apel Primit</p>
                        <p className="text-xl text-white font-light">
                            {incomingCallerInfo?.number || 'Număr Necunoscut'}
                        </p>
                        {incomingCallerInfo?.name && (
                            <p className="text-sm text-gray-400 mt-1">
                                {incomingCallerInfo.name} 
                                {incomingCallerInfo.orderId ? ` (Comanda #${incomingCallerInfo.orderId})` : ''}
                            </p>
                        )}
                    </div>

                    <div className="flex items-center gap-3">
                        <button 
                            onClick={rejectIncoming}
                            className="bg-red-500/10 hover:bg-red-500/20 text-red-500 px-6 py-2.5 rounded-xl font-medium transition-colors flex items-center gap-2"
                        >
                            <span className="material-icons-round">call_end</span>
                            Refuză
                        </button>
                        <button 
                            onClick={answerIncoming}
                            className="bg-emerald-500 hover:bg-emerald-600 text-white px-6 py-2.5 rounded-xl font-medium shadow-[0_0_15px_rgba(16,185,129,0.4)] transition-all flex items-center gap-2"
                        >
                            <span className="material-icons-round">call</span>
                            Răspunde
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // Optional: Show active call globally if it was an inbound call
    if (callState === 'active' && activeCall && activeCall.direction === 'inbound') {
         return (
            <div className="fixed top-0 left-0 right-0 z-[9999] p-4 flex justify-center animate-slideDown">
                <div className="bg-[#13141a] border border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.2)] rounded-2xl p-4 flex items-center gap-6 max-w-2xl w-full">
                    <div className="bg-emerald-500/10 p-3 rounded-xl">
                        <span className="material-icons-round text-emerald-400 text-3xl animate-pulse">phone_in_talk</span>
                    </div>
                    
                    <div className="flex-1">
                        <p className="text-sm text-emerald-400 font-medium uppercase tracking-wider mb-1">Apel Activ (Inbound)</p>
                        <p className="text-xl text-white font-light">
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
            </div>
        );
    }

    return null;
}
