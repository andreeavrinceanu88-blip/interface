// Unified SIP Client Factory
// Switches between DIDLogic (default) and Telnyx (backup) seamlessly

export type SipProviderType = 'didlogic' | 'telnyx';

export const getSipProvider = (): SipProviderType => {
    if (typeof window === 'undefined') return 'didlogic';
    const saved = localStorage.getItem('sip_provider');
    if (saved === 'telnyx' || saved === 'didlogic') {
        return saved as SipProviderType;
    }
    // Default is DIDLogic
    return 'didlogic';
};

export const setSipProvider = (provider: SipProviderType) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem('sip_provider', provider);
    window.dispatchEvent(new CustomEvent('sip_provider_changed', { detail: provider }));
};

export const getSipClient = async (providerOverride?: SipProviderType): Promise<any> => {
    const provider = providerOverride || getSipProvider();
    console.log(`[SIP] Loading client for provider: ${provider.toUpperCase()}`);

    if (provider === 'telnyx') {
        const { getTelnyxClient } = await import('./telnyxClient');
        return getTelnyxClient();
    } else {
        const { getDidlogicClient } = await import('./didlogicClient');
        return getDidlogicClient();
    }
};

export const resetSipClients = async () => {
    try {
        const { resetDidlogicClient } = await import('./didlogicClient');
        resetDidlogicClient();
    } catch (e) {}
};

/**
 * Normalizes phone numbers specifically for each SIP provider:
 * - DIDLogic: pure international digits starting with country code 40 (e.g. 40735548486), NO leading '+' or '0'.
 * - Telnyx: international E.164 with '+' (e.g. +40735548486).
 */
export function normalizePhoneForProvider(input: string, provider: SipProviderType): string {
    if (!input) return '';
    let cleaned = input.replace(/[^\d+]/g, '');

    // Strip leading 00 if international format (e.g. 00407... -> 407...)
    if (cleaned.startsWith('00')) cleaned = cleaned.slice(2);

    // If starts with +40, strip +
    if (cleaned.startsWith('+40')) cleaned = cleaned.slice(1);
    // If starts with 400 and 12 digits (e.g. +40 07... entered with extra 0) -> strip extra 0
    if (cleaned.startsWith('400') && cleaned.length === 12) cleaned = '40' + cleaned.slice(3);
    // If starts with 07 and 10 digits (e.g. 0735548486) -> 40735548486
    else if (cleaned.startsWith('07') && cleaned.length === 10) cleaned = '40' + cleaned.slice(1);
    // If starts with 0 and 10 digits (e.g. 021, 031 landline) -> 40 + without leading 0
    else if (cleaned.startsWith('0') && cleaned.length === 10) cleaned = '40' + cleaned.slice(1);
    // If 9 digits starting with 7 (e.g. 735548486) -> 40735548486
    else if (cleaned.startsWith('7') && cleaned.length === 9) cleaned = '40' + cleaned;
    // Strip any lingering +
    cleaned = cleaned.replace(/^\+/, '');

    if (provider === 'didlogic') {
        return cleaned; // 40735548486
    } else {
        return '+' + cleaned; // +40735548486
    }
}
