'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef, Suspense } from 'react';
import Link from 'next/link';
import PlayerCard from '@/components/PlayerCard';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';
import { useSession } from "next-auth/react";
import { useSearchParams } from 'next/navigation';
import { Search, ChevronRight, Star, Activity, GraduationCap, ShieldCheck, Mail, Phone, Users, Loader2, X, ShoppingCart } from 'lucide-react';
import { getNormalizedCategories, positionWeights, formatPhone } from '@/lib/utils';
import { Player, DraftPick, Team, StandingRow, ScheduleGame } from '../../types';

interface RosterPlayer extends Player {
  group?: string;
  offensePos?: string;
  defensePos?: string;
  specialPos?: string;
  isIR?: boolean;
}

export const dynamic = 'force-dynamic';

const positionOrder = [
  'QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'
];

export default function RosterPage() {
  return (
    <Suspense fallback={<div className="p-20 text-center font-black animate-pulse text-slate-400 uppercase italic">Loading Personnel Files...</div>}>
      <RosterContent />
    </Suspense>
  );
}

function RosterContent() {
  const { data: session, status } = useSession();
  const { selectedTeam, setSelectedTeam, initTeam } = useTeam();
  const searchParams = useSearchParams();
  const [data, setData] = useState<{ 
    roster: RosterPlayer[], 
    picks: DraftPick[], 
    history: DraftPick[], 
    schedule: ScheduleGame[], 
    stats: StandingRow & { diff: number, currentYear: string, rosterLimit: number }, 
    coachContact?: Team 
  } | null>(null);
  const [rules, setRules] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [sortBy, setSortBy] = useState<'default' | 'name' | 'pos'>('default');
  const [activeTab, setActiveTab] = useState<'ROSTER' | 'HISTORY'>('ROSTER');
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [tradeBlock, setTradeBlock] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [tradeBlockForm, setTradeBlockForm] = useState<{ player: Player; asking: string } | null>(null);
  const [removeConfirm, setRemoveConfirm] = useState<Player | null>(null);
  const [detailLoading, setDetailLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const lastPlayedRef = useRef<HTMLDivElement>(null);
  const hasSynced = useRef(false);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const fetchTradeBlockStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/trade-block');
      if (res.ok) {
        const players: { playerId: string }[] = await res.json();
        setTradeBlock(new Set(players.map(p => p.playerId)));
      }
    } catch (error) {
      console.error("Failed to fetch trade block status:", error);
    }
  }, []);

  useEffect(() => {
    fetchTradeBlockStatus();
  }, [fetchTradeBlockStatus]);

  // 🚀 HELPER: Normalize names for bulletproof matching
  const normalize = useCallback((s: string | number | null | undefined) => (s || "").toString().replace(/^[xXyY*][- ]+/g, '').replace(/[^a-z0-9 ]/gi, '').trim().toUpperCase(), []);

  useEffect(() => {
    if (status === "authenticated" && (session?.user as { id?: string })?.id && !hasSynced.current) {
      hasSynced.current = true;
      const sessionId = (session.user as { id?: string }).id || '';
      const saved = localStorage.getItem('gfl-selected-team');
      if (!saved || saved === sessionId) {
        // No saved preference, or localStorage was poisoned by a previous auto-select —
        // clear it and default to the user's own team without persisting
        localStorage.removeItem('gfl-selected-team');
        initTeam(sessionId);
      }
    }
  }, [status, session, initTeam]);

  // --- HANDLE INCOMING TEAM LINK ---
  useEffect(() => {
    const teamParam = searchParams.get('team');
    if (teamParam) {
      setSelectedTeam(teamParam.toUpperCase());
    }
  }, [searchParams, setSelectedTeam]);

  useEffect(() => {
    if (!selectedTeam) return;
    setLoading(true);

    const loadFranchiseData = async () => {
      try {
        const timestamp = Date.now();
        const [standingsRes, rulesRes, draftPicksRes, teamsRes] = await Promise.all([
          fetch(`/api/standings?t=${timestamp}`),
          fetch(`/api/rules?t=${timestamp}`),
          fetch(`/api/draft-picks?t=${timestamp}`),
          fetch(`/api/teams?t=${timestamp}`)
        ]);

        const standingsData = await standingsRes.json();
        const rulesData = await rulesRes.json();
        
        const requirements: Record<string, number> = {};
        rulesData.forEach((r: { setting: string; value: string }) => {
          if (r.setting?.startsWith('min_')) {
            requirements[r.setting.replace('min_', '').toUpperCase()] = Number(r.value);
          }
        });
        setRules(requirements);
        const allDraftPicks = await draftPicksRes.json();
        const allTeams = await teamsRes.json();

        const target = normalize(selectedTeam);

        // 🚀 RESOLVE IDENTITY: Find the team in the official registry
        const coachContact = allTeams.find((t: Team) => 
          normalize(t.short) === target || 
          normalize(t.teamshort) === target ||
          normalize(t.name) === target ||
          normalize(t.team) === target ||
          (t.nickname && normalize(t.nickname) === target)
        );

        const targetShort = normalize(coachContact?.teamshort || coachContact?.short || selectedTeam);
        const targetName = normalize(coachContact?.team || coachContact?.name || selectedTeam);
        const displayFullName = coachContact ? `${coachContact.team} ${coachContact.nickname}` : selectedTeam;

        const yearRule = rulesData.find((r: { setting: string }) => r.setting === 'cuts_year');
        const DYNAMIC_YEAR = yearRule?.value ? yearRule.value.toString() : "2025";

        // 🚀 ROBUST MATCHING: Find the standings entry using normalized keys
        const teamEntry = standingsData.find((s: StandingRow) => {
          const sName = normalize(s.team);
          const sShort = normalize(s.teamshort || s.short);
          const matchesTeam = sName === targetShort || sName === targetName || (sShort && (sShort === targetShort || sShort === targetName));
          
          const yearMatch = s.year?.toString() === DYNAMIC_YEAR;
          return matchesTeam && yearMatch;
        });

        const [rosterRes, scheduleRes] = await Promise.all([
          fetch(`/api/rosters/${selectedTeam}`),
          fetch(`/api/schedule?team=${teamEntry?.teamshort || selectedTeam}`)
        ]);

        const rosterData = await rosterRes.json();
        const scheduleData = await scheduleRes.json();

        const limitRule = rulesData.find((r: { setting: string; value: string }) => r.setting === 'limit_roster');
        const rosterLimit = limitRule ? Number(limitRule.value) : 53;

        let pf = 0; let pa = 0;
        // 🚀 ACCURATE DIFF: Calculate PF/PA using normalized identity
        const currentGames = scheduleData.filter((g: ScheduleGame) => g.year?.toString() === DYNAMIC_YEAR && g.status === "Final");
        currentGames.forEach((game: ScheduleGame) => {
            const cleanHome = normalize(game.home);
            const cleanVisitor = normalize(game.visitor);
            const isHome = cleanHome === targetShort || cleanHome === targetName;
            const isVisitor = cleanVisitor === targetShort || cleanVisitor === targetName;
            
            if (isHome) { pf += Number(game.hScore || 0); pa += Number(game.vScore || 0); }
            else if (isVisitor) { pf += Number(game.vScore || 0); pa += Number(game.hScore || 0); }
        });

        // Filter for history: Match by team code in parentheses or full string
        const history = Array.isArray(allDraftPicks) ? allDraftPicks.filter((p: { currentOwner: string; draftedPlayer: string }) => {
          const ownerStr = p.currentOwner || "";
          const match = ownerStr.match(/\(([^)]+)\)/);
          const code = (match ? match[1] : ownerStr).trim().toUpperCase();
          return code === selectedTeam.trim().toUpperCase() && 
                 p.draftedPlayer && p.draftedPlayer.trim() !== "" && !p.draftedPlayer.includes("SKIPPED");
        }).sort((a: { year: number; overall: number }, b: { year: number; overall: number }) => Number(b.year) - Number(a.year) || Number(a.overall) - Number(b.overall)) : [];

        setData({
          roster: rosterData.roster || [],
          picks: rosterData.picks || [],
          history: history,
          schedule: scheduleData || [],
          stats: { 
            won: 0,
            lost: 0,
            tie: 0,
            pct: 0,
            offPts: 0,
            defPts: 0,
            ...teamEntry, 
            team: displayFullName, // Use the resolved full name for display
            diff: pf - pa, 
            currentYear: DYNAMIC_YEAR, 
            rosterLimit 
          },
          coachContact
        });
      } catch (err) { 
        console.error(err); 
        setError('Failed to load franchise data. Please try refreshing the page.');
      } finally { 
        setLoading(false); 
      }
    };
    loadFranchiseData();
  }, [selectedTeam, normalize]);

  const handlePlayerDetails = useCallback((p: Player) => {
    setDetailLoading(p.identity);
    fetch(`/api/players/details/${encodeURIComponent(p.identity)}`)
      .then(r => r.json())
      .then(data => { setViewingPlayer(data); setDetailLoading(null); })
      .catch(() => setDetailLoading(null));
  }, []);

  const handleToggleTradeBlock = useCallback((player: Player) => {
    if (tradeBlock.has(player.identity)) {
      setRemoveConfirm(player);
    } else {
      setTradeBlockForm({ player, asking: '' });
    }
  }, [tradeBlock]);

  const handleConfirmRemove = useCallback(async (player: Player) => {
    try {
      const response = await fetch(`/api/trade-block?playerId=${player.identity}`, { method: 'DELETE' });
      if (response.ok) {
        showToast(`${player.name} removed from the trade block.`);
        fetchTradeBlockStatus();
      } else {
        showToast('Failed to remove player from trade block.', 'error');
      }
    } catch {
      showToast('Error removing player from trade block.', 'error');
    } finally {
      setRemoveConfirm(null);
    }
  }, [fetchTradeBlockStatus, showToast]);

  const handleConfirmAdd = useCallback(async (player: Player, asking: string) => {
    try {
      const response = await fetch('/api/trade-block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId: player.identity,
          playerName: player.name,
          team: selectedTeam,
          position: player.pos,
          asking,
        }),
      });
      if (response.ok) {
        showToast(`${player.name} added to the trade block.`);
        fetchTradeBlockStatus();
      } else {
        const errorData = await response.json();
        showToast(`Failed: ${errorData.message}`, 'error');
      }
    } catch {
      showToast('Error posting to trade block.', 'error');
    } finally {
      setTradeBlockForm(null);
    }
  }, [selectedTeam, fetchTradeBlockStatus, showToast]);

  const canEdit = useMemo(() => {
    if (status !== 'authenticated' || !data?.coachContact || !session?.user) return false;
    const sessionUserId = (session.user as { id?: string })?.id;
    return sessionUserId === data.coachContact.short || sessionUserId === data.coachContact.teamshort;
  }, [status, session, data?.coachContact]);

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
    if (!data?.schedule || !data?.stats?.currentYear || !data?.coachContact) return [];
    const teamShort = normalize(data.coachContact.short);
    const teamName = normalize(data.coachContact.name);

    return data.schedule
      .filter((g: ScheduleGame) => {
        const matchesYear = g.year?.toString() === data.stats.currentYear;
        const isFinal = g.status === "Final";
        const cleanHome = normalize(g.home);
        const cleanVisitor = normalize(g.visitor);
        const isMyTeam = cleanHome === teamShort || cleanHome === teamName || 
                         cleanVisitor === teamShort || cleanVisitor === teamName;
        return matchesYear && isFinal && isMyTeam;
      })
      .sort((a, b) => Number(a.week || 0) - Number(b.week || 0))
      .slice(-5)
      .map(game => {
        const cleanHome = normalize(game.home);
        const isHome = cleanHome === teamShort || cleanHome === teamName;
        return isHome ? (Number(game.hScore || 0) > Number(game.vScore || 0)) : (Number(game.vScore || 0) > Number(game.hScore || 0));
      });
  }, [data, normalize]);

  const rosterStatus = useMemo(() => {
    if (!data?.roster) return { active: 0, ir: 0 };
    return {
      active: data.roster.filter(p => !p.isIR).length,
      ir: data.roster.filter(p => p.isIR).length
    };
  }, [data?.roster]);

  const teamNeeds = useMemo(() => {
    if (!data?.roster || Object.keys(rules).length === 0) return [];
    const counts: Record<string, number> = {};
    data?.roster?.forEach(p => {
      // Only count player in their first position category (prevent double-counting multi-position players)
      const slots = [p.offensePos, p.defensePos, p.specialPos].filter((s): s is string => Boolean(s));
      for (const slot of slots) {
        const cats = getNormalizedCategories(slot);
        if (cats.length > 0) {
          counts[cats[0]] = (counts[cats[0]] || 0) + 1;
          break;
        }
      }
    });
    return Object.entries(rules).map(([pos, min]) => {
      const current = counts[pos] || 0;
      return { pos, current, min, status: (min - current) > 0 ? 'THIN' : 'SOLID' };
    });
  }, [data?.roster, rules]);

  const complianceIssues = useMemo(() => {
    return teamNeeds.filter(n => n.status === 'THIN');
  }, [teamNeeds]);

  const sortedGroups = useMemo(() => {
    if (!data?.roster) return { OFF: [] as RosterPlayer[], DEF: [] as RosterPlayer[], SPEC: [] as RosterPlayer[] };
    const filtered = data.roster.filter(p => (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) || (p.pos || '').toLowerCase().includes(searchTerm.toLowerCase()));
    const sortFn = (players: Player[]) => [...players].sort((a, b) => {
        if (sortBy === 'name') return (a.name || '').split(' ').pop()!.localeCompare((b.name || '').split(' ').pop()!);
        const posA = (a.pos || '').split('-')[0].trim();
        const posB = (b.pos || '').split('-')[0].trim();
        if (sortBy === 'pos') return posA.localeCompare(posB);
        return (positionWeights[posA] || 99) - (positionWeights[posB] || 99);
    });
    return {
      OFF: sortFn(filtered.filter(p => p.group === 'OFF')),
      DEF: sortFn(filtered.filter(p => p.group === 'DEF')),
      SPEC: sortFn(filtered.filter(p => p.group && ['SPEC', 'ST', 'SPECIAL'].includes(p.group))),
    };
  }, [data, sortBy, searchTerm]);

  const filteredHistory = useMemo(() => {
    if (!data?.history) return [];
    return data?.history?.filter(p => 
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
    const groups = data?.roster?.reduce((acc, p) => {
      // Only place player in their first position category (prevent double-counting multi-position players)
      const slots = [p.offensePos, p.defensePos, p.specialPos].filter((s): s is string => Boolean(s));
      for (const slot of slots) {
        const cats = getNormalizedCategories(slot);
        if (cats.length > 0) {
          const cat = cats[0];
          if (!acc[cat]) acc[cat] = [];
          if (!acc[cat].find(existing => existing.identity === p.identity)) {
            acc[cat].push(p);
          }
          break;
        }
      }
      return acc;
    }, {} as Record<string, Player[]>);

    // Sort each group by specific position weight then last name
    Object.keys(groups).forEach(cat => {
      groups[cat].sort((a, b) => {
        const posA = (a.pos || a.position || '').split('-')[0].trim().toUpperCase();
        const posB = (b.pos || b.position || '').split('-')[0].trim().toUpperCase();
        
        const weightA = positionWeights[posA] || 99;
        const weightB = positionWeights[posB] || 99;

        if (weightA !== weightB) return weightA - weightB;

        const lastA = (a.last || a.name?.split(' ').pop() || '').toLowerCase();
        const lastB = (b.last || b.name?.split(' ').pop() || '').toLowerCase();
        return lastA.localeCompare(lastB);
      });
    });

    return groups;
  }, [data?.roster]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900 text-left">
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}
      <Toast data={toast} />
      {tradeBlockForm && (
        <TradeBlockFormModal
          player={tradeBlockForm.player}
          asking={tradeBlockForm.asking}
          onAskingChange={(v) => setTradeBlockForm(prev => prev ? { ...prev, asking: v } : null)}
          onConfirm={() => handleConfirmAdd(tradeBlockForm.player, tradeBlockForm.asking)}
          onClose={() => setTradeBlockForm(null)}
        />
      )}
      {removeConfirm && (
        <RemoveConfirmModal
          player={removeConfirm}
          onConfirm={() => handleConfirmRemove(removeConfirm)}
          onClose={() => setRemoveConfirm(null)}
        />
      )}

      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Roster <span className="text-blue-600">Explorer</span></h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2"><Activity size={14} className="text-emerald-500" /> Personnel Terminal • Season {data?.stats?.currentYear}</p>
        </div>
        <div className="w-full md:w-80"><TeamSelector /></div>
      </header>

      {/* ERROR MESSAGE */}
      {error && !loading && (
        <div className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-8 flex items-center justify-center gap-6">
          <div className="text-center">
            <h3 className="text-lg font-black uppercase italic text-red-900 tracking-tight">Error</h3>
            <p className="text-sm text-red-700 font-bold mt-1">{error}</p>
          </div>
        </div>
      )}

      {/* TEAM STATS STRIP (dots and record restored) */}
      {data?.stats && (
        <div className="bg-slate-900 text-white rounded-[2.5rem] p-8 flex flex-wrap items-center justify-between shadow-2xl border border-slate-800">
          <div className="flex items-center gap-8">
            <div className="w-4 h-4 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_15px_rgba(16,185,129,0.6)]" />
            <div>
              <h2 className="text-4xl font-black uppercase italic tracking-tighter leading-none">{data?.stats?.team} <span className="text-blue-500 not-italic ml-2">{data?.stats?.nickname}</span></h2>
              <div className="flex items-center gap-4 mt-4">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">COACH: {data?.stats?.coach?.toUpperCase()}</p>
                {data?.coachContact?.email && (
                  <a href={`mailto:${data.coachContact.email}`} className="flex items-center gap-1 text-[10px] font-black text-blue-400 hover:text-blue-300 uppercase tracking-widest transition-colors">
                    <Mail size={12} /> {data.coachContact.email}
                  </a>
                )}
                {data?.coachContact?.mobile && (
                  <p className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest"><Phone size={12} /> {formatPhone(data.coachContact.mobile)}</p>
                )}
                <div className="h-4 w-[1px] bg-slate-700" />
                <Link href="/directory" className="flex items-center gap-1 text-[10px] font-black text-slate-400 hover:text-blue-600 uppercase tracking-widest transition-colors">
                  <Users size={12} /> League Directory
                </Link>
                {(rosterStatus.active > (data?.stats?.rosterLimit || 53) || complianceIssues.length > 0) && (
                  <span className="bg-red-600 text-white text-[8px] font-black px-2 py-0.5 rounded animate-pulse shadow-lg shadow-red-500/20">
                    {rosterStatus.active > (data?.stats?.rosterLimit || 53) && complianceIssues.length > 0 
                      ? 'ROSTER VIOLATION' 
                      : rosterStatus.active > (data?.stats?.rosterLimit || 53) 
                        ? 'OVER LIMIT' 
                        : 'NON-COMPLIANT'}
                  </span>
                )}
                <div className="h-4 w-[1px] bg-slate-700" />
                <div className="flex gap-1.5">
                  {recentForm.map((isWin, i) => (
                    <div key={i} className={`w-3 h-3 rounded-full ${isWin ? 'bg-emerald-500' : 'bg-red-500'}`} />
                  ))}
                </div>
                <div className="h-4 w-[1px] bg-slate-700" />
                <div className="flex flex-col gap-1">
                  <p className={`text-[10px] font-black uppercase tracking-widest ${rosterStatus.active > (data?.stats?.rosterLimit || 53) ? 'text-red-500 animate-pulse' : 'text-emerald-400'}`}>
                    ROSTER: {rosterStatus.active} / {data?.stats?.rosterLimit}
                  </p>
                  <div className="w-24 h-1 bg-slate-800 rounded-full overflow-hidden flex">
                    <div 
                      className={`h-full transition-all duration-1000 ${rosterStatus.active > (data?.stats?.rosterLimit || 53) ? 'bg-red-500' : 'bg-emerald-500'}`}
                      style={{ width: `${Math.min(100, (rosterStatus.active / (data?.stats?.rosterLimit || 53)) * 100)}%` }}
                    />
                  </div>
                </div>
                {rosterStatus.ir > 0 && (
                  <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest">+{rosterStatus.ir} IR</p>
                )}
                </div>
              </div>
            </div>
          <div className="flex gap-12 pr-6">
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-3">Record</p>
              <p className="text-4xl font-black italic tracking-tighter">{data?.stats?.won || 0}-{data?.stats?.lost || 0}</p>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-black text-slate-500 uppercase italic tracking-widest mb-3">Diff</p>
              <p className={`text-4xl font-black italic tracking-tighter ${(data?.stats?.diff || 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{data?.stats?.diff || 0}</p>
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
          <div className="flex gap-2">
            <div className="flex bg-white p-2 rounded-[1.5rem] shadow-sm border border-slate-200 gap-2">
              {(['default', 'name', 'pos'] as const).map((s) => (
                <button key={s} onClick={() => setSortBy(s)} className={`px-8 py-4 text-[10px] font-black uppercase rounded-xl transition-all ${sortBy === s ? 'bg-slate-900 text-white shadow-xl' : 'text-slate-400 hover:text-slate-900'}`}>{s}</button>
              ))}
            </div>
            <Link
              href="/free-agents"
              className="bg-slate-900 text-white px-6 py-4 rounded-[1.5rem] shadow-sm font-black uppercase text-[10px] tracking-widest hover:bg-blue-600 transition-all active:scale-95 flex items-center gap-2 whitespace-nowrap"
            >
              <Search size={13} /> Scout Free Agents
            </Link>
          </div>
        )}
      </div>

      {/* COMPLIANCE WARNING BOX */}
      {activeTab === 'ROSTER' && !searchTerm && (rosterStatus.active > (data?.stats?.rosterLimit || 53) || complianceIssues.length > 0) && !loading && (
        <div className="bg-red-50 border-2 border-red-100 rounded-[2rem] p-8 flex items-start gap-6 animate-in fade-in slide-in-from-top-4 duration-500">
          <div className="bg-red-500 p-3 rounded-2xl text-white shadow-lg shadow-red-500/20">
            <ShieldCheck size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-lg font-black uppercase italic text-red-900 tracking-tight">Roster Compliance Warning</h3>
            <p className="text-sm text-red-700 font-bold mt-1">The following requirements are not currently met:</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {rosterStatus.active > (data?.stats?.rosterLimit || 53) && (
                <span className="bg-white border border-red-200 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  Roster Size: {rosterStatus.active} / {data?.stats?.rosterLimit}
                </span>
              )}
              {complianceIssues.map(issue => (
                <span key={issue.pos} className="bg-white border border-red-200 text-red-600 px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-widest">
                  {issue.pos}: {issue.current} / {issue.min}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

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
             <RosterSection title="Offense" players={sortedGroups.OFF} accent="bg-slate-800" color="text-blue-600 bg-blue-50" onDetails={handlePlayerDetails} onToggleTradeBlock={handleToggleTradeBlock} canEdit={canEdit} tradeBlock={tradeBlock} detailLoading={detailLoading} />
             <RosterSection title="Defense" players={sortedGroups.DEF} accent="bg-red-900" color="text-red-600 bg-red-50" onDetails={handlePlayerDetails} onToggleTradeBlock={handleToggleTradeBlock} canEdit={canEdit} tradeBlock={tradeBlock} detailLoading={detailLoading} />
          </div>

          <div className="lg:col-span-4 space-y-10">
            <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden text-left">
              <div className="px-8 py-5 font-black text-white bg-blue-600 uppercase tracking-widest text-[10px]"><span>Schedule</span></div>
              <div className="divide-y divide-slate-50 max-h-[400px] overflow-y-auto custom-scrollbar">
                {data?.schedule?.filter(g => g.year === data?.stats?.currentYear).map((game, i, arr) => {
                  const targetIdx = arr.map(g => g.status).lastIndexOf("Final");
                  const teamShort = data?.coachContact?.short?.toUpperCase() || "";
                  const teamName = data?.coachContact?.name?.toUpperCase() || "";
                  
                  const cleanHome = normalize(game.home);
                  const isHome = cleanHome === teamShort || cleanHome === teamName;
                  
                  const isWin = isHome ? (parseInt(String(game.hScore || '0')) > parseInt(String(game.vScore || '0'))) : (parseInt(String(game.vScore || '0')) > parseInt(String(game.hScore || '0')));
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

            <RosterSection title="Special Teams" players={sortedGroups.SPEC} accent="bg-emerald-900" color="text-emerald-600 bg-emerald-50" onDetails={handlePlayerDetails} onToggleTradeBlock={handleToggleTradeBlock} canEdit={canEdit} tradeBlock={tradeBlock} detailLoading={detailLoading} />
          </div>

          {/* TACTICAL DEPTH CHART (Full Width Bottom) */}
          <div className="lg:col-span-12 bg-white rounded-[2.5rem] p-8 border border-slate-100 shadow-sm">
            <h2 className="font-black uppercase tracking-tighter text-xl mb-8 flex items-center gap-2 text-slate-900">
              <span className="w-2 h-8 bg-blue-600 rounded-full"></span>
              Tactical Depth Chart
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
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
                          href="/free-agents"
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
                          <button 
                            key={idx} 
                            onClick={() => handlePlayerDetails(p)}
                            className={`text-[11px] font-bold uppercase truncate w-full text-left hover:text-blue-600 transition-colors ${isIR ? 'text-slate-400 italic' : 'text-slate-700'}`} 
                            title={p.name || `${p.first} ${p.last}`}
                          >
                            {idx + 1}. <span className="text-[9px] text-slate-400 font-black mr-1">[{p.pos || p.position}]</span> {p.name || `${p.first} ${p.last}`} {isIR && <span className="text-[8px] opacity-60">(IR)</span>}
                          </button>
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

function RosterSection({ title, players, accent, color, onDetails, onToggleTradeBlock, canEdit, tradeBlock, detailLoading }: { title: string, players: RosterPlayer[], accent: string, color: string, onDetails: (p: Player) => void, onToggleTradeBlock: (p: Player) => void, canEdit: boolean, tradeBlock: Set<string>, detailLoading?: string | null }) {
  const avgAge = useMemo(() => {
    const playersWithAge = players.filter(p => p.core?.age || p.age);
    if (playersWithAge.length === 0) return 0;
    const total = playersWithAge.reduce((sum, p) => sum + Number(p.core?.age || p.age || 0), 0);
    return (total / playersWithAge.length).toFixed(1);
  }, [players]);

  return (
    <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden text-left h-fit">
      <div className={`px-8 py-5 font-black text-white ${accent} flex justify-between items-center uppercase tracking-widest text-[10px]`}>
        <span>{title}</span>
        <div className="flex items-center gap-4">
          {Number(avgAge) > 0 && (
            <span className="text-white/40">AVG AGE: <span className="text-white">{avgAge}</span></span>
          )}
          <span className="bg-white/20 px-3 py-1 rounded-lg italic">{players.length}</span>
        </div>
      </div>
      <div className="divide-y divide-slate-50">
        {players.map((p: Player, i: number) => {
          const isOnBlock = tradeBlock.has(p.identity);
          return (
            <div key={i} className="group flex items-center justify-between p-5 hover:bg-slate-50 transition-all">
              <div className="flex items-center gap-4 min-w-0">
                <span className={`shrink-0 font-mono text-[9px] font-black ${color} w-10 h-10 flex items-center justify-center rounded-xl uppercase italic shadow-inner`}>{p.pos}</span>
                <div className="min-w-0">
                  <a href={`https://www.google.com/search?q=${encodeURIComponent(p.name || '')}`} target="_blank" rel="noopener noreferrer" className="text-sm font-black text-slate-900 uppercase italic tracking-tighter leading-none hover:text-blue-600 truncate block">{p.name}</a>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Age {p.core?.age || p.age || '??'}</span>
                    {(() => {
                      const pos = (p.pos || '').toUpperCase();
                      const isOL = ['C', 'G', 'OT', 'OG', 'T', 'OL'].includes(pos);
                      const isSkill = ['WR', 'TE', 'RB', 'HB', 'FB'].includes(pos);
                      const skillRating = isSkill ? (p as {receiving?: string | null}).receiving : null;
                      const ovrVal = isSkill
                        ? (skillRating && skillRating !== '0' ? skillRating : null)
                        : isOL
                          ? (p.overall ? (Number(p.overall) / 2).toFixed(1) : null)
                          : (p.overall || null);
                      return ovrVal ? <span className="text-[9px] font-black text-blue-400 uppercase tracking-widest">OVR {ovrVal}</span> : null;
                    })()}
                  </div>
                </div>
              </div>
              <div className="flex items-center">
                {canEdit && (
                  <button
                    onClick={() => onToggleTradeBlock(p)}
                    className={`flex-shrink-0 ml-4 flex items-center justify-center w-12 h-12 rounded-xl active:scale-95 transition-all shadow-sm font-black text-xs ${
                      isOnBlock
                        ? 'bg-green-600 text-white'
                        : 'bg-slate-100 text-slate-400 group-hover:bg-green-600 group-hover:text-white'
                    }`}
                    title={isOnBlock ? "Remove from Trade Block" : "Post to Trade Block"}
                  >
                    TB
                  </button>
                )}
                <button onClick={() => onDetails(p)} disabled={detailLoading === p.identity} className="flex-shrink-0 ml-4 flex items-center justify-center w-12 h-12 rounded-xl bg-slate-100 text-slate-400 group-hover:bg-blue-600 group-hover:text-white active:scale-95 transition-all shadow-sm disabled:opacity-60">
                  {detailLoading === p.identity ? <Loader2 size={18} className="animate-spin" /> : <ChevronRight size={20} />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Toast({ data }: { data: { message: string; type: 'success' | 'error' } | null }) {
  if (!data) return null;
  return (
    <div className={`fixed bottom-8 left-1/2 -translate-x-1/2 z-[300] px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest shadow-2xl animate-in fade-in slide-in-from-bottom-4 duration-300 whitespace-nowrap ${data.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-red-600 text-white'}`}>
      {data.message}
    </div>
  );
}

function TradeBlockFormModal({ player, asking, onAskingChange, onConfirm, onClose }: {
  player: Player; asking: string; onAskingChange: (v: string) => void; onConfirm: () => void; onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-2xl font-black uppercase italic tracking-tighter">Post to Trade Block</h3>
            <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-1">{player.name}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900 transition-colors"><X size={24} /></button>
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Asking Terms (optional)</label>
          <input autoFocus type="text" placeholder="e.g. 1st round pick, WR..." value={asking}
            onChange={(e) => onAskingChange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
            className="w-full p-4 bg-slate-50 border-none rounded-2xl font-bold text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none" />
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2">
            <ShoppingCart size={14} /> Post
          </button>
        </div>
      </div>
    </div>
  );
}

function RemoveConfirmModal({ player, onConfirm, onClose }: { player: Player; onConfirm: () => void; onClose: () => void; }) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-[2.5rem] shadow-2xl w-full max-w-sm p-8 space-y-6 text-center">
        <div>
          <p className="text-xl font-black uppercase italic tracking-tight">Remove from Trade Block?</p>
          <p className="text-[11px] font-black text-blue-600 uppercase tracking-widest mt-2">{player.name}</p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-500 font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
          <button onClick={onConfirm} className="flex-1 py-4 rounded-2xl bg-red-600 text-white font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all shadow-lg shadow-red-500/30">Remove</button>
        </div>
      </div>
    </div>
  );
}