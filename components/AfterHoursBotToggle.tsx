import React, { useState, useRef, useEffect } from 'react';
import { useTelnyx } from '../contexts/TelnyxContext';
import { AfterHoursMode } from '../lib/afterHoursBot';

export default function AfterHoursBotToggle() {
    const { afterHoursMode, setAfterHoursMode, isRobotActive } = useTelnyx();
    const [isOpen, setIsOpen] = useState(false);
    const [isPlayingPreview, setIsPlayingPreview] = useState(false);
    const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const toggleAudioPreview = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (isPlayingPreview) {
            if (audioPreviewRef.current) {
                audioPreviewRef.current.pause();
                audioPreviewRef.current.currentTime = 0;
            }
            setIsPlayingPreview(false);
        } else {
            if (!audioPreviewRef.current) {
                audioPreviewRef.current = new Audio('/audio/after-hours.mp3');
                audioPreviewRef.current.onerror = () => {
                    if (audioPreviewRef.current && audioPreviewRef.current.src.endsWith('.mp3')) {
                        audioPreviewRef.current.src = '/audio/after-hours.wav';
                    }
                };
                audioPreviewRef.current.onended = () => setIsPlayingPreview(false);
            }
            audioPreviewRef.current.currentTime = 0;
            audioPreviewRef.current.play().then(() => {
                setIsPlayingPreview(true);
            }).catch(err => {
                console.warn('Audio preview play error:', err);
                setIsPlayingPreview(false);
            });
        }
    };

    const handleSelectMode = (mode: AfterHoursMode) => {
        setAfterHoursMode(mode);
        setIsOpen(false);
    };

    // Status pill styling & labels
    const getBadgeConfig = () => {
        if (afterHoursMode === 'on') {
            return {
                bg: 'bg-purple-500/15 border-purple-500/40 text-purple-300 hover:bg-purple-500/25',
                dot: 'bg-purple-400 animate-pulse shadow-[0_0_8px_rgba(168,85,247,0.8)]',
                icon: 'smart_toy',
                label: 'Robot Activ (Manual)',
                sub: 'Răspunde automat la toate apelurile'
            };
        }
        if (afterHoursMode === 'auto') {
            if (isRobotActive) {
                return {
                    bg: 'bg-indigo-500/15 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/25',
                    dot: 'bg-indigo-400 animate-pulse shadow-[0_0_8px_rgba(99,102,241,0.8)]',
                    icon: 'nightlight_round',
                    label: 'Robot Auto (18:00+ Activ)',
                    sub: 'Activ după program & weekend'
                };
            }
            return {
                bg: 'bg-cyan-500/10 border-cyan-500/30 text-cyan-300 hover:bg-cyan-500/20',
                dot: 'bg-cyan-400',
                icon: 'schedule',
                label: 'Robot Auto (Zi: Operator)',
                sub: 'Activ doar după ora 18:00'
            };
        }
        return {
            bg: 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10',
            dot: 'bg-emerald-400',
            icon: 'support_agent',
            label: 'Robot: Inactiv (Operator)',
            sub: 'Operatorii răspund manual la apeluri'
        };
    };

    const config = getBadgeConfig();

    return (
        <div className="relative inline-block" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`flex items-center gap-2 px-3 py-1.5 md:py-2 rounded-xl border text-xs font-medium transition-all ${config.bg}`}
                title="Configurare Robot Apeluri În Afara Programului"
            >
                <span className={`w-2 h-2 rounded-full ${config.dot}`} />
                <span className="material-icons-round text-base">{config.icon}</span>
                <span className="hidden sm:inline font-semibold">{config.label}</span>
                <span className="material-icons-round text-sm opacity-70">arrow_drop_down</span>
            </button>

            {/* Dropdown Menu */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-[#13141f] border border-white/15 rounded-2xl shadow-2xl p-3 z-50 animate-fadeIn backdrop-blur-xl">
                    <div className="px-2 py-1.5 mb-2 border-b border-white/10 flex items-center justify-between">
                        <div>
                            <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                                <span className="material-icons-round text-sm text-cyan-400">smart_toy</span>
                                Robot Apeluri Inbound
                            </h4>
                            <p className="text-[11px] text-gray-400 mt-0.5">Control manual sau automat după ora 18:00</p>
                        </div>
                        <button
                            onClick={toggleAudioPreview}
                            className={`p-1.5 rounded-lg border text-[11px] flex items-center gap-1 transition-colors ${isPlayingPreview ? 'bg-amber-500/20 border-amber-500/40 text-amber-300' : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'}`}
                            title={isPlayingPreview ? 'Oprește muzica de fundal' : 'Ascultă muzica de fundal'}
                        >
                            <span className="material-icons-round text-sm">{isPlayingPreview ? 'stop' : 'volume_up'}</span>
                            <span className="text-[10px] font-mono">{isPlayingPreview ? 'Stop' : 'Test Audio'}</span>
                        </button>
                    </div>

                    <div className="space-y-1.5">
                        {/* Option 1: Inactive (Manual Operator) */}
                        <button
                            onClick={() => handleSelectMode('off')}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 ${afterHoursMode === 'off' ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200 shadow-[0_0_12px_rgba(16,185,129,0.15)]' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                        >
                            <span className="material-icons-round text-lg mt-0.5 text-emerald-400">support_agent</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white">Inactiv (Operator)</span>
                                    {afterHoursMode === 'off' && <span className="material-icons-round text-emerald-400 text-sm">check_circle</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">Apelurile sună pe căști și operatorul răspunde manual.</p>
                            </div>
                        </button>

                        {/* Option 2: Active ON (Manual Force Robot) */}
                        <button
                            onClick={() => handleSelectMode('on')}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 ${afterHoursMode === 'on' ? 'bg-purple-500/15 border-purple-500/40 text-purple-200 shadow-[0_0_12px_rgba(168,85,247,0.15)]' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                        >
                            <span className="material-icons-round text-lg mt-0.5 text-purple-400">smart_toy</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white">Activ Acum (Manual ON)</span>
                                    {afterHoursMode === 'on' && <span className="material-icons-round text-purple-400 text-sm">check_circle</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">Răspunde instantaneu clientului, redă muzica și nu deranjează operatorii.</p>
                            </div>
                        </button>

                        {/* Option 3: Auto Schedule (outside 09:00 - 18:00) */}
                        <button
                            onClick={() => handleSelectMode('auto')}
                            className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-3 ${afterHoursMode === 'auto' ? 'bg-cyan-500/15 border-cyan-500/40 text-cyan-200 shadow-[0_0_12px_rgba(6,182,212,0.15)]' : 'bg-white/5 border-transparent hover:bg-white/10 text-gray-300'}`}
                        >
                            <span className="material-icons-round text-lg mt-0.5 text-cyan-400">schedule</span>
                            <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-white">Automat (18:00 - 09:00 & Weekend)</span>
                                    {afterHoursMode === 'auto' && <span className="material-icons-round text-cyan-400 text-sm">check_circle</span>}
                                </div>
                                <p className="text-[11px] text-gray-400 mt-0.5">Ziua răspund operatorii. După 18:00 și în weekend preia robotul automat.</p>
                            </div>
                        </button>
                    </div>

                    <div className="mt-2.5 pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-gray-400 font-mono px-1">
                        <span>Stare apel curent:</span>
                        <span className={`font-bold px-1.5 py-0.5 rounded ${isRobotActive ? 'bg-purple-500/20 text-purple-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
                            {isRobotActive ? 'ROBOT PREIA APELURILE' : 'OPERATOR PE TURĂ'}
                        </span>
                    </div>
                </div>
            )}
        </div>
    );
}
