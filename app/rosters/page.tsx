'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';
import { useSession } from "next-auth/react";
import { Search, ChevronRight, ExternalLink, Star, Activity, GraduationCap, ShieldCheck } from 'lucide-react';
import { Player, Team, DraftPick } from '../../types';

export const dynamic = 'force-dynamic';

const positionWeights: Record<string, number> = {
  'QB': 1, 'RB': 2, 'HB': 2, 'FB': 3, 'WR': 4, 'TE': 5,
  'OT': 6, 'LT': 6, 'RT': 6, 'T': 6, 'OG': 7, 'LG': 7, 'RG': 7, 'G': 7, 'C': 8, 'OL': 9,
  'DT': 10, 'NT': 11, 'DE': 12, 'DL': 13, 'MLB': 14, 'ILB': 15, 'OLB': 16, 'LB': 17,
  'CB': 18, 'FS': 19, 'SS': 20, 'S': 21, 'DB': 22,
  'K': 30, 'P': 31, 'LS': 32, 'KR': 33, 'PR': 34
};

const positionOrder = [
  'QB', 'RB', 'WR', 'TE', 'LT', 'LG', 'C', 'RG', 'RT', 'OL',
  'DE', 'DT', 'NT', 'LB', 'CB', 'S', 'K', 'P'
];

export default function RosterPage() {
  const { data: session, status } = useSession();
  const { selectedTeam, setSelectedTeam } = useTeam(); 
  const [data, setData] = useState<{ roster: Player[], picks: DraftPick[], history: DraftPick[], schedule: any[], stats: any } | null>(null);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'pos'>('default');
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'HISTORY'>('ROSTER');
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const lastPlayedRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.id && !hasSynced.current) {
      setSelectedTeam((session.user as any).id);
      hasSynced.current = true;
    }
  }, [status, session, setSelectedTeam]);

  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true);

    const loadFranchiseData = async () => {
      try {
        const [standingsRes, rulesRes, draftPicksRes] = await Promise.all([
          fetch(`/api/standings`),
          fetch(`/api/rules`),
          fetch(`/api/draft-picks`)
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
        const allDraftPicks = await draftPicksRes.json();

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

        const yearRule = rulesData.find((r: any) => r.setting === 'cuts_year');
        const DYNAMIC_YEAR = yearRule ? yearRule.value.toString() : "2025";

        let pf = 0; let pa = 0;
        scheduleData.filter((g: any) => g.year === DYNAMIC_YEAR && g.status === "Final").forEach((game: any) => {
            const isHome = [game.home.toUpperCase()].includes(teamEntry?.team?.toUpperCase()) || [game.home.toUpperCase()].includes(teamEntry?.teamshort?.toUpperCase());
            if (isHome) { pf += parseInt(game.hScore); pa += parseInt(game.vScore); }
            else { pf += parseInt(game.vScore); pa += parseInt(game.hScore); }
        });

        // Filter for history: Match by team code in parentheses or full string
        const history = Array.isArray(allDraftPicks) ? allDraftPicks.filter((p: any) => {
          const ownerStr = p.currentOwner || "";
          const match = ownerStr.match(/\(([^)]+)\)/);
          const code = (match ? match[1] : ownerStr).trim().toUpperCase();
          return code === selectedTeam.trim().toUpperCase() && 
                 p.draftedPlayer && p.draftedPlayer.trim() !== "" && !p.draftedPlayer.includes("SKIPPED");
        }).sort((a: any, b: any) => Number(b.year) - Number(a.year) || Number(a.overall) - Number(b.overall)) : [];

        setData({
          roster: rosterData.roster || [],
          picks: rosterData.picks || [],
          history: history,
          schedule: scheduleData || [],
          stats: { ...teamEntry, diff: pf - pa, currentYear: DYNAMIC_YEAR }
        });
      } catch (err) { console.error(err); } finally { setLoading(false); }
    };
    loadFranchiseData();
  }, [selectedTeam]);

  useEffect(() => {
    if (data?.schedule && !loading) {
      const scrollTimer = setTimeout(() => {
        if (lastPlayedRef.current) {
          lastPlayedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 600);
      return () => clearTimeout(scrollTimer);
    }
  }, [data, loading]);

  const recentForm = useMemo(() => {
    if (!data?.schedule || !data?.stats?.currentYear) return [];
    const teamName = (data.stats.team || "").toUpperCase();
    return data.schedule
      .filter(g => g.year === data.stats.currentYear && g.status === "Final" && (g.home.toUpperCase() === teamName || g.visitor.toUpperCase() === teamName))
      .sort((a, b) => parseInt(a.week) - parseInt(b.week))
      .slice(-5)
      .map(game => {
        const isHome = game.home.toUpperCase() === teamName;
        return isHome ? (parseInt(game.hScore) > parseInt(game.vScore)) : (parseInt(game.vScore) > parseInt(game.hScore));
      });
  }, [data]);

  const totalSalary = useMemo(() => {
    if (!data?.roster) return 0;
    return data.roster.reduce((acc, p) => {
      const s = Number(String(p.salary || 0).replace(/[^0-9.-]+/g,""));
      return acc + s;
    }, 0);
  }, [data?.roster]);

  const teamNeeds = useMemo(() => {
    if (!data?.roster || Object.keys(rules).length === 0) return [];
    const counts: Record<string, number> = {};
    data.roster.forEach(p => {
      let pos = (p.pos || p.position || "").toUpperCase();
      if (['OT', 'LT', 'RT', 'OG', 'LG', 'RG', 'C', 'T', 'G', 'OL'].includes(pos)) pos = 'OL';
      if (['DE', 'DT', 'NT', 'DL'].includes(pos)) pos = 'DL';
      if (['ILB', 'OLB', 'MLB', 'LB', 'LB-S'].includes(pos)) pos = 'LB';
      if (['CB', 'LB-S', 'S', 'DB'].includes(pos)) pos = 'DB';
      counts[pos] = (counts[pos] || 0) + 1;
    });
    return Object.entries(rules).map(([pos, min]) => {
      const current = counts[pos] || 0;
      return { pos, current, min, status: (min - current) > 0 ? 'THIN' : 'SOLID' };
    });
  }, [data?.roster, rules]);

  const sortedGroups = useMemo(() => {
    if (!data?.roster) return { OFF: [] as Player[], DEF: [] as Player[], SPEC: [] as Player[] };
    const filtered = data.roster.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.pos || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const sortFn = (players: Player[]) => [...players].sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').split(' ').pop()!.localeCompare((b.name || '').split(' ').pop()!);
        if (sortBy === 'pos') return (a.pos || '').localeCompare(b.pos || '');
        return (positionWeights[a.pos || ''] || 99) - (positionWeights[b.pos || ''] || 99);
    });
    return {
      OFF: sortFn(filtered.filter(p => p.group === 'OFF')),
      DEF: sortFn(filtered.filter(p => p.group === 'DEF')),
      SPEC: sortFn(filtered.filter(p => p.group && ['SPEC', 'ST', 'SPECIAL'].includes(p.group))),
    };
  }, [data, sortBy, searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    return data.history.filter(p => 
      (p.draftedPlayer || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.year || '').toString().includes(searchTerm)
    );
  }, [data?.history, searchTerm]);

  const needsMap = useMemo(() => {
    const map: Record<string, boolean> = {};
    teamNeeds.forEach(n => {
      if (n.status === 'THIN') map[n.pos] = true;
    });
    return map;
  }, [teamNeeds]);

  const depthGroups = useMemo(() => {
    if (!data?.roster) return {} as Record<string, Player[]>;
    return data.roster.reduce((acc, p) => {
      let pos = (p.pos || p.position || '??').trim().toUpperCase();
      // Normalize some positions for the chart
      if (['HB', 'FB'].includes(pos)) pos = 'RB';
      if (['ILB', 'OLB', 'MLB'].includes(pos)) pos = 'LB';
      if (['FS', 'SS'].includes(pos)) pos = 'S';
      
      if (!acc[pos]) acc[pos] = [];
      acc[pos].push(p);
      return acc;
    }, {} as Record<string, Player[]>);
  }, [data?.roster]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Roster <span className="text-blue-600">Explorer</span></h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2"><Activity size={14} className="text-emerald-500" /> Personnel Terminal • Season {data?.stats?.currentYear}</p>
        </div>
        <div className="w-full md:w-80"><TeamSelector /></div>
      </header>

      {/* TEAM STATS STRIP (dots and record restored) */}
      {data?.stats && (
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 flex flex-wrap items-center justify-between shadow-2xl border border-slate-800">
          <div className="flex items-center gap-8">
            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
            <div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{data.stats.team} <span className="text-blue-500 not-italic ml-2">{data.stats.nickname}</span></h2>
              <div className="flex items-center gap-4 mt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">COACH: {data.stats.coach?.toUpperCase()}</p>
                <div className="h-4 w-[1px] bg-slate-700" />
                <div className="flex gap-1.5">
                  {recentForm.map((isWin, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  ))}
                </div>
                <div className="h-4 w-[1px] bg-slate-700" />
                <div className="flex flex-col gap-1">
                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                    SALARY: ${totalSalary.toLocaleString()}
                  </p>
                  <div className="w-32 h-1 bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-1000 ${totalSalary > 250000000 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (totalSalary / 250000000) * 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="flex gap-12 pr-6">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-3">Record</p>
              <p className="text-4xl font-black italic tracking-tighter">{data.stats.wins || 0}-{data.stats.losses || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-3">Diff</p>
              <p className={`text-4xl font-black italic tracking-tighter ${data.stats.diff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data.stats.diff}</p>
            </div>
          </div>
        </div>
      )}

      {/* TAB SWITCHER */}
      <div className="flex bg-white p-1.5 rounded-[1.5rem] shadow-sm border border-slate-200 w-fit">
        <button 
          onClick={() => setActiveTab('ROSTER')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'ROSTER' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}
        >
          Personnel & Depth
        </button>
        <button 
          onClick={() => setActiveTab('HISTORY')}
          className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase transition-all ${activeTab === 'HISTORY' ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}
        >
          Draft History
        </button>
      </div>

      {/* FILTERS */}
      <div className="flex flex-col xl:flex-row gap-6">
        <div className="relative flex-1">
          <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input type="text" placeholder={activeTab === 'ROSTER' ? "Filter roster..." : "Search draft history..."} value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-6 pl-16 pr-8 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg shadow-sm" />
        </div>
        {activeTab === 'ROSTER' && (
          <div className="flex bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-200 gap-2">
          {['default', 'name', 'pos'].map((s: any) => (
            <button key={s} onClick={() => setSortBy(s)} className={`px-8 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${sortBy === s ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>{s}</button>
          ))}
        </div>
        )}
      </div>

      {/* POSITIONAL DASHBOARD */}
      {activeTab === 'ROSTER' && !searchTerm && !loading && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 p-8">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-8 flex items-center gap-2 italic"><GraduationCap size={16} /> Positional Requirements</h3>
            <div className="grid grid-cols-2 sm:grid-cols-5 md:grid-cols-10 gap-3">
              {teamNeeds.map((need) => (
                <div key={need.pos} className={`p-4 rounded-2xl border-2 flex flex-col items-center justify-center ${need.status === 'THIN' ? 'bg-red-50 border-red-200' : 'bg-slate-50 border-slate-100'}`}>
                  <p className="text-[9px] font-black text-slate-400 uppercase mb-2 leading-none">{need.pos}</p>
                  <p className="text-xl font-black italic">{need.current}<span className="text-[11px] text-slate-300 ml-1">{"/"}{need.min}</span></p>
                </div>
              ))}
            </div>
        </div>
      )}

      {/* MAIN CONTENT */}
      {data && activeTab === 'ROSTER' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 pb-20">
          <div className="lg:col-span-8 grid grid-cols-1 md:grid-cols-2 gap-8">
             <RosterSection title="Offense" players={sortedGroups.OFF} accent="bg-slate-800" color="text-blue-600 bg-blue-50" onDetails={(p: Player) => fetch(`/api/players/details/${encodeURIComponent(p.identity)}`).then(r => r.json()).then(setViewingPlayer)} />
             <RosterSection title="Defense" players={sortedGroups.DEF} accent="bg-red-900" color="text-red-600 bg-red-50" onDetails={(p: Player) => fetch(`/api/players/details/${encodeURIComponent(p.identity)}`).then(r => r.json()).then(setViewingPlayer)} />
          </div>

          <div className="lg:col-span-4 space-y-10">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden text-left">
              <div className="px-8 py-5 font-black text-white bg-blue-600 uppercase tracking-widest text-[10px]"><span>Schedule</span></div>
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {data.schedule?.filter(g => g.year === data.stats?.currentYear).map((game, i, arr) => {
                  const targetIdx = arr.map(g => g.status).lastIndexOf("Final");
                  const teamName = (data.stats.team || "").toUpperCase();
                  const isHome = game.home.toUpperCase() === teamName;
                  const isWin = isHome ? (parseInt(game.hScore) > parseInt(game.vScore)) : (parseInt(game.vScore) > parseInt(game.hScore));
                  return (
                    <div key={i} ref={i === targetIdx ? lastPlayedRef : null} className={`flex items-center justify-between p-6 transition-all ${i === targetIdx ? 'bg-amber-50/50' : 'hover:bg-slate-50'}`}>
                      <div><span className="text-[8px] font-black text-slate-400 uppercase">Week {game.week}</span><p className="text-xs font-black uppercase italic mt-1">{isHome ? 'VS' : 'AT'} {isHome ? game.visitor : game.home}</p></div>
                      <div className={`font-mono text-xs font-black ${game.status === 'Final' ? (isWin ? 'text-emerald-500' : 'text-red-500') : 'text-slate-200'}`}>{game.status === 'Final' ? `${game.hScore}-${game.vScore}` : 'UPCOMING'}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] shadow-2xl p-8 border border-slate-800 text-left">
              <h3 className="font-black text-white text-[10px] tracking-[0.3em] uppercase mb-8 flex items-center gap-2"><Star size={14} className="text-blue-500" /> Draft Capital</h3>
              <div className="space-y-4 max-h-[400px] overflow-y-auto custom-scrollbar pr-2">
                {data.picks?.map((pick: DraftPick, i: number) => (
                  <div key={i} className="bg-slate-800/40 border border-slate-700/50 p-5 rounded-[1.5rem] flex items-center gap-6">
                    <div className="bg-blue-600 text-white w-14 h-14 rounded-2xl flex flex-col items-center justify-center font-black shrink-0 leading-none"><span className="text-[9px] mb-1 opacity-60 font-black">{pick.year}</span><span className="text-base italic uppercase tracking-tighter">R{pick.round}</span></div>
                    <div className="flex-grow"><p className="text-white font-black text-sm uppercase italic tracking-tighter leading-none mb-1.5">Pick #{pick.overall || 'TBD'}</p><p className="text-[10px] font-bold text-slate-500 uppercase italic leading-none">Origin: <span className="text-blue-400/80">{pick.originalTeam || '—'}</span></p></div>
                  </div>
                ))}
              </div>
            </div>

            <RosterSection title="Special Teams" players={sortedGroups.SPEC} accent="bg-emerald-900" color="text-emerald-600 bg-emerald-50" onDetails={(p: Player) => fetch(`/api/players/details/${encodeURIComponent(p.identity)}`).then(r => r.json()).then(setViewingPlayer)} />
          </div>

          {/* TACTICAL DEPTH CHART (Full Width Bottom) */}
          <div className="lg:col-span-12 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
            <h2 className="font-black uppercase tracking-tighter text-xl mb-8 flex items-center gap-2 text-slate-900">
              <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
              Tactical Depth Chart
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {positionOrder.map(pos => {
                const players = depthGroups[pos] || [];
                if (players.length === 0) return null;

                // Determine if this position belongs to a "Thin" category
                let category = pos;
                if (['LT', 'LG', 'C', 'RG', 'RT', 'OL'].includes(pos)) category = 'OL';
                if (['DE', 'DT', 'NT'].includes(pos)) category = 'DL';
                if (['CB', 'S'].includes(pos)) category = 'DB';
                const isThin = needsMap[category];

                return (
                  <div key={pos} className={`bg-slate-50 rounded-2xl p-4 border transition-all flex flex-col gap-3 ${isThin ? 'border-red-200 bg-red-50/30 ring-1 ring-red-100' : 'border-slate-100'}`}>
                    <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-widest ${isThin ? 'text-red-400' : 'text-slate-400'}`}>{pos}</span>
                        {isThin && <span className="text-[7px] font-black bg-red-500 text-white px-1 rounded-sm animate-pulse">NEED</span>}
                      </div>
                      <div className="flex items-center gap-2">
                        <Link 
                          href={`/draft?scout=${category}`} 
                          className="p-1 hover:bg-blue-100 rounded text-blue-600 transition-colors"
                          title={`Scout ${category} Free Agents`}
                        >
                          <Search size={12} />
                        </Link>
                        <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${isThin ? 'text-red-600 bg-red-100' : 'text-blue-600 bg-blue-50'}`}>{players.length}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {players.map((p, idx) => {
                        const isIR = p.team?.toUpperCase().endsWith('-IR');
                        return (
                          <p key={idx} className={`text-[11px] font-bold uppercase truncate ${isIR ? 'text-slate-400 italic' : 'text-slate-700'}`} title={p.name || `${p.first} ${p.last}`}>
                            {idx + 1}. {p.last || p.name?.split(' ').pop()} {isIR && <span className="text-[8px] opacity-60">(IR)</span>}
                          </p>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* DRAFT HISTORY CONTENT */}
      {data && activeTab === 'HISTORY' && (
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden pb-20">
          <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h2 className="font-black uppercase tracking-tighter text-xl">All-Time Draft Selections</h2>
              <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                  {filteredHistory.length} Picks
              </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em]">
                  <th className="px-8 py-5">Year</th>
                  <th className="px-8 py-5">Pick</th>
                  <th className="px-8 py-5">Player Selected</th>
                  <th className="px-8 py-5">Original Team</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredHistory.map((pick, i) => (
                  <tr key={i} className="hover:bg-slate-50 transition-colors group">
                    <td className="px-8 py-6 font-bold text-slate-400">{pick.year}</td>
                    <td className="px-8 py-6">
                      <span className="bg-blue-50 text-blue-600 px-3 py-1 rounded-lg font-black italic text-xs">
                        R{pick.round} P{pick.overall}
                      </span>
                    </td>
                    <td className="px-8 py-6">
                      <p className="font-black text-slate-900 uppercase italic tracking-tight text-lg leading-none">{pick.draftedPlayer}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase mt-1.5 italic tracking-tighter">{pick.timestamp}</p>
                    </td>
                    <td className="px-8 py-6 text-slate-500 font-bold text-xs uppercase">
                      {pick.originalTeam || 'Own Pick'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function RosterSection({ title, players, accent, color, onDetails }: { title: string, players: Player[], accent: string, color: string, onDetails: (p: Player) => void }) {
  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden text-left h-fit">
      <div className={`px-8 py-5 font-black text-white ${accent} flex justify-between items-center uppercase tracking-widest text-[10px]`}>
        <span>{title}</span>
        <span className="bg-white/20 px-3 py-1 rounded-lg italic">{players.length}</span>
      </div>
      <div className="divide-y divide-slate-50">
        {players.map((p: Player, i: number) => (
          <div key={i} className="group flex items-center justify-between p-5 hover:bg-slate-50 transition-all">
            <div className="flex items-center gap-4 min-w-0">
              <span className={`shrink-0 font-mono text-[9px] font-black ${color} w-10 h-10 flex items-center justify-center rounded-xl uppercase italic shadow-inner`}>{p.pos}</span>
              <div className="min-w-0">
                <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name || '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-slate-900 uppercase italic tracking-tighter leading-none hover:text-blue-600 truncate block">{p.name}</a>
                <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mt-1">Age {p.core?.age || p.age || '??'}</p>
              </div>
            </div>
            <button onClick={() => onDetails(p)} className="flex-shrink-0 ml-4 flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white active:scale-95 transition-all shadow-sm"><ChevronRight size={20} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}