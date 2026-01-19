'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PlayerCard from '@/components/PlayerCard';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';

export const dynamic = 'force-dynamic';

const positionWeights: Record<string, number> = {
  'QB': 1, 'RB': 2, 'HB': 2, 'FB': 3, 'WR': 4, 'TE': 5,
  'OT': 6, 'LT': 6, 'RT': 6, 'T': 6, 'OG': 7, 'LG': 7, 'RG': 7, 'G': 7, 'C': 8, 'OL': 9,
  'DT': 10, 'NT': 11, 'DE': 12, 'DL': 13, 'MLB': 14, 'ILB': 15, 'OLB': 16, 'LB': 17,
  'CB': 18, 'FS': 19, 'SS': 20, 'S': 21, 'DB': 22,
  'K': 30, 'P': 31, 'LS': 32, 'KR': 33, 'PR': 34
};

export default function RosterPage() {
  const { selectedTeam } = useTeam(); 
  const [data, setData] = useState<{ roster: any[], picks: any[], schedule: any[], stats: any } | null>(null);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'pos'>('default');
  const [viewingPlayer, setViewingPlayer] = useState<any>(null);
  const lastPlayedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true);

    const loadFranchiseData = async () => {
      try {
        const [standingsRes, rulesRes] = await Promise.all([
          fetch(`/api/standings`),
          fetch(`/api/rules`)
        ]);

        const standingsData = await standingsRes.json();
        const rulesData = await rulesRes.json();
        
        // 1. Process Rules: Map min_POS to requirements object
        const requirements: Record<string, number> = {};
        rulesData.forEach((r: any) => {
          if (r.setting?.startsWith('min_')) {
            requirements[r.setting.replace('min_', '').toUpperCase()] = parseInt(r.value);
          }
        });
        setRules(requirements);

        const teamEntry = standingsData.find((s: any) => 
          s.team?.toString().trim().toUpperCase() === selectedTeam.trim().toUpperCase() ||
          s.teamshort?.toString().trim().toUpperCase() === selectedTeam.trim().toUpperCase()
        );

        const [rosterRes, scheduleRes] = await Promise.all([
          fetch(`/api/rosters/${selectedTeam}`),
          fetch(`/api/schedule?team=${teamEntry?.teamshort || selectedTeam}`)
        ]);

        const rosterData = await rosterRes.json();
        const scheduleData = await scheduleRes.json();

        //const TARGET_YEAR = "2025";

        // Find the year setting (assuming it's named 'current_year' in your sheet)
        const yearRule = rulesData.find((r: any) => r.setting === 'cut_year');
        const DYNAMIC_YEAR = yearRule ? yearRule.value.toString() : "2025"; // Fallback to 2025

        let wins = 0; let losses = 0; let pf = 0; let pa = 0;
        const teamName = (teamEntry?.team || "").trim().toUpperCase();
        const teamShort = (teamEntry?.teamshort || selectedTeam).trim().toUpperCase();

        scheduleData
          .filter((g: any) => g.year === DYNAMIC_YEAR && g.status === "Final")
          .forEach((game: any) => {
            const hS = parseInt(game.hScore) || 0;
            const vS = parseInt(game.vScore) || 0;
            const isHome = game.home.toUpperCase() === teamName || game.home.toUpperCase() === teamShort;
            const isAway = game.visitor.toUpperCase() === teamName || game.visitor.toUpperCase() === teamShort;

            if (isHome) {
              pf += hS; pa += vS;
              if (hS > vS) wins++; else if (vS > hS) losses++;
            } else if (isAway) {
              pf += vS; pa += hS;
              if (vS > hS) wins++; else if (hS > vS) losses++;
            }
          });

        setData({
          roster: rosterData.roster || [],
          picks: rosterData.picks || [],
          schedule: scheduleData || [],
          stats: { ...teamEntry, wins, losses, pf, diff: pf - pa, currentYear: DYNAMIC_YEAR }
        });
      } catch (err) {
        console.error("Load Error:", err);
      } finally {
        setLoading(false);
      }
    };

    loadFranchiseData();
  }, [selectedTeam]);

  // SCROLL EFFECT
  useEffect(() => {
    if (data?.schedule && !loading) {
      requestAnimationFrame(() => {
        if (lastPlayedRef.current) {
          lastPlayedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [data, loading]);

  // TEAM NEEDS CALCULATION
  const teamNeeds = useMemo(() => {
    if (!data?.roster || Object.keys(rules).length === 0) return [];

    const counts: Record<string, number> = {};
    data.roster.forEach(p => {
      let pos = (p.pos || "").toUpperCase();
      if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C', 'T', 'G', 'OL'].includes(pos)) pos = 'OL';
      if (['DE', 'DT', 'NT', 'DL'].includes(pos)) pos = 'DL';
      if (['ILB', 'OLB', 'LB', 'LB-S'].includes(pos)) pos = 'LB';
      if (['CB', 'LB-S', 'S', 'DB'].includes(pos)) pos = 'DB';
      counts[pos] = (counts[pos] || 0) + 1;
    });

    return Object.entries(rules).map(([pos, min]) => {
      const current = counts[pos] || 0;
      const diff = min - current;
      return {
        pos,
        current,
        min,
        status: diff > 0 ? (diff >= 2 ? 'CRITICAL' : 'THIN') : 'SOLID'
      };
    });
  }, [data?.roster, rules]);

  const fetchPlayerDetails = async (p: any) => {
    const firstName = p.name.split(' ')[0].toLowerCase();
    const lastName = p.name.split(' ').pop().toLowerCase();
    const clean = (val: string) => val ? val.split(/[\/,]/)[0].trim().toLowerCase() : '';

    const identity = `${firstName}|${lastName}|${p.age || ''}|${clean(p.offensePos)}|${clean(p.defensePos)}|${clean(p.specialPos)}`;
    
    try {
      const r = await fetch(`/api/players/details/${encodeURIComponent(identity)}`);
      if (r.ok) {
        setViewingPlayer(await r.json()); 
      } else {
        alert(`Scouting 404: No match for [${identity}]`);
      }
    } catch (e) {
      console.error("API ERROR:", e);
    }
  };

  const recentForm = useMemo(() => {
    if (!data?.schedule || !data?.stats?.currentYear || !selectedTeam) return [];
    const teamName = (data.stats.team || "").trim().toUpperCase();
    const teamShort = (data.stats.teamshort || selectedTeam || "").trim().toUpperCase();

    return data.schedule
      .filter(g => g.year === data.stats.currentYear && g.status === "Final" && 
        ([g.home.toUpperCase(), g.visitor.toUpperCase()].includes(teamName) || 
         [g.home.toUpperCase(), g.visitor.toUpperCase()].includes(teamShort)))
      .sort((a, b) => parseInt(a.week) - parseInt(b.week))
      .slice(-5)
      .map(game => {
        const isHome = [game.home.toUpperCase()].includes(teamName) || [game.home.toUpperCase()].includes(teamShort);
        return isHome ? (parseInt(game.hScore) > parseInt(game.vScore)) : (parseInt(game.vScore) > parseInt(game.hScore));
      });
  }, [data?.schedule, data?.stats, selectedTeam]);

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
      SPEC: sortFn(data.roster.filter(p => ['SPEC', 'ST', 'SPECIAL'].includes(p.group))),
    };
  }, [data, sortBy]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900 text-left">
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <div className="text-left">
          <h1 className="text-2xl font-black tracking-tight text-slate-800 uppercase leading-none italic">Roster Explorer</h1>
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-[0.2em] mt-2 italic">Active Scouting & Depth Charts</p>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex bg-gray-100 p-1 rounded-lg">
             {(['default', 'name', 'pos'] as const).map((s) => (
               <button key={s} onClick={() => setSortBy(s)}
                 className={`px-3 py-1 text-[10px] font-bold uppercase rounded ${sortBy === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}
               >
                 {s}
               </button>
             ))}
           </div>
           <TeamSelector />
        </div>
      </div>

      {/* TEAM STATS STRIP */}
      {data?.stats && (
        <div className="bg-slate-900 text-white rounded-2xl p-5 flex flex-wrap items-center justify-between shadow-xl border border-slate-800">
          <div className="flex items-center gap-4">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <div className="text-left">
               <h2 className="text-xl font-black uppercase italic tracking-tighter leading-none">
                 {data.stats.team || selectedTeam} <span className="text-blue-500 not-italic ml-1">{data.stats.nickname || 'Franchise'}</span>
               </h2>
               <div className="flex items-center gap-3 mt-2">
                 <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                   COACH {data.stats.coach?.toUpperCase() || (selectedTeam.toUpperCase() === 'VICO' ? 'GEORGE DI MARTINO' : 'UNASSIGNED')}
                 </p>
                 <div className="h-3 w-[1px] bg-slate-700" />
                 <div className="flex items-center gap-1.5">
                   <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Form:</span>
                   <div className="flex gap-1.5">
                     {recentForm.map((isWin, i) => (
                       <div key={i} className={`w-2.5 h-2.5 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
                     ))}
                   </div>
                 </div>
               </div>
            </div>
          </div>
          <div className="flex gap-8">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">{data.stats.currentYear} Record</p>
              <p className="text-lg font-black">{data.stats.wins}-{data.stats.losses}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest">Diff</p>
              <p className={`text-lg font-black ${data.stats.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.stats.diff > 0 ? `+${data.stats.diff}` : data.stats.diff}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* POSITIONAL STRENGTH DASHBOARD */}
      {!loading && teamNeeds.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
           <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Positional Count vs Minimum Requirements</h3>
           <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-3">
              {teamNeeds.map((need) => (
                <div key={need.pos} className={`p-3 rounded-lg border text-center flex flex-col justify-center ${
                  need.status === 'CRITICAL' ? 'bg-red-50 border-red-200' : 
                  need.status === 'THIN' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
                }`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-1">{need.pos}</p>
                  <p className={`text-sm font-black ${need.status === 'CRITICAL' ? 'text-red-600' : 'text-slate-800'}`}>
                    {need.current}<span className="text-[10px] text-slate-400 font-bold">/{need.min}</span>
                  </p>
                </div>
              ))}
           </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" /></div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* OFFENSE AND DEFENSE COLUMNS */}
          {(['OFF', 'DEF'] as const).map((unit) => (
            <div key={unit} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden h-fit">
              <div className={`px-4 py-3 font-black text-white flex justify-between items-center ${unit === 'OFF' ? 'bg-slate-800' : 'bg-red-900'}`}>
                <span className="tracking-tighter uppercase">{unit}ENSE</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] uppercase">{sortedGroups[unit].length} Plyrs</span>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedGroups[unit].map((p, i) => (
                  <div key={i} className="group flex items-center justify-between p-3 hover:bg-blue-50/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded w-10 text-center">{p.pos}</span>
                      <div className="flex flex-col text-left">
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 uppercase leading-none hover:text-blue-600 hover:underline">
                          {p.name}
                        </a>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1 italic">AGE: {p.age || '—'}</span>
                      </div>
                    </div>
                    <button onClick={() => fetchPlayerDetails(p)} className="bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded shadow-sm italic hover:bg-blue-700">
                      Details
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* RIGHT COLUMN: SCHEDULE, DRAFT CAPITAL, SPECIAL TEAMS */}
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 font-black text-white bg-blue-600 flex justify-between items-center uppercase tracking-tighter">
                <span>Schedule & Results</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px] italic">{data.stats.currentYear} SEASON</span>
              </div>
              <div className="divide-y divide-gray-100 overflow-y-auto max-h-[300px] custom-scrollbar">
                {data.schedule?.filter(g => g.year === data.stats.currentYear).map((game: any, i: number, arr: any[]) => {
                  const targetIdx = arr.map(g => g.status).lastIndexOf("Final");
                  const teamKey = selectedTeam.toUpperCase();
                  const isHome = game.home?.toUpperCase() === teamKey;
                  const opponent = isHome ? game.visitor : game.home;
                  const isPlayed = game.status === "Final";
                  const isWin = isPlayed && (parseInt(isHome ? game.hScore : game.vScore) > parseInt(isHome ? game.vScore : game.hScore));
                  
                  return (
                    <div key={i} ref={i === targetIdx ? lastPlayedRef : null} className={`flex items-center justify-between p-3 transition-colors ${i === targetIdx ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : 'hover:bg-slate-50'}`}>
                      <div className="flex flex-col text-left">
                        <span className={`text-[9px] font-black uppercase tracking-widest leading-none ${i === targetIdx ? 'text-amber-600' : 'text-slate-400'}`}>
                          Week {game.week} {i === targetIdx && "• LATEST"}
                        </span>
                        <span className="text-xs font-bold text-slate-800 uppercase tracking-tighter mt-1 leading-none">
                          {isHome ? 'vs' : '@'} {opponent}
                        </span>
                      </div>
                      <div className={`font-mono text-sm font-black ${isPlayed ? (isWin ? 'text-emerald-600' : 'text-red-500') : 'text-slate-200 italic'}`}>
                        {isPlayed ? (isHome ? `${game.hScore}-${game.vScore}` : `${game.vScore}-${game.hScore}`) : 'Upcoming'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 rounded-2xl shadow-xl p-5 border border-slate-800">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-black text-white text-xs tracking-widest uppercase">Draft Capital</h3>
                  <span className="text-slate-500 font-mono text-xs uppercase italic">{data.picks?.length || 0} Assets</span>
                </div>
                <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.picks?.map((pick: any, i: number) => (
                    <div key={i} className="bg-slate-800/50 border border-slate-700 p-3 rounded-xl flex items-center gap-4 transition-all">
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-lg flex flex-col items-center justify-center flex-shrink-0 shadow-lg">
                        <span className="text-[8px] font-black leading-none">{pick.year}</span>
                        <span className="text-sm font-black italic uppercase leading-none">R{pick.round}</span>
                      </div>
                      <div className="flex-grow text-left">
                        <p className="text-white font-black text-sm uppercase tracking-tight">Pick #{pick.overall || '??'}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase italic">From: <span className="text-blue-400">{pick.originalTeam || 'VV'}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 font-black text-white bg-indigo-900 flex justify-between items-center uppercase">
                <span>Special Teams</span>
                <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{sortedGroups.SPEC.length}</span>
              </div>
              <div className="divide-y divide-gray-100">
                {sortedGroups.SPEC.map((p, i) => (
                  <div key={i} className="group flex items-center justify-between p-3">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-[11px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded w-10 text-center uppercase">{p.pos}</span>
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name + ' stats')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 uppercase leading-none hover:text-indigo-600 hover:underline">
                        {p.name}
                      </a>
                    </div>
                    <button onClick={() => fetchPlayerDetails(p)} className="bg-indigo-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded shadow-sm hover:bg-indigo-700">
                      Details
                    </button>
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