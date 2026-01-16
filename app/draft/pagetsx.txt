'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SelectionModal from '@/components/SelectionModal';
import PlayerCard from '@/components/PlayerCard'; 

export const dynamic = 'force-dynamic';

interface Team { name: string; short: string; }

export default function DraftPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [roundFilter, setRoundFilter] = useState('All Rounds');
  
  // Free Agent States
  const [showFA, setShowFA] = useState(false);
  const [faPlayers, setFaPlayers] = useState<any[]>([]);
  const [faLoading, setFaLoading] = useState(false);
  const [faSearch, setFaSearch] = useState('');
  
  // Selection & Scouting States
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null); 
  const [selectedPick, setSelectedPick] = useState<any>(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [progress, setProgress] = useState<number>(100);

  const loadData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      const [pRes, tRes] = await Promise.all([
        fetch('/api/draft-picks', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/teams').then(res => res.json())
      ]);
      const sortedPicks = Array.isArray(pRes) 
        ? pRes.sort((a, b) => Number(a.overall) - Number(b.overall))
        : [];
      setPicks(sortedPicks);
      setTeams(tRes);
    } catch (err) { 
      console.error("Error:", err); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const { onClockPick, previousPick } = useMemo(() => {
    const currentIndex = picks.findIndex(p => p.status === "Active");
    return {
      onClockPick: picks[currentIndex],
      previousPick: currentIndex > 0 ? picks[currentIndex - 1] : null
    };
  }, [picks]);

  useEffect(() => {
    if (!onClockPick) return;
    const timerInterval = setInterval(() => {
      const now = new Date().getTime();
      const startTimeStr = previousPick?.timestamp;
      const startRef = startTimeStr ? new Date(startTimeStr).getTime() : new Date().getTime() - (1000 * 60); 
      const roundNum = parseInt(onClockPick.round);
      const limitMs = (roundNum <= 2 ? 24 : 12) * 60 * 60 * 1000;
      const expiryTime = startRef + limitMs;
      const diff = expiryTime - now;

      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        setProgress(0);
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        setProgress((diff / limitMs) * 100);
      }
    }, 1000);
    return () => clearInterval(timerInterval);
  }, [onClockPick, previousPick]);

  const resolveCode = (str: string) => {
    if (!str) return "";
    const match = str.match(/\(([^)]+)\)/);
    return (match ? match[1] : str).trim().toUpperCase();
  };

  const getFullTeamName = (shortCode: string) => {
    if (!shortCode) return "Unknown Team";
    const codeToMatch = resolveCode(shortCode);
    const team = teams.find(t => resolveCode(t.short) === codeToMatch);
    return team ? team.name : shortCode;
  };

  const filteredPicks = useMemo(() => {
    return picks.filter(p => {
      const searchStr = searchTerm.toLowerCase();
      const matchesSearch = p.currentOwner?.toLowerCase().includes(searchStr) || 
                            p.draftedPlayer?.toLowerCase().includes(searchStr);
      const matchesYear = yearFilter === 'All' || p.year?.toString() === yearFilter;
      const matchesTeam = teamFilter === 'All Teams' || getFullTeamName(p.currentOwner) === teamFilter;
      const matchesRound = roundFilter === 'All Rounds' || p.round.toString() === roundFilter;
      return matchesSearch && matchesYear && matchesTeam && matchesRound;
    });
  }, [picks, searchTerm, yearFilter, teamFilter, roundFilter, teams]);

  const fetchFAWithDetails = async (p: any) => {
    try {
      const first = (p.first || '').toLowerCase();
      const last = (p.last || '').toLowerCase();
      const age = p.age ? String(p.age).toLowerCase() : '';
      const off = (p.offense || '').toLowerCase();
      const def = (p.defense || '').toLowerCase();
      const spec = (p.special || '').toLowerCase();
      const identity = [first, last, age, off, def, spec].join('|');
      
      const r = await fetch(`/api/players/details/${encodeURIComponent(identity)}`);
      if (r.ok) {
        const detailData = await r.json();
        setSelectedPlayer(detailData);
      } else {
        alert(`Scouting data not found for: ${p.first} ${p.last}`);
      }
    } catch (e) {
      console.error("SEARCH ERROR:", e);
    }
  };

  // Helper to open the modal
  const handleOpenSelection = (pick: any) => {
    setSelectedPick(pick);
    setShowSelectionModal(true);
  };

  if (loading) return <div className="p-20 text-center font-black text-slate-400 uppercase tracking-widest">Loading Draft Board...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen font-sans text-black">
      
      {/* CLOCK SECTION */}
      {onClockPick && (
        <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-2 text-center md:text-left">
              <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse">Live: On the Clock</span>
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter leading-tight">
                {getFullTeamName(onClockPick.currentOwner)}
                {(onClockPick.originalTeam || onClockPick.original_team) && (onClockPick.originalTeam || onClockPick.original_team) !== onClockPick.currentOwner && (
                  <span className="block text-sm text-blue-400 font-bold normal-case italic mt-1">
                    via {getFullTeamName(onClockPick.originalTeam || onClockPick.original_team)}
                  </span>
                )}
              </h2>
              <p className="text-slate-400 font-bold text-sm">Overall Pick #{onClockPick.overall} • Round {onClockPick.round}</p>
            </div>
            <div className="flex flex-col items-center md:items-end">
              <p className="text-5xl md:text-7xl font-mono font-black text-amber-400 tracking-tighter tabular-nums">{timeLeft}</p>
              <p className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Remaining for this pick</p>
            </div>
          </div>
          <div className="h-2 bg-slate-800 w-full">
            <div className={`h-full transition-all duration-1000 ease-linear ${progress < 20 ? 'bg-red-500' : 'bg-blue-500'}`} style={{ width: `${progress}%` }} />
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="flex flex-col xl:flex-row gap-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex-1">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Year</label>
            <select className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase text-black" value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}>
              <option value="All">All Years</option>
              {Array.from(new Set(picks.map(p => p.year))).sort().map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Team Owner</label>
            <select className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase text-black" value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}>
              <option value="All Teams">All Teams</option>
              {Array.from(new Set(picks.map(p => getFullTeamName(p.currentOwner)))).sort().map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Round</label>
            <select className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase text-black" value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}>
              <option value="All Rounds">All Rounds</option>
              {Array.from(new Set(picks.map(p => p.round))).sort((a,b)=>a-b).map(r => <option key={r} value={r.toString()}>Round {r}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Search</label>
            <input type="text" placeholder="Search player..." className="p-3 border rounded-lg text-sm text-black" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
        
        <div className="flex gap-2">
            <button onClick={() => { setFaLoading(true); setShowFA(true); fetch('/api/free-agents').then(r => r.json()).then(res => { setFaPlayers(res); setFaLoading(false); }); }} className="flex-1 xl:flex-none bg-slate-900 text-white px-6 py-4 rounded-xl shadow-sm font-black uppercase text-xs tracking-widest hover:bg-slate-800 active:scale-95">
                Free Agents
            </button>
            <button onClick={() => loadData(true)} disabled={isRefreshing} className="flex-1 xl:flex-none bg-white border border-gray-200 hover:bg-gray-50 text-slate-600 px-6 py-4 rounded-xl shadow-sm flex items-center justify-center gap-3 transition-all active:scale-95 disabled:opacity-50">
                <svg className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span className="text-xs font-black uppercase tracking-widest text-black">Refresh Board</span>
            </button>
        </div>
      </div>

      {/* DRAFT TABLE */}
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-widest">
                <th className="px-6 py-4">Pick</th>
                <th className="px-6 py-4">Drafted Player</th>
                <th className="px-6 py-4">Team Owner</th>
                <th className="px-6 py-4 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredPicks.map((pick) => {
                const isDrafted = !!pick.draftedPlayer && !pick.draftedPlayer.includes("SKIPPED");
                const isSkipped = !!pick.draftedPlayer && pick.draftedPlayer.includes("SKIPPED");
                const isOnClock = onClockPick && pick.overall === onClockPick.overall;
                const originalTeam = pick.originalTeam || pick.original_team;
                const isTraded = originalTeam && originalTeam !== pick.currentOwner;
                
                return (
                  <tr key={pick.overall} className={`transition-colors ${isOnClock ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset' : ''}`}>
                    <td className="px-6 py-6">
                      <span className={`text-2xl font-black ${isOnClock ? 'text-blue-600' : 'text-slate-200'}`}>#{pick.overall}</span>
                    </td>
                    <td className="px-6 py-4 text-black">
                      {isDrafted ? (
                        <div className="flex flex-col">
                          <a 
                            href={`https://www.google.com/search?q=${encodeURIComponent(pick.draftedPlayer )}`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="font-black text-slate-900 uppercase text-sm hover:text-blue-600 hover:underline transition-colors"
                          >
                            {pick.draftedPlayer}
                          </a>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{pick.timestamp}</span>
                        </div>
                      ) : isSkipped ? (
                        <div className="flex flex-col text-orange-500 uppercase">
                          <span className="font-black text-[10px]">Time Expired (Skipped)</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase italic">Can still make late selection</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-xs uppercase font-bold tracking-widest">{isOnClock ? 'On the Clock' : 'Pending'}</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <span className={`font-black uppercase ${isOnClock ? 'text-blue-900' : 'text-slate-700'}`}>{getFullTeamName(pick.currentOwner)}</span>
                        {isTraded && (
                          <span className="text-[10px] text-blue-600 font-bold italic mt-0.5">via {getFullTeamName(originalTeam)}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(isOnClock || isSkipped) && !isDrafted ? (
                        <button onClick={() => handleOpenSelection(pick)} className={`${isOnClock ? "bg-blue-600 hover:bg-blue-700 animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.3)]" : "bg-[#f59e0b] hover:bg-[#d97706]"} text-white text-[10px] font-black py-2.5 px-5 rounded-lg shadow-lg uppercase transition-all`}>
                          {isSkipped ? "Make Late Selection" : "Make Selection"}
                        </button>
                      ) : isDrafted ? (
                        <span className="text-green-500 font-black text-[10px] border border-green-200 bg-green-50 px-3 py-1 rounded-full uppercase">Completed</span>
                      ) : (
                        <span className="text-slate-300 font-black text-[10px] uppercase">Locked</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* FREE AGENT DRAWER */}
      {showFA && (
        <div className="fixed inset-0 z-[80] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShowFA(false)} />
          <div className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-6 bg-slate-900 text-white flex justify-between items-center">
              <div>
                <h3 className="text-lg font-black uppercase tracking-tight">Free Agents</h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Waiver Wire</p>
              </div>
              <button onClick={() => setShowFA(false)} className="text-3xl">&times;</button>
            </div>
            <div className="p-4 border-b">
              <input type="text" placeholder="Search FA..." className="w-full p-3 border rounded-xl text-black text-sm" value={faSearch} onChange={(e) => setFaSearch(e.target.value)} />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {faLoading ? (
                <div className="text-center py-20 animate-pulse text-slate-400 font-black uppercase">Loading...</div>
              ) : faPlayers.filter(p => `${p.first} ${p.last}`.toLowerCase().includes(faSearch.toLowerCase())).map((p, i) => (
                <div key={i} className="p-4 border rounded-2xl hover:bg-slate-50 transition-colors flex justify-between items-center group text-black">
                  <div className="flex-1">
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(p.first + ' ' + p.last )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-black text-slate-900 uppercase text-sm hover:text-blue-600 hover:underline inline-flex items-center gap-1 group/link"
                    >
                      {p.first} {p.last}
                      <svg className="w-3 h-3 text-blue-400 opacity-0 group-hover/link:opacity-100 transition-opacity" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Age {p.age} — {p.position}</p>
                  </div>
                  <button 
                    onClick={() => fetchFAWithDetails(p)} 
                    className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 hover:bg-blue-100 px-3 py-2 rounded-xl shrink-0"
                  >
                    Details
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {selectedPlayer && <PlayerCard data={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      {showSelectionModal && selectedPick && (
        <SelectionModal 
          pick={{...selectedPick, currentOwner: getFullTeamName(selectedPick.currentOwner), currentOwnerCode: resolveCode(selectedPick.currentOwner)}}
          onClose={() => { setSelectedPick(null); setShowSelectionModal(false); }}
          onComplete={() => { setSelectedPick(null); setShowSelectionModal(false); loadData(); }}
          onScout={(p) => fetchFAWithDetails(p)} 
        />
      )}
    </div>
  );
}