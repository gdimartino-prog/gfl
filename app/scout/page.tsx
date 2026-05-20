'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Loader2, Sparkles } from 'lucide-react';

type Meta = { teamName: string; currentRound: number | null; picksUntilNext: number | null; poolSize: number; rosterSize: number };

export default function ScoutPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [needs, setNeeds] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [meta, setMeta] = useState<Meta | null>(null);
  const [teamShort, setTeamShort] = useState('');

  useEffect(() => {
    if (status === 'unauthenticated') router.replace('/login');
  }, [status, router]);

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
    setMeta(null);
    try {
      const res = await fetch('/api/scout/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ needs: needs.trim(), teamShort: teamShort || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Request failed');
      setRecommendations(data.recommendations);
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
          An expert NFL scout that considers your AFL ratings, current roster gaps, draft context, and live NFL news to recommend who to target with your next pick.
        </p>

        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 mb-8">
          <label className="block mb-3 text-xs font-black uppercase tracking-widest text-slate-500">Team</label>
          <input
            type="text"
            value={teamShort}
            onChange={(e) => setTeamShort(e.target.value.toUpperCase())}
            className="mb-5 w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            placeholder="e.g. SG"
          />

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

        {recommendations && (
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 prose prose-slate prose-sm max-w-none whitespace-pre-wrap">
            {recommendations}
          </div>
        )}
      </div>
    </div>
  );
}
