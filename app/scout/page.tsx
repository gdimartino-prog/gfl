'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles, X } from 'lucide-react';
import { POSITION_GROUPS } from '@/lib/positionGroups';

const RECENT_NEEDS_KEY = 'gfl-scout-recent-needs';
const RECENT_NEEDS_TTL_MS = 24 * 60 * 60 * 1000;
type RecentNeed = { text: string; ts: number };

function loadRecentNeeds(): RecentNeed[] {
  try {
    const raw = localStorage.getItem(RECENT_NEEDS_KEY);
    if (!raw) return [];
    const parsed: RecentNeed[] = JSON.parse(raw);
    const cutoff = Date.now() - RECENT_NEEDS_TTL_MS;
    return parsed.filter(e => e && typeof e.text === 'string' && typeof e.ts === 'number' && e.ts >= cutoff);
  } catch {
    return [];
  }
}

function saveRecentNeeds(entries: RecentNeed[]) {
  try {
    localStorage.setItem(RECENT_NEEDS_KEY, JSON.stringify(entries.slice(0, 20)));
  } catch { /* quota or disabled */ }
}

type Meta = { teamName: string; currentRound: number | null; picksUntilNext: number | null; poolSize: number; rosterSize: number; maxAge?: number | null; rookiesOnly?: boolean };
type TeamOption = { teamshort: string; team: string };

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
      if (id) setTeamShort(id.toUpperCase());
    }
  }, [session]);

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
        }),
      });
      // Vercel returns an HTML 504 page when the function exceeds maxDuration,
      // so guard JSON parsing — show a friendly message instead of a parser error.
      const ct = res.headers.get('content-type') || '';
      if (!ct.includes('application/json')) {
        if (res.status === 504) throw new Error('Scout timed out (60s). Try narrowing the position group, lowering the age, or enabling "Rookies only" so there are fewer players to research.');
        throw new Error(`Scout failed with HTTP ${res.status}. Try again in a moment.`);
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || `Request failed (HTTP ${res.status})`);
      setRecommendations(data.recommendations);
      setRecommendationsHtml(data.recommendationsHtml || null);
      setMeta(data.meta);

      const submitted = needs.trim();
      if (submitted) {
        setRecentNeeds(prev => {
          const dedup = prev.filter(e => e.text.toLowerCase() !== submitted.toLowerCase());
          const next = [{ text: submitted, ts: Date.now() }, ...dedup].slice(0, 20);
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

  if (status === 'loading') return null;

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Sparkles className="text-blue-600" size={28} />
          <h1 className="text-3xl font-black tracking-tight text-slate-900">Draft Scout</h1>
        </div>
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

          <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Positions to scout</label>
          <div className="mb-5 flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setSelectedGroups([])}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                selectedGroups.length === 0
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
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
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {g.label}
                </button>
              );
            })}
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

          <div className="mt-5 flex items-center justify-between">
            <p className="text-xs text-slate-400">Considers ratings, roster, draft context, and live NFL info via web search.</p>
            <button
              type="submit"
              disabled={loading || !needs.trim()}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white text-sm font-black uppercase tracking-widest px-6 py-3 rounded-xl shadow transition-colors"
            >
              {loading ? (<><Loader2 size={16} className="animate-spin" />Scouting…</>) : (<>Get Recommendations</>)}
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
            <span className="px-3 py-1 rounded-full bg-slate-100 text-slate-600">Roster: {meta.rosterSize}</span>
          </div>
        )}

        {recommendationsHtml ? (
          <article
            className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none prose-a:text-blue-600 prose-a:underline"
            dangerouslySetInnerHTML={{ __html: recommendationsHtml }}
          />
        ) : recommendations ? (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
            {recommendations}
          </div>
        ) : null}
      </div>
    </div>
  );
}
