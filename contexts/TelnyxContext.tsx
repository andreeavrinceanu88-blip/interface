import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { supabase, supabaseAdmin } from '../lib/supabaseClient';
import { useAuth } from './AuthContext';

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
    ringtoneVolume: number;
    callLogs: string[];
    setRingtoneVolume: (vol: number) => void;
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
    const [callLogs, setCallLogs] = useState<string[]>([]);
    
    const addLog = (msg: string) => {
        setCallLogs(prev => [...prev.slice(-49), `${new Date().toLocaleTimeString('ro-RO', {hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit'})}: ${msg}`]);
    };
    const [ringtoneVolume, setRingtoneVolume] = useState(() => {
        const saved = localStorage.getItem('telnyx_ringtone_vol');
        return saved ? parseFloat(saved) : 0.15; // default lower volume
    });

    const clientRef = useRef<any>(null);
    const audioRef = useRef<HTMLAudioElement>(null);
    const incomingRingtoneRef = useRef<HTMLAudioElement | null>(null);
    const ringbackOscRef = useRef<any>(null);
    const audioCtxRef = useRef<any>(null);
    const profileRef = useRef(profile);
    const activeOrderIdRef = useRef<string | null>(null);
    const callStartTimeRef = useRef<number | null>(null);
    const activeCallRef = useRef<any>(null);
    const incomingCallRef = useRef<any>(null);
    const loggedCallsRef = useRef<Set<string>>(new Set());
    const ringtoneVolumeRef = useRef(ringtoneVolume);
    const callCooldownUntilRef = useRef<number>(0); // Timestamp after which new calls are allowed

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

    const lookupCaller = async (phoneNumber: string) => {
        if (!phoneNumber) return;
        const last7 = phoneNumber.slice(-7);
        try {
            const { data, error } = await supabaseAdmin
                .from('orders')
                .select('id, name, client_personal_id, order_id, phone_number, store_name, produse, status, type, value, created_at')
                .ilike('phone_number', `%${last7}`)
                .order('created_at', { ascending: false })
                .limit(2);
            
            if (data && data.length > 0 && !error) {
                setIncomingCallerInfo({
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
                if (notification.type === 'callUpdate' && notification.call) {
                    const call = notification.call;
                    const eventMsg = `Stare: ${call.state} | Dir: ${call.direction || 'N/A'}`;
                    addLog(eventMsg);
                    console.log('[Telnyx] callUpdate state:', call.state, '| direction:', call.direction, '| remoteStream:', !!call.remoteStream, '| remoteCallerNumber:', call.options?.remoteCallerNumber, '| callerNumber:', call.options?.callerNumber, '| destinationNumber:', call.options?.destinationNumber);

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
                        if (call.direction !== 'outbound') {
                            // Inbound call (direction is 'inbound' or undefined)
                            console.log('[Telnyx] 📞 Inbound call detected from:', call.options?.remoteCallerNumber);
                            setIncomingCall(call);
                            incomingCallRef.current = call;
                            lookupCaller(call.options.remoteCallerNumber);
                            // Only play ringtone if NOT already in an active call
                            setCallState(prev => {
                                if (prev !== 'active') {
                                    playIncomingRingtone();
                                } else {
                                    console.log('[Telnyx] Suppressing ringtone — already in active call');
                                }
                                return prev;
                            });
                        } else {
                            setCallState('calling');
                            setActiveCall(call);
                            activeCallRef.current = call;
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
                        activeCallRef.current = call;
                        setIncomingCall(null);
                        incomingCallRef.current = null;
                        
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
                        const getCallId = (c: any) => c?.options?.callSessionId || c?.callSessionId || c?.id;
                        const callId = getCallId(call);
                        const isEndingIncoming = incomingCallRef.current && (
                            (callId && callId === getCallId(incomingCallRef.current)) || call === incomingCallRef.current
                        );
                        const isEndingActive = activeCallRef.current && (
                            (callId && callId === getCallId(activeCallRef.current)) || call === activeCallRef.current
                        );
                        
                        stopRingback();
                        stopIncomingRingtone();
                        
                        // Extract SIP hangup reason
                        const sipCode = call.cause || call.sipCode || call.options?.sipCode;
                        const sipReason = call.causeMessage || call.sipReason || call.options?.sipReason;
                        const rawReason = sipReason || sipCode || call.hangupCause || '';
                        
                        console.log('[Telnyx] Call ended — raw:', rawReason, '| sipCode:', sipCode, '| sipReason:', sipReason, '| cause:', call.cause, '| causeMessage:', call.causeMessage, '| hangupCause:', call.hangupCause, '| isEndingIncoming:', isEndingIncoming, '| isEndingActive:', isEndingActive);
                        
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
                        
                        // Determine order ID to log: use existing active order, or prefix for inbound calls
                        const logOrderId = call.direction === 'inbound' 
                            ? `INBOUND:${call.options?.remoteCallerNumber || 'necunoscut'}`
                            : activeOrderIdRef.current;
                        const opId = profileRef.current?.id || null;
                        
                        // Calculate specific status for inbound
                        const finalStatus = call.direction === 'inbound' && !wasActive ? 'missed' : callStatus;

                        // Save call log for ALL calls (inbound & outbound)
                        const callSessionId = call.options?.callSessionId || call.callSessionId;
                        const isErrorCall = callStatus === 'rejected' && rawReason && rawReason !== 'ORIGINATOR_CANCEL' && rawReason !== 'NORMAL_CLEARING';
                        
                        // For error calls, always log even without an order_id (use phone number)
                        const fallbackOrderId = isErrorCall 
                            ? `ERR:${call.options?.destinationNumber || call.options?.remoteCallerNumber || 'unknown'}`
                            : null;
                        const effectiveOrderId = logOrderId || fallbackOrderId;
                        
                        if (opId && callSessionId && effectiveOrderId && !loggedCallsRef.current.has(callSessionId)) {
                            loggedCallsRef.current.add(callSessionId);
                            
                            const logPayload: any = {
                                operator_id: opId,
                                order_id: effectiveOrderId,
                                duration_secs: duration,
                                status: finalStatus,
                                // New columns (safe to include — if columns don't exist yet they'll be ignored)
                                error_code: rawReason || null,
                                error_message: friendlyReason || null,
                                destination_number: call.options?.destinationNumber || call.options?.remoteCallerNumber || null,
                                caller_id: call.options?.callerNumber || null,
                                call_direction: call.direction || 'outbound',
                                raw_sip_data: {
                                    sipCode,
                                    sipReason,
                                    cause: call.cause,
                                    causeMessage: call.causeMessage,
                                    hangupCause: call.hangupCause,
                                    callState: call.state,
                                    callSessionId,
                                    timestamp: new Date().toISOString()
                                }
                            };
                            
                            supabaseAdmin.from('call_logs').insert(logPayload).then(({error}) => {
                                if (error) {
                                    // If new columns don't exist yet, retry with just the basic fields
                                    if (error.code === '42703') { // column does not exist
                                        console.warn('[Telnyx] New columns not yet in DB, saving basic log. Please run the SQL migration.');
                                        supabaseAdmin.from('call_logs').insert({
                                            operator_id: opId,
                                            order_id: effectiveOrderId,
                                            duration_secs: duration,
                                            status: finalStatus,
                                        }).then(({error: e2}) => {
                                            if (e2) console.error('[Telnyx] Error saving basic call log:', e2);
                                            else console.log(`[Telnyx] Basic call log saved (migration pending)`);
                                        });
                                    } else {
                                        console.error('[Telnyx] Error saving call log:', error);
                                    }
                                } else {
                                    console.log(`[Telnyx] ✅ Call log saved: status=${finalStatus}, duration=${duration}s, error=${rawReason || 'none'}`);
                                }
                            });
                            
                            // Also mark processed_by on the order (only for outbound calls where we have a real order ID)
                            if (!wasActive && activeOrderIdRef.current) {
                                supabaseAdmin.from('orders').update({ processed_by: opId })
                                    .or(`id.eq.${activeOrderIdRef.current},order_id.eq.${activeOrderIdRef.current}`)
                                    .then(({error}) => {
                                        if (error) console.error('[Telnyx] Error updating processed_by:', error);
                                        else console.log('[Telnyx] processed_by set for unanswered call');
                                    });
                            }
                        }

                        // If the ending call is just the incoming (secondary) call while we have an active call, 
                        // only clean up the incoming call — DON'T touch the active call
                        if (isEndingIncoming && !isEndingActive && activeCallRef.current) {
                            console.log('[Telnyx] Secondary incoming call ended — keeping active call alive');
                            setIncomingCall(null);
                            incomingCallRef.current = null;
                            setIncomingCallerInfo(null);
                        } else {
                            // This is the active call ending (or the only call ending)
                            if (audioRef.current) audioRef.current.srcObject = null;
                            
                            // Set hangup reason for UI display — show all reasons except normal endings
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
                            
                            // Reset refs
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
                            
                            // Set a 3-second cooldown after call ends to prevent accidental re-dials
                            callCooldownUntilRef.current = Date.now() + 3000;
                            
                            setActiveCall(null);
                            // Only clear the ref on 'destroy', not on 'hangup',
                            // so the guard in makeCall keeps blocking until fully torn down
                            if (call.state === 'destroy' || call.state === 'purge') {
                                activeCallRef.current = null;
                            }
                            setIsMuted(false);
                            
                            // Only wipe the incoming call if it's NOT explicitly an active-only teardown while an incoming is alive
                            if (!(isEndingActive && !isEndingIncoming && incomingCallRef.current)) {
                                setIncomingCall(null);
                                incomingCallRef.current = null;
                                setIncomingCallerInfo(null);
                            } else {
                                console.log('[Telnyx] Active call ended — keeping secondary incoming call alive');
                            }
                        }
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

        let finalDest = destination;
        if (finalDest.startsWith('07')) finalDest = '+40' + finalDest.slice(1);
        else if (finalDest.startsWith('40') && finalDest.length === 11) finalDest = '+' + finalDest;

        // Start synthetic ringback immediately on click to satisfy AudioContext user gesture requirements
        playRingback();
        
        activeOrderIdRef.current = orderId || null;
        callStartTimeRef.current = null; // Reset on new call
        setLastHangupReason(null); // Clear previous reason
        setCallLogs([]); // Clear previous logs
        addLog(`Inițiat apel către ${finalDest}`);
        
        const call = clientRef.current.newCall({
            destinationNumber: finalDest,
            callerNumber: callerId || 'Unknown',
            audio: true,
            video: false,
        });
        setActiveCall(call);
        activeCallRef.current = call;
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
                            incomingCallRef.current = null;
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
                audioRef, ringtoneVolume, setRingtoneVolume
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
