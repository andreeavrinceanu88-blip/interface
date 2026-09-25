import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';
import { getSipClient, getInboundClient, getSipProvider, setSipProvider, normalizePhoneForProvider, SipProviderType } from '../lib/sipClient';

export type CallState = 'idle' | 'calling' | 'active' | 'ringing' | 'rejected';

export interface CallerInfo {
    number: string;
    name?: string;
    orderId?: string;
    recentOrders?: { order_number: string; order_id: string; store_name: string; produse: string; status: string; type: string; value: number; created_at: string }[];
}

interface TelnyxContextType {
    isReady: boolean;
    callState: CallState;
    activeCall: any;
    incomingCalls: any[];
    callerInfos: Record<string, CallerInfo>;
    lastHangupReason: string | null;
    makeCall: (destination: string, callerId?: string, orderId?: string) => void;
    hangup: () => void; // hangs up active call only
    answerIncoming: (callId?: string) => void;
    rejectIncoming: (callId?: string) => void;
    markForCallback: () => void;
    toggleMute: () => void;
    isMuted: boolean;
    audioRef: React.RefObject<HTMLAudioElement>;
    ringtoneVolume: number;
    callLogs: string[];
    setRingtoneVolume: (vol: number) => void;
    activeProvider: SipProviderType;
    switchProvider: (provider: SipProviderType) => void;
}

const TelnyxContext = createContext<TelnyxContextType | null>(null);

export const TelnyxProvider = ({ children }: { children: React.ReactNode }) => {
    const { profile } = useAuth();
    const [isReady, setIsReady] = useState(false);
    const [callState, setCallState] = useState<CallState>('idle');
    const [activeCall, setActiveCall] = useState<any>(null);
    const [incomingCalls, setIncomingCalls] = useState<any[]>([]);
    const [callerInfos, setCallerInfos] = useState<Record<string, CallerInfo>>({});
    const [isMuted, setIsMuted] = useState(false);
    const [lastHangupReason, setLastHangupReason] = useState<string | null>(null);
    const [callLogs, setCallLogs] = useState<string[]>([]);
    
    const addLog = (msg: string) => {
        setCallLogs(prev => [...prev.slice(-49), `${new Date().toLocaleTimeString('ro-RO', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}: ${msg}`]);
    };
    const [ringtoneVolume, setRingtoneVolume] = useState(() => {
        const saved = localStorage.getItem('telnyx_ringtone_vol');
        return saved ? parseFloat(saved) : 0.15; // default lower volume
    });

    const [provider, setProvider] = useState<SipProviderType>(() => getSipProvider());

    const switchProvider = (newProvider: SipProviderType) => {
        console.log(`[SIP] Switching provider to: ${newProvider}`);
        setSipProvider(newProvider);
        setProvider(newProvider);
    };

    useEffect(() => {
        const handleProviderChange = (e: any) => {
            if (e.detail && (e.detail === 'didlogic' || e.detail === 'telnyx')) {
                setProvider(e.detail);
            }
        };
        window.addEventListener('sip_provider_changed', handleProviderChange);
        return () => window.removeEventListener('sip_provider_changed', handleProviderChange);
    }, []);

    const clientRef = useRef<any>(null);
    const inboundClientRef = useRef<any>(null);
    const outboundCleanupRef = useRef<(() => void) | null>(null);
    const inboundCleanupRef = useRef<(() => void) | null>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
    const ringbackOscRef = useRef<any>(null);
    const ringbackGainRef = useRef<any>(null);
    const audioCtxRef = useRef<any>(null);
    const profileRef = useRef(profile);
    const activeOrderIdRef = useRef<string | null>(null);
    const callStartTimeRef = useRef<number | null>(null);
    const activeCallRef = useRef<any>(null);
    const incomingCallsRef = useRef<any[]>([]);
    const loggedCallsRef = useRef<Set<string>>(new Set());
    const ringtoneVolumeRef = useRef(ringtoneVolume);
    const callCooldownUntilRef = useRef<number>(0); // Timestamp after which new calls are allowed
    const needsCallbackRef = useRef<boolean>(false);
    // Stable ref so inbound listener always calls the latest handleNotification
    const handleNotificationRef = useRef<((n: any, source: string) => void) | null>(null);

    useEffect(() => {
        profileRef.current = profile;
    }, [profile]);

    // ── Operator Presence Heartbeat (every 30s)
    useEffect(() => {
        if (!profile?.id) return;
        
        const sendHeartbeat = () => {
            supabaseAdmin.from('operator_presence').upsert({
                operator_id: profile.id,
                last_seen: new Date().toISOString()
            }, { onConflict: 'operator_id' }).then(({ error }) => {
                if (error) console.error('[Presence] Heartbeat error:', error);
            });
        };

        // Send immediately on mount
        sendHeartbeat();
        
        // Then every 30 seconds
        const interval = setInterval(sendHeartbeat, 30000);

        return () => {
            clearInterval(interval);
            // On unmount (tab close/logout), delete presence
            supabaseAdmin.from('operator_presence')
                .delete()
                .eq('operator_id', profile.id)
                .then(() => {});
        };
    }, [profile?.id]);

    useEffect(() => {
        localStorage.setItem('telnyx_ringtone_vol', ringtoneVolume.toString());
        ringtoneVolumeRef.current = ringtoneVolume;
    }, [ringtoneVolume]);

    const playRingback = () => {
        try {
            stopRingback();
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            if (ctx.state === 'suspended') ctx.resume();

            const playBeep = () => {
                try {
                    // Do not beep if ringback was stopped
                    if (!ringbackOscRef.current) return;
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    ringbackGainRef.current = gain;
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
        if (ringbackGainRef.current) {
            try {
                ringbackGainRef.current.gain.setValueAtTime(0, audioCtxRef.current?.currentTime || 0);
            } catch (e) {}
            ringbackGainRef.current = null;
        }
    };

    // Safety net: ensure ringback is ALWAYS killed whenever not actively calling
    useEffect(() => {
        if (callState !== 'calling') {
            stopRingback();
        }
    }, [callState]);

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

    const ringtoneCtxRef = useRef<any>(null);
    const ringtoneIntervalRef = useRef<any>(null);

    const playIncomingRingtone = () => {
        if (ringtoneIntervalRef.current) return; // Already playing

        // Nokia Grande Valse — the iconic 2000s ringtone
        // Notes: [frequency, duration in seconds]
        const melody: [number, number][] = [
            [659.25, 0.125], // E5
            [587.33, 0.125], // D5
            [369.99, 0.250], // F#4
            [415.30, 0.250], // G#4
            [554.37, 0.125], // C#5
            [493.88, 0.125], // B4
            [293.66, 0.250], // D4
            [329.63, 0.250], // E4
            [493.88, 0.125], // B4
            [440.00, 0.125], // A4
            [277.18, 0.250], // C#4
            [329.63, 0.250], // E4
            [440.00, 0.500], // A4
        ];

        const totalDuration = melody.reduce((sum, [, d]) => sum + d, 0);

        const playOnce = () => {
            try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                ringtoneCtxRef.current = ctx;
                
                const gainNode = ctx.createGain();
                gainNode.gain.value = ringtoneVolumeRef.current;
                gainNode.connect(ctx.destination);

                let time = ctx.currentTime + 0.05;
                melody.forEach(([freq, dur]) => {
                    const osc = ctx.createOscillator();
                    osc.type = 'square';
                    osc.frequency.value = freq;

                    // Envelope for cleaner sound
                    const noteGain = ctx.createGain();
                    noteGain.gain.setValueAtTime(0, time);
                    noteGain.gain.linearRampToValueAtTime(1, time + 0.01);
                    noteGain.gain.setValueAtTime(1, time + dur - 0.02);
                    noteGain.gain.linearRampToValueAtTime(0, time + dur);

                    osc.connect(noteGain);
                    noteGain.connect(gainNode);
                    osc.start(time);
                    osc.stop(time + dur);
                    time += dur;
                });
            } catch (e) {
                console.error('[Telnyx] Ringtone error:', e);
            }
        };

        playOnce();
        // Repeat every (melody duration + 1.5s pause)
        ringtoneIntervalRef.current = setInterval(playOnce, (totalDuration + 1.5) * 1000);
    };

    const stopIncomingRingtone = () => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
        if (ringtoneCtxRef.current) {
            try { ringtoneCtxRef.current.close(); } catch (e) {}
            ringtoneCtxRef.current = null;
        }
    };

    const lookupCaller = async (phoneNumber: string, callId: string) => {
        if (!phoneNumber) return;
        const cleanDigits = phoneNumber.replace(/\D/g, '');
        const last7 = cleanDigits.slice(-7);
        if (!last7) {
            setCallerInfos(prev => ({ ...prev, [callId]: { number: phoneNumber } }));
            return;
        }
        try {
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('id, name, client_personal_id, order_id, phone_number, store_name, produse, status, type, value, created_at')
                .ilike('phone_number', `%${last7}`)
                .order('created_at', { ascending: false })
                .limit(2);
            
            if (data && data.length > 0 && !error) {
                addLog(`🔍 Client identificat: ${data[0].name} (${data.length} comenzi în sistem)`);
                setCallerInfos(prev => ({
                    ...prev,
                    [callId]: {
                        number: phoneNumber,
                        name: data[0].name,
                        orderId: String(data[0].order_id || data[0].id),
                        recentOrders: data.map(o => ({
                            order_number: o.client_personal_id || `#${o.id || o.order_id}`,
                            order_id: o.order_id,
                            store_name: o.store_name,
                            produse: o.produse,
                            status: o.status,
                            type: o.type,
                            value: o.value,
                            created_at: o.created_at,
                        })),
                    }
                }));
            } else {
                addLog(`🔍 Număr necunoscut (fără comenzi în sistem)`);
                setCallerInfos(prev => ({ ...prev, [callId]: { number: phoneNumber } }));
            }
        } catch (err) {
            console.error('Caller lookup error', err);
            setCallerInfos(prev => ({ ...prev, [callId]: { number: phoneNumber } }));
        }
    };

    const tryAttachAudio = (targetCall?: any) => {
        const c = targetCall || activeCallRef.current;
        if (!c || !audioRef.current) return;

        const stream = c.remoteStream 
            || c.options?.remoteStream 
            || (c.voiceCall?.session?.connection?.getRemoteStreams?.()?.[0]);

        if (stream) {
            const tracks = stream.getAudioTracks ? stream.getAudioTracks() : [];
            if (tracks.length > 0 && audioRef.current.srcObject !== stream) {
                console.log('[SIP] ▶ Attaching remote audio — tracks:', tracks.length, tracks.map((t: any) => `${t.label} (${t.readyState})`));
                addLog(`🔊 Canal audio conectat (${tracks.length} track audio)`);
                audioRef.current.srcObject = stream;
                audioRef.current.volume = 1.0;
                audioRef.current.play().catch(e => console.error('[SIP] Audio play error:', e));
            }
        }
    };


    const handleNotification = (notification: any, source: string) => {
        if (notification.type === 'callUpdate' && notification.call) {
            const call = notification.call;
            const eventMsg = `[${source}] Stare: ${call.state} | Dir: ${call.direction || 'N/A'}`;
            addLog(eventMsg);
            console.log(`[SIP][${source}] callUpdate state:`, call.state, '| direction:', call.direction, '| remoteStream:', !!call.remoteStream, '| callerNumber:', call.options?.callerNumber, '| remoteCallerNumber:', call.options?.remoteCallerNumber, '| destinationNumber:', call.options?.destinationNumber);

            const getCallId = (c: any) => c?.id || c?.options?.callSessionId || c?.callSessionId || 'unknown_call';
            const callId = getCallId(call);

            const getCallerNumber = (c: any) => {
                const raw = c?.options?.remoteCallerNumber || 
                            c?.options?.callerNumber || 
                            c?.remoteCallerNumber || 
                            c?.callerNumber || 
                            c?.options?.callerName || 
                            '';
                return String(raw).replace(/^sip:/i, '').split('@')[0];
            };

            const getDestinationNumber = (c: any) => {
                const raw = c?.options?.destinationNumber || 
                            c?.options?.calleeNumber || 
                            c?.destinationNumber || 
                            '';
                return String(raw).replace(/^sip:/i, '').split('@')[0];
            };

            const callerNumber = getCallerNumber(call);
            const destinationNumber = getDestinationNumber(call);

            if (!call.options) call.options = {};
            if (!call.options.remoteCallerNumber && callerNumber) {
                call.options.remoteCallerNumber = callerNumber;
            }

            if (call.state === 'ringing') {
                if (call.direction !== 'outbound') {
                    // Inbound call
                    console.log(`[SIP][${source}] 📞 Inbound call detected from:`, callerNumber, '| Call ID:', callId);
                    call._sourceProvider = source;

                    setIncomingCalls(prev => {
                        if (prev.find(c => getCallId(c) === callId)) return prev;
                        const next = [...prev, call];
                        incomingCallsRef.current = next;
                        return next;
                    });

                    needsCallbackRef.current = false;
                    lookupCaller(callerNumber, callId);

                    setCallState(prev => {
                        if (prev !== 'active') {
                            playIncomingRingtone();
                        } else {
                            console.log(`[SIP][${source}] Suppressing ringtone — already in active call`);
                        }
                        return prev;
                    });
                } else {
                    setCallState('calling');
                    setActiveCall(call);
                    activeCallRef.current = call;
                    playRingback();
                }
                tryAttachAudio(call);
            }
            else if (call.state === 'active') {
                stopRingback();
                stopIncomingRingtone();
                setCallState('active');
                setActiveCall(call);
                activeCallRef.current = call;

                setIncomingCalls(prev => {
                    const next = prev.filter(c => getCallId(c) !== callId);
                    incomingCallsRef.current = next;
                    return next;
                });

                if (callStartTimeRef.current === null) {
                    callStartTimeRef.current = Date.now();
                }

                tryAttachAudio(call);

                try {
                    const pc = call.peer?.instance || call.peer || call.options?.peer || call.peerConnection;
                    if (pc && typeof pc.addEventListener === 'function') {
                        const onTrack = (event: RTCTrackEvent) => {
                            console.log(`[SIP][${source}] ontrack fired — streams:`, event.streams.length);
                            if (event.streams[0] && audioRef.current) {
                                audioRef.current.srcObject = event.streams[0];
                                audioRef.current.volume = 1.0;
                                audioRef.current.play().catch(e => console.error('[SIP] Audio play error:', e));
                            }
                        };
                        pc.addEventListener('track', onTrack);
                    }
                } catch (e) {}
            }
            else if (call.state === 'answering' || call.state === 'early' || call.state === 'trying') {
                console.log(`[SIP][${source}] Intermediate state:`, call.state);
                if (call.state === 'early' && call.remoteStream) {
                    stopRingback();
                }
                tryAttachAudio(call);
            }
            else if (call.state === 'destroy' || call.state === 'hangup' || call.state === 'purge') {
                const isEndingIncoming = incomingCallsRef.current.some(c => getCallId(c) === callId);

                setIncomingCalls(prev => {
                    const remaining = prev.filter(c => getCallId(c) !== callId);
                    incomingCallsRef.current = remaining;
                    if (remaining.length === 0) {
                        stopIncomingRingtone();
                    }
                    return remaining;
                });

                const isEndingActive = activeCallRef.current && (
                    (callId && callId === getCallId(activeCallRef.current)) || call === activeCallRef.current
                );

                stopRingback();

                const sipCode = call.cause || call.sipCode || call.options?.sipCode;
                const sipReason = call.causeMessage || call.sipReason || call.options?.sipReason;
                const rawReason = sipReason || sipCode || call.hangupCause || '';

                console.log(`[SIP][${source}] Call ended — raw:`, rawReason, '| sipCode:', sipCode, '| isEndingIncoming:', isEndingIncoming, '| isEndingActive:', isEndingActive);

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
                const duration = wasActive ? Math.round((Date.now() - callStartTimeRef.current!) / 1000) : 0;
                const callStatus = wasActive ? 'completed' : 'rejected';
                const finalStatus = call.direction === 'inbound' && !wasActive ? 'missed' : callStatus;

                const logOrderId = call.direction === 'inbound'
                    ? `INBOUND:${callerNumber || 'necunoscut'}`
                    : activeOrderIdRef.current;
                const opId = profileRef.current?.id || null;

                const isErrorCall = callStatus === 'rejected' && rawReason && rawReason !== 'ORIGINATOR_CANCEL' && rawReason !== 'NORMAL_CLEARING';
                const fallbackOrderId = isErrorCall 
                    ? `ERR:${destinationNumber || callerNumber || 'unknown'}`
                    : null;
                const manualDialOrderId = !logOrderId && call.direction !== 'inbound'
                    ? `OUTBOUND:${destinationNumber || 'unknown'}`
                    : null;
                const effectiveOrderId = logOrderId || fallbackOrderId || manualDialOrderId;

                if (opId && callId && effectiveOrderId && !loggedCallsRef.current.has(callId)) {
                    loggedCallsRef.current.add(callId);

                    const logPayload: any = {
                        operator_id: opId,
                        order_id: effectiveOrderId,
                        duration_secs: duration,
                        status: finalStatus,
                        error_code: rawReason || null,
                        error_message: friendlyReason || null,
                        destination_number: destinationNumber || callerNumber || null,
                        caller_id: call.options?.callerNumber || null,
                        call_direction: call.direction || (isEndingIncoming ? 'inbound' : 'outbound'),
                        needs_callback: needsCallbackRef.current,
                        raw_sip_data: {
                            sipCode,
                            sipReason,
                            cause: call.cause,
                            causeMessage: call.causeMessage,
                            hangupCause: call.hangupCause,
                            callState: call.state,
                            callSessionId: callId,
                            provider: source,
                            timestamp: new Date().toISOString()
                        }
                    };

                    supabaseAdmin.from('call_logs').insert(logPayload).then(({error}) => {
                        if (error) {
                            console.warn('[SIP] Full log failed, retrying basic fields...', error);
                            supabaseAdmin.from('call_logs').insert({
                                operator_id: opId,
                                order_id: effectiveOrderId,
                                duration_secs: duration,
                                status: finalStatus,
                                needs_callback: needsCallbackRef.current
                            }).then(({error: e2}) => {
                                if (e2) console.error('[SIP] Error saving basic call log:', e2);
                                else console.log('[SIP] ✅ Basic call log saved');
                            });
                        } else {
                            console.log(`[SIP] ✅ Call log saved: status=${finalStatus}, duration=${duration}s, source=${source}`);
                        }
                    });

                    if (!wasActive && activeOrderIdRef.current) {
                        supabaseAdmin.from('orders').update({ processed_by: opId })
                            .or(`id.eq.${activeOrderIdRef.current},order_id.eq.${activeOrderIdRef.current}`)
                            .then(({error}) => {
                                if (error) console.error('[SIP] Error updating processed_by:', error);
                            });
                    }
                }

                if (isEndingIncoming && !isEndingActive && activeCallRef.current) {
                    console.log(`[SIP][${source}] Secondary incoming call ended — keeping active call alive`);
                } else {
                    if (audioRef.current) audioRef.current.srcObject = null;

                    let finalReason = friendlyReason;
                    if (finalReason !== 'Apel încheiat normal' && finalReason !== 'Apel încheiat' && finalReason !== 'Apel anulat') {
                        if (sipCode) finalReason = `${finalReason || 'Eroare'} (SIP ${sipCode})`;
                        else if (rawReason) finalReason = `${finalReason || 'Eroare'} (${rawReason})`;
                        setLastHangupReason(finalReason || 'Apel respins / Nu a răspuns');
                        addLog(`Eroare: ${finalReason}`);
                    } else {
                        setLastHangupReason(null);
                        addLog('Apel încheiat.');
                    }

                    callStartTimeRef.current = null;
                    activeOrderIdRef.current = null;

                    setCallState(prev => {
                        if (prev === 'calling' || prev === 'ringing') {
                            playRejectedBeeps();
                            setTimeout(() => { setCallState('idle'); setLastHangupReason(null); }, 8000);
                            return 'rejected';
                        }
                        if (prev === 'rejected') return 'rejected';
                        return 'idle';
                    });

                    callCooldownUntilRef.current = Date.now() + 3000;
                    setActiveCall(null);
                    if (call.state === 'destroy' || call.state === 'purge') {
                        activeCallRef.current = null;
                    }
                    setIsMuted(false);
                }
            }
        }
    };

    // Always keep the ref pointing to the latest handleNotification
    handleNotificationRef.current = handleNotification;

    // Clean up inbound listeners on unmount
    useEffect(() => {
        return () => {
            if (inboundCleanupRef.current) {
                inboundCleanupRef.current();
                inboundCleanupRef.current = null;
            }
        };
    }, []);

    // Main SIP Provider Lifecycle Effect
    useEffect(() => {
        let cancelled = false;
        setIsReady(false);

        // Clean up previous outbound client listeners
        if (outboundCleanupRef.current) {
            outboundCleanupRef.current();
            outboundCleanupRef.current = null;
        }

        // 1. Inbound Telnyx Client only runs if Telnyx is the explicitly selected provider
        const initInbound = async () => {
            if (provider !== 'telnyx') return;
            try {
                const telnyx = await getInboundClient();
                if (cancelled) return;
                inboundClientRef.current = telnyx;

                if (!inboundCleanupRef.current) {
                    const onInboundReady = () => console.log('[SIP] Inbound Telnyx WebRTC ready');
                    const onInboundError = (e: any) => console.warn('[SIP] Inbound Telnyx WebRTC error:', e);
                    const onInboundNotification = (n: any) => {
                        console.log('[SIP][TELNYX NOTIFICATION]', n?.type, n?.call?.state);
                        try {
                            handleNotificationRef.current?.(n, 'telnyx');
                        } catch (err) {
                            console.error('[SIP][TELNYX] Notification handler error:', err);
                        }
                    };

                    telnyx.on('telnyx.ready', onInboundReady);
                    telnyx.on('telnyx.error', onInboundError);
                    telnyx.on('telnyx.notification', onInboundNotification);

                    inboundCleanupRef.current = () => {
                        telnyx.off('telnyx.ready', onInboundReady);
                        telnyx.off('telnyx.error', onInboundError);
                        telnyx.off('telnyx.notification', onInboundNotification);
                    };
                }
            } catch (err) {
                console.error('[SIP] Failed to initialize inbound Telnyx client:', err);
            }
        };

        if (provider === 'telnyx') {
            initInbound();
        }

        // 2. Initialize active provider client (DIDLogic handles both inbound and outbound)
        const initOutbound = async () => {
            try {
                const client = await getSipClient(provider);
                if (cancelled) return;
                clientRef.current = client;

                if (client.connected) setIsReady(true);

                const onReady = () => setIsReady(true);
                const onError = () => setIsReady(false);

                const _provider = provider;
                const onLog = (msg: string) => {
                    addLog(msg);
                };
                client.on('telnyx.log', onLog);

                const onNotification = (n: any) => {
                    console.log(`[SIP][${_provider} NOTIFICATION]`, n?.type, n?.call?.state, n?.call?.id);
                    try {
                        handleNotificationRef.current?.(n, _provider);
                    } catch (err) {
                        console.error(`[SIP][${_provider}] Notification handler error:`, err);
                    }
                };
                client.on('telnyx.notification', onNotification);

                client.on('telnyx.ready', onReady);
                client.on('telnyx.error', onError);

                outboundCleanupRef.current = () => {
                    client.off('telnyx.ready', onReady);
                    client.off('telnyx.error', onError);
                    client.off('telnyx.log', onLog);
                    if (onNotification) {
                        client.off('telnyx.notification', onNotification);
                    }
                };
            } catch (err) {
                console.error(`[SIP] (${provider}) Outbound init error:`, err);
                if (!cancelled) setIsReady(false);
            }
        };

        initOutbound();

        return () => {
            cancelled = true;
            if (outboundCleanupRef.current) {
                outboundCleanupRef.current();
                outboundCleanupRef.current = null;
            }
        };
    }, [provider]);

    const makeCall = (destination: string, callerId?: string, orderId?: string) => {
        if (!clientRef.current) return;
        if (activeCallRef.current) {
            console.warn('[Telnyx] makeCall blocked — call already in progress (activeCallRef set)');
            return;
        }
        
        // Cooldown: prevent re-calling within 3 seconds of a previous call ending
        const now = Date.now();
        if (now < callCooldownUntilRef.current) {
            const remaining = Math.ceil((callCooldownUntilRef.current - now) / 1000);
            console.warn(`[Telnyx] makeCall blocked — cooldown active, ${remaining}s remaining`);
            return;
        }

        const finalDest = normalizePhoneForProvider(destination, provider);

        // Start synthetic ringback immediately on click to satisfy AudioContext user gesture requirements
        playRingback();
        
        activeOrderIdRef.current = orderId || null;
        callStartTimeRef.current = null; // Reset on new call
        setLastHangupReason(null); // Clear previous reason
        setCallLogs([]); // Clear previous logs
        needsCallbackRef.current = false; // Reset callback flag
        addLog(`Inițiat apel către ${finalDest}`);
        let finalCallerId = callerId;
        if (finalCallerId && !finalCallerId.startsWith('+')) {
            finalCallerId = '+' + finalCallerId;
        }
        if (!finalCallerId) {
            finalCallerId = provider === 'didlogic'
                ? (import.meta.env?.VITE_DIDLOGIC_CALLER_ID || '+40373785200')
                : (import.meta.env?.VITE_TELNYX_CALLER_ID || '+40363060018');
        }

        const call = clientRef.current.newCall({
            destinationNumber: finalDest,
            callerNumber: finalCallerId,
            audio: true,
            video: false,
        });
        setActiveCall(call);
        activeCallRef.current = call;
        setCallState('calling');
    };

    const hangup = () => {
        stopRingback();
        if (activeCallRef.current) {
            try { activeCallRef.current.hangup(); } catch (e) {}
        } else if (activeCall) {
            try { activeCall.hangup(); } catch (e) {}
        }
        if (clientRef.current) {
            try {
                clientRef.current.activeCall = null;
                if (clientRef.current.device) clientRef.current.device.currentCall = null;
            } catch (e) {}
        }
        // Do not hangup ringing calls automatically to avoid dropping queued calls!
        setCallState('idle');
    };

    const answerIncoming = (callId?: string) => {
        setIncomingCalls(prev => {
            const call = callId 
                ? prev.find(c => (c.id || c.options?.callSessionId) === callId) 
                : prev[0];
            if (call) {
                const callerNum = call.options?.remoteCallerNumber || call.options?.callerNumber || 'Client';
                addLog(`📞 Răspund la apelul de la ${callerNum}...`);
                stopIncomingRingtone();
                try {
                    console.log('[SIP] Answering call:', call.id || call.options?.callSessionId);
                    call.answer();
                } catch (e) {
                    console.error('[SIP] Answer error:', e);
                }
            }
            return prev;
        });
    };

    const rejectIncoming = (callId?: string) => {
        setIncomingCalls(prev => {
            const call = callId 
                ? prev.find(c => (c.id || c.options?.callSessionId) === callId) 
                : prev[0];
            if (call) {
                const callerNum = call.options?.remoteCallerNumber || call.options?.callerNumber || 'Client';
                addLog(`❌ Apel respins de la ${callerNum}`);
                try {
                    if (typeof call.reject === 'function') {
                        call.reject();
                    } else {
                        call.hangup();
                    }
                } catch (e) {
                    console.error('[SIP] Reject error:', e);
                }
            }
            return prev.filter(c => (c.id || c.options?.callSessionId) !== callId);
        });
        stopIncomingRingtone();
    };

    const markForCallback = () => {
        needsCallbackRef.current = true;
        addLog('Marcat pentru "De sunat"');
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
                isReady, callState, activeCall, incomingCalls, callerInfos, lastHangupReason,
                makeCall, hangup, answerIncoming, rejectIncoming, markForCallback, toggleMute, isMuted,
                audioRef, ringtoneVolume, setRingtoneVolume,
                activeProvider: provider, switchProvider
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
