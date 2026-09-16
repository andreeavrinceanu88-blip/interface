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
