// Vercel Serverless Function — Shopify Proxy
// Handles address update and status/tag sync from the frontend
// This avoids CORS by making server-side calls to Shopify Admin API

const API_VERSION = '2026-01';

function getStoreConfig(storeName) {
    const normalized = (storeName || '').toLowerCase().trim();
    if (normalized === 'vitadomus') {
        return {
            url: process.env.VITE_VITADOMUS_SHOPIFY_URL,
            clientId: process.env.VITE_VITADOMUS_SHOPIFY_CLIENT_ID,
            clientSecret: process.env.VITE_VITADOMUS_SHOPIFY_CLIENT_SECRET,
        };
    }
    // Default to Tamtrend
    return {
        url: process.env.VITE_TAMTREND_SHOPIFY_URL || 'https://k7agxh-7y.myshopify.com',
        clientId: process.env.VITE_TAMTREND_SHOPIFY_CLIENT_ID,
        clientSecret: process.env.VITE_TAMTREND_SHOPIFY_CLIENT_SECRET,
    };
}

async function getAccessToken(config) {
    if (!config.clientId || !config.clientSecret) {
        throw new Error(`Shopify credentials missing for ${config.url}`);
    }
    const res = await fetch(`${config.url}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: config.clientId,
            client_secret: config.clientSecret,
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error(`Failed to obtain Shopify token for ${config.url}`);
    }
    return data.access_token;
}

export default async function handler(req, res) {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const { action, storeName, orderId, address, status, note } = req.body;

        if (!storeName || !orderId) {
            return res.status(400).json({ error: 'storeName and orderId are required' });
        }

        const config = getStoreConfig(storeName);
        const token = await getAccessToken(config);
        const headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
        };
        const graphqlUrl = `${config.url}/admin/api/${API_VERSION}/graphql.json`;
        const gid = String(orderId).includes('gid://') ? orderId : `gid://shopify/DraftOrder/${orderId}`;

        // ── ACTION: update-address ──
        if (action === 'update-address') {
            const updateMut = `
                mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                    draftOrderUpdate(id: $id, input: $input) {
                        draftOrder { id }
                        userErrors { field message }
                    }
                }
            `;
            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: updateMut,
                    variables: {
                        id: gid,
                        input: {
                            shippingAddress: {
                                address1: address
                            }
                        }
                    }
                })
            });
            const gqlData = await gqlRes.json();
            const errors = gqlData?.data?.draftOrderUpdate?.userErrors;
            if (errors && errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }
            return res.status(200).json({ success: true });
        }

        // ── ACTION: update-note ──
        if (action === 'update-note') {
            const updateMut = `
                mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                    draftOrderUpdate(id: $id, input: $input) {
                        draftOrder { id }
                        userErrors { field message }
                    }
                }
            `;
            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: updateMut,
                    variables: {
                        id: gid,
                        input: {
                            note: note || ''
                        }
                    }
                })
            });
            const gqlData = await gqlRes.json();
            const errors = gqlData?.data?.draftOrderUpdate?.userErrors;
            if (errors && errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }
            return res.status(200).json({ success: true });
        }

        // ── ACTION: update-status ──
        if (action === 'update-status') {
            // 1. Get current tags
            const getQuery = `
                query getDraftOrder($id: ID!) {
                    draftOrder(id: $id) {
                        id
                        tags
                        note
                    }
                }
            `;
            const getRes2 = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query: getQuery, variables: { id: gid } })
            });
            const getData = await getRes2.json();
            const draftOrder = getData?.data?.draftOrder;
            if (!draftOrder) {
                return res.status(404).json({ success: false, error: 'Draft order not found in Shopify' });
            }

            const currentTags = draftOrder.tags || [];
            const statusTag = status.toUpperCase();
            const updatedTags = [...currentTags];
            if (!updatedTags.includes(statusTag)) updatedTags.push(statusTag);

            let newNote = draftOrder.note ? draftOrder.note + '\n' : '';
            newNote += `[Status platformă: ${statusTag}]`;
            if (note) newNote += ` - ${note}`;

            // 2. Update tags + note
            const updateMut = `
                mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                    draftOrderUpdate(id: $id, input: $input) {
                        userErrors { field message }
                    }
                }
            `;
            await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: updateMut,
                    variables: {
                        id: gid,
                        input: { tags: updatedTags, note: newNote }
                    }
                })
            });

            // 3. Complete if confirmat
            if (status === 'confirmat') {
                const completeMut = `
                    mutation draftOrderComplete($id: ID!, $paymentPending: Boolean) {
                        draftOrderComplete(id: $id, paymentPending: $paymentPending) {
                            userErrors { field message }
                        }
                    }
                `;
                await fetch(graphqlUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: completeMut,
                        variables: { id: gid, paymentPending: true }
                    })
                });
            }

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch (err) {
        console.error('Shopify proxy error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
