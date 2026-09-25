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

    constructor(id: string, direction: 'inbound' | 'outbound', options: any) {
        this.id = id;
        this.state = 'calling';
        this.direction = direction;
        this.options = { ...options, callSessionId: id };
    }

    hangup() {
        if (this.voiceCall) {
            try { this.voiceCall.hangup(); } catch (e) { console.warn('[DIDLogic] Hangup error:', e); }
        }
    }

    answer() {
        if (this.voiceCall) {
            try { this.voiceCall.answer(); } catch (e) { console.warn('[DIDLogic] Answer error:', e); }
        }
    }

    reject() {
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

    constructor() {}

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
        console.log('[DIDLogic] Initializing Voice SDK client...');
        const { Device, CallCredentialsManager } = await import('@didlogic/voice-sdk');

        // Credentials manager points to our serverless proxy / local dev proxy
        this.credsManager = new CallCredentialsManager({
            proxyUrl: '/api/didlogic-proxy',
            refreshBeforeExpirySec: 120,
            retryDelayMs: 5000,
            maxRetryAttempts: 10,
        });

        this.device = new Device();

        this.device.on('registered', () => {
            console.log('[DIDLogic] ✅ SIP Registered & Ready');
            const creds = this.credsManager?.getCredentials?.();
            if (creds?.sipUser) {
                this.patchUa(creds.sipUser);
            }
            this.connected = true;
            this.emit('telnyx.ready');
        });

        this.device.on('registrationFailed', (e: any) => {
            console.error('[DIDLogic] ❌ Registration failed:', e?.cause);
            this.connected = false;
            this.emit('telnyx.error', e);
        });

        this.device.on('transportDisconnected', () => {
            console.warn('[DIDLogic] ⚠️ Transport disconnected');
            this.connected = false;
            this.emit('telnyx.error', { cause: 'Disconnected' });
        });

        this.device.on('incomingCall', (voiceCall: any) => {
            const callId = 'dl_in_' + Date.now();
            console.log('[DIDLogic] 📞 Inbound call from:', voiceCall.remoteIdentity);

            const wrappedCall = new DidlogicCallWrapper(callId, 'inbound', {
                remoteCallerNumber: voiceCall.remoteIdentity || 'necunoscut',
                destinationNumber: voiceCall.calledNumber || undefined,
            });
            wrappedCall.voiceCall = voiceCall;
            wrappedCall.state = 'ringing';

            this.bindCallEvents(voiceCall, wrappedCall);
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        this.credsManager.onCredentials = (creds: any) => {
            console.log('[DIDLogic] Applying refreshed credentials (user:', creds.sipUser, ')');
            this.device.applyCredentials(creds);
            this.patchUa(creds.sipUser);
        };

        this.credsManager.onError = (err: any) => {
            console.error('[DIDLogic] Credentials error:', err);
            this.emit('telnyx.error', err);
        };

        // Fetch initial credentials to kick off registration
        try {
            await this.credsManager.fetch();
            const currentCreds = this.credsManager.getCredentials?.();
            if (currentCreds?.sipUser) {
                this.patchUa(currentCreds.sipUser);
            }
        } catch (err) {
            console.error('[DIDLogic] Initial credentials fetch error:', err);
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

        // Normalize destination for DIDLogic: international E.164 digits without '+' (e.g. 40735548486)
        const dest = normalizePhoneForProvider(options.destinationNumber, 'didlogic');

        console.log('[DIDLogic] Dialing destination:', dest, '(digits only, no plus)', 'callerId:', options.callerNumber);

        // Inject Caller ID headers into JsSIP session if callerNumber is provided
        const callerNum = options.callerNumber ? (options.callerNumber.startsWith('+') ? options.callerNumber : '+' + options.callerNumber) : null;
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
                this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
                return;
            }
            this.bindCallEvents(voiceCall, wrappedCall);
        }).catch((err: any) => {
            if (restoreUaCall) restoreUaCall();
            console.error('[DIDLogic] Call failed to initiate:', err);
            wrappedCall.state = 'destroy';
            wrappedCall.cause = err.message || 'Call failed';
            wrappedCall.hangupCause = err.message;
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        return wrappedCall;
    }

    private bindCallEvents(voiceCall: any, wrappedCall: DidlogicCallWrapper) {
        if (voiceCall.session) {
            voiceCall.session.on('progress', () => {
                console.log('[DIDLogic] 📞 Session progress / early media');
                wrappedCall.state = 'early';
                wrappedCall.remoteStream = voiceCall.getRemoteStream();
                this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
            });

            voiceCall.session.on('failed', (e: any) => {
                const status = e?.message?.status_code;
                const reason = e?.message?.reason_phrase;
                console.error(`[DIDLogic] ❌ Raw SIP Failure: Status=${status}, Reason="${reason}", Cause=${e?.cause}`);
                if (status) {
                    wrappedCall.cause = `${status} ${reason || e?.cause || ''}`.trim();
                    wrappedCall.causeMessage = reason;
                    wrappedCall.hangupCause = `${status} ${reason || ''}`.trim();
                }
            });
        }

        voiceCall.on('accepted', () => {
            console.log('[DIDLogic] Call answered / active');
            wrappedCall.state = 'active';
            wrappedCall.remoteStream = voiceCall.getRemoteStream();
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        voiceCall.on('ended', ({ cause }: any) => {
            console.log('[DIDLogic] Call ended. Cause:', cause);
            wrappedCall.state = 'destroy';
            wrappedCall.cause = wrappedCall.cause || cause || 'NORMAL_CLEARING';
            wrappedCall.hangupCause = wrappedCall.hangupCause || cause;
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });

        voiceCall.on('failed', ({ cause }: any) => {
            console.log('[DIDLogic] Call failed. Cause:', cause);
            wrappedCall.state = 'destroy';
            wrappedCall.cause = wrappedCall.cause || cause || 'Call Failed';
            wrappedCall.hangupCause = wrappedCall.hangupCause || cause;
            this.emit('telnyx.notification', { type: 'callUpdate', call: wrappedCall });
        });
    }

    private patchUa(sipUser: string) {
        if (!this.device?.ua) return;
        const ua = this.device.ua;

        if ((ua as any)._didlogicPatched) return;
        (ua as any)._didlogicPatched = true;

        const origReceiveRequest = ua.receiveRequest.bind(ua);
        ua.receiveRequest = (request: any) => {
            const method = request?.method;
            const ruriUser = request?.ruri?.user;
            const configUser = ua._configuration?.uri?.user || sipUser;
            const contactUser = ua._contact?.uri?.user;

            console.log(`[DIDLogic] 📨 Incoming SIP message: ${method} | RURI: "${ruriUser}" | Config: "${configUser}" | Contact: "${contactUser}"`);

            if (method === 'INVITE') {
                console.log('[DIDLogic] 📞 Inbound INVITE intercepted:', {
                    from: request.from?.toString(),
                    to: request.to?.toString(),
                    callId: request.call_id,
                    xDid: typeof request.getHeader === 'function' ? request.getHeader('X-DID') : undefined,
                    ruri: request.ruri?.toString()
                });
            }

            // DIDLogic sends incoming SIP requests (INVITE, CANCEL, ACK, etc.) to the DID or destination extension.
            // JsSIP strictly drops requests where ruri.user !== _configuration.uri.user with a 404 Not Found.
            // Normalizing request.ruri.user to match configUser guarantees that JsSIP accepts the call and emits newRTCSession.
            if (request?.ruri && request.ruri.user && request.ruri.user !== configUser && request.ruri.user !== contactUser) {
                console.log(`[DIDLogic] 🔄 Normalizing ${method} RURI user "${ruriUser}" -> "${configUser}" for JsSIP acceptance`);
                request.ruri.user = configUser;
            }

            return origReceiveRequest(request);
        };

        ua.on('newRTCSession', (e: any) => {
            console.log('[DIDLogic] 🔔 JsSIP newRTCSession fired:', e.originator, e.session?.direction);
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
