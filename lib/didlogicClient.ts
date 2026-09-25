// DIDLogic WebRTC Client Singleton
// Implements the same event and call API expected by TelnyxContext for seamless failover

import { normalizePhoneForProvider } from './sipClient';

class DidlogicCallWrapper {
    id: string;
    state: string;
    direction: 'inbound' | 'outbound';
    remoteStream?: MediaStream | null;
    options: {
        destinationNumber?: string;
        callerNumber?: string;
        remoteCallerNumber?: string;
        callSessionId?: string;
    };
    voiceCall: any = null;
    cause?: string;
    causeMessage?: string;
    hangupCause?: string;
    logger?: (msg: string) => void;

    constructor(id: string, direction: 'inbound' | 'outbound', options: any) {
        this.id = id;
        this.state = 'calling';
        this.direction = direction;
        this.options = { ...options, callSessionId: id };
    }

    hangup() {
        this.logger?.('📴 Comandă de închidere apel...');
        if (this.voiceCall) {
            try { this.voiceCall.hangup(); } catch (e) { console.warn('[DIDLogic] Hangup error:', e); }
        }
    }

    answer() {
        this.logger?.('📞 Comandă de răspuns apel...');
        if (this.voiceCall) {
            try { this.voiceCall.answer(); } catch (e) { console.warn('[DIDLogic] Answer error:', e); }
        }
    }

    reject() {
        this.logger?.('❌ Comandă de respingere apel (486 Busy)...');
        if (this.voiceCall) {
            try {
                if (typeof this.voiceCall.reject === 'function') {
                    this.voiceCall.reject();
                } else {
                    this.voiceCall.hangup();
                }
            } catch (e) { console.warn('[DIDLogic] Reject error:', e); }
        }
    }

    muteAudio() {
        if (this.voiceCall) {
            try { this.voiceCall.mute(true); } catch (e) {}
        }
    }

    unmuteAudio() {
        if (this.voiceCall) {
            try { this.voiceCall.mute(false); } catch (e) {}
        }
    }
}

class DidlogicClientWrapper {
    connected = false;
    private listeners: Map<string, Set<Function>> = new Map();
    private device: any = null;
    private credsManager: any = null;
    provider = 'didlogic';
    activeCall: DidlogicCallWrapper | null = null;

    constructor() {}

    log(msg: string, ...extra: any[]) {
        console.log(`%c[DIDLogic] ${msg}`, 'color: #06b6d4; font-weight: bold;', ...extra);
        this.emit('telnyx.log', msg);
    }

    warn(msg: string, ...extra: any[]) {
        console.warn(`[DIDLogic ⚠️] ${msg}`, ...extra);
        this.emit('telnyx.log', `⚠️ ${msg}`);
    }

    error(msg: string, ...extra: any[]) {
        console.error(`[DIDLogic ❌] ${msg}`, ...extra);
        this.emit('telnyx.log', `❌ ${msg}`);
    }

    on(event: string, handler: Function) {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, new Set());
        }
        this.listeners.get(event)!.add(handler);
    }

    off(event: string, handler: Function) {
        this.listeners.get(event)?.delete(handler);
    }

    emit(event: string, data?: any) {
        this.listeners.get(event)?.forEach(fn => {
            try { fn(data); } catch (e) { console.error('[DIDLogic] Event handler error:', e); }
        });
    }

    async init() {
        this.log('Inițializare client Voice SDK...');
        const { Device, CallCredentialsManager } = await import('@didlogic/voice-sdk');

        // Credentials manager points to our serverless proxy / local dev proxy
        this.credsManager = new CallCredentialsManager({
            proxyUrl: '/api/didlogic-proxy',
            refreshBeforeExpirySec: 120,
            retryDelayMs: 5000,
            maxRetryAttempts: 10,
        });

        this.device = new Device();

        this.device.on('transportConnected', () => {
            this.log('🟢 Conexiune WebSocket WSS stabilită cu serverul DIDLogic');
        });

        this.device.on('incomingCall', (voiceCall: any) => {
            const callId = 'dl_in_' + Date.now();
            const fromNum = voiceCall.remoteIdentity || 'necunoscut';
            const toDid = voiceCall.calledNumber || 'N/A';
            this.log(`📞 APEL DE INTRARE detectat de la: ${fromNum} | DID apelat: ${toDid}`);

            const wrappedCall = new DidlogicCallWrapper(callId, 'inbound', {
                remoteCallerNumber: fromNum,
                destinationNumber: toDid,
            });
            wrappedCall.logger = (msg: string) => this.log(msg);
            wrappedCall.voiceCall = voiceCall;
            wrappedCall.state = 'ringing';
            this.activeCall = wrappedCall;

            this.bindCallEvents(voiceCall, wrappedCall);
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        this.log(`Device instanțiat. hasListeners(incomingCall): ${this.device.hasListeners('incomingCall')}`);

        this.device.on('registered', () => {
            const creds = this.credsManager?.getCredentials?.();
            const user = creds?.sipUser || 'ok';
            this.log(`✅ SIP Înregistrat & Pregătit (User: ${user})`);
            if (creds?.sipUser) {
                this.patchUa(creds.sipUser);
            }
            this.connected = true;
            this.emit('telnyx.ready');
        });

        this.device.on('registrationFailed', (e: any) => {
            this.error(`Înregistrare SIP eșuată: ${e?.cause || 'necunoscut'}`);
            this.connected = false;
            this.emit('telnyx.error', e);
        });

        this.device.on('transportDisconnected', () => {
            this.warn('Conexiune WebSocket întreruptă');
            this.connected = false;
            this.emit('telnyx.error', { cause: 'Disconnected' });
        });

        this.credsManager.onCredentials = (creds: any) => {
            this.log(`Reînnoire credențiale SIP primite (User: ${creds.sipUser})`);
            this.device.applyCredentials(creds);
            this.patchUa(creds.sipUser);
        };

        this.credsManager.onError = (err: any) => {
            this.error(`Eroare credențiale SIP: ${err?.message || JSON.stringify(err)}`);
            this.emit('telnyx.error', err);
        };

        // Fetch initial credentials to kick off registration
        try {
            this.log('Preluare credențiale inițiale prin proxy...');
            await this.credsManager.fetch();
            const currentCreds = this.credsManager.getCredentials?.();
            this.log(`Credențiale inițiale obținute cu succes (WSS: ${currentCreds?.wssUrl})`);
            if (currentCreds?.sipUser) {
                this.patchUa(currentCreds.sipUser);
            }
        } catch (err) {
            this.error(`Preluarea inițială a credențialelor a eșuat: ${err}`);
            this.emit('telnyx.error', err);
            throw err;
        }

        return this;
    }

    newCall(options: { destinationNumber: string; callerNumber?: string; audio?: boolean; video?: boolean }) {
        if (!this.device) {
            throw new Error('DIDLogic device not initialized');
        }

        const callId = 'dl_out_' + Date.now();
        const wrappedCall = new DidlogicCallWrapper(callId, 'outbound', options);
        wrappedCall.logger = (msg: string) => this.log(msg);
        this.activeCall = wrappedCall;

        // Normalize destination for DIDLogic: international E.164 digits without '+' (e.g. 40735548486)
        const dest = normalizePhoneForProvider(options.destinationNumber, 'didlogic');
        const callerNum = options.callerNumber ? (options.callerNumber.startsWith('+') ? options.callerNumber : '+' + options.callerNumber) : null;

        this.log(`Inițiere apel ieșire către: ${dest} | Caller ID: ${callerNum || 'Default'}`);

        // Inject Caller ID headers into JsSIP session if callerNumber is provided
        let restoreUaCall: (() => void) | null = null;
        if (this.device?.ua && callerNum) {
            const origUaCall = this.device.ua.call.bind(this.device.ua);
            this.device.ua.call = (targetUri: any, opts: any) => {
                opts = opts || {};
                opts.extraHeaders = opts.extraHeaders ? [...opts.extraHeaders] : [];
                const host = (typeof targetUri === 'string' && targetUri.includes('@')) ? targetUri.split('@')[1] : 'sip.didlogic.com';
                opts.extraHeaders.push(`P-Asserted-Identity: <sip:${callerNum}@${host}>`);
                opts.extraHeaders.push(`Remote-Party-ID: <sip:${callerNum}@${host}>;party=calling;screen=yes;privacy=off`);
                return origUaCall(targetUri, opts);
            };
            restoreUaCall = () => {
                if (this.device?.ua) this.device.ua.call = origUaCall;
            };
        }

        let cancelledBeforeVoiceCall = false;
        wrappedCall.hangup = () => {
            cancelledBeforeVoiceCall = true;
            this.log('📴 Solicitare închidere apel (operator)...');
            if (this.activeCall === wrappedCall) {
                this.activeCall = null;
            }
            if (this.device) {
                this.device.currentCall = null;
            }
            if (wrappedCall.voiceCall) {
                try { wrappedCall.voiceCall.hangup(); } catch (e) { console.warn('[DIDLogic] Hangup error:', e); }
            }
        };

        // Initiate call asynchronously
        this.device.call(dest).then((voiceCall: any) => {
            if (restoreUaCall) restoreUaCall();
            wrappedCall.voiceCall = voiceCall;
            if (cancelledBeforeVoiceCall) {
                try { voiceCall.hangup(); } catch (e) {}
                wrappedCall.state = 'destroy';
                wrappedCall.cause = 'NORMAL_CLEARING';
                if (this.activeCall === wrappedCall) this.activeCall = null;
                if (this.device) this.device.currentCall = null;
                this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
                return;
            }
            this.bindCallEvents(voiceCall, wrappedCall);
        }).catch((err: any) => {
            if (restoreUaCall) restoreUaCall();
            this.error(`Eșec la inițierea apelului: ${err.message || err}`);
            wrappedCall.state = 'destroy';
            wrappedCall.cause = err.message || 'Call failed';
            wrappedCall.hangupCause = err.message;
            if (this.activeCall === wrappedCall) this.activeCall = null;
            if (this.device) this.device.currentCall = null;
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        return wrappedCall;
    }

    private bindCallEvents(voiceCall: any, wrappedCall: DidlogicCallWrapper) {
        if (voiceCall.session) {
            voiceCall.session.on('progress', () => {
                this.log('📞 Semnal progres sesiune (Early media / Ton apelare)');
                wrappedCall.state = 'early';
                wrappedCall.remoteStream = voiceCall.getRemoteStream();
                this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
            });

            voiceCall.session.on('failed', (e: any) => {
                const status = e?.message?.status_code;
                const reason = e?.message?.reason_phrase;
                this.error(`Semnal SIP eșuat: Status=${status}, Reason="${reason}", Cause=${e?.cause}`);
                if (status) {
                    wrappedCall.cause = `${status} ${reason || e?.cause || ''}`.trim();
                    wrappedCall.causeMessage = reason;
                    wrappedCall.hangupCause = `${status} ${reason || ''}`.trim();
                }
            });
        }

        voiceCall.on('accepted', () => {
            this.log('✅ Apel conectat / Răspuns primit (Convorbire activă)');
            wrappedCall.state = 'active';
            wrappedCall.remoteStream = voiceCall.getRemoteStream();
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        const finishCall = (cause: any, defaultMsg: string) => {
            if (this.activeCall === wrappedCall) {
                this.activeCall = null;
            }
            if (this.device) {
                this.device.currentCall = null;
            }
            const finalCause = cause || defaultMsg;
            this.log(`📴 Apel încheiat. Cauză: ${finalCause}`);
            wrappedCall.state = 'destroy';
            wrappedCall.cause = wrappedCall.cause || cause || defaultMsg;
            wrappedCall.hangupCause = wrappedCall.hangupCause || cause;
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        };

        voiceCall.on('ended', ({ cause }: any) => {
            finishCall(cause, 'NORMAL_CLEARING');
        });

        voiceCall.on('failed', ({ cause }: any) => {
            finishCall(cause, 'Call Failed');
        });
    }

    private patchUa(sipUser: string) {
        if (!this.device?.ua) return;
        const ua = this.device.ua;

        if ((ua as any)._didlogicPatched) return;
        (ua as any)._didlogicPatched = true;

        // Raw WebSocket interceptor — runs before ANY parsing or SIP logic
        try {
            const ws = (ua as any)._transport?.socket?._ws;
            if (ws && !(ws as any)._wireLogAttached) {
                (ws as any)._wireLogAttached = true;
                ws.addEventListener('message', (evt: MessageEvent) => {
                    const raw = typeof evt.data === 'string' ? evt.data : '';
                    if (raw.includes('SIP/2.0')) {
                        const firstLine = raw.split('\r\n')[0] || raw.split('\n')[0] || '';
                        console.log(`%c[DIDLogic WSS WIRE] 📥 Primit pe WebSocket: ${firstLine}`, 'background: #0891b2; color: #ffffff; font-weight: bold; padding: 2px 6px; border-radius: 4px;');
                        if (raw.startsWith('INVITE')) {
                            console.log(`%c[DIDLogic WSS WIRE INVITE]\n${raw}`, 'color: #d946ef; font-family: monospace;');
                        }
                    }
                });
            }
        } catch (e) {}

        const origReceiveRequest = ua.receiveRequest.bind(ua);
        ua.receiveRequest = (request: any) => {
            const method = request?.method;
            const ruriUser = request?.ruri?.user;
            const configUser = ua._configuration?.uri?.user || sipUser;
            const contactUser = ua._contact?.uri?.user;

            console.log(`[DIDLogic SIP WIRE] 📡 Pachet SIP recepționat: ${method} | RURI: "${ruriUser}" | Call-ID: ${request?.call_id || 'N/A'}`);

            if (method === 'INVITE') {
                const fromHeader = request.from?.toString();
                const toHeader = request.to?.toString();
                const callId = request.call_id;
                const xDid = typeof request.getHeader === 'function' ? request.getHeader('X-DID') : undefined;

                this.log(`📨 Pachet SIP INVITE primit de la ${fromHeader} | DID apelat: ${xDid || toHeader} | Call-ID: ${callId}`);

                // Crucial fix for 486 Busy Here:
                // Voice SDK's Device.ts automatically terminates inbound INVITE with 486 if this.currentCall != null.
                // If the app is idle or the existing call is already ended/terminated, reset device.currentCall to null
                // so the incoming call is GUARANTEED to be accepted and delivered to the inboundCall listener!
                if (this.device) {
                    const cur = this.device.currentCall;
                    const hasListener = this.device.hasListeners('incomingCall');
                    this.log(`🔍 Verificare stare apel: hasListeners=${hasListener} | currentCall=${!!cur} | activeCall=${!!this.activeCall}`);

                    if (cur && (!this.activeCall || cur.terminated || cur._terminated || cur.session?.isEnded?.())) {
                        this.warn('Curățare stare apel reziduală pentru a garanta preluarea apelului');
                        this.device.currentCall = null;
                    }
                }
            } else if (method === 'CANCEL') {
                this.log('📨 Pachet SIP CANCEL primit (apelantul a anulat apelul)');
            } else if (method === 'BYE') {
                this.log('📨 Pachet SIP BYE primit (partenerul de convorbire a închis)');
            } else if (method !== 'ACK') {
                console.log(`[DIDLogic] 📨 Mesaj SIP: ${method} | RURI: "${ruriUser}"`);
            }

            // DIDLogic sends incoming SIP requests (INVITE, CANCEL, ACK, etc.) to the DID or destination extension.
            // JsSIP strictly drops requests where ruri.user !== _configuration.uri.user with a 404 Not Found.
            // Normalizing request.ruri.user to match configUser guarantees that JsSIP accepts the call and emits newRTCSession.
            if (request?.ruri && request.ruri.user && request.ruri.user !== configUser && request.ruri.user !== contactUser) {
                this.log(`Normalizare RURI SIP user "${ruriUser}" -> "${configUser}"`);
                request.ruri.user = configUser;
            }

            return origReceiveRequest(request);
        };

        ua.on('newRTCSession', (e: any) => {
            this.log(`🔔 Sesiune WebRTC JsSIP creată: originator=${e.originator}, direction=${e.session?.direction}`);
        });
    }

    disconnect() {
        try {
            if (this.device) {
                this.device.unregister();
                this.device.destroy();
                this.device = null;
            }
            if (this.credsManager) {
                this.credsManager.destroy();
                this.credsManager = null;
            }
            this.connected = false;
        } catch (e) {
            console.warn('[DIDLogic] Disconnect error:', e);
        }
    }
}

let didlogicPromise: Promise<DidlogicClientWrapper> | null = null;

export const getDidlogicClient = (): Promise<DidlogicClientWrapper> => {
    if (didlogicPromise) return didlogicPromise;

    didlogicPromise = (async () => {
        const client = new DidlogicClientWrapper();
        await client.init();
        return client;
    })();

    return didlogicPromise;
};

export const resetDidlogicClient = () => {
    if (didlogicPromise) {
        didlogicPromise.then(c => c.disconnect()).catch(() => {});
        didlogicPromise = null;
    }
};
