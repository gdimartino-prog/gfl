'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';
import { POSITION_GROUPS } from '@/lib/positionGroups';

type Meta = { teamName: string; currentRound: number | null; picksUntilNext: number | null; poolSize: number; rosterSize: number };
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
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setRecommendations(data.recommendations);
      setRecommendationsHtml(data.recommendationsHtml || null);
      setMeta(data.meta);
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

          <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">What do you need?</label>
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
