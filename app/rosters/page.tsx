'use client';

import React, { useState, useEffect } from 'react';

export default function RosterPage() {
  const [teams, setTeams] = useState([]);
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
        setData(json);
        setLoading(false);
      })
      .catch(err => {
        console.error("Error loading roster:", err);
        setLoading(false);
      });
  }, [selectedTeam]);

  const groups = {
    OFF: data?.roster.filter(p => p.group === 'OFF') || [],
    DEF: data?.roster.filter(p => p.group === 'DEF') || [],
    SPEC: data?.roster.filter(p => p.group === 'SPEC') || [],
  };

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen font-sans">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Roster Overview</h1>
          <p className="text-sm text-gray-500">Official depth chart and draft assets</p>
        </div>
        
        <div className="flex items-center gap-6">
          {data && (
            <div className="text-right border-r pr-6 border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Active Players</p>
              <p className={`text-xl font-black ${data.roster.length > 53 ? 'text-red-600' : 'text-green-600'}`}>
                {data.roster.length} <span className="text-gray-300 text-sm">/ 53</span>
              </p>
            </div>
          )}
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)}
            className="p-3 border rounded-lg bg-gray-50 font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer"
          >
            <option value="">Select a Team...</option>
            {teams.map((t: any) => (
              <option key={t.short} value={t.short}>{t.name}</option>
            ))}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <div className="flex flex-col items-center gap-3 text-gray-400">
            <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-sm font-medium">Syncing data...</p>
          </div>
        </div>
      )}

      {data && !loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {['OFF', 'DEF'].map(unit => (
            <div key={unit} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden h-fit">
              <div className={`px-4 py-3 font-bold text-white flex justify-between items-center ${unit === 'OFF' ? 'bg-blue-800' : 'bg-red-800'}`}>
                <span className="tracking-wide">{unit === 'OFF' ? 'OFFENSE' : 'DEFENSE'}</span>
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{groups[unit].length}</span>
              </div>
              <div className="p-2">
                <table className="w-full">
                  <tbody>
                    {groups[unit].map((p, i) => (
                      <tr key={i} className="border-b last:border-0 border-gray-50 hover:bg-blue-50/50 transition-colors">
                        <td className="py-2.5 px-3 font-mono text-xs font-bold text-blue-600 w-12">{p.pos}</td>
                        <td className="py-2.5 px-3 text-sm text-gray-800 uppercase font-semibold">{p.name}</td>
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
                <span className="bg-white/20 px-2 py-0.5 rounded text-xs">{groups.SPEC.length}</span>
              </div>
              <div className="p-2 space-y-1">
                {groups.SPEC.map((p, i) => (
                  <div key={i} className="flex px-3 py-2.5 border-b last:border-0 border-gray-50 text-sm hover:bg-indigo-50/50">
                    <span className="font-mono text-indigo-600 w-12 font-bold">{p.pos}</span>
                    <span className="text-gray-800 uppercase font-semibold">{p.name}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl shadow-sm border border-amber-200 overflow-hidden">
              <div className="px-4 py-3 font-bold text-amber-900 bg-amber-200 flex justify-between items-center">
                <span>DRAFT CAPITAL</span>
                <span className="bg-amber-900/10 px-2 py-0.5 rounded text-xs">{data.picks.length}</span>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {data.picks.map((pick, i) => (
                  <div key={i} className="bg-white border border-amber-200 p-3 rounded-lg text-center shadow-sm">
                    <p className="text-[10px] text-amber-600 font-black uppercase tracking-tighter">{pick.year} DRAFT</p>
                    <p className="text-sm font-black text-amber-900">RD {pick.round}</p>
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