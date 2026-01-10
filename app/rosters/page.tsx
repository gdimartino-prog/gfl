'use client';

import React, { useState, useEffect, useMemo } from 'react';
import PlayerCard from '@/components/PlayerCard';

export const dynamic = 'force-dynamic';

const positionWeights: Record<string, number> = {
  'QB': 1, 'RB': 2, 'HB': 2, 'FB': 3, 'WR': 4, 'TE': 5,
  'OT': 6, 'LT': 6, 'RT': 6, 'T': 6, 'OG': 7, 'LG': 7, 'RG': 7, 'G': 7, 'C': 8, 'OL': 9,
  'DT': 10, 'NT': 11, 'DE': 12, 'DL': 13, 'MLB': 14, 'ILB': 15, 'OLB': 16, 'LB': 17,
  'CB': 18, 'FS': 19, 'SS': 20, 'S': 21, 'DB': 22,
  'K': 30, 'P': 31, 'LS': 32, 'KR': 33, 'PR': 34
};

export default function RosterPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [data, setData] = useState<{ roster: any[], picks: any[] } | null>(null);
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'pos'>('default');
  const [viewingPlayer, setViewingPlayer] = useState<any>(null);

  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
  }, []);

  useEffect(() => {
    if (!selectedTeam) { setData(null); return; }
    setLoading(true);
    fetch(`/api/rosters/${selectedTeam}`)
      .then(res => res.json())
      .then(json => {
        setData({ roster: json.roster || [], picks: json.picks || [] });
        setLoading(false);
      });
  }, [selectedTeam]);

  const getGoogleSearchUrl = (name: string) => `https://www.google.com/search?q=${encodeURIComponent(name + ' NFL')}`;

  const fetchPlayerDetails = async (p: any) => {
    try {
      const nameParts = p.name ? p.name.trim().split(/\s+/) : ['', ''];
      const first = (nameParts[0] || '').toLowerCase();
      const last = (nameParts.length > 1 ? nameParts[nameParts.length - 1] : '').toLowerCase();
      const age = p.age ? String(p.age).toLowerCase() : '';
      const off = p.group === 'OFF' ? p.pos.toLowerCase() : '';
      const def = p.group === 'DEF' ? p.pos.toLowerCase() : '';
      const spec = p.group === 'SPEC' ? p.pos.toLowerCase() : '';

      const identity = [first, last, age, off, def, spec].join('|');
      const r = await fetch(`/api/players/details/${encodeURIComponent(identity)}`);
      if (r.ok) {
        setViewingPlayer(await r.json());
      } else {
        alert(`Scouting data not found for: ${p.name}`);
      }
    } catch (e) { console.error("Search Error:", e); }
  };

  const sortedGroups = useMemo(() => {
    if (!data?.roster) return { OFF: [], DEF: [], SPEC: [] };
    const sortFn = (players: any[]) => {
      const list = [...players];
      if (sortBy === 'name') return list.sort((a, b) => a.name.split(' ').pop().localeCompare(b.name.split(' ').pop()));
      if (sortBy === 'pos') return list.sort((a, b) => a.pos.localeCompare(b.pos));
      return list.sort((a, b) => (positionWeights[a.pos] || 99) - (positionWeights[b.pos] || 99));
    };
    return {
      OFF: sortFn(data.roster.filter(p => p.group === 'OFF')),
      DEF: sortFn(data.roster.filter(p => p.group === 'DEF')),
      SPEC: sortFn(data.roster.filter(p => p.group === 'SPEC')),
    };
  }, [data, sortBy]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900">
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}

      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-800">ROSTER EXPLORER</h1>
          <p className="text-xs font-bold text-blue-500 uppercase tracking-widest">Team Management & Scouting</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border">
             <span className="text-[10px] font-black text-gray-400 uppercase px-2">Sort By</span>
             {(['default', 'name', 'pos'] as const).map((mode) => (
               <button key={mode} onClick={() => setSortBy(mode)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${sortBy === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                 {mode.toUpperCase()}
               </button>
             ))}
          </div>

          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)}
            className="p-3 border rounded-lg bg-gray-50 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">SELECT TEAM</option>
            {teams.map((t: any) => <option key={t.short} value={t.short}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20 text-blue-600">
          <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {(['OFF', 'DEF'] as const).map((unit) => (
            <div key={unit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
              <div className={`px-4 py-3 font-black text-white flex justify-between items-center ${unit === 'OFF' ? 'bg-slate-800' : 'bg-red-900'}`}>
                <span className="tracking-tighter">{unit === 'OFF' ? 'OFFENSE' : 'DEFENSE'}</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{sortedGroups[unit].length} PLYRS</span>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedGroups[unit].map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-blue-50/50 group transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded w-10 text-center">{p.pos}</span>
                      <div className="flex flex-col">
                        <a href={getGoogleSearchUrl(p.name)} target="_blank" rel="noopener noreferrer" 
                           className="text-sm font-bold text-slate-800 uppercase hover:text-blue-600 hover:underline decoration-2 underline-offset-4">
                          {p.name}
                        </a>
                        <span className="text-[10px] font-bold text-gray-400">AGE: {p.age || '—'}</span>
                      </div>
                    </div>
                    <button onClick={() => fetchPlayerDetails(p)}
                      className="opacity-0 group-hover:opacity-100 bg-white text-blue-700 text-[10px] font-black px-3 py-1.5 rounded-lg border shadow-sm hover:bg-blue-600 hover:text-white transition-all">
                      Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="space-y-6">
            {/* Special Teams Card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 font-black text-white bg-indigo-900 flex justify-between items-center">
                <span className="tracking-tighter uppercase">Special Teams</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{sortedGroups.SPEC.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedGroups.SPEC.map((p, i) => (
                  <div key={i} className="flex items-center justify-between p-3 hover:bg-indigo-50/50 group transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-10 text-center">{p.pos}</span>
                      <a href={getGoogleSearchUrl(p.name)} target="_blank" rel="noopener noreferrer" 
                         className="text-sm font-bold text-slate-800 uppercase hover:text-indigo-600 hover:underline">{p.name}</a>
                    </div>
                    <button onClick={() => fetchPlayerDetails(p)}
                      className="opacity-0 group-hover:opacity-100 bg-white text-indigo-700 text-[10px] font-black px-3 py-1.5 rounded-lg border shadow-sm hover:bg-indigo-600 hover:text-white transition-all">
                      SCOUT
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* Redesigned Draft Capital Card */}
            <div className="bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-800">
               <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-white text-xs tracking-[0.2em] uppercase">Draft Capital</h3>
                  <span className="text-slate-500 font-mono text-xs">{data.picks?.length || 0} ASSETS</span>
               </div>
               <div className="space-y-3">
                 {data.picks?.map((pick: any, i: number) => (
                   <div key={i} className="relative bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center gap-4 overflow-hidden group">
                     <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-4xl italic text-white pointer-events-none">
                       {pick.round}
                     </div>
                     <div className="bg-blue-600 text-white w-12 h-12 rounded-lg flex flex-col items-center justify-center flex-shrink-0 shadow-lg">
                        <span className="text-[10px] font-black leading-none">{pick.year}</span>
                        <span className="text-lg font-black italic">R{pick.round}</span>
                     </div>
                     <div className="flex-grow">
                       <p className="text-white font-black text-sm tracking-tight">
                         {pick.overall && pick.overall !== 'N/A' ? `PICK #${pick.overall}` : 'ROUND ' + pick.round}
                       </p>
                       <p className="text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
                         From: <span className="text-blue-400">{pick.originalTeam}</span>
                       </p>
                     </div>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}