// Shopify sync service — calls Vercel serverless function /api/shopify-sync
// This avoids CORS by letting the server handle Shopify API calls

const API_ENDPOINT = '/api/shopify-sync';

export async function syncOrderStatusWithShopify(storeName: string, orderId: string, status: string, additionalNote?: string): Promise<boolean> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-status',
                storeName,
                orderId,
                status,
                note: additionalNote,
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log('Shopify status sync success');
            return true;
        } else {
            console.error('Shopify status sync failed:', data);
            return false;
        }
    } catch (err) {
        console.error('Shopify status sync error:', err);
        return false;
    }
}

export async function syncOrderAddressWithShopify(storeName: string, orderId: string, newAddress: string): Promise<boolean> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-address',
                storeName,
                orderId,
                address: newAddress,
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log('Shopify address sync success');
            return true;
        } else {
            console.error('Shopify address sync failed:', data);
            return false;
        }
    } catch (err) {
        console.error('Shopify address sync error:', err);
        return false;
    }
}

export async function syncOrderNoteWithShopify(storeName: string, orderId: string, noteText: string): Promise<boolean> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-note',
                storeName,
                orderId,
                note: noteText,
            })
        });
        const data = await res.json();
        if (data.success) {
            console.log('Shopify note sync success');
            return true;
        } else {
            console.error('Shopify note sync failed:', data);
            return false;
        }
    } catch (err) {
        console.error('Shopify note sync error:', err);
        return false;
    }
}
