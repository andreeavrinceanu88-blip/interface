import React, { useState, useRef, useEffect } from 'react';

// ─── Types ────────────────────────────────────────────────────────────────────
interface TelnyxRecord {
    id: string;
    record_type: string;
    call_leg_id: string;
    call_session_id: string;
    cld: string;
    cli: string;
    started_at: string;
    finished_at: string;
    duration_secs: number | null;
    billing_duration_secs: number | null;
    status: string;
    direction: string;
    hangup_cause: string | null;
    call_cost: { cost: string; currency: string } | null;
    tags: string[] | null;
}

interface TelnyxResponse {
    data: TelnyxRecord[];
    meta?: { page_number: number; page_size: number; page_token?: string; total_results?: number };
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatPhone(raw: string): string {
    const cleaned = raw.trim().replace(/\s+/g, '').replace(/-/g, '');
    if (!cleaned) return '';
    // Already international
    if (cleaned.startsWith('+')) return cleaned;
    // Romanian local format: 07xxx or 08xxx → +407xxx
    if (/^0[0-9]/.test(cleaned)) return `+40${cleaned.slice(1)}`;
    // Starts with country code without +, e.g. 407xxx
    if (cleaned.startsWith('40')) return `+${cleaned}`;
    // Fallback: just prepend +
    return `+${cleaned}`;
}

function formatDuration(secs: number | null): string {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatDateTime(iso: string | null | undefined): string {
    if (!iso) return '—';
    try {
        return new Date(iso).toLocaleString('ro-RO', {
            day: '2-digit', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', second: '2-digit',
        });
    } catch {
        return iso;
    }
}

function statusColor(status: string): string {
    const s = (status || '').toLowerCase();
    if (s === 'answered') return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    if (s === 'no_answer' || s === 'no-answer') return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
    if (s === 'busy') return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    if (s === 'failed' || s === 'rejected') return 'bg-red-500/10 text-red-400 border-red-500/20';
    return 'bg-gray-500/10 text-gray-400 border-gray-500/20';
}

function directionIcon(dir: string): string {
    const d = (dir || '').toLowerCase();
    if (d === 'inbound') return 'call_received';
    if (d === 'outbound') return 'call_made';
    return 'swap_horiz';
}

function hangupLabel(cause: string | null): string {
    if (!cause) return '—';
    return cause.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function todayISO(): string {
    return new Date().toISOString().split('T')[0];
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function VerificareApeluri() {
    const [phoneInput, setPhoneInput] = useState('');
    const [startDate, setStartDate] = useState(todayISO());
    const [endDate, setEndDate] = useState(todayISO());
    const [loading, setLoading] = useState(false);
    const [records, setRecords] = useState<TelnyxRecord[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [searched, setSearched] = useState('');
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => { inputRef.current?.focus(); }, []);

    async function handleSearch() {
        const phone = formatPhone(phoneInput);
        if (!phone) return;

        setLoading(true);
        setError(null);
        setRecords(null);
        setSearched(phone);
        setExpandedId(null);
        setPage(1);

        try {
            const encodedPhone = encodeURIComponent(phone);

            // Build date filter params — Telnyx accepts ISO 8601 datetimes
            const startISO = encodeURIComponent(`${startDate}T00:00:00Z`);
            const endISO   = encodeURIComponent(`${endDate}T23:59:59Z`);

            const url = `/telnyx-proxy?filter[record_type]=call-control&filter[cld]=${encodedPhone}&filter[started_at][gte]=${startISO}&filter[finished_at][lte]=${endISO}&page[size]=100`;

            const res = await fetch(url);
            if (!res.ok) {
                const text = await res.text();
                throw new Error(`HTTP ${res.status}: ${text}`);
            }
            const json: TelnyxResponse = await res.json();
            setRecords(json.data ?? []);
        } catch (err: any) {
            setError(err?.message || 'Eroare necunoscută');
        } finally {
            setLoading(false);
        }
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        if (e.key === 'Enter') handleSearch();
    }

    const [page, setPage] = useState(1);
    const pageSize = 10;

    const hasResults = records !== null;
    const count = records?.length ?? 0;
    const totalPages = Math.ceil(count / pageSize);
    const pageRecords = records?.slice((page - 1) * pageSize, page * pageSize) ?? [];

    return (
        <div className="space-y-6">
            {/* ── Page header ── */}
            <div>
                <h2 className="text-3xl font-light text-white mb-1 tracking-tight">Verificare Apeluri</h2>

            </div>

            {/* ── Search card ── */}
            <div className="card-depth p-6 rounded-2xl border border-white/5 space-y-4">
                {/* Phone input row */}
                <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">
                        Număr de telefon (CLD)
                    </label>
                    <div className="flex gap-3 items-center">
                        <div className="flex-1 relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 material-icons-round text-gray-500 text-xl pointer-events-none">
                                phone
                            </span>
                            <input
                                ref={inputRef}
                                type="tel"
                                value={phoneInput}
                                onChange={e => setPhoneInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Ex: +40735548486 sau 40735548486"
                                className="w-full pl-12 pr-4 py-3.5 bg-[#13141a] border border-white/5 rounded-xl text-sm focus:outline-none focus:ring-1 focus:ring-primary/50 text-gray-200 placeholder:text-gray-600 transition-all"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            disabled={loading || !phoneInput.trim()}
                            className="flex items-center gap-2 px-6 py-3.5 rounded-xl text-sm font-medium bg-primary/20 border border-primary/30 text-primary-light hover:bg-primary/30 hover:text-white transition-all disabled:opacity-40 disabled:pointer-events-none"
                        >
                            {loading ? (
                                <>
                                    <span className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                    Se caută...
                                </>
                            ) : (
                                <>
                                    <span className="material-icons-round text-base">search</span>
                                    Caută
                                </>
                            )}
                        </button>
                    </div>
                </div>

                {/* Date range row */}
                <div>
                    <label className="block text-xs text-gray-500 uppercase tracking-widest font-medium mb-3">
                        Interval de date
                    </label>
                    <div className="flex items-center gap-3 bg-[#13141a] px-4 py-3 rounded-xl border border-white/5 w-fit">
                        <span className="material-icons-round text-gray-500 text-sm">calendar_today</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none"
                        />
                        <span className="text-gray-600">—</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={e => setEndDate(e.target.value)}
                            className="bg-transparent text-gray-200 text-sm border-none focus:ring-0 cursor-pointer outline-none"
                        />
                    </div>
                </div>
            </div>

            {/* ── Error ── */}
            {error && (
                <div className="flex items-start gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    <span className="material-icons-round text-base mt-0.5 flex-shrink-0">error_outline</span>
                    <div>
                        <p className="font-medium">Eroare la interogare</p>
                        <p className="text-red-400/70 text-xs mt-0.5 font-mono">{error}</p>
                    </div>
                </div>
            )}

            {/* ── Loading shimmer ── */}
            {loading && (
                <div className="card-depth p-6 rounded-2xl border border-white/5 space-y-4 animate-pulse">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="h-16 rounded-xl bg-white/5" />
                    ))}
                </div>
            )}

            {/* ── Results ── */}
            {!loading && hasResults && (
                <div className="space-y-3">
                    {/* Summary bar */}
                    <div className="flex items-center justify-between px-1">
                        <p className="text-sm text-gray-400">
                            <span className="font-medium text-white">{count}</span> înregistrări găsite pentru{' '}
                            <span className="font-mono text-primary">{searched}</span>
                        </p>
                        {count > 0 && (
                            <span className="text-[11px] text-gray-600 italic">Afișare {Math.min((page - 1) * pageSize + 1, count)}–{Math.min(page * pageSize, count)} din {count}</span>
                        )}
                    </div>

                    {count === 0 ? (
                        <div className="card-depth p-12 rounded-2xl border border-white/5 text-center">
                            <span className="material-icons-round text-5xl text-gray-700 mb-3 block">search_off</span>
                            <p className="text-gray-500 font-light">
                                Nu s-au găsit apeluri pentru <span className="font-mono text-gray-400">{searched}</span> în intervalul selectat
                            </p>
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {pageRecords.map((rec) => {
                                const isExpanded = expandedId === rec.id;
                                return (
                                    <div
                                        key={rec.id}
                                        className="card-depth rounded-xl border border-white/5 overflow-hidden"
                                    >
                                        {/* ── Row summary ── */}
                                        <button
                                            className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-white/5 transition-colors"
                                            onClick={() => setExpandedId(isExpanded ? null : rec.id)}
                                        >
                                            {/* Direction icon */}
                                            <span
                                                className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${
                                                    (rec.direction || '').toLowerCase() === 'inbound'
                                                        ? 'bg-blue-500/10 text-blue-400'
                                                        : 'bg-purple-500/10 text-purple-400'
                                                }`}
                                            >
                                                <span className="material-icons-round text-base">
                                                    {directionIcon(rec.direction)}
                                                </span>
                                            </span>

                                            {/* Started at */}
                                            <div className="w-48 flex-shrink-0">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Început</p>
                                                <p className="text-sm text-gray-200 font-num">{formatDateTime(rec.started_at)}</p>
                                            </div>

                                            {/* Finished at */}
                                            <div className="w-48 flex-shrink-0 hidden md:block">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Sfârșit</p>
                                                <p className="text-sm text-gray-200 font-num">{formatDateTime(rec.finished_at)}</p>
                                            </div>

                                            {/* CLI */}
                                            <div className="flex-1 min-w-0">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">De la</p>
                                                <p className="text-sm text-gray-200 font-num truncate">{rec.cli || '—'}</p>
                                            </div>

                                            {/* Duration */}
                                            <div className="w-24 flex-shrink-0 hidden sm:block">
                                                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Durată</p>
                                                <p className="text-sm text-gray-200 font-num">{formatDuration(rec.duration_secs)}</p>
                                            </div>

                                            {/* Status badge */}
                                            <div className="flex-shrink-0">
                                                <span className={`px-2.5 py-1 rounded-lg text-[11px] border font-medium ${statusColor(rec.status)}`}>
                                                    {rec.status || 'unknown'}
                                                </span>
                                            </div>

                                            {/* Cost */}
                                            {rec.call_cost && (
                                                <div className="w-20 flex-shrink-0 hidden lg:block text-right">
                                                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide">Cost</p>
                                                    <p className="text-sm text-gray-200 font-num">
                                                        {rec.call_cost.cost} {rec.call_cost.currency}
                                                    </p>
                                                </div>
                                            )}

                                            {/* Detalii button */}
                                            <span
                                                onClick={e => e.stopPropagation()}
                                                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/5 border border-white/10 text-gray-400 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all cursor-pointer select-none"
                                            >
                                                Detalii
                                            </span>

                                            {/* Expand chevron */}
                                            <span
                                                className={`material-icons-round text-gray-600 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-180' : ''}`}
                                            >
                                                expand_more
                                            </span>
                                        </button>

                                        {/* ── Expanded details ── */}
                                        {isExpanded && (
                                            <div className="border-t border-white/5 px-5 py-5 bg-black/20 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-5">
                                                <DetailItem label="Început (started_at)" value={formatDateTime(rec.started_at)} />
                                                <DetailItem label="Sfârșit (finished_at)" value={formatDateTime(rec.finished_at)} />
                                                <DetailItem label="Durată (secunde)" value={rec.duration_secs != null ? String(rec.duration_secs) : '—'} />
                                                <DetailItem label="Durată facturabilă" value={rec.billing_duration_secs != null ? String(rec.billing_duration_secs) : '—'} />
                                                <DetailItem label="CLD (destinatar)" value={rec.cld} mono />
                                                <DetailItem label="CLI (apelant)" value={rec.cli} mono />
                                                <DetailItem label="Direcție" value={rec.direction} />
                                                <DetailItem label="Status" value={rec.status} />
                                                <DetailItem label="Cauza închiderii" value={hangupLabel(rec.hangup_cause)} />
                                                <DetailItem label="Call Leg ID" value={rec.call_leg_id} mono />
                                                <DetailItem label="Session ID" value={rec.call_session_id} mono />
                                                {rec.call_cost && (
                                                    <DetailItem
                                                        label="Cost apel"
                                                        value={`${rec.call_cost.cost} ${rec.call_cost.currency}`}
                                                    />
                                                )}
                                                {rec.tags && rec.tags.length > 0 && (
                                                    <div className="col-span-2 sm:col-span-3 lg:col-span-4 space-y-1">
                                                        <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">Tags</p>
                                                        <div className="flex flex-wrap gap-2">
                                                            {rec.tags.map(tag => (
                                                                <span key={tag} className="px-2 py-0.5 rounded-lg text-[11px] border bg-primary/10 text-primary border-primary/20 font-medium">
                                                                    {tag}
                                                                </span>
                                                            ))}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Pagination bar */}
                        {totalPages > 1 && (
                            <div className="flex justify-between items-center px-1 pt-2">
                                <p className="text-xs text-gray-500 italic font-light">
                                    Pagina {page} din {totalPages} &nbsp;&middot;&nbsp; {count} înregistrări totale
                                </p>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => { setPage(p => Math.max(1, p - 1)); setExpandedId(null); }}
                                        disabled={page === 1}
                                        className="w-9 h-9 btn-3d-secondary rounded-xl disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                    >
                                        <span className="material-icons-round">chevron_left</span>
                                    </button>
                                    <div className="px-4 flex items-center text-xs text-gray-400 font-num bg-white/5 rounded-xl border border-white/5">
                                        {page} / {totalPages}
                                    </div>
                                    <button
                                        onClick={() => { setPage(p => Math.min(totalPages, p + 1)); setExpandedId(null); }}
                                        disabled={page >= totalPages}
                                        className="w-9 h-9 btn-3d-secondary rounded-xl disabled:opacity-30 disabled:pointer-events-none flex items-center justify-center"
                                    >
                                        <span className="material-icons-round">chevron_right</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    )}
                </div>
            )}

            {/* ── Empty state (before first search) ── */}
            {!loading && !hasResults && !error && (
                <div className="flex flex-col items-center justify-center py-20 text-center opacity-60">
                    <span className="material-icons-round text-6xl text-gray-700 mb-4 p-4 rounded-full bg-surface-dark-lighter border border-white/5">
                        fact_check
                    </span>
                    <h3 className="text-xl font-light text-white mb-1">Introduceți un număr de telefon</h3>
                    <p className="text-gray-500 max-w-sm font-light text-sm">
                        Selectați intervalul de date și introduceți numărul cu prefix internațional (ex: +40...) pentru a vedea istoricul apelurilor.
                    </p>
                </div>
            )}
        </div>
    );
}

// ─── Helper component ─────────────────────────────────────────────────────────
function DetailItem({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
    return (
        <div className="space-y-0.5">
            <p className="text-[10px] text-gray-600 uppercase tracking-widest font-medium">{label}</p>
            <p className={`text-sm text-gray-300 break-all ${mono ? 'font-mono text-xs text-gray-400' : ''}`}>
                {value || '—'}
            </p>
        </div>
    );
}
