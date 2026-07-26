import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

export type CallState = 'idle' | 'calling' | 'active' | 'ringing' | 'rejected';

export interface CallerInfo {
    number: string;
    name?: string;
    orderId?: string;
}

interface TelnyxContextType {
    isReady: boolean;
    callState: CallState;
    activeCall: any;
    incomingCall: any;
    incomingCallerInfo: CallerInfo | null;
    makeCall: (destination: string, callerId?: string) => void;
    hangup: () => void;
    answerIncoming: () => void;
    rejectIncoming: () => void;
    toggleMute: () => void;
    isMuted: boolean;
    audioRef: React.RefObject<HTMLAudioElement>;
}

const TelnyxContext = createContext<TelnyxContextType | null>(null);

export const TelnyxProvider = ({ children }: { children: React.ReactNode }) => {
    const [isReady, setIsReady] = useState(false);
    const [callState, setCallState] = useState<CallState>('idle');
    const [activeCall, setActiveCall] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [incomingCallerInfo, setIncomingCallerInfo] = useState<CallerInfo | null>(null);
    const [isMuted, setIsMuted] = useState(false);

    const clientRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
    const ringbackOscRef = useRef<any>(null);
    const audioCtxRef = useRef<any>(null);

    const playRingback = () => {
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            stopRingback();

            const playBeep = () => {
                try {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.type = 'sine';
                    osc.frequency.value = 425;
                    gain.gain.value = 0.4;
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.start();
                    osc.stop(ctx.currentTime + 1);
                } catch (e) {}
            };
            playBeep();
            ringbackOscRef.current = setInterval(playBeep, 3000);
        } catch (e) {
            console.error('[Telnyx] Failed to play ringback:', e);
        }
    };

    const stopRingback = () => {
        if (ringbackOscRef.current) {
            clearInterval(ringbackOscRef.current);
            ringbackOscRef.current = null;
        }
    };

    const playRejectedBeeps = () => {
        try {
            if (!audioCtxRef.current) return;
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();
            
            const scheduleBeep = (time: number) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = 480;
                gain.gain.value = 0.4;
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.start(time);
                osc.stop(time + 0.3);
            };

            const t = ctx.currentTime;
            scheduleBeep(t);
            scheduleBeep(t + 0.5);
            scheduleBeep(t + 1.0);
        } catch (e) {}
    };

    const playIncomingRingtone = () => {
        if (!incomingRingtoneRef.current) {
            const audio = new Audio('/ringtone.mp3'); // Fallback ringtone
            audio.loop = true;
            incomingRingtoneRef.current = audio;
        }
        incomingRingtoneRef.current.play().catch(console.error);
    };

    const stopIncomingRingtone = () => {
        if (incomingRingtoneRef.current) {
            incomingRingtoneRef.current.pause();
            incomingRingtoneRef.current.currentTime = 0;
        }
    };

    const lookupCaller = async (phoneNumber: string) => {
        if (!phoneNumber) return;
        const last7 = phoneNumber.slice(-7);
        try {
            const { data, error } = await supabase
                .from('orders')
                .select('id, name, order_id, phone_number')
                .ilike('phone_number', `%${last7}`)
                .limit(1)
                .single();
            
            if (data && !error) {
                setIncomingCallerInfo({
                    number: phoneNumber,
                    name: data.name,
                    orderId: String(data.order_id || data.id)
                });
            } else {
                setIncomingCallerInfo({ number: phoneNumber });
            }
        } catch (err) {
            console.error('Caller lookup error', err);
            setIncomingCallerInfo({ number: phoneNumber });
        }
    };

    useEffect(() => {
        const username = import.meta.env?.VITE_TELNYX_SIP_USERNAME ?? 'vitadomus';
        const password = import.meta.env?.VITE_TELNYX_SIP_PASSWORD ?? 'vitadomus';
        if (!username || !password) return;

        import('@telnyx/webrtc').then(({ TelnyxRTC }) => {
            const client = new TelnyxRTC({ login: username, password: password });
            
            client.on('telnyx.ready', () => setIsReady(true));
            client.on('telnyx.error', () => setIsReady(false));
            
            client.on('telnyx.notification', (notification: any) => {
                const call = notification.call;
                if (notification.type === 'callUpdate') {
                    
                    if (call.state === 'ringing') {
                        if (call.direction === 'inbound') {
                            setIncomingCall(call);
                            lookupCaller(call.options.remoteCallerNumber);
                            playIncomingRingtone();
                        } else {
                            setCallState('calling');
                            setActiveCall(call);
                            playRingback();
                        }
                    }
                    else if (call.state === 'active') {
                        stopRingback();
                        stopIncomingRingtone();
                        setCallState('active');
                        setActiveCall(call);
                        setIncomingCall(null);
                        
                        if (audioRef.current && call.remoteStream) {
                            audioRef.current.srcObject = call.remoteStream;
                            audioRef.current.play().catch(console.error);
                        }
                    } 
                    else if (call.state === 'destroy' || call.state === 'hangup' || call.state === 'purge') {
                        stopRingback();
                        stopIncomingRingtone();
                        if (audioRef.current) audioRef.current.srcObject = null;
                        
                        setCallState(prev => {
                            if (prev === 'calling') {
                                playRejectedBeeps();
                                setTimeout(() => setCallState('idle'), 3000);
                                return 'rejected';
                            }
                            return 'idle';
                        });
                        
                        setActiveCall(null);
                        setIncomingCall(null);
                        setIncomingCallerInfo(null);
                        setIsMuted(false);
                    }
                }
            });
            
            client.connect();
            clientRef.current = client;
        }).catch(err => {
            console.error('[Telnyx] Init error:', err);
            setIsReady(false);
        });

        return () => {
            if (clientRef.current) {
                clientRef.current.disconnect();
                clientRef.current = null;
            }
        };
    }, []);

    const makeCall = (destination: string, callerId?: string) => {
        if (!clientRef.current) return;
        const call = clientRef.current.newCall({
            destinationNumber: destination,
            callerNumber: callerId || 'Unknown',
            audio: true,
            video: false,
        });
        setActiveCall(call);
        setCallState('calling');
    };

    const hangup = () => {
        if (activeCall) activeCall.hangup();
        if (incomingCall) incomingCall.hangup();
        setCallState('idle');
    };

    const answerIncoming = () => {
        if (incomingCall) {
            stopIncomingRingtone();
            incomingCall.answer();
        }
    };

    const rejectIncoming = () => {
        if (incomingCall) {
            stopIncomingRingtone();
            incomingCall.hangup();
            setIncomingCall(null);
            setIncomingCallerInfo(null);
        }
    };

    const toggleMute = () => {
        if (activeCall) {
            if (isMuted) {
                activeCall.unmuteAudio();
                setIsMuted(false);
            } else {
                activeCall.muteAudio();
                setIsMuted(true);
            }
        }
    };

    return (
        <TelnyxContext.Provider
            value={{
                isReady, callState, activeCall, incomingCall, incomingCallerInfo,
                makeCall, hangup, answerIncoming, rejectIncoming, toggleMute, isMuted,
                audioRef
            }}
        >
            {children}
            <audio ref={audioRef} autoPlay />
        </TelnyxContext.Provider>
    );
};

export const useTelnyx = () => {
    const context = useContext(TelnyxContext);
    if (!context) throw new Error('useTelnyx must be used within a TelnyxProvider');
    return context;
};
