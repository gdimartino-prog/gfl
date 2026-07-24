'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X, FileSearch, TrendingUp, Newspaper, Search } from 'lucide-react';
import { POSITION_GROUPS } from '@/lib/positionGroups';

const FA_CURRENT_YEAR = new Date().getFullYear();
const FA_YEARS = [FA_CURRENT_YEAR - 1, FA_CURRENT_YEAR];
const FA_MONTH = new Date().getMonth() + 1;
const FA_DEFAULT_YEAR = FA_MONTH >= 9 || FA_MONTH === 1 ? FA_CURRENT_YEAR : FA_CURRENT_YEAR - 1;

const FA_POS_COLORS: Record<string, string> = {
  QB: 'bg-blue-100 text-blue-800', RB: 'bg-green-100 text-green-800',
  WR: 'bg-purple-100 text-purple-800', TE: 'bg-yellow-100 text-yellow-800',
  OL: 'bg-slate-100 text-slate-600', DL: 'bg-red-100 text-red-800',
  LB: 'bg-orange-100 text-orange-800', DB: 'bg-pink-100 text-pink-800',
  K: 'bg-teal-100 text-teal-800',
};
const FA_POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K'];

interface FaPlayer {
  id: number;
  name: string;
  espnId: string | null;
  nflTeam: string | null;
  age?: number | null;
  posGroup: string;
  score: number;
}

const RECENT_NEEDS_KEY = 'gfl-scout-recent-needs';
const RECENT_NEEDS_CAP = 5;
type RecentNeed = { text: string; ts: number };

function loadRecentNeeds(): RecentNeed[] {
  try {
    const raw = localStorage.getItem(RECENT_NEEDS_KEY);
    if (!raw) return [];
    const parsed: RecentNeed[] = JSON.parse(raw);
    return parsed
      .filter(e => e && typeof e.text === 'string' && typeof e.ts === 'number')
      .slice(0, RECENT_NEEDS_CAP);
  } catch {
    return [];
  }
}

function saveRecentNeeds(entries: RecentNeed[]) {
  try {
    localStorage.setItem(RECENT_NEEDS_KEY, JSON.stringify(entries.slice(0, RECENT_NEEDS_CAP)));
  } catch { /* quota or disabled */ }
}

type ScoutMode = 'fast' | 'full' | 'copy';
type Meta = { teamName: string; currentRound: number | null; picksUntilNext: number | null; poolSize: number; rosterSize: number; maxAge?: number | null; rookiesOnly?: boolean; mode?: ScoutMode };
type TeamOption = { teamshort: string; team: string };
type RosterPlayerOption = { name: string; position: string | null; age: string | null; last: string | null };
type PageTab = 'draft-scout' | 'player-report' | 'fa-power';

export default function ScoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [needs, setNeeds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [recommendationsHtml, setRecommendationsHtml] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [teamShort, setTeamShort] = useState('');
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [maxAge, setMaxAge] = useState<string>('');
  const [rookiesOnly, setRookiesOnly] = useState(false);
  const [recentNeeds, setRecentNeeds] = useState<RecentNeed[]>([]);
  const [mode, setMode] = useState<ScoutMode>('fast');
  const [copyPromptText, setCopyPromptText] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const role = (session?.user as { role?: string } | undefined)?.role ?? '';
  const isCommissioner = role === 'admin' || role === 'superuser';

  // Page tab
  const [activeTab, setActiveTab] = useState<PageTab>('draft-scout');

  // ESPN news ids
  const [newsIds, setNewsIds] = useState<Set<string>>(new Set());
  useEffect(() => {
    fetch('/api/espn-news')
      .then(r => r.ok ? r.json() : { ids: [] })
      .then(d => setNewsIds(new Set<string>(d.ids ?? [])))
      .catch(() => {});
  }, []);

  // FA Power state
  const [faYear, setFaYear] = useState(FA_DEFAULT_YEAR);
  const [faFilterGroup, setFaFilterGroup] = useState<string | null>(null);
  const [faSearch, setFaSearch] = useState('');
  const [faData, setFaData] = useState<FaPlayer[] | null>(null);
  const [faLoading, setFaLoading] = useState(false);
  const [faError, setFaError] = useState<string | null>(null);

  // Player report state
  const [reportTeamShort, setReportTeamShort] = useState('');
  const [reportRoster, setReportRoster] = useState<RosterPlayerOption[]>([]);
  const [reportRosterLoading, setReportRosterLoading] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState('');
  const [reportMode, setReportMode] = useState<'run' | 'copy'>('run');
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);
  const [reportText, setReportText] = useState<string | null>(null);
  const [reportHtml, setReportHtml] = useState<string | null>(null);
  const [reportCopyPrompt, setReportCopyPrompt] = useState<string | null>(null);
  const [reportCopied, setReportCopied] = useState(false);
  const [bulkCopyPrompt, setBulkCopyPrompt] = useState<string | null>(null);
  const [bulkCopied, setBulkCopied] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);

  useEffect(() => {
    setRecentNeeds(loadRecentNeeds());
  }, []);

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    fetch('/api/teams')
      .then(r => r.json())
      .then((data: TeamOption[]) => {
        if (Array.isArray(data)) {
          setTeamOptions([...data].sort((a, b) => (a.team || a.teamshort).localeCompare(b.team || b.teamshort)));
        }
      })
      .catch(() => { /* ignore — dropdown stays empty, user can re-select */ });
  }, [status]);

  useEffect(() => {
    if (session?.user) {
      const id = (session.user as { id?: string }).id;
      if (id) {
        setTeamShort(id.toUpperCase());
        setReportTeamShort(id.toUpperCase());
      }
    }
  }, [session]);

  const loadFaPower = useCallback(async (year: number) => {
    setFaLoading(true);
    setFaError(null);
    setFaData(null);
    try {
      const r = await fetch(`/api/fa-power?year=${year}`);
      if (!r.ok) throw new Error('Failed to load FA rankings');
      setFaData(await r.json());
    } catch (e) {
      setFaError((e as Error).message);
    } finally {
      setFaLoading(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'fa-power' && status === 'authenticated' && isCommissioner) {
      loadFaPower(faYear);
    }
  }, [activeTab, faYear, status, isCommissioner, loadFaPower]);

  const faFiltered = useMemo(() => {
    if (!faData) return [];
    let list = faFilterGroup ? faData.filter(p => p.posGroup === faFilterGroup) : faData;
    if (faSearch.trim()) {
      const q = faSearch.trim().toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q));
    }
    return list;
  }, [faData, faFilterGroup, faSearch]);

  const faAvailableGroups = useMemo(() => {
    if (!faData) return [];
    const seen = new Set(faData.map(p => p.posGroup));
    return FA_POS_ORDER.filter(g => seen.has(g));
  }, [faData]);

  useEffect(() => {
    if (!reportTeamShort) { setReportRoster([]); setSelectedPlayer(''); return; }
    setReportRosterLoading(true);
    setSelectedPlayer('');
    fetch(`/api/rosters/${encodeURIComponent(reportTeamShort)}`)
      .then(r => r.json())
      .then((data: { roster?: { name: string; position: string | null; age: string | null; last: string | null }[] }) => {
        const arr = Array.isArray(data) ? data : (data?.roster ?? []);
        const sorted = [...arr]
          .filter(p => p.name)
          .sort((a, b) => (a.last ?? a.name).localeCompare(b.last ?? b.name));
        setReportRoster(sorted.map(p => ({ name: p.name, position: p.position ?? null, age: p.age ?? null, last: p.last ?? null })));
      })
      .catch(() => setReportRoster([]))
      .finally(() => setReportRosterLoading(false));
  }, [reportTeamShort]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!needs.trim()) {
      setError('Tell the scout what you need (positions, strategy, etc.)');
      return;
    }
    setLoading(true);
    setError(null);
    setRecommendations(null);
    setRecommendationsHtml(null);
    setCopyPromptText(null);
    setCopied(false);
    setMeta(null);
    try {
      const res = await fetch('/api/scout/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          needs: needs.trim(),
          teamShort: teamShort || undefined,
          positionGroups: selectedGroups,
          maxAge: maxAge ? Number(maxAge) : undefined,
          rookiesOnly,
          mode,
        }),
      });
      const ct = res.headers.get('content-type') || '';

      // copy mode is a normal JSON response — no streaming
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
        if (data.mode === 'copy' && data.promptText) {
          setCopyPromptText(data.promptText);
        } else {
          setRecommendations(data.recommendations);
          setRecommendationsHtml(data.recommendationsHtml || null);
        }
        setMeta(data.meta);
      } else if (ct.includes('application/x-ndjson')) {
        // fast + full modes stream NDJSON line-by-line. Each line is one event:
        //   {type:'start', meta} → set meta chip row right away
        //   {type:'text', value} → append to the in-progress recommendations
        //   {type:'complete', annotated, html} → swap streamed text for the
        //     citation-annotated HTML (inline [[N]] markers + Sources)
        //   {type:'error', error} → bubble up to the error banner
        if (!res.body) throw new Error('Scout response has no body to stream.');
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let sawComplete = false;
        let streamErrorMsg: string | null = null;
        let streamingText = '';
        // Sanity cap so a hostile / buggy upstream that never emits \n can't
        // exhaust client memory by accumulating one giant "line."
        const MAX_BUFFER = 1_000_000;
        const consumeLine = (line: string) => {
          if (!line.trim()) return;
          let event: { type: string; [k: string]: unknown };
          try { event = JSON.parse(line) as { type: string; [k: string]: unknown }; } catch { return; }
          if (event.type === 'start') {
            setMeta(event.meta as Meta);
          } else if (event.type === 'text') {
            streamingText += String(event.value ?? '');
            setRecommendations(streamingText);
          } else if (event.type === 'complete') {
            sawComplete = true;
            setRecommendations(String(event.annotated ?? streamingText));
            setRecommendationsHtml(String(event.html ?? ''));
          } else if (event.type === 'error') {
            streamErrorMsg = String(event.error ?? 'Scout failed mid-stream.');
          }
        };
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          if (buffer.length > MAX_BUFFER) {
            throw new Error('Scout stream exceeded buffer limit — aborting.');
          }
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';
          for (const line of lines) consumeLine(line);
          if (streamErrorMsg) break;
        }
        if (buffer.trim()) consumeLine(buffer);
        if (streamErrorMsg) throw new Error(streamErrorMsg);
        if (!sawComplete && !streamingText) {
          if (res.status === 504) throw new Error('Scout timed out (60s). Try narrowing the position group, lowering the age, or enabling "Rookies only" so there are fewer players to research.');
          throw new Error('Scout ended before producing any output.');
        }
        if (!sawComplete) {
          // Stream ended mid-flight (likely the 60s Vercel cap). Show what
          // we have and tell the user it's partial.
          setError('Scout was cut off at the 60s Vercel cap — showing what streamed. Try Fast mode or narrower filters for a complete response.');
        }
      } else {
        if (res.status === 504) throw new Error('Scout timed out (60s). Try narrowing the position group, lowering the age, or enabling "Rookies only" so there are fewer players to research.');
        throw new Error(`Scout failed with HTTP ${res.status}. Try again in a moment.`);
      }

      const submitted = needs.trim();
      if (submitted) {
        setRecentNeeds(prev => {
          const dedup = prev.filter(e => e.text.toLowerCase() !== submitted.toLowerCase());
          const next = [{ text: submitted, ts: Date.now() }, ...dedup].slice(0, RECENT_NEEDS_CAP);
          saveRecentNeeds(next);
          return next;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  };

  const handlePlayerReport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPlayer) return;
    setReportLoading(true);
    setReportError(null);
    setReportText(null);
    setReportHtml(null);
    setReportCopyPrompt(null);
    setReportCopied(false);
    try {
      const res = await fetch('/api/scout/player-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playerName: selectedPlayer, teamShort: reportTeamShort, mode: reportMode }),
      });
      const ct = res.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const data = await res.json();
        if (!res.ok) throw new Error((data as { error?: string }).error || `Request failed (HTTP ${res.status})`);
        if (data.mode === 'copy' && data.promptText) { setReportCopyPrompt(data.promptText); return; }
      }
      if (!ct.includes('application/x-ndjson')) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { error?: string }).error || `Request failed (HTTP ${res.status})`);
      }
      if (!res.body) throw new Error('No response body');
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let streamingText = '';
      let streamError: string | null = null;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';
        for (const line of lines) {
          if (!line.trim()) continue;
          let ev: { type: string; [k: string]: unknown };
          try { ev = JSON.parse(line); } catch { continue; }
          if (ev.type === 'text') {
            streamingText += String(ev.value ?? '');
            setReportText(streamingText);
          } else if (ev.type === 'complete') {
            setReportText(String(ev.annotated ?? streamingText));
            setReportHtml(String(ev.html ?? ''));
          } else if (ev.type === 'error') {
            streamError = String(ev.error ?? 'Report failed');
          }
        }
        if (streamError) break;
      }
      if (buffer.trim()) {
        try {
          const ev = JSON.parse(buffer) as { type: string; [k: string]: unknown };
          if (ev.type === 'complete') {
            setReportText(String(ev.annotated ?? streamingText));
            setReportHtml(String(ev.html ?? ''));
          }
        } catch { /* ignore */ }
      }
      if (streamError) throw new Error(streamError);
    } catch (err) {
      setReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setReportLoading(false);
    }
  };

  const handleBulkPrompts = async () => {
    if (!reportTeamShort || reportRoster.length === 0) return;
    setBulkLoading(true);
    setReportError(null);
    setBulkCopyPrompt(null);
    setBulkCopied(false);
    setReportText(null);
    setReportHtml(null);
    setReportCopyPrompt(null);
    try {
      const res = await fetch('/api/scout/bulk-player-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ teamShort: reportTeamShort }),
      });
      const data = await res.json() as { error?: string; combinedPrompt?: string; count?: number };
      if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
      setBulkCopyPrompt(data.combinedPrompt ?? '');
    } catch (err) {
      setReportError(err instanceof Error ? err.message : String(err));
    } finally {
      setBulkLoading(false);
    }
  };

  if (status === 'loading') return null;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="text-blue-600" size={28} />
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Scout</h1>
        </div>

        {/* Tab toggle */}
        <div className="mb-8 flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('draft-scout')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'draft-scout'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <Sparkles size={14} />
            Draft Scout
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('player-report')}
            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-colors ${
              activeTab === 'player-report'
                ? 'bg-white text-blue-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            <FileSearch size={14} />
            Player Report
          </button>
          {isCommissioner && (
            <button
              type="button"
              onClick={() => setActiveTab('fa-power')}
              className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-black uppercase tracking-widest transition-colors ${
                activeTab === 'fa-power'
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <TrendingUp size={14} />
              FA Power
            </button>
          )}
        </div>

        {activeTab === 'player-report' ? (
          <div>
            <p className="text-slate-600 text-sm mb-8 max-w-2xl">
              Select a player from your roster to generate a detailed NFL scouting report. Helps you decide whether to keep or cut them. Uses live NFL news — no GFL data.
            </p>

            <form onSubmit={handlePlayerReport} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
              <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Team</label>
              <select
                value={reportTeamShort}
                onChange={(e) => setReportTeamShort(e.target.value)}
                className="mb-5 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
              >
                {teamOptions.length === 0 && <option value={reportTeamShort}>{reportTeamShort || '(loading)'}</option>}
                {teamOptions.map(t => (
                  <option key={t.teamshort} value={t.teamshort.toUpperCase()}>
                    {t.team || t.teamshort} ({t.teamshort})
                  </option>
                ))}
              </select>

              <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Player</label>
              {reportRosterLoading ? (
                <div className="mb-5 flex items-center gap-2 text-sm text-slate-400">
                  <Loader2 size={14} className="animate-spin" /> Loading roster…
                </div>
              ) : (
                <select
                  value={selectedPlayer}
                  onChange={(e) => setSelectedPlayer(e.target.value)}
                  className="mb-5 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
                >
                  <option value="">— select a player —</option>
                  {reportRoster.map(p => (
                    <option key={p.name} value={p.name}>
                      {p.position ? `${p.position} — ` : ''}{p.name}{p.age ? ` (${p.age})` : ''}
                    </option>
                  ))}
                </select>
              )}

              <div className="mt-5 mb-4">
                <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Mode</label>
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                  {([
                    { id: 'run', label: 'Run Report', sub: 'With web search — ~$0.30/call', desc: 'Live NFL news, depth chart, injury status.' },
                    { id: 'copy', label: 'Copy to chat', sub: 'No API call — $0', desc: 'Returns the prompt to paste into gemini.google.com.' },
                  ] as const).map(opt => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setReportMode(opt.id)}
                      className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                        reportMode === opt.id
                          ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                          : 'border-slate-200 bg-white hover:bg-slate-50'
                      }`}
                    >
                      <div className="text-xs font-black uppercase tracking-widest text-slate-700">{opt.label}</div>
                      <div className="text-[10px] font-bold text-slate-500 mt-0.5">{opt.sub}</div>
                      <div className="text-[10px] text-slate-400 mt-1 leading-snug">{opt.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-2 flex-wrap">
                {reportMode === 'copy' && reportRoster.length > 0 && (
                  <button
                    type="button"
                    onClick={handleBulkPrompts}
                    disabled={bulkLoading || reportLoading}
                    className="inline-flex items-center gap-2 bg-slate-700 hover:bg-slate-800 disabled:bg-slate-300 text-white text-sm font-black uppercase tracking-widest px-5 py-3 rounded-xl shadow transition-colors"
                  >
                    {bulkLoading ? (
                      <><Loader2 size={16} className="animate-spin" />Building…</>
                    ) : (
                      <>All {reportRoster.length} Players</>
                    )}
                  </button>
                )}
                <button
                  type="submit"
                  disabled={reportLoading || !selectedPlayer || bulkLoading}
                  className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow transition-colors"
                >
                  {reportLoading ? (
                    <><Loader2 size={16} className="animate-spin" />{reportMode === 'copy' ? 'Building…' : 'Scouting…'}</>
                  ) : reportMode === 'copy' ? (
                    <>Build Prompt</>
                  ) : (
                    <><FileSearch size={16} />Run Report</>
                  )}
                </button>
              </div>
            </form>

            {reportError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {reportError}
              </div>
            )}

            {bulkCopyPrompt ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">All-player prompts ready</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Each player&apos;s prompt is separated by <code>---</code>. Paste one at a time into{' '}
                      <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">gemini.google.com</a>.
                      Or copy all and ask Gemini to work through them in sequence.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(bulkCopyPrompt);
                        setBulkCopied(true);
                        setTimeout(() => setBulkCopied(false), 2500);
                      } catch {
                        setReportError('Copy failed — select the text below and copy manually.');
                      }
                    }}
                    className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow transition-colors"
                  >
                    {bulkCopied ? 'Copied!' : 'Copy All'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={bulkCopyPrompt}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={24}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono bg-slate-50 resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  {bulkCopyPrompt.length.toLocaleString()} chars total.
                </p>
              </div>
            ) : reportCopyPrompt ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
                <div className="flex items-start justify-between gap-4 mb-3">
                  <div>
                    <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Prompt ready</h2>
                    <p className="text-xs text-slate-500 mt-1 max-w-xl">
                      Click <strong>Copy</strong>, then paste into{' '}
                      <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">gemini.google.com</a>{' '}
                      (free with a Google account). No API cost.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(reportCopyPrompt);
                        setReportCopied(true);
                        setTimeout(() => setReportCopied(false), 2500);
                      } catch {
                        setReportError('Copy failed — select the text below and copy manually.');
                      }
                    }}
                    className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow transition-colors"
                  >
                    {reportCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <textarea
                  readOnly
                  value={reportCopyPrompt}
                  onFocus={(e) => e.currentTarget.select()}
                  rows={18}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono bg-slate-50 resize-y"
                />
                <p className="text-[10px] text-slate-400 mt-2">
                  Prompt length: {reportCopyPrompt.length.toLocaleString()} chars.
                </p>
              </div>
            ) : reportHtml ? (
              <article
                className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none prose-a:text-blue-600 prose-a:underline"
                dangerouslySetInnerHTML={{ __html: reportHtml }}
              />
            ) : reportText ? (
              <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
                {reportText}
              </div>
            ) : null}
          </div>
        ) : (
        <>
        <p className="text-slate-600 text-sm mb-8 max-w-2xl">
          An expert NFL scout that considers your GFL ratings, current roster gaps, draft context, and live NFL news to recommend who to target with your next pick.
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Team</label>
          <select
            value={teamShort}
            onChange={(e) => setTeamShort(e.target.value)}
            className="mb-5 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm bg-white"
          >
            {teamOptions.length === 0 && <option value={teamShort}>{teamShort || '(loading)'}</option>}
            {teamOptions.map(t => (
              <option key={t.teamshort} value={t.teamshort.toUpperCase()}>
                {t.team || t.teamshort} ({t.teamshort})
              </option>
            ))}
          </select>

          <div className="mb-5 rounded-xl border-2 border-blue-100 bg-blue-50/50 px-4 py-3">
            <div className="flex items-baseline justify-between gap-3 mb-2">
              <label className="block text-xs font-black uppercase tracking-widest text-blue-700">
                Filter pool by position
              </label>
              <span className="text-[10px] text-slate-500">
                {selectedGroups.length === 0
                  ? 'No filter — top 400 players across all positions will be sent.'
                  : `Filtering to ${selectedGroups.length} position group${selectedGroups.length === 1 ? '' : 's'}.`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                onClick={() => setSelectedGroups([])}
                className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  selectedGroups.length === 0
                    ? 'bg-blue-600 text-white'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              {POSITION_GROUPS.map(g => {
                const active = selectedGroups.includes(g.label);
                return (
                  <button
                    key={g.label}
                    type="button"
                    onClick={() => setSelectedGroups(prev =>
                      active ? prev.filter(l => l !== g.label) : [...prev, g.label]
                    )}
                    className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                      active
                        ? 'bg-blue-600 text-white'
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    {g.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mb-5 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="scout-max-age" className="text-xs font-black uppercase tracking-widest text-slate-500">
                Age ≤
              </label>
              <input
                id="scout-max-age"
                type="number"
                min={18}
                max={50}
                value={maxAge}
                onChange={(e) => setMaxAge(e.target.value)}
                placeholder="any"
                className="w-20 rounded-lg border border-slate-300 px-3 py-1.5 text-sm bg-white"
              />
            </div>

            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={rookiesOnly}
                onChange={(e) => setRookiesOnly(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs font-black uppercase tracking-widest text-slate-500">
                Rookies only <span className="text-slate-400 font-normal normal-case tracking-normal">(current NFL draft class still in pool)</span>
              </span>
            </label>
          </div>

          <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">What do you need?</label>
          {recentNeeds.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 mr-1">Recent:</span>
              {recentNeeds.map(r => (
                <span
                  key={r.ts}
                  className="group inline-flex items-center gap-1 max-w-xs rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs pl-3 pr-1 py-1 transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => setNeeds(r.text)}
                    className="truncate text-left"
                    title={r.text}
                  >
                    {r.text.length > 60 ? r.text.slice(0, 57) + '…' : r.text}
                  </button>
                  <button
                    type="button"
                    onClick={() => setRecentNeeds(prev => {
                      const next = prev.filter(e => e.ts !== r.ts);
                      saveRecentNeeds(next);
                      return next;
                    })}
                    className="rounded-full p-0.5 hover:bg-slate-300 text-slate-500"
                    title="Remove"
                    aria-label="Remove recent search"
                  >
                    <X size={11} />
                  </button>
                </span>
              ))}
            </div>
          )}
          <textarea
            value={needs}
            onChange={(e) => setNeeds(e.target.value)}
            placeholder="e.g. rebuilding, deep at WR but need OL and pass rush; prefer dynasty value over win-now; willing to take an injury risk on a sleeper"
            rows={4}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-blue-500"
          />

          <div className="mt-5 mb-4">
            <label className="block mb-2 text-xs font-black uppercase tracking-widest text-slate-500">Mode</label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {([
                { id: 'fast', label: 'Fast', sub: 'No web search — ~$0.02/call', desc: 'Uses pre-fetched depth chart + training knowledge. Default.' },
                { id: 'full', label: 'Full', sub: 'With web search — ~$0.30/call', desc: 'Live injury news, snap counts, beat-writer takes. Slower.' },
                { id: 'copy', label: 'Copy to chat', sub: 'No API call — $0', desc: 'Returns the assembled prompt to paste into gemini.google.com.' },
              ] as const).map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setMode(opt.id)}
                  className={`text-left rounded-lg border px-3 py-2 transition-colors ${
                    mode === opt.id
                      ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200'
                      : 'border-slate-200 bg-white hover:bg-slate-50'
                  }`}
                >
                  <div className="text-xs font-black uppercase tracking-widest text-slate-700">{opt.label}</div>
                  <div className="text-[10px] font-bold text-slate-500 mt-0.5">{opt.sub}</div>
                  <div className="text-[10px] text-slate-400 mt-1 leading-snug">{opt.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">Considers ratings, roster, draft context{mode === 'full' ? ', and live NFL info via web search' : mode === 'fast' ? ', and pre-fetched depth charts' : ''}.</p>
            <button
              type="submit"
              disabled={loading || !needs.trim()}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow transition-colors"
            >
              {loading ? (<><Loader2 size={16} className="animate-spin" />{mode === 'copy' ? 'Building prompt…' : 'Scouting…'}</>) : (<>{mode === 'copy' ? 'Build Prompt' : 'Get Recommendations'}</>)}
            </button>
          </div>
        </form>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
            {error}
          </div>
        )}

        {meta && (
          <div className="mb-6 flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">{meta.teamName}</span>
            {meta.currentRound != null && <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Round {meta.currentRound}</span>}
            {meta.picksUntilNext != null && <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">{meta.picksUntilNext === 0 ? 'On the clock' : `${meta.picksUntilNext} picks until your turn`}</span>}
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">{meta.poolSize} candidates considered</span>
            {meta.maxAge != null && <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Age ≤ {meta.maxAge}</span>}
            {meta.rookiesOnly && <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-700">Rookies only</span>}
            {meta.mode && (
              <span className={`px-3 py-1 rounded-full ${
                meta.mode === 'full' ? 'bg-violet-100 text-violet-700' :
                meta.mode === 'copy' ? 'bg-emerald-100 text-emerald-700' :
                'bg-slate-100 text-slate-600'
              }`}>
                {meta.mode === 'full' ? 'Full (web search)' : meta.mode === 'copy' ? 'Copy to chat' : 'Fast (no search)'}
              </span>
            )}
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Roster: {meta.rosterSize}</span>
          </div>
        )}

        {copyPromptText ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
            <div className="flex items-start justify-between gap-4 mb-3">
              <div>
                <h2 className="text-sm font-black uppercase tracking-widest text-slate-700">Prompt ready</h2>
                <p className="text-xs text-slate-500 mt-1 max-w-xl">
                  Click <strong>Copy</strong>, then paste into{' '}
                  <a href="https://gemini.google.com/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">gemini.google.com</a>{' '}
                  (free with a Google account). No API cost.
                </p>
              </div>
              <button
                type="button"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(copyPromptText);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2500);
                  } catch {
                    setError('Copy failed — select the text below and copy manually.');
                  }
                }}
                className="shrink-0 inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black uppercase tracking-widest px-4 py-2 rounded-lg shadow transition-colors"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
            <textarea
              readOnly
              value={copyPromptText}
              onFocus={(e) => e.currentTarget.select()}
              rows={18}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs font-mono bg-slate-50 resize-y"
            />
            <p className="text-[10px] text-slate-400 mt-2">
              Prompt length: {copyPromptText.length.toLocaleString()} chars. Heads-up: consumer Gemini chat may use your conversation for training (unlike the API). Don&apos;t paste anything sensitive.
            </p>
          </div>
        ) : recommendationsHtml ? (
          <article
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none prose-a:text-blue-600 prose-a:underline"
            dangerouslySetInnerHTML={{ __html: recommendationsHtml }}
          />
        ) : recommendations ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
            {recommendations}
          </div>
        ) : null}
        </>
        )}

        {activeTab === 'fa-power' && isCommissioner && (
          <div>
            <p className="text-slate-600 text-sm mb-8 max-w-2xl">
              Top available free agents ranked by last season&apos;s performance score. Use this to identify high-value targets before making moves.
            </p>

            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <span className="text-xs font-black uppercase text-slate-400 tracking-widest">Season</span>
              <div className="flex bg-white p-1 rounded-xl shadow-sm border border-slate-200">
                {FA_YEARS.map((y) => (
                  <button
                    key={y}
                    onClick={() => setFaYear(y)}
                    className={`px-5 py-2 rounded-lg text-[10px] font-black uppercase transition-all ${
                      faYear === y ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {y}
                  </button>
                ))}
              </div>
              {faLoading && <Loader2 size={14} className="animate-spin text-slate-400" />}
            </div>

            <div className="relative w-full max-w-xs mb-2">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={faSearch}
                onChange={e => setFaSearch(e.target.value)}
                placeholder="Search players…"
                className="w-full pl-8 pr-3 py-2 text-sm border border-slate-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              {faSearch && (
                <button onClick={() => setFaSearch('')} className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                  <X size={13} />
                </button>
              )}
            </div>

            {faError && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">
                {faError}
              </div>
            )}

            {faLoading && !faData && (
              <div className="py-16 text-center">
                <Loader2 size={24} className="animate-spin text-slate-400 mx-auto mb-2" />
                <p className="text-xs font-black uppercase text-slate-400 tracking-widest">
                  Computing {faYear} power scores for all free agents...
                </p>
                <p className="text-xs text-slate-300 mt-1">First load may take up to 30 seconds</p>
              </div>
            )}

            {faData && !faLoading && (
              <>
                <div className="flex flex-wrap gap-1.5 mb-4">
                  <button
                    onClick={() => setFaFilterGroup(null)}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${faFilterGroup === null ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                  >
                    All
                  </button>
                  {faAvailableGroups.map(g => (
                    <button
                      key={g}
                      onClick={() => setFaFilterGroup(faFilterGroup === g ? null : g)}
                      className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-colors ${faFilterGroup === g ? 'bg-slate-900 text-white' : 'bg-white text-slate-500 border border-slate-200 hover:bg-slate-50'}`}
                    >
                      {g}
                    </button>
                  ))}
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="border-b border-slate-100 bg-slate-50">
                      <tr>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">#</th>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Player</th>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">Pos</th>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest">NFL Team</th>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Age</th>
                        <th className="py-2 px-3 text-[9px] font-black text-slate-400 uppercase tracking-widest text-right">Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faFiltered.map((p, i) => (
                        <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50 transition-colors">
                          <td className="py-2 px-3 text-sm font-bold text-slate-500 tabular-nums">{i + 1}</td>
                          <td className="py-2 px-3 text-sm whitespace-nowrap">
                            <div className="flex items-center gap-1.5">
                              {p.espnId && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={`https://a.espncdn.com/i/headshots/nfl/players/full/${p.espnId}.png`}
                                  alt={p.name}
                                  className="w-7 h-7 rounded-full object-cover bg-slate-100 flex-shrink-0"
                                  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                />
                              )}
                              <div className="flex items-center gap-1">
                                <a
                                  href={`https://www.google.com/search?q=${encodeURIComponent(p.name + ' NFL')}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="font-bold text-slate-800 hover:text-blue-600 transition-colors"
                                >
                                  {p.name}
                                </a>
                                {p.espnId && newsIds.has(p.espnId) && (
                                  <a
                                    href={`https://www.espn.com/nfl/player/news/_/id/${p.espnId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    title="Recent ESPN news"
                                    className="text-orange-400 hover:text-orange-600 transition-colors"
                                  >
                                    <Newspaper size={11} />
                                  </a>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="py-2 px-3">
                            <span className={`inline-block text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${FA_POS_COLORS[p.posGroup] ?? 'bg-slate-100 text-slate-600'}`}>
                              {p.posGroup}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-xs text-slate-500 whitespace-nowrap">{p.nflTeam ?? '—'}</td>
                          <td className="py-2 px-3 text-sm text-right tabular-nums text-slate-500">{p.age ?? '—'}</td>
                          <td className="py-2 px-3 text-sm text-right tabular-nums font-semibold text-slate-700">{p.score.toFixed(1)}</td>
                        </tr>
                      ))}
                      {faFiltered.length === 0 && (
                        <tr>
                          <td colSpan={6} className="py-8 text-center text-xs text-slate-400">No free agents found with stats</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-400 mt-2">{faFiltered.length} players shown</p>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
