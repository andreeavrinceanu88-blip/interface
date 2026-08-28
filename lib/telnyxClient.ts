let clientPromise: Promise<any> | null = null;

export const getTelnyxClient = (): Promise<any> => {
    if (clientPromise) return clientPromise;

    clientPromise = (async () => {
        const username = import.meta.env?.VITE_TELNYX_SIP_USERNAME;
        const password = import.meta.env?.VITE_TELNYX_SIP_PASSWORD;

        if (!username || !password) {
            const err = new Error('Telnyx SIP credentials are missing from .env');
            console.error(err);
            throw err;
        }

        const { TelnyxRTC } = await import('@telnyx/webrtc');
        const client = new TelnyxRTC({ login: username, password: password });
        client.connect();
        return client;
    })();

    return clientPromise;
};
