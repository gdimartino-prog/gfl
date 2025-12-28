'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import SelectionModal from '@/components/SelectionModal';

export const dynamic = 'force-dynamic';

interface Team { name: string; short: string; }

export default function DraftPage() {
  const [picks, setPicks] = useState<any[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [roundFilter, setRoundFilter] = useState('All Rounds');
  
  const [selectedPick, setSelectedPick] = useState<any>(null);

  // Timer States
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [progress, setProgress] = useState<number>(100);

  const loadData = useCallback(async () => {
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
    } catch (err) { console.error("Error:", err); } finally { setLoading(false); }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // --- LOGIC: IDENTIFY CLOCK STATUS ---
  const { onClockPick, previousPick, onDeckPicks } = useMemo(() => {
    // FIX: Look for the pick that is specifically marked "Active" in the Sheet to drive the timer
    const currentIndex = picks.findIndex(p => p.status === "Active");
    
    return {
      onClockPick: picks[currentIndex],
      previousPick: currentIndex > 0 ? picks[currentIndex - 1] : null,
      onDeckPicks: picks.slice(currentIndex + 1, currentIndex + 4)
    };
  }, [picks]);

  // --- LOGIC: COUNTDOWN CALCULATOR ---
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

  // --- LOGIC: FILTERED PICKS ---
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

  if (loading) return <div className="p-20 text-center font-black text-slate-400 uppercase tracking-widest">Loading Draft Board...</div>;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen font-sans">
      
      {/* CLOCK SECTION */}
      {onClockPick && (
        <div className="bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-800">
          <div className="p-6 md:p-10 flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="space-y-2 text-center md:text-left">
              <span className="bg-blue-600 text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter animate-pulse">
                Live: On the Clock
              </span>
              <h2 className="text-4xl font-black text-white uppercase italic tracking-tighter">
                {getFullTeamName(onClockPick.currentOwner)}
              </h2>
              <p className="text-slate-400 font-bold text-sm">Overall Pick #{onClockPick.overall} • Round {onClockPick.round}</p>
              
              <div className="mt-4 pt-4 border-t border-slate-800 hidden md:block">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">On Deck</p>
                 <div className="flex gap-4">
                    {onDeckPicks.map((p, idx) => (
                      <div key={idx} className="text-xs font-bold text-slate-400">
                        <span className="text-slate-600 mr-1">#{p.overall}</span> {getFullTeamName(p.currentOwner).split(' ').pop()}
                      </div>
                    ))}
                 </div>
              </div>
            </div>

            <div className="flex flex-col items-center md:items-end">
              <p className="text-5xl md:text-7xl font-mono font-black text-amber-400 tracking-tighter tabular-nums">
                {timeLeft}
              </p>
              <p className="text-[10px] font-black text-slate-500 uppercase mt-2 tracking-widest">Remaining for this pick</p>
            </div>
          </div>
          
          <div className="h-2 bg-slate-800 w-full">
            <div 
              className={`h-full transition-all duration-1000 ease-linear ${progress < 20 ? 'bg-red-500' : 'bg-blue-500'}`}
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      {/* FILTER BAR */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Year</label>
          <select 
            className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={yearFilter} onChange={(e) => setYearFilter(e.target.value)}
          >
            <option value="All">All Years</option>
            {Array.from(new Set(picks.map(p => p.year))).sort().map(y => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Team</label>
          <select 
            className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={teamFilter} onChange={(e) => setTeamFilter(e.target.value)}
          >
            <option value="All Teams">All Teams</option>
            {Array.from(new Set(picks.map(p => getFullTeamName(p.currentOwner)))).sort().map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Round</label>
          <select 
            className="p-3 border rounded-lg bg-gray-50 text-xs font-bold uppercase outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            value={roundFilter} onChange={(e) => setRoundFilter(e.target.value)}
          >
            <option value="All Rounds">All Rounds</option>
            {Array.from(new Set(picks.map(p => p.round))).sort((a,b)=>a-b).map(r => <option key={r} value={r.toString()}>Round {r}</option>)}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-black uppercase text-slate-400 ml-1">Search</label>
          <input 
            type="text" placeholder="Search player..."
            className="p-3 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}
          />
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
                // FIX: Status is drafted if there is a name that ISN'T the "SKIPPED" text
                const isDrafted = !!pick.draftedPlayer && !pick.draftedPlayer.includes("SKIPPED");
                const isSkipped = !!pick.draftedPlayer && pick.draftedPlayer.includes("SKIPPED");
                const isOnClock = onClockPick && pick.overall === onClockPick.overall;
                
                return (
                  <tr key={pick.overall} className={`transition-colors ${isOnClock ? 'bg-blue-50/80 ring-2 ring-blue-500 ring-inset' : ''}`}>
                    <td className="px-6 py-6">
                      <span className={`text-2xl font-black ${isOnClock ? 'text-blue-600' : 'text-slate-200'}`}>
                        #{pick.overall}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {isDrafted ? (
                        <div className="flex flex-col">
                          <span className="font-black text-slate-900 uppercase text-sm">{pick.draftedPlayer}</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase">{pick.timestamp}</span>
                        </div>
                      ) : isSkipped ? (
                        <div className="flex flex-col">
                          <span className="font-black text-orange-500 uppercase text-[10px]">Time Expired (Skipped)</span>
                          <span className="text-[9px] font-bold text-slate-400 uppercase italic tracking-tight">Can still make late selection</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-xs uppercase font-bold tracking-widest">
                          {isOnClock ? 'On the Clock' : 'Pending'}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`font-black uppercase ${isOnClock ? 'text-blue-900' : 'text-slate-700'}`}>
                        {getFullTeamName(pick.currentOwner)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      {(isOnClock || isSkipped) && !isDrafted ? (
                        <button 
                          onClick={() => setSelectedPick(pick)}
                          className={`${
                            isOnClock 
                              ? "bg-blue-600 hover:bg-blue-700 animate-pulse shadow-[0_0_15px_rgba(37,99,235,0.3)]" 
                              : "bg-[#f59e0b] hover:bg-[#d97706]" // RESTORED: Orange for Late Selection
                          } text-white text-[10px] font-black py-2.5 px-5 rounded-lg shadow-lg uppercase transition-all`}
                        >
                          {isSkipped ? "Make Late Selection" : "Make Selection"}
                        </button>
                      ) : isDrafted ? (
                        <span className="text-green-500 font-black text-[10px] border border-green-200 bg-green-50 px-3 py-1 rounded-full uppercase">
                          Completed
                        </span>
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

      {selectedPick && (
        <SelectionModal 
          pick={{
            ...selectedPick,
            currentOwner: getFullTeamName(selectedPick.currentOwner),
            currentOwnerCode: resolveCode(selectedPick.currentOwner)
          }}
          onClose={() => setSelectedPick(null)}
          onComplete={() => { setSelectedPick(null); loadData(); }}
        />
      )}
    </div>
  );
}