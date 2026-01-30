'use client';

// 1/28/26 3:33pm

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SelectionModal from '@/components/SelectionModal';
import PlayerCard from '@/components/PlayerCard'; 
import { getPositionStats } from '@/lib/playerStats'; 
import { useSession } from "next-auth/react";
import { Clock, Search, RotateCw, X, Zap, ChevronRight, Filter } from 'lucide-react';
import RecentPicksTicker from '@/components/RecentPicksTicker';

export const dynamic = 'force-dynamic';

interface Team { name: string; short: string; }

interface DraftPick {
  year: number;
  round: number;
  overall: number;
  originalTeam: string;
  currentOwner: string;
  status: string;
  draftedPlayer?: string;
  timestamp?: string;
  via?: string | null;   // 🚀 Calculated by lib/draftpicks
  history?: string;      // 🚀 From Column K
}

export default function DraftPage() {
  const { data: session } = useSession();
  //const [picks, setPicks] = useState<any[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
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
  const [faPosFilter, setFaPosFilter] = useState('All');
  const [faSortKey, setFaSortKey] = useState('overall');
  
  // Selection & Scouting States
  const [selectedPlayer, setSelectedPlayer] = useState<any>(null); 
  const [selectedPick, setSelectedPick] = useState<any>(null);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [progress, setProgress] = useState<number>(100);

  // --- DATA LOADING ---
  const loadData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      const [pRes, tRes, rRes] = await Promise.all([
        fetch('/api/draft-picks', { cache: 'no-store' }).then(res => res.json()),
        fetch('/api/teams').then(res => res.json()),
        fetch('/api/rules').then(res => res.json()) 
      ]);

      const sortedPicks = Array.isArray(pRes) 
        ? pRes.sort((a, b) => Number(a.overall) - Number(b.overall))
        : [];
      
      setPicks(sortedPicks);
      setTeams(tRes);

      if (Array.isArray(rRes)) {
        const yearRule = rRes.find(r => r.setting === 'draft_year');
        if (yearRule && yearRule.value) {
          setYearFilter(yearRule.value.toString());
        }
      }
    } catch (err) { 
      console.error("Error loading draft data:", err); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- CLOCK & STATUS LOGIC ---
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
      const draftedPlayerName = p.draftedPlayer?.toLowerCase() || "";
      const matchesSearch = p.currentOwner?.toLowerCase().includes(searchStr) || 
                            draftedPlayerName.includes(searchStr);
      const matchesYear = yearFilter === 'All' || p.year?.toString() === yearFilter;
      const matchesTeam = teamFilter === 'All Teams' || getFullTeamName(p.currentOwner) === teamFilter;
      const matchesRound = roundFilter === 'All Rounds' || p.round.toString() === roundFilter;
      return matchesSearch && matchesYear && matchesTeam && matchesRound;
    });
  }, [picks, searchTerm, yearFilter, teamFilter, roundFilter, teams]);

  const processedFAs = useMemo(() => {
    if (!Array.isArray(faPlayers)) return [];
    return [...faPlayers]
      .filter(p => {
        const displayName = p.name || `${p.first || ''} ${p.last || ''}`;
        const matchesSearch = displayName.toLowerCase().includes(faSearch.toLowerCase());
        const pos = (p.offense || p.defense || p.special || p.position || p.pos || '').toUpperCase();
        
        const matchesPos = faPosFilter === 'All' || 
          (faPosFilter === 'OL' ? ['OL', 'C', 'G', 'T', 'C-G', 'G-T'].includes(pos) : pos === faPosFilter.toUpperCase());

        return matchesSearch && matchesPos;
      })
      .sort((a, b) => {
        const valA = Number(a.overall || a.core?.overall || 0);
        const valB = Number(b.overall || b.core?.overall || 0);
        if (faSortKey === 'age') return (Number(a.age || a.core?.age || 0) - Number(b.age || b.core?.age || 0));
        return valB - valA;
      });
  }, [faPlayers, faSearch, faPosFilter, faSortKey]);

  // --- 🚀 HYDRATION ENGINE ---
  const fetchFAWithDetails = async (p: any, silent = false) => {
    if (silent && (p.stats || p.allStats?.receptions)) return;
    try {
      const r = await fetch(`/api/players/details/${encodeURIComponent(p.identity)}`);
      if (r.ok) {
        const detailData = await r.json();
        setFaPlayers(prev => prev.map(player => 
            player.identity === p.identity ? { ...player, ...detailData } : player
        ));
        if (!silent) setSelectedPlayer(detailData);
      }
    } catch (e) { console.error("Hydration Error:", e); }
  };

  useEffect(() => {
    if (showFA && processedFAs.length > 0) {
      const topHydrate = processedFAs.slice(0, 10);
      topHydrate.forEach(p => fetchFAWithDetails(p, true));
    }
  }, [showFA, faPosFilter, faSearch, processedFAs]);

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">Syncing Draft Board...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-slate-900">
      
      {/* HEADER SECTION */}
      <header className="max-w-7xl mx-auto p-4 md:p-8 flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Draft <span className="text-blue-600">Board</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Season {yearFilter} Live Entry Console
          </p>
        </div>
        <div className="flex gap-3">
          <button 
            type="button"
            onClick={() => { 
              setFaLoading(true); 
              setShowFA(true); 
              fetch(`/api/players?view=light&t=${Date.now()}`).then(r => r.json()).then(res => { 
                setFaPlayers(res.filter((p: any) => p.team === 'FA')); 
                setFaLoading(false); 
              }); 
            }} 
            className="bg-slate-900 text-white px-8 py-4 rounded-2xl shadow-xl font-black uppercase text-[10px] tracking-widest hover:bg-slate-800 transition-all active:scale-95 flex items-center gap-3"
          >
            <Search size={14} /> Scout Free Agents
          </button>
          <button onClick={() => loadData(true)} className="bg-white border-2 border-slate-100 p-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95">
            <RotateCw size={20} className={`${isRefreshing ? 'animate-spin' : ''} text-slate-400`} />
          </button>
        </div>
      </header>

      {/* 🚀 TICKER PLACEMENT */}
      <RecentPicksTicker picks={picks} teams={teams} />

      <main className="max-w-7xl mx-auto p-4 md:p-8 space-y-10">

        {/* CLOCK SECTION */}
        {onClockPick && (
          <div className="bg-slate-900 rounded-[3rem] shadow-2xl overflow-hidden border border-slate-800 p-10 flex flex-col md:flex-row justify-between items-center gap-10">
            <div className="flex flex-col gap-4">
              <div className="flex items-center gap-2">
                <Zap size={14} className="text-blue-500 fill-blue-500" />
                <span className="text-[10px] font-black text-blue-500 uppercase tracking-widest">
                  GFL Direct: On the Clock
                </span>
              </div>
              
              <h2 className="text-7xl font-black text-white uppercase italic tracking-tighter leading-none">
                {getFullTeamName(onClockPick.currentOwner)}
              </h2>

              <div className="flex items-center gap-4 mt-2">
                <span className="text-slate-400 font-black text-[11px] uppercase tracking-[0.2em]">
                  Pick #{onClockPick.overall}
                </span>
                <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
                <span className="text-slate-400 font-black text-[11px] uppercase tracking-[0.2em]">
                  Round {onClockPick.round}
                </span>
              </div>
            </div>

            <div className="bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-700 min-w-[300px] text-center">
              <p className="text-8xl font-mono font-black text-amber-400 tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                {timeLeft}
              </p>
              <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-widest">
                Remaining Selection Time
              </p>
            </div>
          </div>
        )}

        {/* FILTER BAR */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-6 rounded-[2rem] shadow-xl border border-slate-100">
          <FilterSelect label="Season" value={yearFilter} onChange={setYearFilter} options={Array.from(new Set(picks.map(p => p.year))).sort()} />
          <FilterSelect label="Franchise" value={teamFilter} onChange={setTeamFilter} options={Array.from(new Set(picks.map(p => getFullTeamName(p.currentOwner)))).sort()} />
          <FilterSelect label="Round" value={roundFilter} onChange={setRoundFilter} options={Array.from(new Set(picks.map(p => p.round))).sort((a,b)=>a-b)} />
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-2">Find Player</label>
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={14} />
              <input 
                type="text" 
                placeholder="Search..." 
                className="w-full p-3.5 pl-10 bg-slate-50 border-none rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 transition-all" 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* DRAFT TABLE */}
        <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-[0.25em]">
                  <th className="px-10 py-6">Pick</th>
                  <th className="px-10 py-6">Drafted Player</th>
                  <th className="px-10 py-6">Current Owner</th>
                  <th className="px-10 py-6 text-right pr-16">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPicks.map((pick) => {
                  const isDrafted = !!pick.draftedPlayer && !pick.draftedPlayer.includes("SKIPPED") && pick.draftedPlayer.trim() !== "";
                  const isSkipped = !!pick.draftedPlayer && pick.draftedPlayer.includes("SKIPPED");
                  const isOnClock = onClockPick && pick.overall === onClockPick.overall;
                  return (
                    <tr key={pick.overall} className={`transition-all ${isOnClock ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-10 py-8">
                        <span className={`text-4xl font-black italic tracking-tighter ${isOnClock ? 'text-blue-600' : isDrafted ? 'text-slate-100' : 'text-slate-200'}`}>
                          {pick.overall}
                        </span>
                      </td>
                      <td className="px-10 py-4">
                        {isDrafted ? (
                          <div className="flex flex-col">
                            <a href={`https://www.google.com/search?q=${encodeURIComponent(pick.draftedPlayer.split(' - ').pop() || pick.draftedPlayer)}`} target="_blank" rel="noopener noreferrer" className="text-base font-black uppercase text-slate-900 hover:text-blue-600 transition-all">
                              {pick.draftedPlayer}
                            </a>
                            <span className="text-[10px] font-black text-slate-400 uppercase italic mt-1">{pick.timestamp}</span>
                          </div>
                        ) : isSkipped ? (
                          <div className="flex flex-col text-orange-500 uppercase">
                            <span className="font-black text-[11px]">Expired (Skipped)</span>
                            <span className="text-[8px] font-black opacity-60">Late Selection Eligible</span>
                          </div>
                        ) : (
                          <span className={`text-[11px] font-black uppercase tracking-widest ${isOnClock ? 'text-blue-500 animate-pulse' : 'text-slate-200'}`}>
                            {isOnClock ? 'On the Clock' : 'Awaiting Turn'}
                          </span>
                        )}
                      </td>

                      <td className="px-10 py-4">
                        <div className="flex flex-col">
                          {/* 1. Current Owner Full Name */}
                          <span className="text-sm font-black uppercase tracking-tight text-slate-700">
                            {getFullTeamName(pick.currentOwner)}
                          </span>

                          {/* 🚀 ROBUST CONDITIONAL TRADE DISPLAY */}
                          {pick.history && pick.history.trim() !== "" ? (
                            <div className="flex flex-col">
                              {(() => {
                                // Identify all team codes in the string (e.g., "TFT", "LM")
                                const teamCodes = pick.history.match(/[A-Z0-9]+/g) || [];
                                
                                // Case A: Multiple teams found (3 or more) -> Show full path
                                if (teamCodes.length >= 3) {
                                  return (
                                    <>
                                      <span className="text-[10px] font-black uppercase text-blue-500 italic tracking-[0.2em] leading-none mt-1">
                                        VIA {getFullTeamName(pick.originalTeam)}
                                      </span>
                                      <span className="text-[9px] font-black uppercase text-blue-400 italic tracking-[0.1em] leading-tight mt-1">
                                        {/* Map every code to a full name and join with an arrow */}
                                        {teamCodes.map(code => getFullTeamName(code)).join(' → ')}
                                      </span>
                                    </>
                                  );
                                }
                                
                                // Case B: Exactly 2 teams (Single Trade) -> Show only VIA
                                return (
                                  <span className="text-[10px] font-black uppercase text-blue-500 italic tracking-[0.2em] leading-none mt-1">
                                    VIA {getFullTeamName(pick.originalTeam)}
                                  </span>
                                );
                              })()}
                            </div>
                          ) : (
                            /* Fallback if History is empty */
                            pick.via && (
                              <span className="text-[10px] font-black uppercase text-blue-500 italic tracking-[0.2em] leading-none mt-1">
                                VIA {getFullTeamName(pick.via)}
                              </span>
                            )
                          )}
                        </div>
                      </td>

                      <td className="px-10 py-4 text-right pr-16">
                        {isDrafted ? (
                          <span className="text-emerald-500 font-black text-[10px] uppercase border border-emerald-100 bg-emerald-50 px-4 py-2 rounded-full tracking-widest">Finalized</span>
                        ) : isSkipped && session ? (
                          <button onClick={() => { setSelectedPick(pick); setShowSelectionModal(true); }} className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest py-3.5 px-8 rounded-2xl shadow-xl hover:bg-orange-600 transition-all active:scale-95">Late Selection</button>
                        ) : isOnClock && session ? (
                          <button onClick={() => { setSelectedPick(pick); setShowSelectionModal(true); }} className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-3.5 px-8 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95">Enter Selection</button>
                        ) : (
                          <span className="text-slate-200 font-black text-[10px] uppercase tracking-widest">Locked</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* FREE AGENT DRAWER */}
      {showFA && (
        <div className="fixed inset-0 z-[150] flex justify-end">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFA(false)} />
          <div className="relative w-full max-w-xl bg-slate-50 h-full shadow-2xl flex flex-col border-l border-slate-200">
            <div className="p-10 bg-slate-900 text-white flex justify-between items-center shadow-xl">
              <div>
                <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none">Scouting <span className="text-blue-600">Terminal</span></h3>
                <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mt-2">Live Personnel Database Access</p>
              </div>
              <button onClick={() => setShowFA(false)} className="bg-slate-800 p-3 rounded-2xl text-slate-400 hover:text-white transition-all"><X size={24} /></button>
            </div>

            <div className="p-6 bg-white border-b shadow-sm space-y-4">
              <div className="flex gap-3">
                <div className="relative flex-[2]">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" size={16} />
                  <input type="text" placeholder="Filter by name..." className="w-full p-4 pl-12 bg-slate-50 border-none rounded-2xl text-slate-900 font-bold text-sm" value={faSearch} onChange={(e) => setFaSearch(e.target.value)} />
                </div>
                <select className="flex-1 p-2 bg-slate-50 border-none rounded-2xl text-[10px] font-black uppercase text-slate-900" value={faSortKey} onChange={(e) => setFaSortKey(e.target.value)}>
                  <option value="overall">Sort: OVR</option>
                  <option value="age">Sort: AGE</option>
                </select>
              </div>
              
              <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth">
                {['All', 'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'].map(pos => (
                  <button key={pos} onClick={() => setFaPosFilter(pos)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase transition-all shrink-0 ${faPosFilter === pos ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/30' : 'bg-slate-100 text-slate-400 hover:bg-slate-200'}`}>{pos}</button>
                ))}
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4 bg-slate-50/50">
              {faLoading ? (
                <div className="text-center py-20 text-slate-300 font-black uppercase animate-pulse italic">Querying Database...</div>
              ) : processedFAs.map((p, i) => (
                <div 
                  key={p.identity || i} 
                  onMouseEnter={() => fetchFAWithDetails(p, true)}
                  className="bg-white border border-slate-100 rounded-[2rem] shadow-sm p-6 transition-all hover:border-blue-200 hover:shadow-md"
                >
                   <div className="flex justify-between items-start mb-6">
                      <div className="space-y-1">
                        <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name || `${p.first} ${p.last}`)}`} target="_blank" rel="noopener noreferrer" className="font-black text-slate-900 uppercase text-xl italic block leading-none hover:text-blue-600 transition-all">
                          {p.name || `${p.first} ${p.last}`}
                        </a>
                        <div className="flex gap-2 items-center">
                          <span className="bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">{p.pos || p.position || p.offense || p.defense}</span>
                          <span className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Age {p.core?.age || p.age || '??'}</span>
                        </div>
                      </div>
                      <button onClick={() => fetchFAWithDetails(p, false)} className="bg-slate-900 text-white text-[9px] font-black px-5 py-3 rounded-xl uppercase hover:bg-blue-600 transition-all flex items-center gap-2">Details <ChevronRight size={12} /></button>
                   </div>
                   <div className="grid grid-cols-5 gap-2">
                      {getPositionStats(p).map((stat, idx) => (
                        <StatMini key={idx} label={stat.label} val={stat.val} />
                      ))}
                   </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSelectionModal && selectedPick && (
        <SelectionModal 
          pick={{...selectedPick, currentOwner: getFullTeamName(selectedPick.currentOwner), currentOwnerCode: resolveCode(selectedPick.currentOwner)}}
          coach={session?.user?.name || "Unknown Coach"}
          onClose={() => { setSelectedPick(null); setShowSelectionModal(false); }}
          onComplete={() => { setSelectedPick(null); setShowSelectionModal(false); loadData(); setFaPlayers([]); }}
          onScout={(p) => fetchFAWithDetails(p)} 
        />
      )}

      {selectedPlayer && <PlayerCard data={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}
    </div>
  );
}

// 🚀 HELPER COMPONENTS
function FilterSelect({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: any[] }) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest ml-2">{label}</label>
      <select className="w-full p-3.5 bg-slate-50 border-none rounded-xl text-[10px] font-black uppercase text-slate-900 focus:ring-2 focus:ring-blue-500 transition-all cursor-pointer" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value={label === "Franchise" ? "All Teams" : "All"}>All {label}s</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}

function StatMini({ label, val }: { label: string, val: any }) {
  return (
    <div className="flex flex-col items-center justify-center bg-slate-50 rounded-2xl py-3 border border-slate-100">
      <span className="text-[7px] font-black text-slate-400 uppercase leading-none mb-1 tracking-tighter">{label}</span>
      <span className="text-[11px] font-black text-slate-900 italic">{val || '0'}</span>
    </div>
  );
}