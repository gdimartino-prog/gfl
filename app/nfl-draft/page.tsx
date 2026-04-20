'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';

interface NflPick {
  id: number;
  year: number;
  round: number;
  pick: number;
  roundPick: number;
  playerName: string;
  position: string | null;
  nflTeam: string | null;
  college: string | null;
  gflDrafted: boolean;
}

const POSITION_COLORS: Record<string, string> = {
  QB: 'bg-red-100 text-red-800',
  RB: 'bg-green-100 text-green-800',
  WR: 'bg-blue-100 text-blue-800',
  TE: 'bg-purple-100 text-purple-800',
  OT: 'bg-yellow-100 text-yellow-800',
  G:  'bg-yellow-100 text-yellow-800',
  C:  'bg-yellow-100 text-yellow-800',
  T:  'bg-yellow-100 text-yellow-800',
  DE: 'bg-orange-100 text-orange-800',
  DT: 'bg-orange-100 text-orange-800',
  LB: 'bg-pink-100 text-pink-800',
  OLB:'bg-pink-100 text-pink-800',
  CB: 'bg-cyan-100 text-cyan-800',
  S:  'bg-cyan-100 text-cyan-800',
  K:  'bg-gray-100 text-gray-700',
  FB: 'bg-green-100 text-green-800',
};

export default function NflDraftPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  const [picks, setPicks] = useState<NflPick[]>([]);
  const [draftYear, setDraftYear] = useState<number | null>(null);
  const [gflCount, setGflCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(2025);
  const [posFilter, setPosFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [showGflOnly, setShowGflOnly] = useState(false);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
      return;
    }
    const role = (session?.user as { role?: string })?.role;
    if (status === 'authenticated' && role !== 'admin' && role !== 'superuser') {
      router.replace('/');
    }
  }, [status, session, router]);

  useEffect(() => {
    if (status !== 'authenticated') return;
    setLoading(true);
    fetch(`/api/nfl-draft?year=${year}`)
      .then(r => r.json())
      .then(data => {
        setPicks(data.picks || []);
        setDraftYear(data.draftYear || null);
        setGflCount(data.gflDraftedCount || 0);
      })
      .finally(() => setLoading(false));
  }, [year, status]);

  const role = (session?.user as { role?: string })?.role;
  if (status === 'loading' || (status === 'authenticated' && role !== 'admin' && role !== 'superuser')) {
    return null;
  }

  const rounds = [...new Set(picks.map(p => p.round))].sort((a, b) => a - b);
  const positions = ['ALL', ...new Set(picks.map(p => p.position || '').filter(Boolean))].sort();

  const searchLower = search.toLowerCase();
  const filtered = picks.filter(p => {
    if (posFilter !== 'ALL' && p.position !== posFilter) return false;
    if (showGflOnly && !p.gflDrafted) return false;
    if (search && !p.playerName.toLowerCase().includes(searchLower) &&
        !p.nflTeam?.toLowerCase().includes(searchLower) &&
        !p.college?.toLowerCase().includes(searchLower)) return false;
    return true;
  });

  const byRound = rounds.reduce<Record<number, NflPick[]>>((acc, r) => {
    acc[r] = filtered.filter(p => p.round === r);
    return acc;
  }, {});

  const gflInFiltered = filtered.filter(p => p.gflDrafted).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">NFL Draft Board</h1>
            {draftYear && (
              <p className="text-sm text-gray-500 mt-1">
                GFL {draftYear} draft — {gflCount} players also drafted in GFL
              </p>
            )}
          </div>
          <select
            value={year}
            onChange={e => setYear(Number(e.target.value))}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {[2025, 2024, 2023].map(y => (
              <option key={y} value={y}>{y} NFL Draft</option>
            ))}
          </select>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          <input
            type="text"
            placeholder="Search player, team, college…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white w-64"
          />
          <select
            value={posFilter}
            onChange={e => setPosFilter(e.target.value)}
            className="border rounded px-3 py-1.5 text-sm bg-white"
          >
            {positions.map(p => <option key={p} value={p}>{p === 'ALL' ? 'All Positions' : p}</option>)}
          </select>
          <button
            onClick={() => setShowGflOnly(v => !v)}
            className={`px-3 py-1.5 rounded text-sm font-medium border transition-colors ${
              showGflOnly
                ? 'bg-red-600 text-white border-red-600'
                : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
            }`}
          >
            GFL Drafted Only {gflInFiltered > 0 && `(${gflInFiltered})`}
          </button>
        </div>

        {loading ? (
          <div className="text-center py-20 text-gray-400">Loading draft data…</div>
        ) : (
          <div className="space-y-8">
            {rounds.map(round => {
              const roundPicks = byRound[round];
              if (!roundPicks || roundPicks.length === 0) return null;
              const gflInRound = roundPicks.filter(p => p.gflDrafted).length;
              return (
                <div key={round}>
                  <div className="flex items-center gap-3 mb-3">
                    <h2 className="text-lg font-bold text-gray-800">Round {round}</h2>
                    {gflInRound > 0 && (
                      <span className="text-xs font-semibold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                        {gflInRound} GFL pick{gflInRound > 1 ? 's' : ''}
                      </span>
                    )}
                    <span className="text-xs text-gray-400">{roundPicks.length} picks</span>
                  </div>
                  <div className="bg-white rounded-lg shadow-sm border overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-gray-50 border-b text-xs text-gray-500 uppercase tracking-wide">
                          <th className="px-3 py-2 text-left w-16">Pick</th>
                          <th className="px-3 py-2 text-left">Player</th>
                          <th className="px-3 py-2 text-left w-14">Pos</th>
                          <th className="px-3 py-2 text-left hidden sm:table-cell">NFL Team</th>
                          <th className="px-3 py-2 text-left hidden md:table-cell">College</th>
                        </tr>
                      </thead>
                      <tbody>
                        {roundPicks.map((p, i) => (
                          <tr
                            key={p.id}
                            className={`border-b last:border-0 transition-colors ${
                              p.gflDrafted
                                ? 'bg-red-50 hover:bg-red-100'
                                : i % 2 === 0 ? 'hover:bg-gray-50' : 'bg-gray-50/50 hover:bg-gray-100'
                            }`}
                          >
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-1.5">
                                <span className={`font-mono font-bold text-xs ${p.gflDrafted ? 'text-red-700' : 'text-gray-500'}`}>
                                  #{p.pick}
                                </span>
                                <span className="text-[10px] text-gray-400">(R{round}.{p.roundPick})</span>
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              <div className="flex items-center gap-2">
                                <span className={`font-semibold ${p.gflDrafted ? 'text-red-700' : 'text-gray-900'}`}>
                                  {p.playerName}
                                </span>
                                {p.gflDrafted && (
                                  <span className="text-[10px] font-bold bg-red-600 text-white px-1.5 py-0.5 rounded uppercase tracking-wider">
                                    GFL
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-3 py-2">
                              {p.position && (
                                <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded ${POSITION_COLORS[p.position] || 'bg-gray-100 text-gray-700'}`}>
                                  {p.position}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-gray-600 hidden sm:table-cell">{p.nflTeam}</td>
                            <td className="px-3 py-2 text-gray-500 hidden md:table-cell">{p.college}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center py-16 text-gray-400">No picks match your filters.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
