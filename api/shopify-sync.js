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
        url: process.env.VITE_TAMTREND_SHOPIFY_URL || 'https://z10zqc-mz.myshopify.com',
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
        const { action, storeName, orderId, address, city, province, status, note, productIds, name } = req.body;

        if (!storeName) {
            return res.status(400).json({ error: 'storeName is required' });
        }

        const config = getStoreConfig(storeName);
        console.log(`[shopify-sync] Store: ${storeName}, URL: ${config.url}, hasClientId: ${!!config.clientId}, hasClientSecret: ${!!config.clientSecret}`);
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
            const shippingAddress = { address1: address || '' };
            if (city) shippingAddress.city = city;
            if (province) shippingAddress.province = province;
            
            if (name) {
                const parts = name.trim().split(' ');
                shippingAddress.lastName = parts.pop() || '';
                shippingAddress.firstName = parts.join(' ') || '';
            }
            
            const billingAddress = { ...shippingAddress };

            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: updateMut,
                    variables: {
                        id: gid,
                        input: { shippingAddress, billingAddress }
                    }
                })
            });
            const gqlText = await gqlRes.text();
            let gqlData;
            try {
                gqlData = JSON.parse(gqlText);
            } catch (parseErr) {
                console.error('[shopify-sync] update-address non-JSON response:', gqlText);
                return res.status(500).json({ success: false, errorMessage: `Shopify a returnat un răspuns invalid: ${gqlText.substring(0, 300)}` });
            }
            
            // Check for GraphQL-level errors
            if (gqlData?.errors && gqlData.errors.length > 0) {
                const errMsg = gqlData.errors.map(e => e.message).join('; ');
                return res.status(400).json({ success: false, errorMessage: errMsg, raw: gqlData });
            }
            
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
            
            // Check for GraphQL-level errors
            if (gqlData?.errors && gqlData.errors.length > 0) {
                const errMsg = gqlData.errors.map(e => e.message).join('; ');
                return res.status(400).json({ success: false, errorMessage: errMsg, raw: gqlData });
            }
            
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
                        note2
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

            let newNote = draftOrder.note2 ? draftOrder.note2 + '\n' : '';
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
                                note2
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
                
                // Wait 5 seconds to ensure Shopify finishes background recalculations
                console.log(`[shopify-sync] Waiting 5 seconds before confirming draft ${gid}...`);
                await new Promise(resolve => setTimeout(resolve, 5000));

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
                const completeErrors = completeData?.data?.draftOrderComplete?.userErrors;

                // Check for GraphQL-level errors (e.g. auth, network, query errors)
                if (completeData?.errors && completeData.errors.length > 0) {
                    const errMsg = completeData.errors.map(e => e.message).join('; ');
                    return res.status(400).json({ success: false, errorMessage: errMsg, raw: completeData });
                }

                // Check for userErrors (business logic errors from Shopify)
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
                    note: resultOrder?.note2 || newNote,
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
            
            // Check for GraphQL-level errors
            if (gqlData?.errors && gqlData.errors.length > 0) {
                const errMsg = gqlData.errors.map(e => e.message).join('; ');
                return res.status(400).json({ success: false, errorMessage: errMsg, raw: gqlData });
            }
            
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
            const { items, shippingPrice } = req.body;
            if (!items || !Array.isArray(items)) {
                return res.status(400).json({ error: 'items array is required' });
            }
            
            console.log('[shopify-sync] update-draft-order-line-items called with:', JSON.stringify({ orderId: gid, items, shippingPrice }));

            // ── Step 1: Fetch actual variant prices from Shopify ──
            // Products sold via call center often have catalog price=0 and compareAtPrice=real price
            const variantGids = items
                .filter(item => item.variant_id && item.variant_id !== 'null' && item.variant_id !== 'undefined')
                .map(item => String(item.variant_id).includes('gid://') ? item.variant_id : `gid://shopify/ProductVariant/${item.variant_id}`);
            
            let variantPrices = {};
            if (variantGids.length > 0) {
                const variantQuery = `
                    query getVariants($ids: [ID!]!) {
                        nodes(ids: $ids) {
                            ... on ProductVariant {
                                id
                                price
                                compareAtPrice
                                title
                                product { title }
                            }
                        }
                    }
                `;
                const variantRes2 = await fetch(graphqlUrl, {
                    method: 'POST',
                    headers,
                    body: JSON.stringify({ query: variantQuery, variables: { ids: variantGids } })
                });
                const variantData = await variantRes2.json();
                console.log('[shopify-sync] Variant prices raw response:', JSON.stringify(variantData));
                
                const nodes = variantData?.data?.nodes || [];
                nodes.forEach(node => {
                    if (node && node.id) {
                        variantPrices[node.id] = {
                            price: node.price,
                            compareAtPrice: node.compareAtPrice,
                            title: node.product?.title || node.title
                        };
                    }
                });
                console.log('[shopify-sync] Variant prices map:', JSON.stringify(variantPrices));
            }

            // ── Step 2: Also fetch current draft line items to see existing prices ──
            const currentDraftQuery = `
                query getDraftOrder($id: ID!) {
                    draftOrder(id: $id) {
                        id
                        lineItems(first: 50) {
                            edges {
                                node {
                                    id
                                    title
                                    quantity
                                    originalUnitPriceSet { shopMoney { amount currencyCode } }
                                    variant { id price compareAtPrice }
                                }
                            }
                        }
                    }
                }
            `;
            const currentDraftRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({ query: currentDraftQuery, variables: { id: gid } })
            });
            const currentDraftData = await currentDraftRes.json();
            const currentLineItems = currentDraftData?.data?.draftOrder?.lineItems?.edges || [];
            console.log('[shopify-sync] Current draft line items:', JSON.stringify(currentLineItems.map(e => ({
                title: e.node.title,
                qty: e.node.quantity,
                price: e.node.originalUnitPriceSet?.shopMoney?.amount,
                variantPrice: e.node.variant?.price,
                variantCompareAt: e.node.variant?.compareAtPrice
            }))));

            // ── Step 3: Build line items with correct prices ──
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
                                        originalUnitPriceSet { shopMoney { amount currencyCode } presentmentMoney { amount } }
                                        variant { id price compareAtPrice product { id } }
                                    }
                                }
                            }
                        }
                        userErrors { field message }
                    }
                }
            `;
            
            const lineItemsInput = items.map(item => {
                const lineItem = {
                    quantity: item.quantity
                };
                if (item.title) lineItem.title = item.title;
                if (item.sku) lineItem.sku = item.sku;
                
                let variantGid = null;
                if (item.variant_id && item.variant_id !== 'null' && item.variant_id !== 'undefined') {
                    variantGid = String(item.variant_id).includes('gid://') ? item.variant_id : `gid://shopify/ProductVariant/${item.variant_id}`;
                    lineItem.variantId = variantGid;
                }
                
                // Determine the correct price to use:
                // Priority: item.price (from client) > compareAtPrice > variant price
                // This ensures we respect the exact forced price calculated by the frontend (including discounts)
                let resolvedPrice = null;
                
                if (item.price !== undefined && item.price !== null && parseFloat(item.price) > 0) {
                    resolvedPrice = parseFloat(item.price).toString();
                    console.log(`[shopify-sync] DISCOUNT LOG: Using client-provided item.price=${resolvedPrice} for variant ${variantGid}`);
                } else if (variantGid && variantPrices[variantGid]) {
                    const vp = variantPrices[variantGid];
                    if (vp.compareAtPrice && parseFloat(vp.compareAtPrice) > 0) {
                        resolvedPrice = vp.compareAtPrice;
                        console.log(`[shopify-sync] DISCOUNT LOG: Fallback to compareAtPrice=${resolvedPrice} for variant ${variantGid} (${vp.title})`);
                    } else if (vp.price && parseFloat(vp.price) > 0) {
                        resolvedPrice = vp.price;
                        console.log(`[shopify-sync] DISCOUNT LOG: Fallback to variant price=${resolvedPrice} for variant ${variantGid} (${vp.title})`);
                    } else {
                        console.log(`[shopify-sync] DISCOUNT LOG: WARNING: Both price (${vp.price}) and compareAtPrice (${vp.compareAtPrice}) are 0 or null for ${vp.title}`);
                    }
                } else {
                    console.log(`[shopify-sync] DISCOUNT LOG: No client price and no variant info found for variant ${variantGid}`);
                }

                if (resolvedPrice !== null) {
                    let finalPrice = parseFloat(resolvedPrice);
                    if (item.appliedDiscount && parseFloat(item.appliedDiscount) > 0) {
                        const originalPriceBeforeDiscount = finalPrice;
                        finalPrice -= parseFloat(item.appliedDiscount);
                        console.log(`[shopify-sync] DISCOUNT LOG: Applied per-unit discount of ${item.appliedDiscount}! Unit Price calculated: ${originalPriceBeforeDiscount} - ${item.appliedDiscount} = ${finalPrice}`);
                    } else {
                        console.log(`[shopify-sync] DISCOUNT LOG: No appliedDiscount provided by client for variant ${variantGid}. Unit Price remains: ${finalPrice}`);
                    }
                    if (finalPrice < 0) {
                        console.log(`[shopify-sync] DISCOUNT LOG: Final price was less than 0 (${finalPrice}), clamped to 0.`);
                        finalPrice = 0;
                    }
                    lineItem.originalUnitPrice = finalPrice.toFixed(2);
                    
                    // Shopify ignores originalUnitPrice if variantId is provided, so we must use appliedDiscount OR we can omit variantId.
                    // To maintain inventory tracking, we must send variantId. 
                    // But if the user doesn't want the "Reducere" tag, the official way is to either use `priceOverride` (if supported) or we must fallback to applying a discount.
                    // We will NOT send an explicit `appliedDiscount` object to Shopify (because the user hates the tag), 
                    // INSTEAD, we will omit the variantId so Shopify accepts the custom price!
                    if (item.appliedDiscount && parseFloat(item.appliedDiscount) > 0) {
                        console.log(`[shopify-sync] DISCOUNT LOG: Omitting variantId to force custom price without discount tag for ${lineItem.title || variantGid}`);
                        delete lineItem.variantId; 
                    }
                    
                    console.log(`[shopify-sync] DISCOUNT LOG: Forcing originalUnitPrice to ${lineItem.originalUnitPrice}`);
                } else {
                    console.log(`[shopify-sync] DISCOUNT LOG: WARNING: No price resolved for variant ${variantGid}, Shopify will fallback to variant catalog price`);
                }

                console.log(`[shopify-sync] Final line item:`, JSON.stringify(lineItem));
                return lineItem;
            });

            const input = { lineItems: lineItemsInput };

            // Add shipping line if shippingPrice is provided and > 0
            if (shippingPrice && parseFloat(shippingPrice) > 0) {
                input.shippingLine = {
                    title: 'Livrare Rapida',
                    priceWithCurrency: { amount: parseFloat(shippingPrice).toFixed(2), currencyCode: 'RON' }
                };
            } else {
                // Gratuit
                input.shippingLine = {
                    title: 'Livrare Gratuita',
                    priceWithCurrency: { amount: '0.00', currencyCode: 'RON' }
                };
            }

            console.log('[shopify-sync] Final mutation input:', JSON.stringify(input, null, 2));

            const gqlRes = await fetch(graphqlUrl, {
                method: 'POST',
                headers,
                body: JSON.stringify({
                    query: mutation,
                    variables: {
                        id: gid,
                        input
                    }
                })
            });
            const gqlData = await gqlRes.json();
            
            console.log('[shopify-sync] draftOrderUpdate response:', JSON.stringify(gqlData));
            
            // Check for GraphQL-level errors
            if (gqlData?.errors && gqlData.errors.length > 0) {
                const errMsg = gqlData.errors.map(e => e.message).join('; ');
                return res.status(400).json({ success: false, errorMessage: errMsg, raw: gqlData });
            }
            
            const errors = gqlData?.data?.draftOrderUpdate?.userErrors;
            if (errors && errors.length > 0) {
                return res.status(400).json({ success: false, errors });
            }
            
            const resultDraft = gqlData?.data?.draftOrderUpdate?.draftOrder;
            
            // Log the resulting line items for debugging
            const resultItems = resultDraft?.lineItems?.edges || [];
            console.log('[shopify-sync] Result line items after update:', JSON.stringify(resultItems.map(e => ({
                title: e.node.title,
                qty: e.node.quantity,
                price: e.node.originalUnitPriceSet?.shopMoney?.amount,
                variantPrice: e.node.variant?.price,
                variantCompareAt: e.node.variant?.compareAtPrice
            }))));
            // --- REST API FALLBACK FOR SHIPPING LINE ---
            // Shopify GraphQL is notoriously bugged with custom shipping lines unless you use order editing.
            // Using the REST API guarantees the custom shipping price applies correctly.
            if (shippingPrice !== undefined) {
                try {
                    const draftIdParts = gid.split('/');
                    const restId = draftIdParts[draftIdParts.length - 1];
                    const restUrl = `${config.url}/admin/api/2024-01/draft_orders/${restId}.json`;
                    
                    const shippingData = {
                        draft_order: {
                            shipping_line: {
                                title: parseFloat(shippingPrice) > 0 ? 'Livrare Rapida' : 'Livrare Gratuita',
                                price: parseFloat(shippingPrice).toFixed(2),
                                custom: true
                            }
                        }
                    };
                    
                    console.log(`[shopify-sync] REST API Shipping Fallback to ${restUrl}`, JSON.stringify(shippingData));
                    const restRes = await fetch(restUrl, {
                        method: 'PUT',
                        headers,
                        body: JSON.stringify(shippingData)
                    });
                    
                    const restData = await restRes.json();
                    if (restData.errors) {
                        console.error('[shopify-sync] REST API Shipping Error:', JSON.stringify(restData.errors));
                    } else {
                        console.log('[shopify-sync] REST API Shipping Success!');
                    }
                } catch (e) {
                    console.error('[shopify-sync] REST API Fallback failed catastrophically:', e);
                }
            }
            // ------------------------------------------

            return res.status(200).json({ success: true, draftOrder: resultDraft, __debugInput: input });
        }

        // ── ACTION: check-draft-status ──
        if (action === 'check-draft-status') {
            const query = `
                query getDraftOrderStatus($id: ID!) {
                    draftOrder(id: $id) {
                        id
                        name
                        status
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
                return res.status(404).json({ success: false, error: 'Draft order not found in Shopify' });
            }
            return res.status(200).json({ success: true, status: draftOrder.status, name: draftOrder.name });
        }

        return res.status(400).json({ error: `Unknown action: ${action}` });

    } catch (err) {
        console.error('Shopify proxy error:', err);
        return res.status(500).json({ success: false, error: err.message });
    }
}
