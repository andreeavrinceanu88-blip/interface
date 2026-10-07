// After-Hours Call Robot Management
// Allows manual toggle (ON/OFF) or automated schedule (outside 09:00 - 18:00 RO time & weekends)

export type AfterHoursMode = 'off' | 'on' | 'auto';

const STORAGE_KEY = 'after_hours_bot_mode';
const EVENT_NAME = 'after_hours_bot_mode_changed';

/**
 * Returns current configured mode:
 * - 'off': Robot is completely disabled. Operators answer manually.
 * - 'on': Robot is manually forced ON. Inbound calls are answered automatically with hold music.
 * - 'auto': Robot activates automatically outside 09:00 - 18:00 (Romania time) and all day on weekends.
 */
export const getAfterHoursMode = (): AfterHoursMode => {
    if (typeof window === 'undefined') return 'off';
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'off' || saved === 'on' || saved === 'auto') {
        return saved as AfterHoursMode;
    }
    // Default to 'off' so nothing is forced until user enables it
    return 'off';
};

export const setAfterHoursMode = (mode: AfterHoursMode) => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(STORAGE_KEY, mode);
    window.dispatchEvent(new CustomEvent(EVENT_NAME, { detail: mode }));
};

/**
 * Returns true if the robot is currently active right now.
 */
export const isAfterHoursActiveNow = (): boolean => {
    const mode = getAfterHoursMode();
    if (mode === 'on') return true;
    if (mode === 'off') return false;

    // Mode is 'auto': Check Romanian local time (Europe/Bucharest)
    try {
        const roDateStr = new Date().toLocaleString('en-US', { timeZone: 'Europe/Bucharest' });
        const roDate = new Date(roDateStr);
        const day = roDate.getDay(); // 0 = Sunday, 6 = Saturday
        const hour = roDate.getHours();

        // Weekend: active all day
        if (day === 0 || day === 6) return true;

        // Weekday: active before 09:00 or at/after 18:00
        if (hour >= 18 || hour < 9) return true;

        return false;
    } catch (e) {
        // Fallback to local machine time if timezone lookup fails
        const now = new Date();
        const day = now.getDay();
        const hour = now.getHours();
        if (day === 0 || day === 6) return true;
        if (hour >= 18 || hour < 9) return true;
        return false;
    }
};

/**
 * Audio Stream Helper:
 * Creates a MediaStream that streams the audio file (/audio/after-hours.wav)
 * into a WebRTC peer connection so the remote caller hears it clearly.
 */
class BotAudioPlayer {
    private audioCtx: AudioContext | null = null;
    private audioEl: HTMLAudioElement | null = null;
    private mediaStream: MediaStream | null = null;
    private sourceNode: MediaElementAudioSourceNode | null = null;

    prepare(): { stream: MediaStream | null; play: () => Promise<void>; stop: () => void } {
        try {
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            this.audioCtx = new AudioContextClass();
            const dest = this.audioCtx.createMediaStreamDestination();

            this.audioEl = new Audio('/audio/after-hours.wav');
            this.audioEl.crossOrigin = 'anonymous';
            this.audioEl.loop = false;

            this.sourceNode = this.audioCtx.createMediaElementSource(this.audioEl);
            this.sourceNode.connect(dest);

            this.mediaStream = dest.stream;

            const play = async () => {
                if (this.audioCtx && this.audioCtx.state === 'suspended') {
                    await this.audioCtx.resume();
                }
                if (this.audioEl) {
                    await this.audioEl.play().catch(e => console.warn('[BotAudioPlayer] Play error:', e));
                }
            };

            const stop = () => {
                try {
                    if (this.audioEl) {
                        this.audioEl.pause();
                        this.audioEl.currentTime = 0;
                    }
                    if (this.audioCtx && this.audioCtx.state !== 'closed') {
                        this.audioCtx.close();
                    }
                } catch (e) {}
            };

            return { stream: this.mediaStream, play, stop };
        } catch (err) {
            console.error('[BotAudioPlayer] Failed to initialize Web Audio player:', err);
            return {
                stream: null,
                play: async () => {},
                stop: () => {}
            };
        }
    }
}

export const createBotAudioPlayer = () => new BotAudioPlayer();
