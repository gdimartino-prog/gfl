'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PlayerCard from '@/components/PlayerCard';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';
import { useSession } from "next-auth/react";
import { Search } from 'lucide-react'; // Added icon for search

export const dynamic = 'force-dynamic';

const positionWeights: Record<string, number> = {
  'QB': 1, 'RB': 2, 'HB': 2, 'FB': 3, 'WR': 4, 'TE': 5,
  'OT': 6, 'LT': 6, 'RT': 6, 'T': 6, 'OG': 7, 'LG': 7, 'RG': 7, 'G': 7, 'C': 8, 'OL': 9,
  'DT': 10, 'NT': 11, 'DE': 12, 'DL': 13, 'MLB': 14, 'ILB': 15, 'OLB': 16, 'LB': 17,
  'CB': 18, 'FS': 19, 'SS': 20, 'S': 21, 'DB': 22,
  'K': 30, 'P': 31, 'LS': 32, 'KR': 33, 'PR': 34
};

export default function RosterPage() {
  const { data: session, status } = useSession();
  const { selectedTeam, setSelectedTeam } = useTeam(); 
  const [data, setData] = useState<{ roster: any[], picks: any[], schedule: any[], stats: any } | null>(null);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'pos'>('default');
  const [viewingPlayer, setViewingPlayer] = useState<any>(null);
  
  // NEW: Search state
  const [searchTerm, setSearchTerm] = useState('');
  
  const lastPlayedRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);

  // 1. SESSION SYNC
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.id && !hasSynced.current) {
      setSelectedTeam((session.user as any).id);
      hasSynced.current = true;
    }
  }, [status, session, setSelectedTeam]);

  // 2. DATA FETCHING
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

        const yearRule = rulesData.find((r: any) => r.setting === 'cut_year');
        const DYNAMIC_YEAR = yearRule ? yearRule.value.toString() : "2025";

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

  // 3. SCROLL EFFECT
  useEffect(() => {
    if (data?.schedule && !loading) {
      requestAnimationFrame(() => {
        if (lastPlayedRef.current) {
          lastPlayedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      });
    }
  }, [data, loading]);

  // 4. TEAM NEEDS CALCULATION
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
      return { pos, current, min, status: diff > 0 ? (diff >= 2 ? 'CRITICAL' : 'THIN') : 'SOLID' };
    });
  }, [data?.roster, rules]);

  // 5. PLAYER DETAILS FETCH
  const fetchPlayerDetails = async (p: any) => {
    const identity = p.identity; 
    if (!identity) return;
    try {
      const r = await fetch(`/api/players/details/${encodeURIComponent(identity)}`);
      if (r.ok) setViewingPlayer(await r.json()); 
    } catch (e) { console.error(e); }
  };

  // 6. RECENT FORM LOGIC
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

  // 7. SORTING & SEARCH LOGIC
  const sortedGroups = useMemo(() => {
    if (!data?.roster) return { OFF: [], DEF: [], SPEC: [] };
    
    // Apply Filter first
    const filtered = data.roster.filter(p => 
      p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.pos.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const sortFn = (players: any[]) => {
      const list = [...players];
      if (sortBy === 'name') return list.sort((a, b) => a.name.split(' ').pop().localeCompare(b.name.split(' ').pop()));
      if (sortBy === 'pos') return list.sort((a, b) => a.pos.localeCompare(b.pos));
      return list.sort((a, b) => (positionWeights[a.pos] || 99) - (positionWeights[b.pos] || 99));
    };

    return {
      OFF: sortFn(filtered.filter(p => p.group === 'OFF')),
      DEF: sortFn(filtered.filter(p => p.group === 'DEF')),
      SPEC: sortFn(filtered.filter(p => ['SPEC', 'ST', 'SPECIAL'].includes(p.group))),
    };
  }, [data, sortBy, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen text-slate-900 text-left">
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}

      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8">
        <div className="text-left space-y-1">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Roster <span className="text-blue-600">Explorer</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-1">
             Active Scouting & Depth Charts • Season {data?.stats?.currentYear}
          </p>
          <div className="flex bg-gray-200/50 p-1 rounded-lg w-fit mt-6">
            {(['default', 'name', 'pos'] as const).map((s) => (
              <button key={s} onClick={() => setSortBy(s)}
                className={`px-4 py-1.5 text-[10px] font-black uppercase rounded-md transition-all ${sortBy === s ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-slate-600'}`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
        <div className="w-full md:w-96">
           <TeamSelector />
        </div>
      </div>

      {/* TEAM STATS STRIP */}
      {data?.stats && (
        <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-wrap items-center justify-between shadow-2xl border border-slate-800">
          <div className="flex items-center gap-6 text-left">
            <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]" />
            <div>
                <h2 className="text-2xl font-black uppercase italic tracking-tighter leading-none text-white">
                  {data.stats.team || selectedTeam} <span className="text-blue-500 not-italic ml-1">{data.stats.nickname || 'Franchise'}</span>
                </h2>
                <div className="flex items-center gap-4 mt-3">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-none">
                    COACH {data.stats.coach?.toUpperCase() || 'UNASSIGNED'}
                  </p>
                  <div className="h-3 w-[1px] bg-slate-700" />
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-none">Form:</span>
                    <div className="flex gap-1.5">
                      {recentForm.map((isWin, i) => (
                        <div key={i} className={`w-2.5 h-2.5 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
                      ))}
                    </div>
                  </div>
                </div>
            </div>
          </div>
          <div className="flex gap-10 pr-4">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest leading-none mb-2">Record</p>
              <p className="text-2xl font-black text-white">{data.stats.wins}-{data.stats.losses}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest leading-none mb-2">Diff</p>
              <p className={`text-2xl font-black ${data.stats.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {data.stats.diff > 0 ? `+${data.stats.diff}` : data.stats.diff}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* SEARCH BAR SECTION */}
      <div className="relative w-full">
        <div className="absolute inset-y-0 left-0 pl-6 flex items-center pointer-events-none">
          <Search className="h-5 w-5 text-slate-400" />
        </div>
        <input 
          type="text" 
          placeholder="Filter roster by player name or position (e.g. 'QB')..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-white border-2 border-slate-100 rounded-2xl py-5 pl-14 pr-6 text-slate-800 font-bold placeholder:text-slate-300 shadow-sm focus:border-blue-500 focus:ring-0 outline-none transition-all text-lg"
        />
        {searchTerm && (
          <button 
            onClick={() => setSearchTerm('')}
            className="absolute inset-y-0 right-0 pr-6 flex items-center text-[10px] font-black text-slate-300 uppercase tracking-widest hover:text-blue-500 transition-colors"
          >
            Clear Filter
          </button>
        )}
      </div>

      {/* POSITIONAL DASHBOARD */}
      {!loading && teamNeeds.length > 0 && !searchTerm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 text-left italic">Positional Count vs Minimum Requirements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-10 gap-4">
               {teamNeeds.map((need) => (
                 <div key={need.pos} className={`p-4 rounded-xl border text-center flex flex-col justify-center transition-all ${
                   need.status === 'CRITICAL' ? 'bg-red-50 border-red-200' : 
                   need.status === 'THIN' ? 'bg-amber-50 border-amber-200' : 'bg-slate-50 border-slate-100'
                 }`}>
                   <p className="text-[9px] font-black text-slate-400 uppercase leading-none mb-2 text-center">{need.pos}</p>
                   <p className={`text-lg font-black ${need.status === 'CRITICAL' ? 'text-red-600' : 'text-slate-800'}`}>
                     {need.current}<span className="text-[11px] text-slate-300 font-bold ml-0.5">/{need.min}</span>
                   </p>
                 </div>
               ))}
            </div>
        </div>
      )}

      {/* ROSTER CONTENT */}
      {loading ? (
        <div className="flex justify-center py-24 font-black text-slate-300 uppercase tracking-widest animate-pulse italic text-center">Syncing...</div>
      ) : data && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
          {/* OFFENSE */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden h-fit">
            <div className="px-6 py-4 font-black text-white bg-slate-800 flex justify-between items-center uppercase tracking-tighter">
              <span>OFFENSE</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{sortedGroups.OFF.length} Results</span>
            </div>
            <div className="divide-y divide-gray-50">
              {sortedGroups.OFF.length > 0 ? sortedGroups.OFF.map((p, i) => (
                <div key={i} className="group flex items-center justify-between p-4 hover:bg-blue-50/50 transition-colors text-left">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-1 rounded w-10 text-center uppercase">{p.pos}</span>
                    <div className="flex flex-col">
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 uppercase leading-none hover:text-blue-600 hover:underline">{p.name}</a>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1.5 italic leading-none">AGE: {p.age || '—'}</span>
                    </div>
                  </div>
                  <button onClick={() => fetchPlayerDetails(p)} className="bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded hover:bg-blue-700 italic shadow-sm transition-all active:scale-95">Details</button>
                </div>
              )) : <div className="p-10 text-center text-slate-300 italic text-xs uppercase font-bold">No Offense Found</div>}
            </div>
          </div>

          {/* DEFENSE */}
          <div className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden h-fit">
            <div className="px-6 py-4 font-black text-white bg-red-900 flex justify-between items-center uppercase tracking-tighter">
              <span>DEFENSE</span>
              <span className="bg-white/10 px-2 py-0.5 rounded text-[10px]">{sortedGroups.DEF.length} Results</span>
            </div>
            <div className="divide-y divide-gray-50 text-left">
              {sortedGroups.DEF.length > 0 ? sortedGroups.DEF.map((p, i) => (
                <div key={i} className="group flex items-center justify-between p-4 hover:bg-red-50/30 transition-colors">
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-[11px] font-black text-red-600 bg-red-50 px-2 py-1 rounded w-10 text-center uppercase">{p.pos}</span>
                    <div className="flex flex-col">
                      <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name)}`} target="_blank" rel="noopener noreferrer" className="text-sm font-bold text-slate-800 uppercase leading-none hover:text-blue-600 hover:underline">{p.name}</a>
                      <span className="text-[10px] font-bold text-gray-400 uppercase tracking-tighter mt-1.5 italic leading-none">AGE: {p.age || '—'}</span>
                    </div>
                  </div>
                  <button onClick={() => fetchPlayerDetails(p)} className="bg-blue-600 text-white text-[10px] font-black uppercase px-3 py-1 rounded hover:bg-blue-700 italic shadow-sm transition-all active:scale-95">Details</button>
                </div>
              )) : <div className="p-10 text-center text-slate-300 italic text-xs uppercase font-bold">No Defense Found</div>}
            </div>
          </div>

          <div className="space-y-8">
            {/* SCHEDULE */}
            <div className="bg-white rounded-[2rem] shadow-xl border border-gray-200 overflow-hidden text-left">
              <div className="px-6 py-4 font-black text-white bg-blue-600 flex justify-between items-center uppercase tracking-tighter">
                <span>League Schedule</span>
              </div>
              <div className="divide-y divide-gray-50 overflow-y-auto max-h-[400px] custom-scrollbar">
                {data.schedule?.filter(g => g.year === data.stats.currentYear).map((game: any, i: number, arr: any[]) => {
                  const targetIdx = arr.map(g => g.status).lastIndexOf("Final");
                  const teamName = (data.stats.team || "").trim().toUpperCase();
                  const teamShort = (data.stats.teamshort || selectedTeam || "").trim().toUpperCase();
                  const isHome = [game.home.toUpperCase()].includes(teamName) || [game.home.toUpperCase()].includes(teamShort);
                  const opponent = isHome ? game.visitor : game.home;
                  const isPlayed = game.status === "Final";
                  const isWin = isPlayed && (isHome ? (parseInt(game.hScore) > parseInt(game.vScore)) : (parseInt(game.vScore) > parseInt(game.hScore)));
                  
                  return (
                    <div key={i} ref={i === targetIdx ? lastPlayedRef : null} className={`flex items-center justify-between p-4 transition-colors ${i === targetIdx ? 'bg-amber-50' : 'hover:bg-slate-50'}`}>
                      <div className="flex flex-col text-left">
                        <span className={`text-[9px] font-black uppercase tracking-widest ${i === targetIdx ? 'text-amber-600' : 'text-slate-400'}`}>Week {game.week}</span>
                        <span className="text-xs font-bold text-slate-800 uppercase mt-1 leading-none">{isHome ? 'vs' : '@'} {opponent}</span>
                      </div>
                      <div className={`font-mono text-sm font-black ${isPlayed ? (isWin ? 'text-emerald-600' : 'text-red-500') : 'text-slate-200 italic'}`}>
                        {isPlayed ? (isHome ? `${game.hScore}-${game.vScore}` : `${game.vScore}-${game.hScore}`) : 'UPCOMING'}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* DRAFT CAPITAL */}
            <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-6 border border-slate-800 text-left">
                <h3 className="font-black text-white text-xs tracking-[0.3em] uppercase mb-6 flex items-center gap-2 text-left text-white">Draft Capital</h3>
                <div className="space-y-4 max-h-[450px] overflow-y-auto pr-2 custom-scrollbar">
                  {data.picks?.map((pick: any, i: number) => (
                    <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-2xl flex items-center gap-5">
                      <div className="bg-blue-600 text-white w-12 h-12 rounded-xl flex flex-col items-center justify-center shadow-lg font-black leading-none flex-shrink-0">
                        <span className="text-[9px] mb-0.5">{pick.year}</span>
                        <span className="text-base italic uppercase">R{pick.round}</span>
                      </div>
                      <div className="flex-grow text-left">
                        <p className="text-white font-black text-sm uppercase tracking-tight leading-none mb-1.5 text-left">Pick #{pick.overall || '??'}</p>
                        <p className="text-[10px] font-bold text-slate-500 uppercase italic leading-none text-left">Origin: <span className="text-blue-400/80">{pick.originalTeam || '—'}</span></p>
                      </div>
                    </div>
                  ))}
                </div>
            </div>
          </div>
        </div>
      )}
      {/* FOOTER INFO (For Debugging) */}
      <div className="mt-20 p-8 bg-slate-900 rounded-t-[3rem] border-t border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-widest flex flex-wrap gap-10 justify-center">
          <p>LOGGED_COACH: <span className="text-white">{session?.user?.name || 'GUEST'}</span></p>
          <p>AUTH_ID: <span className="text-emerald-400">{(session?.user as any)?.id || 'NONE'}</span></p>
          <p>SYNC_LOCK: <span className="text-blue-400">{hasSynced.current ? "ENGAGED" : "OPEN"}</span></p>
      </div>
    </div>
  );
}