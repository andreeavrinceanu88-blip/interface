import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

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
    lastHangupReason: string | null;
    makeCall: (destination: string, callerId?: string, orderId?: string) => void;
    hangup: () => void;
    answerIncoming: () => void;
    rejectIncoming: () => void;
    toggleMute: () => void;
    isMuted: boolean;
    audioRef: React.RefObject<HTMLAudioElement>;
}

const TelnyxContext = createContext<TelnyxContextType | null>(null);

export const TelnyxProvider = ({ children }: { children: React.ReactNode }) => {
    const { profile } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [callState, setCallState] = useState<CallState>('idle');
    const [activeCall, setActiveCall] = useState<any>(null);
    const [incomingCall, setIncomingCall] = useState<any>(null);
    const [incomingCallerInfo, setIncomingCallerInfo] = useState<CallerInfo | null>(null);
    const [isMuted, setIsMuted] = useState(false);
    const [lastHangupReason, setLastHangupReason] = useState<string | null>(null);

    const clientRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
    const ringbackOscRef = useRef<any>(null);
    const audioCtxRef = useRef<any>(null);
    const profileRef = useRef(profile);
    const activeOrderIdRef = useRef<string | null>(null);
    const callStartTimeRef = useRef<number | null>(null);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

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
                    
                    console.log('[Telnyx] callUpdate state:', call.state, '| direction:', call.direction, '| remoteStream:', !!call.remoteStream);

                    // Helper: try to attach remote audio whenever a stream is available
                    const tryAttachAudio = () => {
                        if (audioRef.current && call.remoteStream) {
                            const tracks = call.remoteStream.getAudioTracks();
                            if (tracks.length > 0 && audioRef.current.srcObject !== call.remoteStream) {
                                console.log('[Telnyx] ▶ Attaching remote audio — tracks:', tracks.length, tracks.map((t: any) => `${t.label} (${t.readyState})`));
                                audioRef.current.srcObject = call.remoteStream;
                                audioRef.current.volume = 1.0;
                                audioRef.current.play().catch(e => console.error('[Telnyx] Audio play error:', e));
                            }
                        }
                    };

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
                        // Try attaching audio early (some calls skip 'active')
                        tryAttachAudio();
                    }
                    else if (call.state === 'active') {
                        stopRingback();
                        stopIncomingRingtone();
                        setCallState('active');
                        setActiveCall(call);
                        setIncomingCall(null);
                        
                        // Set start time for duration tracking
                        if (callStartTimeRef.current === null) {
                            callStartTimeRef.current = Date.now();
                        }
                        
                        // Attach remote audio stream
                        tryAttachAudio();

                        // Fallback: listen for tracks on the peer connection
                        try {
                            const pc = call.peer || call.options?.peer || call.peerConnection;
                            if (pc && pc.ontrack === null) {
                                pc.ontrack = (event: RTCTrackEvent) => {
                                    console.log('[Telnyx] ontrack fired — streams:', event.streams.length);
                                    if (event.streams[0] && audioRef.current) {
                                        audioRef.current.srcObject = event.streams[0];
                                        audioRef.current.volume = 1.0;
                                        audioRef.current.play().catch(e => console.error('[Telnyx] Audio play error:', e));
                                    }
                                };
                            }
                        } catch (e) { /* peer not accessible */ }
                    }
                    else if (call.state === 'answering' || call.state === 'early' || call.state === 'trying') {
                        console.log('[Telnyx] Intermediate state:', call.state);
                        // When 'early' media arrives (carrier announcement), stop our synthetic ringback
                        // so the user can hear the remote audio (e.g. "number invalid" robot)
                        if (call.state === 'early' && call.remoteStream) {
                            stopRingback();
                            // Mark call as active so UI shows it's connected
                            setCallState('active');
                            if (callStartTimeRef.current === null) {
                                callStartTimeRef.current = Date.now();
                            }
                        }
                        tryAttachAudio();
                    } 
                    else if (call.state === 'destroy' || call.state === 'hangup' || call.state === 'purge') {
                        stopRingback();
                        stopIncomingRingtone();
                        if (audioRef.current) audioRef.current.srcObject = null;
                        
                        // Extract SIP hangup reason
                        const sipCode = call.cause || call.sipCode || call.options?.sipCode;
                        const sipReason = call.causeMessage || call.sipReason || call.options?.sipReason;
                        const rawReason = sipReason || sipCode || call.hangupCause || '';
                        
                        console.log('[Telnyx] Call ended — raw:', rawReason, '| sipCode:', sipCode, '| sipReason:', sipReason, '| cause:', call.cause, '| causeMessage:', call.causeMessage, '| hangupCause:', call.hangupCause);
                        
                        // Map common SIP codes/reasons to user-friendly Romanian text
                        const reasonMap: Record<string, string> = {
                            'NORMAL_CLEARING': 'Apel încheiat normal',
                            'USER_BUSY': 'Ocupat',
                            'NO_ANSWER': 'Nu răspunde',
                            'NO_USER_RESPONSE': 'Nu răspunde',
                            'CALL_REJECTED': 'Apel respins',
                            'ORIGINATOR_CANCEL': 'Apel anulat',
                            'NORMAL_UNSPECIFIED': 'Apel încheiat',
                            'RECOVERY_ON_TIMER_EXPIRE': 'Timeout - Nu răspunde',
                            'SUBSCRIBER_ABSENT': 'Telefon închis / indisponibil',
                            'UNALLOCATED_NUMBER': '⚠️ Număr inexistent',
                            'INVALID_NUMBER_FORMAT': '⚠️ Număr invalid',
                            'NUMBER_CHANGED': '⚠️ Număr schimbat',
                            'INVALID_GATEWAY': '⚠️ Număr invalid',
                            'DESTINATION_OUT_OF_ORDER': '⚠️ Număr indisponibil / invalid',
                            'EXCHANGE_ROUTING_ERROR': '⚠️ Număr invalid - eroare rutare',
                            'NO_ROUTE_DESTINATION': '⚠️ Număr inexistent - fără rută',
                            'MANDATORY_IE_MISSING': '⚠️ Număr invalid',
                            'NETWORK_OUT_OF_ORDER': 'Rețea indisponibilă',
                            '486': 'Ocupat',
                            '480': 'Nu răspunde / Indisponibil',
                            '487': 'Apel anulat',
                            '603': 'Apel respins',
                            '404': '⚠️ Număr inexistent',
                            '484': '⚠️ Număr invalid - format incorect',
                            '485': '⚠️ Număr invalid - ambiguu',
                            '502': '⚠️ Număr invalid - gateway',
                            '604': '⚠️ Număr inexistent',
                            '408': 'Timeout - Nu răspunde',
                            '503': 'Serviciu indisponibil',
                            '410': '⚠️ Număr dezactivat',
                        };
                        const friendlyReason = reasonMap[String(rawReason).toUpperCase()] || reasonMap[String(sipCode)] || (rawReason ? String(rawReason) : null);
                        
                        const wasActive = callStartTimeRef.current !== null;
                        const wasAttempted = activeOrderIdRef.current !== null;
                        const duration = wasActive ? Math.round((Date.now() - callStartTimeRef.current!) / 1000) : 0;
                        const callStatus = wasActive ? 'completed' : 'rejected';
                        
                        // Save call log for ALL calls (answered or not)
                        if (activeOrderIdRef.current && profileRef.current?.id) {
                            supabaseAdmin.from('call_logs').insert({
                                operator_id: profileRef.current.id,
                                order_id: activeOrderIdRef.current,
                                duration_secs: duration,
                                status: callStatus
                            }).then(({error}) => {
                                if (error) console.error('[Telnyx] Error saving call log:', error);
                                else console.log(`[Telnyx] Call log saved: status=${callStatus}, duration=${duration}s, reason=${rawReason}`);
                            });
                            
                            // Also mark processed_by on the order (without changing status/order_state)
                            if (!wasActive) {
                                supabaseAdmin.from('orders').update({ processed_by: profileRef.current.id })
                                    .or(`id.eq.${activeOrderIdRef.current},order_id.eq.${activeOrderIdRef.current}`)
                                    .then(({error}) => {
                                        if (error) console.error('[Telnyx] Error updating processed_by:', error);
                                        else console.log('[Telnyx] processed_by set for unanswered call');
                                    });
                            }
                        }

                        // Set hangup reason for UI display — show all reasons except normal endings
                        if (friendlyReason && friendlyReason !== 'Apel încheiat normal' && friendlyReason !== 'Apel încheiat' && friendlyReason !== 'Apel anulat') {
                            setLastHangupReason(friendlyReason);
                        } else {
                            setLastHangupReason(null);
                        }
                        
                        // Reset refs
                        callStartTimeRef.current = null;
                        activeOrderIdRef.current = null;

                        setCallState(prev => {
                            if (prev === 'calling' || prev === 'ringing') {
                                playRejectedBeeps();
                                setTimeout(() => { setCallState('idle'); setLastHangupReason(null); }, 8000);
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

    const makeCall = (destination: string, callerId?: string, orderId?: string) => {
        if (!clientRef.current) return;
        
        // Start synthetic ringback immediately on click to satisfy AudioContext user gesture requirements
        playRingback();
        
        activeOrderIdRef.current = orderId || null;
        callStartTimeRef.current = null; // Reset on new call
        setLastHangupReason(null); // Clear previous reason
        
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
                isReady, callState, activeCall, incomingCall, incomingCallerInfo, lastHangupReason,
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
