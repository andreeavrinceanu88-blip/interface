// Shopify sync service — calls Vercel serverless function /api/shopify-sync
// This avoids CORS by letting the server handle Shopify API calls

const API_ENDPOINT = '/api/shopify-sync';

export interface ShopifySyncResult {
    success: boolean;
    confirmed?: boolean;
    orderName?: string | null;
    orderTotal?: string | null;
    currency?: string;
    tags?: string[];
    note?: string;
    errors?: any[];
    errorMessage?: string;
    raw?: any;
}

export async function syncOrderStatusWithShopify(storeName: string, orderId: string, status: string, additionalNote?: string): Promise<ShopifySyncResult> {
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
            console.log('Shopify status sync success', data);
            return data;
        } else {
            console.error('Shopify status sync failed:', data);
            return data; // Return full data object containing error details
        }
    } catch (err: any) {
        console.error('Shopify status sync error:', err);
        return { success: false, errorMessage: err.message, raw: err };
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

export interface ShopifyLineItem {
    id: string;
    title: string;
    quantity: number;
    variantId: string | null;
    variantTitle: string | null;
    price: string;
    currency: string;
}

export async function getShopifyLineItems(storeName: string, orderId: string): Promise<ShopifyLineItem[] | null> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get-line-items',
                storeName,
                orderId,
            })
        });
        const data = await res.json();
        if (data.success) {
            return data.lineItems;
        } else {
            console.error('Failed to get line items:', data);
            return null;
        }
    } catch (err) {
        console.error('Error getting line items:', err);
        return null;
    }
}

export async function updateShopifyLineItemQuantity(
    storeName: string,
    orderId: string,
    lineItems: { variantId: string; quantity: number }[]
): Promise<ShopifyLineItem[] | null> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-line-item-quantity',
                storeName,
                orderId,
                lineItems,
            })
        });
        const data = await res.json();
        if (data.success) {
            return data.lineItems;
        } else {
            console.error('Failed to update line items:', data);
            return null;
        }
    } catch (err) {
        console.error('Error updating line items:', err);
        return null;
    }
}

// Returns a map of productId -> imageUrl
export async function getProductImages(storeName: string, productIds: number[]): Promise<Record<string, string | null> | null> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'get-product-images',
                storeName,
                productIds,
            })
        });
        const data = await res.json();
        if (data.success) {
            return data.images;
        } else {
            console.error('Failed to get product images:', data);
            return null;
        }
    } catch (err) {
        console.error('Error getting product images:', err);
        return null;
    }
}

export async function getAllProducts(storeName: string): Promise<any[] | null> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'get-all-products', storeName })
        });
        const data = await res.json();
        if (data.success) {
            return data.products;
        }
        console.error('Failed to get all products:', data);
        return null;
    } catch (err) {
        console.error('Error in getAllProducts:', err);
        return null;
    }
}

export async function updateShopifyLineItemsBulk(storeName: string, orderId: number | string, items: { variant_id: number | string, quantity: number }[]): Promise<any | null> {
    try {
        const res = await fetch(API_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update-draft-order-line-items',
                storeName,
                orderId,
                items
            })
        });
        const data = await res.json();
        if (data.success) {
            return data.draftOrder;
        }
        console.error('Failed to update line items in bulk:', data);
        return null;
    } catch (err) {
        console.error('Error in updateShopifyLineItemsBulk:', err);
        return null;
    }
}
