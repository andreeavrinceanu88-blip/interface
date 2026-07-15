const SHOPIFY_URL = 'https://k7agxh-7y.myshopify.com';
const CLIENT_ID = import.meta.env.VITE_SHOPIFY_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_SHOPIFY_CLIENT_SECRET;
const API_VERSION = '2026-01';

async function getAccessToken() {
    const res = await fetch(`${SHOPIFY_URL}/admin/oauth/access_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            grant_type: 'client_credentials'
        })
    });
    const data = await res.json();
    if (!data.access_token) {
        throw new Error('Failed to obtain Shopify access token');
    }
    return data.access_token;
}

export async function syncOrderStatusWithShopify(draftOrderId: string, status: string, additionalNote?: string) {
    try {
        const token = await getAccessToken();
        const headers = {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': token,
        };
        const graphqlUrl = `${SHOPIFY_URL}/admin/api/${API_VERSION}/graphql.json`;

        // Format ID
        const gid = draftOrderId.includes('gid://') ? draftOrderId : `gid://shopify/DraftOrder/${draftOrderId}`;

        // 1. Get current tags and note
        const getQuery = `
            query getDraftOrder($id: ID!) {
                draftOrder(id: $id) {
                    id
                    tags
                    note
                }
            }
        `;
        const getRes = await fetch(graphqlUrl, {
            method: 'POST',
            headers,
            body: JSON.stringify({ query: getQuery, variables: { id: gid } })
        });
        const getData = await getRes.json();
        const draftOrder = getData?.data?.draftOrder;
        if (!draftOrder) {
            console.error('Draft order not found in Shopify', getData);
            return false;
        }

        const currentTags: string[] = draftOrder.tags || [];
        const statusTag = status.toUpperCase();

        // 2. Update Draft Order (append tag and note)
        const updatedTags = [...currentTags];
        if (!updatedTags.includes(statusTag)) {
            updatedTags.push(statusTag);
        }

        let newNote = draftOrder.note ? draftOrder.note + '\n' : '';
        newNote += `[Status platformă: ${statusTag}]`;
        if (additionalNote) {
            newNote += ` - ${additionalNote}`;
        }

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
                    input: {
                        tags: updatedTags,
                        note: newNote
                    }
                }
            })
        });

        // 3. Complete Draft Order if "confirmat"
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
                    variables: {
                        id: gid,
                        paymentPending: true
                    }
                })
            });
        }

        return true;
    } catch (err) {
        console.error('Shopify Sync Error:', err);
        return false;
    }
}
