'use client';

import React, { useState, useEffect } from 'react';

export const dynamic = 'force-dynamic';

export default function RosterPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [data, setData] = useState<{ roster: any[], picks: any[] } | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/teams')
      .then(res => res.json())
      .then(setTeams)
      .catch(err => console.error("Error loading teams:", err));
  }, []);

  useEffect(() => {
    if (!selectedTeam) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/rosters/${selectedTeam}`)
      .then(res => res.json())
      .then(json => {
        setData({
          roster: json.roster || [],
          picks: json.picks || []
        });
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading roster:", err);
        setLoading(false);
      });
  }, [selectedTeam]);

  const groups: Record<string, any[]> = {
    OFF: data?.roster.filter(p => p.group === 'OFF') || [],
    DEF: data?.roster.filter(p => p.group === 'DEF') || [],
    SPEC: data?.roster.filter(p => p.group === 'SPEC') || [],
  };

  // Helper to generate the Google search URL
  const getGoogleSearchUrl = (name: string) => {
    return `https://www.google.com/search?q=${encodeURIComponent(name)}`;
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen font-sans text-slate-900">
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-left">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">ROSTER OVERVIEW</h1>
          <p className="text-sm text-gray-500 text-left">Depth chart and draft assets</p>
        </div>
        
        <div className="flex items-center gap-6">
          {data && (
            <div className="text-right border-r pr-6 border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Active Players</p>
              <p className={`text-xl font-black ${data.roster.length > 53 ? 'text-red-600' : 'text-green-600'} text-right`}>
                {data.roster.length} <span className="text-gray-300 text-sm">/ 53</span>
              </p>
            </div>
          )}
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="p-3 border rounded-lg bg-gray-50 font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
          >
            <option value="">Select a Team...</option>
            {teams.map((t: any) => (
              <option key={t.short} value={t.short}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20 text-blue-600">
          <div className="w-10 h-10 border-4 border-current border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OFFENSE & DEFENSE COLUMNS */}
          {['OFF', 'DEF'].map((unit) => (
            <div key={unit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
              <div className={`px-4 py-3 font-bold text-white flex justify-between items-center ${unit === 'OFF' ? 'bg-blue-800' : 'bg-red-800'}`}>
                <span className="tracking-wide">{unit === 'OFF' ? 'OFFENSE' : 'DEFENSE'}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">{groups[unit]?.length || 0}</span>
              </div>
              <div className="p-2">
                <table className="w-full text-left">
                  <tbody>
                    {(groups[unit] || []).map((p: any, i: number) => (
                      <tr key={i} className="border-b last:border-0 border-gray-50 hover:bg-gray-50">
                        <td className="py-2 px-3 font-mono text-xs font-bold text-blue-600 w-12 text-left">{p.pos}</td>
                        <td className="py-2 px-3 text-sm text-gray-800 uppercase font-semibold text-left">
                          {/* UPDATED: Link added here */}
                          <a 
                            href={getGoogleSearchUrl(p.name)} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="hover:text-blue-600 hover:underline transition-colors"
                          >
                            {p.name}
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}

          {/* SIDEBAR: SPECIAL TEAMS & DRAFT CAPITAL */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="px-4 py-3 font-bold text-white bg-indigo-800 flex justify-between items-center">
                <span>SPECIAL TEAMS</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs font-black">{groups.SPEC.length}</span>
              </div>
              <div className="p-2">
                {groups.SPEC.map((p: any, i: number) => (
                  <div key={i} className="flex px-3 py-2 border-b last:border-0 border-gray-50 text-sm items-center">
                    <span className="font-mono text-indigo-600 w-12 font-bold text-left">{p.pos}</span>
                    <span className="text-gray-800 uppercase font-semibold text-left">
                      {/* UPDATED: Link added here */}
                      <a 
                        href={getGoogleSearchUrl(p.name)} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="hover:text-indigo-600 hover:underline transition-colors"
                      >
                        {p.name}
                      </a>
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* DRAFT CAPITAL SECTION */}
            <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 font-bold text-amber-900 bg-amber-200 flex justify-between items-center">
                <span className="tracking-tight uppercase">Draft Capital</span>
                <span className="bg-amber-900/10 px-2 py-0.5 rounded text-xs font-black">
                  {data.picks?.length || 0}
                </span>
              </div>
              <div className="p-4 space-y-3">
                {data.picks && data.picks.length > 0 ? (
                  data.picks.map((pick: any, i: number) => {
                    const isViaTrade = pick.originalTeam && 
                                     pick.originalTeam.toLowerCase() !== selectedTeam.toLowerCase();
                    
                    return (
                      <div key={i} className="bg-white border border-amber-100 p-3 rounded-lg shadow-sm flex justify-between items-center">
                        <div className="text-left">
                          <p className="text-[10px] text-amber-600 font-black uppercase tracking-tighter text-left">
                            {pick.year} ROUND {pick.round}
                          </p>
                          <p className="text-sm font-black text-slate-800 italic text-left">
                            {pick.overall && pick.overall !== '' ? `PICK #${pick.overall}` : 'PICK TBD'}
                          </p>
                        </div>
                        {isViaTrade && (
                          <div className="text-right">
                            <span className="text-[9px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase">
                              via {pick.originalTeam}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-center py-4 text-xs text-amber-600 italic">No picks currently held.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}