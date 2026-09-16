// Vercel Serverless Function — DIDLogic Proxy
// Proxies requests from @didlogic/voice-sdk to DIDLogic API
// Injects the secret SDK_API_TOKEN on the server side

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const sdkToken = process.env.DIDLOGIC_SDK_TOKEN || '2608a52220fb45d952bae34b235779eaf64ae6ac4519a28651bb09924436337f';
    const upstreamUrl = process.env.DIDLOGIC_UPSTREAM_URL || 'https://app.didlogic.com/mobile/api/sdk/command';

    try {
        const payload = {
            command: req.body?.command || 'call',
            api_token: sdkToken
        };

        const upstreamRes = await fetch(upstreamUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'Whimlets-Dashboard/1.0'
            },
            body: JSON.stringify(payload)
        });

        const data = await upstreamRes.json();
        return res.status(upstreamRes.status).json(data);
    } catch (err) {
        console.error('[DIDLogic Proxy] Upstream error:', err);
        return res.status(502).json({ error: err.message || 'Failed to reach DIDLogic API' });
    }
}
