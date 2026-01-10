'use client';

import React, { useState, useEffect, useMemo } from 'react';

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

  // FIX: Memoize the sorting logic so it doesn't freeze the UI on selection
  const sortedGroups = useMemo(() => {
    if (!data?.roster) return { OFF: [], DEF: [], SPEC: [] };

    const sortFn = (players: any[]) => {
      const list = [...players];
      if (sortBy === 'name') {
        return list.sort((a, b) => a.name.split(' ').pop().localeCompare(b.name.split(' ').pop()));
      }
      if (sortBy === 'pos') {
        return list.sort((a, b) => a.pos.localeCompare(b.pos));
      }
      return list.sort((a, b) => (positionWeights[a.pos] || 99) - (positionWeights[b.pos] || 99));
    };

    return {
      OFF: sortFn(data.roster.filter(p => p.group === 'OFF')),
      DEF: sortFn(data.roster.filter(p => p.group === 'DEF')),
      SPEC: sortFn(data.roster.filter(p => p.group === 'SPEC')),
    };
  }, [data, sortBy]); // Only re-sort if data or sort mode changes

  const getGoogleSearchUrl = (name: string) => `https://www.google.com/search?q=${encodeURIComponent(name)}`;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold">ROSTER OVERVIEW</h1>
          <p className="text-sm text-gray-500">Depth chart and draft assets</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
             <span className="text-[10px] font-bold text-gray-400 uppercase px-2">Sort:</span>
             {(['default', 'name', 'pos'] as const).map((mode) => (
               <button 
                key={mode}
                onClick={() => setSortBy(mode)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all ${sortBy === mode ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
               >
                 {mode === 'default' ? 'NFL' : mode === 'name' ? 'Name' : 'Pos'}
               </button>
             ))}
          </div>

          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="p-3 border rounded-lg bg-gray-50 font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="">Select a Team...</option>
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
            <div key={unit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
              <div className={`px-4 py-3 font-bold text-white flex justify-between items-center ${unit === 'OFF' ? 'bg-blue-800' : 'bg-red-800'}`}>
                <span>{unit === 'OFF' ? 'OFFENSE' : 'DEFENSE'}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{sortedGroups[unit].length}</span>
              </div>
              <div className="p-2">
                <table className="w-full">
                  <tbody>
                    {sortedGroups[unit].map((p, i) => (
                      <tr key={i} className="border-b last:border-0 border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs font-bold text-blue-600 w-12">{p.pos}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 uppercase font-semibold">
                          <a href={getGoogleSearchUrl(p.name)} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 hover:underline">{p.name}</a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 font-bold text-white bg-indigo-800 flex justify-between items-center">
                <span>SPECIAL TEAMS</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{sortedGroups.SPEC.length}</span>
              </div>
              <div className="p-2">
                {sortedGroups.SPEC.map((p, i) => (
                  <div key={i} className="flex px-3 py-2 border-b last:border-0 border-gray-50 text-sm items-center">
                    <span className="font-mono text-indigo-600 w-12 font-bold">{p.pos}</span>
                    <span className="text-gray-800 uppercase font-semibold">
                      <a href={getGoogleSearchUrl(p.name)} target="_blank" rel="noopener noreferrer" className="hover:text-indigo-600 hover:underline">{p.name}</a>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 p-4">
               <h3 className="font-bold text-amber-900 mb-3">DRAFT CAPITAL ({data.picks?.length || 0})</h3>
               {data.picks?.map((pick: any, i: number) => (
                 <div key={i} className="bg-white border border-amber-100 p-3 rounded-lg mb-2 flex justify-between items-center">
                   <div>
                     <p className="text-[10px] text-amber-600 font-black">{pick.year} RD {pick.round}</p>
                     <p className="text-sm font-black text-slate-800 italic">{pick.overall ? `PICK #${pick.overall}` : 'PICK TBD'}</p>
                   </div>
                 </div>
               ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}