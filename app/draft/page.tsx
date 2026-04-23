'use client';

import React, { useState, useEffect, useCallback, useMemo, Suspense, useRef } from 'react';
import SelectionModal from '@/components/SelectionModal';
import PlayerCard from '@/components/PlayerCard'; 
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { Search, RotateCw, Zap, ChevronUp, Trash2, RotateCcw } from 'lucide-react';
import RecentPicksTicker from '@/components/RecentPicksTicker';
import { useConfirm } from '@/components/ConfirmDialog';
import { Team, Player, DraftPick } from '../../types';

export const dynamic = 'force-dynamic';

export default function DraftPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">Syncing Draft Board...</div>}>
      <DraftBoardContent />
    </Suspense>
  );
}

function DraftBoardContent() {
  const { data: session } = useSession();
  const router = useRouter();
  //const [picks, setPicks] = useState<any[]>([]);
  const [picks, setPicks] = useState<DraftPick[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Filter States
  const [searchTerm, setSearchTerm] = useState('');
  const [yearFilter, setYearFilter] = useState('All');
  const [draftStartDate, setDraftStartDate] = useState<Date | null>(null);
  const [teamFilter, setTeamFilter] = useState('All Teams');
  const [roundFilter, setRoundFilter] = useState('All');
  const [draftTypeFilter, setDraftTypeFilter] = useState<'free_agent' | 'rookie' | 'all'>('free_agent');
  

  // Selection & Scouting States
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null); 
  const [selectedPick, setSelectedPick] = useState<DraftPick | null>(null);
  const [modalSessionId, setModalSessionId] = useState(0);
  const [showSelectionModal, setShowSelectionModal] = useState(false);

  // Timer States
  const [timeLeft, setTimeLeft] = useState<string>("00:00:00");
  const [progress, setProgress] = useState(100);
  const hasCalledExpireRef = useRef(false);
  const onClockRowRef = useRef<HTMLTableRowElement>(null);
  const [confirm, ConfirmDialog] = useConfirm();

  // Admin/undo state — 'admin' covers league commissioners, 'superuser' covers the env-var superuser
  const userRole = (session?.user as { role?: string })?.role;
  const isAdminUser = userRole === 'admin' || userRole === 'superuser';
  const myTeamCode = (session?.user as { id?: string })?.id || '';

  const handlePass = async (overall: string) => {
    if (!await confirm('The draft will advance and you can still make a late selection later.', { title: 'Pass this pick?', confirmLabel: 'Pass' })) return;
    setIsRefreshing(true);
    await fetch('/api/draft-pass', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ overallPick: overall, coachName: myTeamCode }),
    });
    loadData(true);
  };

  const handleDeletePick = async (pickId: number) => {
    if (!await confirm('The player will be returned to free agency.', { title: 'Delete this pick?', confirmLabel: 'Delete', destructive: true })) return;
    setIsRefreshing(true);
    await fetch('/api/draft-picks', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pickId }),
    });
    loadData(true);
  };

  const handleUndoMyPick = async () => {
    if (!await confirm('The player will be returned to free agency.', { title: 'Undo your last pick?', confirmLabel: 'Undo', destructive: true })) return;
    setIsRefreshing(true);
    const res = await fetch('/api/draft-picks/undo', { method: 'POST' });
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Could not undo pick.');
    }
    loadData(true);
  };

  // --- DATA LOADING ---
  const loadData = useCallback(async (showRefreshState = false) => {
    if (showRefreshState) setIsRefreshing(true);
    try {
      const typeParam = draftTypeFilter !== 'all' ? `&type=${draftTypeFilter}` : '';
      const [pRes, tRes, rRes] = await Promise.all([
        fetch(`/api/draft-picks?t=${Date.now()}${typeParam}`, { cache: 'no-store' }).then(res => res.json()),
        fetch(`/api/teams?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()),
        fetch(`/api/rules?t=${Date.now()}`, { cache: 'no-store' }).then(res => res.json()) 
      ]);

      const sortedPicks = Array.isArray(pRes) 
      ? pRes
          .map((p: DraftPick) => ({
            ...p,
            // 🚀 Ensure mandatory strings for the Ticker and UI
            draftedPlayer: p.draftedPlayer || "", 
            timestamp: p.timestamp || "",
            // 🚀 Ensure our new trade fields exist
            history: p.history || "",
            via: p.via || null
          }))
          .sort((a, b) => Number(a.overall) - Number(b.overall))
      : [];
      
      setPicks(sortedPicks);
      setTeams(tRes);

      if (Array.isArray(rRes)) {
        const dYear = rRes.find(r => r.setting === 'draft_year');
        if (dYear?.value) setYearFilter(dYear.value.toString());

        const dStart = rRes.find((r: {setting: string; value: string}) => r.setting === 'draft_start_date');
        if (dStart?.value) {
          const d = new Date(dStart.value);
          setDraftStartDate(isNaN(d.getTime()) ? null : d);
        } else {
          setDraftStartDate(null);
        }
      }
    } catch (err) { 
      console.error("Error loading draft data:", err); 
    } finally { 
      setLoading(false); 
      setIsRefreshing(false);
    }
  }, [draftTypeFilter]);

  useEffect(() => { loadData(); }, [loadData]);



  // --- BACK TO TOP LOGIC ---
  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 400) {
        setShowBackToTop(true);
      } else {
        setShowBackToTop(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // --- CLOCK & STATUS LOGIC ---
  const { onClockPick, previousPick } = useMemo(() => {
    const currentIndex = picks.findIndex(p => p.status === "Active");
    return {
      onClockPick: picks[currentIndex],
      previousPick: currentIndex > 0 ? picks[currentIndex - 1] : null
    };
  }, [picks]);

  const myLastPick = picks
    .filter(p => p.status === 'Drafted' && p.currentOwner?.toUpperCase() === myTeamCode.toUpperCase())
    .at(-1);

  const canUndoMyPick = !!myLastPick && !!onClockPick &&
    Number(onClockPick.overall) === Number(myLastPick.overall) + 1;

  // Reset expire ref whenever the on-clock pick changes (new pick, new timer)
  useEffect(() => {
    hasCalledExpireRef.current = false;
  }, [onClockPick?.overall]);

  // Scroll to on-clock pick, leaving ~3 rows visible above it
  useEffect(() => {
    if (!onClockRowRef.current || loading) return;
    const el = onClockRowRef.current;
    const rowHeight = el.offsetHeight;
    const top = el.getBoundingClientRect().top + window.scrollY - rowHeight * 3 - 100;
    window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
  }, [onClockPick?.overall, loading]);

  const scheduledAtMs = onClockPick?.scheduledAt ? new Date(onClockPick.scheduledAt).getTime() : null;
  const isScheduledFuture = scheduledAtMs !== null && scheduledAtMs > Date.now();

  useEffect(() => {
    if (!onClockPick) return;

    // If pick has a future scheduled start, count down to that instead
    if (scheduledAtMs !== null && scheduledAtMs > Date.now()) {
      const computeCountdown = () => {
        const diff = scheduledAtMs - Date.now();
        if (diff <= 0) {
          setTimeLeft("STARTING");
          setProgress(100);
          loadData(true);
        } else {
          const d = Math.floor(diff / (1000 * 60 * 60 * 24));
          const h = Math.floor((diff / (1000 * 60 * 60)) % 24);
          const m = Math.floor((diff / (1000 * 60)) % 60);
          const s = Math.floor((diff / 1000) % 60);
          setTimeLeft(d > 0
            ? `${d}d ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
            : `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
          );
          setProgress(100); // full bar while waiting for schedule
        }
      };
      computeCountdown();
      const timerInterval = setInterval(computeCountdown, 1000);
      return () => clearInterval(timerInterval);
    }

    const clockMins = (onClockPick as { clockMinutes?: number | null }).clockMinutes ?? 1440;
    const limitMs = clockMins * 60 * 1000;
    // Clock starts from: scheduledAt (if set and past) > previous pick's timestamp > now
    const clockStartMs = scheduledAtMs && scheduledAtMs <= Date.now()
      ? scheduledAtMs
      : previousPick?.timestamp ? new Date(previousPick.timestamp).getTime() : Date.now();
    const expiryTime = clockStartMs + limitMs;

    const computeAndSet = () => {
      const diff = expiryTime - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft("EXPIRED");
        setProgress(0);
        if (!hasCalledExpireRef.current) {
          hasCalledExpireRef.current = true;
          fetch('/api/draft-picks/expire', { method: 'POST' })
            .then(() => loadData(true))
            .catch(() => loadData(true));
        }
      } else {
        const h = Math.floor(diff / (1000 * 60 * 60));
        const m = Math.floor((diff / (1000 * 60)) % 60);
        const s = Math.floor((diff / 1000) % 60);
        setTimeLeft(`${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
        setProgress((diff / limitMs) * 100);
      }
    };

    computeAndSet(); // set immediately so no 1-second blank flash
    const timerInterval = setInterval(computeAndSet, 1000);
    return () => clearInterval(timerInterval);
  }, [onClockPick, scheduledAtMs, previousPick, loadData]);

  const resolveCode = (str: string) => {
    if (!str) return "";
    const match = str.match(/\(([^)]+)\)/);
    return (match ? match[1] : str).trim().toUpperCase();
  };

  const getFullTeamName = useCallback((shortCode: string) => {
    if (!shortCode) return "Unknown Team";
    const codeToMatch = resolveCode(shortCode);
    const team = teams.find(t => resolveCode(t.short) === codeToMatch);
    return team ? team.name : shortCode;
  }, [teams]);

  const filteredPicks = useMemo(() => {
    return picks.filter(p => {
      const searchStr = searchTerm.toLowerCase();
      const draftedPlayerName = p.draftedPlayer?.toLowerCase() || "";
      const matchesSearch = p.currentOwner?.toLowerCase().includes(searchStr) || 
                            draftedPlayerName.includes(searchStr);
      const matchesYear = yearFilter === 'All' || p.year?.toString() === yearFilter;
      const matchesTeam = teamFilter === 'All Teams' || getFullTeamName(p.currentOwner) === teamFilter;
      const matchesRound = roundFilter === 'All' || p.round.toString() === roundFilter;
      return matchesSearch && matchesYear && matchesTeam && matchesRound;
    });
  }, [picks, searchTerm, yearFilter, teamFilter, roundFilter, getFullTeamName]);

  // Helper to render trade history logic cleanly
  const renderTradeHistory = (pick: DraftPick) => {
    if (!pick.history || pick.history.trim() === "") {
      return pick.via ? (
        <span className="text-[10px] font-black uppercase text-blue-500 italic tracking-[0.2em] leading-none mt-1">
          VIA {getFullTeamName(pick.via)}
        </span>
      ) : null;
    }

    const teamCodes = pick.history.match(/[A-Z0-9]+/g) || [];
    
    return (
      <div className="flex flex-col">
        <span className="text-[10px] font-black uppercase text-blue-500 italic tracking-[0.2em] leading-none mt-1">
          VIA {getFullTeamName(pick.originalTeam)}
        </span>
        {teamCodes.length >= 3 && (
          <span className="text-[9px] font-black uppercase text-blue-400 italic tracking-[0.1em] leading-tight mt-1">
            {teamCodes.map(code => getFullTeamName(code)).join(' → ')}
          </span>
        )}
      </div>
    );
  };

  const fetchPlayerCard = async (p: Player) => {
    try {
      const r = await fetch(`/api/players/details/${encodeURIComponent(p.identity)}`);
      if (r.ok) setSelectedPlayer(await r.json());
    } catch { /* ignore */ }
  };

  if (loading) return <div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">Syncing Draft Board...</div>;

  return (
    <div className="bg-gray-50 min-h-screen text-slate-900">
      <ConfirmDialog />
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
        <div className="flex gap-3 flex-wrap justify-end">
          {canUndoMyPick && !isAdminUser && (
            <button
              onClick={handleUndoMyPick}
              disabled={isRefreshing}
              className="bg-amber-500 text-white px-6 py-4 rounded-2xl shadow-xl font-black uppercase text-[10px] tracking-widest hover:bg-amber-600 transition-all active:scale-95 flex items-center gap-2"
              title="Undo your last pick (only available before next team picks)"
            >
              <RotateCcw size={14} /> Undo My Pick
            </button>
          )}
          <button onClick={() => loadData(true)} className="bg-white border-2 border-slate-100 p-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95">
            <RotateCw size={20} className={`${isRefreshing ? 'animate-spin' : ''} text-slate-400`} />
          </button>
        </div>
      </header>

      {/* 🚀 TICKER PLACEMENT */}
      <RecentPicksTicker picks={picks} teams={teams} draftStartDate={draftStartDate} />

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

            <div className="bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-700 min-w-[300px] text-center relative overflow-hidden">
              <p className="text-8xl font-mono font-black text-amber-400 tabular-nums drop-shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                {timeLeft}
              </p>
              <p className="text-[10px] font-black text-slate-500 uppercase mt-4 tracking-widest">
                {isScheduledFuture ? 'Starts In' : 'Remaining Selection Time'}
              </p>

              {/* Visual Progress Bar */}
              <div className="absolute bottom-0 left-0 w-full h-1.5 bg-slate-700/30">
                <div 
                  className={`h-full transition-all duration-1000 ease-linear ${
                    progress < 10 ? 'bg-red-500 shadow-[0_0_15px_rgba(239,68,68,0.4)]' : 'bg-amber-400 shadow-[0_0_15px_rgba(251,191,36,0.4)]'
                  }`}
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* DRAFT TYPE TABS — only shown when multiple draft types exist */}
        {(() => {
          const types = new Set(picks.map(p => p.draftType).filter(Boolean));
          if (types.size <= 1) return null;
          return (
            <div className="flex gap-2">
              {([['free_agent', 'Free Agent'], ['rookie', 'Rookie'], ['all', 'All Types']] as const).map(([val, label]) => (
                <button key={val} onClick={() => setDraftTypeFilter(val)}
                  className={`px-6 py-2.5 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all
                    ${draftTypeFilter === val ? 'bg-slate-900 text-white shadow-lg' : 'bg-white border border-slate-200 text-slate-500 hover:border-slate-400'}`}>
                  {label}
                </button>
              ))}
            </div>
          );
        })()}

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
            <table className="w-full text-left border-separate border-spacing-0">
              <thead>
                <tr className="bg-slate-900 text-white uppercase text-[9px] font-black tracking-[0.25em] sticky top-0 z-20">
                  <th className="px-10 py-6 bg-slate-900">RD</th>
                  <th className="px-10 py-6 bg-slate-900">Pick</th>
                  <th className="px-10 py-6 bg-slate-900">Drafted Player</th>
                  <th className="px-10 py-6 bg-slate-900">Current Owner</th>
                  <th className="px-10 py-6 text-right pr-16 bg-slate-900">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filteredPicks.map((pick, index) => {
                  const isDrafted = !!pick.draftedPlayer && !pick.draftedPlayer.includes("SKIPPED") && pick.draftedPlayer.trim() !== "";
                  const isSkipped = !!pick.draftedPlayer && pick.draftedPlayer.includes("SKIPPED");
                  const isPassed = pick.status === 'Passed';
                  const isOnClock = onClockPick && pick.overall === onClockPick.overall;
                  const isNewRound = index === 0 || filteredPicks[index - 1].round !== pick.round;

                  return (
                    <React.Fragment key={pick.overall}>
                      {isNewRound && (
                        <tr className="z-10">
                          <td colSpan={5} className="sticky top-[60px] px-10 py-3 bg-slate-50/95 backdrop-blur-md border-y border-slate-100">
                            <span className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">
                              Round {pick.round}
                            </span>
                          </td>
                        </tr>
                      )}
                      <tr ref={isOnClock ? onClockRowRef : null} className={`transition-all ${isOnClock ? 'bg-blue-50/50' : 'hover:bg-slate-50/50'}`}>
                      <td className="px-10 py-8">
                        <span className={`text-xl font-black italic tracking-tighter ${isOnClock ? 'text-blue-400' : 'text-slate-400'}`}>
                          {pick.round}
                        </span>
                      </td>
                      <td className="px-10 py-8">
                        <span className={`text-4xl font-black italic tracking-tighter ${isOnClock ? 'text-blue-600' : isDrafted ? 'text-slate-100' : 'text-slate-200'}`}>
                          {pick.overall}
                        </span>
                      </td>
                      <td className="px-10 py-4">
                        {isDrafted ? (
                          <div className="flex flex-col">
                            <div className="flex items-center gap-2">
                              {pick.draftedPlayerPosition && (
                                <span className="bg-blue-600 text-white text-[8px] font-black px-2 py-0.5 rounded uppercase shrink-0">{pick.draftedPlayerPosition}</span>
                              )}
                              <a href={`https://www.google.com/search?q=${encodeURIComponent(pick.draftedPlayer.split(' - ').pop() || pick.draftedPlayer)}`} target="_blank" rel="noopener noreferrer" className="text-base font-black uppercase text-slate-900 hover:text-blue-600 transition-all">
                                {pick.draftedPlayer}
                              </a>
                            </div>
                            <span className="text-[10px] font-black text-slate-400 uppercase italic mt-1">{pick.timestamp ? new Date(pick.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
                          </div>
                        ) : isPassed ? (
                          <div className="flex flex-col text-amber-600 uppercase">
                            <span className="font-black text-[11px]">Passed</span>
                            <span className="text-[10px] font-black text-slate-400 italic mt-1">{pick.timestamp ? new Date(pick.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
                            <span className="text-[8px] font-black opacity-60">Late Selection Eligible</span>
                          </div>
                        ) : isSkipped ? (
                          <div className="flex flex-col text-orange-500 uppercase">
                            <span className="font-black text-[11px]">Expired (Skipped)</span>
                            <span className="text-[10px] font-black text-slate-400 italic mt-1">{pick.timestamp ? new Date(pick.timestamp).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true }) : ''}</span>
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
                          <span className="text-sm font-black uppercase tracking-tight text-slate-700">
                            {getFullTeamName(pick.currentOwner)}
                          </span>
                          {renderTradeHistory(pick)}
                          {!isDrafted && !isSkipped && !isOnClock && pick.scheduledAt && (
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wide mt-0.5">
                              {new Date(pick.scheduledAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-10 py-4 text-right pr-16">
                        {isDrafted ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-emerald-500 font-black text-[10px] uppercase border border-emerald-100 bg-emerald-50 px-4 py-2 rounded-full tracking-widest">Finalized</span>
                            {isAdminUser && (
                              <button
                                onClick={() => handleDeletePick(pick.id)}
                                disabled={isRefreshing}
                                className="text-red-400 hover:text-red-600 transition-colors p-1 rounded"
                                title="Delete this pick"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        ) : isPassed && session ? (
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-amber-600 font-black text-[10px] uppercase border border-amber-200 bg-amber-50 px-4 py-2 rounded-full tracking-widest">Passed</span>
                            <button
                              disabled={isRefreshing}
                              onClick={() => {
                                setModalSessionId(Date.now());
                                setSelectedPick(pick);
                                setShowSelectionModal(true);
                              }}
                              className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest py-3.5 px-8 rounded-2xl shadow-xl hover:bg-amber-600 transition-all active:scale-95"
                            >
                              Late Selection
                            </button>
                          </div>
                        ) : isSkipped && session ? (
                          <button
                            disabled={isRefreshing}
                            onClick={() => {
                              setModalSessionId(Date.now());
                              setSelectedPick(pick);
                              setShowSelectionModal(true);
                            }}
                            className="bg-orange-500 text-white text-[9px] font-black uppercase tracking-widest py-3.5 px-8 rounded-2xl shadow-xl hover:bg-orange-600 transition-all active:scale-95"
                          >
                            Late Selection
                          </button>
                        ) : isOnClock && session ? (
                          <div className="flex items-center justify-end gap-3">
                            <button
                              disabled={isRefreshing}
                              onClick={() => handlePass(String(pick.overall))}
                              className="bg-slate-200 text-slate-600 text-[9px] font-black uppercase tracking-widest py-3.5 px-6 rounded-2xl hover:bg-amber-100 hover:text-amber-700 transition-all active:scale-95"
                            >
                              Pass
                            </button>
                            <button
                              disabled={isRefreshing}
                              onClick={() => {
                                setModalSessionId(Date.now());
                                setSelectedPick(pick);
                                setShowSelectionModal(true);
                              }}
                              className="bg-blue-600 text-white text-[9px] font-black uppercase tracking-widest py-3.5 px-8 rounded-2xl shadow-xl hover:bg-blue-700 transition-all active:scale-95"
                            >
                              Enter Selection
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-200 font-black text-[10px] uppercase tracking-widest">Locked</span>
                        )}
                      </td>
                    </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {showSelectionModal && selectedPick && (
        <SelectionModal 
          key={`modal-${selectedPick.overall}-${modalSessionId}`}
          pick={{...selectedPick, currentOwner: getFullTeamName(selectedPick.currentOwner), currentOwnerCode: resolveCode(selectedPick.currentOwner)}}
          coach={session?.user?.name || "Unknown Coach"}
          onClose={() => { setSelectedPick(null); setShowSelectionModal(false); }}
          onComplete={async () => {
            setSelectedPick(null);
            setShowSelectionModal(false);

            // 🚀 PROPAGATION DELAY: Wait 1.5s for Google Sheets to settle
            await new Promise(resolve => setTimeout(resolve, 1500));

            router.refresh();
            await loadData(true);
          }}
          onScout={(p) => fetchPlayerCard(p)}
        />
      )}

      {selectedPlayer && <PlayerCard data={selectedPlayer} onClose={() => setSelectedPlayer(null)} />}

      {/* BACK TO TOP BUTTON */}
      <button
        onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
        className={`fixed bottom-8 right-8 z-[100] bg-slate-900 text-white p-4 rounded-2xl shadow-2xl transition-all duration-300 hover:bg-blue-600 active:scale-95 ${
          showBackToTop ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10 pointer-events-none'
        }`}
      >
        <ChevronUp size={24} />
      </button>
    </div>
  );
}

// 🚀 HELPER COMPONENTS
function FilterSelect({ label, value, onChange, options }: { label: string, value: string, onChange: (v: string) => void, options: (string | number)[] }) {
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

