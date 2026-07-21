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
        const { action, storeName, orderId, address, status, note, productIds } = req.body;

        if (!storeName) {
            return res.status(400).json({ error: 'storeName is required' });
        }

        const config = getStoreConfig(storeName);
        const token = await getAccessToken(config);
        const headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
        };
        const graphqlUrl = `${config.url}/admin/api/${API_VERSION}/graphql.json`;

        // ── ACTION: get-product-images (no orderId needed) ──
        if (action === 'get-product-images') {
            if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
                return res.status(400).json({ error: 'productIds array is required' });
            }
            // Build GIDs
            const gids = productIds.map(pid => `gid://shopify/Product/${pid}`);
            const query = `
                query getProducts($ids: [ID!]!) {
                    nodes(ids: $ids) {
                        ... on Product {
                            id
                            title
                            featuredImage {
                                url
                                altText
                            }
                        }
                    }
                }
            `;
            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables: { ids: gids } })
            });
            const gqlData = await gqlRes.json();
            const nodes = gqlData?.data?.nodes || [];
            const images = {};
            nodes.forEach(node => {
                if (node && node.id) {
                    // Extract numeric ID from GID
                    const numericId = node.id.replace('gid://shopify/Product/', '');
                    images[numericId] = node.featuredImage?.url || null;
                }
            });
            return res.status(200).json({ success: true, images });
        }

        // ── ACTION: get-all-products (no orderId needed) ──
        if (action === 'get-all-products') {
            const query = `
                query getAllProducts {
                    products(first: 50, query: "status:active") {
                        edges {
                            node {
                                id
                                title
                                featuredImage { url altText }
                                variants(first: 50) {
                                    edges {
                                        node {
                                            id
                                            title
                                            price
                                            sku
                                            inventoryQuantity
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query })
            });
            const gqlData = await gqlRes.json();
            if (gqlData.errors) return res.status(500).json({ error: gqlData.errors });
            
            const products = gqlData.data.products.edges.map(e => e.node);
            return res.status(200).json({ success: true, products });
        }

        if (!orderId) {
            return res.status(400).json({ error: 'orderId is required for this action' });
        }
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
                            draftOrder {
                                id
                                status
                                tags
                                note
                                order {
                                    id
                                    name
                                    totalPriceSet {
                                        shopMoney {
                                            amount
                                            currencyCode
                                        }
                                    }
                                }
                            }
                            userErrors { field message }
                        }
                    }
                `;
                const completeRes = await fetch(graphqlUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({
                        query: completeMut,
                        variables: { id: gid, paymentPending: true }
                    })
                });
                const completeData = await completeRes.json();
                console.log('[shopify-sync] draftOrderComplete response:', JSON.stringify(completeData));

                // Check for GraphQL-level errors (e.g. auth, network, query errors)
                if (completeData?.errors && completeData.errors.length > 0) {
                    const errMsg = completeData.errors.map(e => e.message).join('; ');
                    return res.status(400).json({ success: false, errorMessage: errMsg, raw: completeData });
                }

                // Check for userErrors (business logic errors from Shopify)
                const completeErrors = completeData?.data?.draftOrderComplete?.userErrors;
                if (completeErrors && completeErrors.length > 0) {
                    const errMsg = completeErrors.map(e => `${e.field ? e.field + ': ' : ''}${e.message}`).join('; ');
                    return res.status(400).json({ success: false, errorMessage: errMsg, errors: completeErrors });
                }

                // Check if the mutation returned no data at all
                if (!completeData?.data?.draftOrderComplete) {
                    return res.status(400).json({ success: false, errorMessage: 'Shopify nu a returnat date valide. Verifică dacă draft-ul există.', raw: completeData });
                }

                const resultOrder = completeData?.data?.draftOrderComplete?.draftOrder;
                return res.status(200).json({
                    success: true,
                    confirmed: true,
                    orderName: resultOrder?.order?.name || null,
                    orderTotal: resultOrder?.order?.totalPriceSet?.shopMoney?.amount || null,
                    currency: resultOrder?.order?.totalPriceSet?.shopMoney?.currencyCode || 'RON',
                    tags: resultOrder?.tags || updatedTags,
                    note: resultOrder?.note || newNote,
                });
            }

            return res.status(200).json({ success: true });
        }

        // ── ACTION: get-line-items ──
        if (action === 'get-line-items') {
            const query = `
                query getDraftOrderLineItems($id: ID!) {
                    draftOrder(id: $id) {
                        id
                        name
                        lineItems(first: 50) {
                            edges {
                                node {
                                    id
                                    title
                                    quantity
                                    variant {
                                        id
                                        title
                                        price
                                    }
                                    originalUnitPriceSet {
                                        shopMoney {
                                            amount
                                            currencyCode
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            `;
            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query, variables: { id: gid } })
            });
            const gqlData = await gqlRes.json();
            const draftOrder = gqlData?.data?.draftOrder;
            if (!draftOrder) {
                return res.status(404).json({ success: false, error: 'Draft order not found' });
            }
            const lineItems = draftOrder.lineItems.edges.map(e => ({
                id: e.node.id,
                title: e.node.title,
                quantity: e.node.quantity,
                variantId: e.node.variant?.id || null,
                variantTitle: e.node.variant?.title || null,
                price: e.node.originalUnitPriceSet?.shopMoney?.amount || '0',
                currency: e.node.originalUnitPriceSet?.shopMoney?.currencyCode || 'RON',
            }));
            return res.status(200).json({ success: true, lineItems, draftName: draftOrder.name });
        }

        // ── ACTION: update-line-item-quantity ──
        if (action === 'update-line-item-quantity') {
            const { lineItems: updatedLineItems } = req.body;
            if (!updatedLineItems || !Array.isArray(updatedLineItems)) {
                return res.status(400).json({ error: 'lineItems array is required' });
            }

            // Build the line items input for the mutation
            // We need to use draftOrderUpdate with the full line items list
            const lineItemsInput = updatedLineItems.map(item => ({
                variantId: item.variantId,
                quantity: item.quantity,
            }));

            const updateMut = `
                mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                    draftOrderUpdate(id: $id, input: $input) {
                        draftOrder {
                            id
                            lineItems(first: 50) {
                                edges {
                                    node {
                                        id
                                        title
                                        quantity
                                        variant { id title price }
                                        originalUnitPriceSet {
                                            shopMoney { amount currencyCode }
                                        }
                                    }
                                }
                            }
                        }
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
                            lineItems: lineItemsInput
                        }
                    }
                })
            });
            const gqlData = await gqlRes.json();
            const errors = gqlData?.data?.draftOrderUpdate?.userErrors;
            if (errors && errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }
            const updatedDraft = gqlData?.data?.draftOrderUpdate?.draftOrder;
            const resultItems = updatedDraft?.lineItems?.edges?.map(e => ({
                id: e.node.id,
                title: e.node.title,
                quantity: e.node.quantity,
                variantId: e.node.variant?.id || null,
                variantTitle: e.node.variant?.title || null,
                price: e.node.originalUnitPriceSet?.shopMoney?.amount || '0',
                currency: e.node.originalUnitPriceSet?.shopMoney?.currencyCode || 'RON',
            })) || [];
            return res.status(200).json({ success: true, lineItems: resultItems });
        }

        // ── ACTION: update-draft-order-line-items ──
        if (action === 'update-draft-order-line-items') {
            const { items } = req.body;
            if (!items || !Array.isArray(items)) {
                return res.status(400).json({ error: 'items array is required' });
            }
            
            const mutation = `
                mutation draftOrderUpdate($id: ID!, $input: DraftOrderInput!) {
                    draftOrderUpdate(id: $id, input: $input) {
                        draftOrder {
                            id
                            lineItems(first: 50) {
                                edges {
                                    node {
                                        id
                                        title
                                        quantity
                                        originalUnitPriceSet { presentmentMoney { amount } }
                                        variant { id product { id } }
                                    }
                                }
                            }
                        }
                        userErrors { field message }
                    }
                }
            `;
            
            const lineItemsInput = items.map(item => {
                const variantGid = String(item.variant_id).includes('gid://') ? item.variant_id : `gid://shopify/ProductVariant/${item.variant_id}`;
                return {
                    variantId: variantGid,
                    quantity: item.quantity
                };
            });

            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        id: gid,
                        input: { lineItems: lineItemsInput }
                    }
                })
            });
            const gqlData = await gqlRes.json();
            const errors = gqlData?.data?.draftOrderUpdate?.userErrors;
            if (errors && errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }
            return res.status(200).json({ success: true, draftOrder: gqlData?.data?.draftOrderUpdate?.draftOrder });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch (err) {
        console.error('Shopify proxy error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
