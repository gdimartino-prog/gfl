'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import PlayerCard from '@/components/PlayerCard'; 
import TeamSelector from '@/components/TeamSelector'; 
import { useTeam } from '@/context/TeamContext'; 
import { useSession } from "next-auth/react";

interface GroupStats {
  avgAge: string | number;
  posMap: Record<string, number>;
  count: number;
}

interface TeamSummary {
  protected: number;
  pullback: number;
  lastUpdated: string;
}

interface Config {
  cuts_year: string;
  draft_year: string;
  protected: number;
  pullback: number;
  cuts_due_date: string; 
}

interface OrphanedPlayer {
  id: string;
  status: string;
  name: string;
}

function CountdownTimer({ dueDate }: { dueDate: string }) {
  const [timeLeft, setTimeLeft] = useState<string>('');
  const [isPast, setIsPast] = useState(false);

  useEffect(() => {
    if (!dueDate) return;
    const target = new Date(dueDate).getTime();
    const interval = setInterval(() => {
      const now = new Date().getTime();
      const distance = target - now;
      if (distance < 0) {
        setTimeLeft("SUBMISSIONS CLOSED");
        setIsPast(true);
        clearInterval(interval);
        return;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60));
      const minutes = Math.floor((distance % (1000 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [dueDate]);

  return (
    <div className="flex flex-col items-end">
      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Deadline Countdown</span>
      <span className={`text-xl font-black tabular-nums tracking-tighter ${isPast ? 'text-red-500' : 'text-amber-500'}`}>
        {timeLeft || "INITIALIZING..."}
      </span>
    </div>
  );
}

export default function CutsPage() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<any[]>([]);
  const { selectedTeam, setSelectedTeam } = useTeam();
  
  const [roster, setRoster] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [orphanedPlayers, setOrphanedPlayers] = useState<OrphanedPlayer[]>([]);
  const [summary, setSummary] = useState<Record<string, TeamSummary>>({});
  const [config, setConfig] = useState<Config>({ cuts_year: '', draft_year: '', protected: 30, pullback: 8, cuts_due_date: '' });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState<any>(null);

  const hasSynced = useRef(false);
  const rosterHeaderRef = useRef<HTMLDivElement>(null);

  // AUTH LOGIC
  const isCommissioner = (session?.user as any)?.role === "admin";
  const userTeamId = (session?.user as any)?.id; 
  const canEdit = isCommissioner || (selectedTeam === userTeamId);

  const isExpired = useMemo(() => {
    if (!config.cuts_due_date) return false;
    return new Date().getTime() > new Date(config.cuts_due_date).getTime();
  }, [config.cuts_due_date]);

  const getTS = () => `ts=${new Date().getTime()}`;

  // SESSION SYNC: Forces coach's team on login
  useEffect(() => {
    if (status === "authenticated" && userTeamId && !hasSynced.current) {
      setSelectedTeam(userTeamId);
      hasSynced.current = true;
    }
    if (status === "unauthenticated") {
      hasSynced.current = false;
    }
  }, [status, userTeamId, setSelectedTeam]);

  const handleTeamSelect = (teamShort: string) => {
    setSelectedTeam(teamShort);
    setTimeout(() => {
      rosterHeaderRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  // INITIAL LOAD
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const rulesRes = await fetch(`/api/rules?${getTS()}`, { cache: 'no-store' });
        const rulesArr = await rulesRes.json();
        
        const newCfg: any = { protected: 30, pullback: 8, cuts_year: '', draft_year: '', cuts_due_date: '' }; 

        if (Array.isArray(rulesArr)) {
          rulesArr.forEach(r => {
            if (r.setting === 'limit_protected' || r.setting === 'protected') newCfg.protected = parseInt(r.value);
            else if (r.setting === 'limit_pullback' || r.setting === 'pullback') newCfg.pullback = parseInt(r.value);
            else newCfg[r.setting] = r.value;
          });
        }
        setConfig(newCfg);

        const [tRes, sRes] = await Promise.all([
          fetch(`/api/teams?${getTS()}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?year=${newCfg.cuts_year || newCfg.draft_year}&${getTS()}`, { cache: 'no-store' }).then(r => r.json())
        ]);
        setTeams(tRes);
        setSummary(sRes.summary || {});
      } catch (e) {
        console.error("Initialization error:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  // TEAM SPECIFIC DATA LOAD
  useEffect(() => {
    if (!selectedTeam || !config.cuts_year) return;
    async function loadTeam() {
      setRosterLoading(true);
      try {
        const [pRes, cRes] = await Promise.all([
          fetch(`/api/players?team=${selectedTeam}&${getTS()}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?team=${selectedTeam}&year=${config.cuts_year}&${getTS()}`, { cache: 'no-store' }).then(r => r.json())
        ]);

        const processedRoster = pRes.map((p: any) => ({
          ...p,
          identity: [p.first, p.last, p.age, p.offense, p.defense, p.special]
            .map(val => String(val || '').trim().toLowerCase())
            .join('|')
        }));

        const currentRosterIdentities = new Set(processedRoster.map((p: any) => p.identity));
        const orphaned = Object.entries(cRes.selections || {})
          .filter(([id, status]) => status !== 'cut' && !currentRosterIdentities.has(id))
          .map(([id, status]) => {
            const parts = id.split('|');
            return {
              id,
              status: String(status),
              name: `${parts[0]} ${parts[1]}`.toUpperCase()
            };
          });

        setOrphanedPlayers(orphaned);
        setRoster(processedRoster.sort((a: any, b: any) => (a.last || '').localeCompare(b.last || '')));
        setSelections(cRes.selections || {});
      } catch (e) {
        console.error("Load team error:", e);
      } finally {
        setRosterLoading(false);
      }
    }
    loadTeam();
  }, [selectedTeam, config.cuts_year]);

  // STATS CALCULATION
  const stats = useMemo(() => {
    const getStats = (type: string): GroupStats => {
      const rosterList = roster.filter(p => (selections[p.identity] || 'cut') === type);
      const orphanedList = orphanedPlayers.filter(p => p.status === type);
      const totalAge = rosterList.reduce((sum, p) => sum + (parseInt(p.age) || 0), 0);
      const posMap: Record<string, number> = {};
      rosterList.forEach(p => { 
        const pos = p.offense || p.defense || p.special || 'UNK';
        posMap[pos] = (posMap[pos] || 0) + 1; 
      });
      return {
        count: rosterList.length + orphanedList.length,
        avgAge: rosterList.length ? (totalAge / rosterList.length).toFixed(1) : 0,
        posMap
      };
    };
    return { 
      protected: getStats('protected'), 
      pullback: getStats('pullback'), 
      cut: getStats('cut') 
    };
  }, [roster, selections, orphanedPlayers]);

  const filteredRoster = roster.filter(p => 
    `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (id: string, s: string) => {
    if (isExpired) return alert("Deadline passed.");
    if (!canEdit) return alert("Unauthorized.");
    
    const currentStatus = selections[id] || 'cut';
    if (s !== currentStatus) {
      if (s === 'protected' && stats.protected.count >= config.protected) return alert(`Limit ${config.protected} Protected.`);
      if (s === 'pullback' && stats.pullback.count >= config.pullback) return alert(`Limit ${config.pullback} Pullback.`);
    }
    setSelections(prev => ({ ...prev, [id]: prev[id] === s ? 'cut' : s }));
  };

  const fetchPlayerDetails = async (id: string) => {
    try {
      const r = await fetch(`/api/players/details/${id}`);
      if (r.ok) setViewingPlayer(await r.json());
      else alert("Could not load stats.");
    } catch {
      alert("Network error.");
    }
  };

  const save = async () => {
    if (isExpired || !canEdit) return alert("Save locked.");
    setSaving(true);
    try {
      const combined = [
        ...roster.map(p => ({ identity: p.identity, status: selections[p.identity] || 'cut' })),
        ...orphanedPlayers.map(p => ({ identity: p.id, status: p.status }))
      ];
      const res = await fetch('/api/cuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: selectedTeam, year: config.cuts_year, selections: combined })
      });
      if (res.ok) {
        const sRes = await fetch(`/api/cuts?year=${config.cuts_year}&${getTS()}`, { cache: 'no-store' }).then(r => r.json());
        setSummary(sRes.summary || {});
        alert("Roster saved.");
      }
    } catch { alert("Save error."); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] font-black text-slate-400 animate-pulse uppercase tracking-widest text-center px-4 text-sm">
      Establishing Secure Link...
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-[#f8fafc] min-h-screen font-sans text-slate-900">
      
      {/* 1. COMPLIANCE DASHBOARD */}
      <div className="bg-[#1e293b] rounded-[2rem] p-8 shadow-2xl border border-slate-700">
        <div className="flex justify-between items-start mb-8 text-left">
            <h2 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-2">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-ping"></span>
              League Compliance Monitor — {config.cuts_year} Season
            </h2>
            {config.cuts_due_date && <CountdownTimer dueDate={config.cuts_due_date} />}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {teams.map(t => {
            const s = summary[t.short] || { protected: 0, pullback: 0 };
            const isComplete = s.protected === config.protected && s.pullback === config.pullback;
            const isSelected = selectedTeam === t.short;
            const isMyTeam = userTeamId === t.short;

            return (
              <div 
                key={t.short} 
                onClick={() => handleTeamSelect(t.short)}
                className={`p-5 rounded-2xl border-2 transition-all duration-300 cursor-pointer active:scale-95 group text-left ${
                  isSelected ? 'bg-blue-600/20 border-blue-500 shadow-lg' : 
                  isComplete ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-500' : 'bg-slate-800/40 border-slate-700 hover:border-slate-50'
                }`}
              >
                <div className="flex justify-between items-start mb-3">
                   <p className={`text-[12px] font-black uppercase truncate ${isSelected ? 'text-blue-400' : isComplete ? 'text-emerald-400' : 'text-slate-200 group-hover:text-white'}`}>
                    {t.name}
                  </p>
                  {isMyTeam && <span className="text-[8px] font-black text-blue-500 bg-blue-500/10 px-1.5 py-0.5 rounded">HOME</span>}
                </div>
                <div className="space-y-2 text-[10px] font-bold text-slate-500 uppercase tracking-widest">
                  <div className="flex justify-between"><span>Protected</span><span className={isComplete ? 'text-emerald-300' : 'text-white'}>{s.protected}/{config.protected}</span></div>
                  <div className="flex justify-between"><span>Pullback</span><span className={isComplete ? 'text-emerald-300' : 'text-white'}>{s.pullback}/{config.pullback}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* STANDARDIZED HEADER SECTION */}
      <div ref={rosterHeaderRef} className="flex flex-col md:flex-row justify-between items-center gap-6 pt-4 scroll-mt-10 border-b border-slate-200 pb-8 text-left">
        <div className="space-y-1">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Cuts <span className="text-blue-600">Portal</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-1">
            Submission Status • Season {config.cuts_year}
          </p>
        </div>
        
        <div className="w-full md:w-96">
            <TeamSelector />
        </div>
      </div>

      {selectedTeam && (
        <div className="space-y-10 pb-20">
          {/* STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            <StatCard title="Protected" stats={stats.protected} color="text-emerald-500" border="border-emerald-500" />
            <StatCard title="Pullback" stats={stats.pullback} color="text-blue-500" border="border-blue-500" />
            <StatCard title="Released" stats={stats.cut} color="text-red-500" border="border-red-500" />
          </div>

          {/* STICKY ACTION BAR */}
          <div className="sticky top-6 z-50 bg-[#0f172a] shadow-2xl p-5 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center px-10 border border-slate-700 gap-6">
              <div className="flex gap-12 text-white font-black text-left">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1 leading-none">Protected Status</span>
                  <span className={`text-3xl tracking-tighter ${stats.protected.count === config.protected ? 'text-emerald-400' : 'text-white'}`}>
                    {stats.protected.count}<span className="text-slate-600 text-lg ml-1">/ {config.protected}</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1 leading-none">Pullback Status</span>
                  <span className={`text-3xl tracking-tighter ${stats.pullback.count === config.pullback ? 'text-blue-400' : 'text-white'}`}>
                    {stats.pullback.count}<span className="text-slate-600 text-lg ml-1">/ {config.pullback}</span>
                  </span>
                </div>
              </div>
              <div className="flex-1 max-w-xl w-full">
                <input type="text" placeholder="Search roster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800/50 border border-slate-600 rounded-2xl px-6 py-4 text-white font-bold text-sm outline-none focus:border-blue-400 transition-all shadow-inner" />
              </div>
              <button onClick={save} disabled={saving || rosterLoading || isExpired || !canEdit} className={`px-12 py-5 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 min-w-[200px] justify-center ${ (isExpired || !canEdit) ? 'bg-red-900/50 text-red-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}>
                {!canEdit ? 'SCOUTING VIEW' : isExpired ? 'PORTAL CLOSED' : saving ? 'SYNCING...' : 'Submit Final Cuts'}
              </button>
          </div>

          {/* ROSTER LIST */}
          <div className="grid grid-cols-1 gap-4">
            {filteredRoster.map((p) => {
              const s = selections[p.identity] || 'cut';
              return (
                <div key={p.identity} className={`bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center group hover:shadow-xl transition-all gap-4 ${!canEdit ? 'opacity-90' : ''}`}>
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-4">
                        <h3 onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(p.first + ' ' + p.last)}`, '_blank')} className="font-black text-2xl text-slate-800 uppercase leading-none tracking-tight cursor-pointer hover:text-blue-600 transition-all">{p.first} {p.last}</h3>
                        <button onClick={() => fetchPlayerDetails(p.identity)} className="bg-slate-100 hover:bg-blue-500 hover:text-white text-slate-400 text-[9px] font-black px-3 py-1 rounded-full uppercase transition-all italic">Stats</button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md uppercase">{p.offense || p.defense || p.special || 'UNK'}</span>
                      <span className="text-[11px] font-bold text-slate-300 uppercase tracking-widest italic leading-none">Age {p.age}</span>
                    </div>
                  </div>
                  <div className={`flex gap-3 w-full sm:w-auto ${!canEdit ? 'pointer-events-none grayscale opacity-50' : ''}`}>
                    <StatusBtn label="Protect" active={s === 'protected'} color="bg-emerald-500" onClick={() => handleToggle(p.identity, 'protected')} />
                    <StatusBtn label="Pullback" active={s === 'pullback'} color="bg-blue-500" onClick={() => handleToggle(p.identity, 'pullback')} />
                    <StatusBtn label="Cut" active={s === 'cut'} color="bg-red-500" onClick={() => handleToggle(p.identity, 'cut')} isCutType />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
      {viewingPlayer && <PlayerCard data={viewingPlayer} onClose={() => setViewingPlayer(null)} />}
    </div>
  );
}

function StatCard({ title, stats, color, border }: any) {
  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border-t-[14px] ${border} shadow-lg space-y-6 text-left`}>
      <div className="flex justify-between items-start">
        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
        <div className="text-right">
          <p className={`text-5xl font-black italic tracking-tighter leading-none ${color}`}>{stats.count}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest italic leading-none">Avg Age {stats.avgAge}</p>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
        {Object.entries(stats.posMap).map(([pos, count]: any) => (
          <span key={pos} className="bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase border border-slate-100">{pos} {count}</span>
        ))}
      </div>
    </div>
  );
}

function StatusBtn({ label, active, color, onClick, isCutType }: any) {
  const base = "flex-1 sm:flex-none px-8 py-4 rounded-[1.2rem] text-[10px] font-black uppercase border-2 transition-all min-w-[115px] italic shadow-sm";
  if (active) return <button onClick={onClick} className={`${base} ${color} text-white border-transparent scale-105 z-10 shadow-lg`}>{label}</button>;
  return <button onClick={onClick} className={`${base} bg-white ${isCutType ? 'text-red-500 border-red-50 hover:bg-red-50' : 'text-slate-300 border-slate-50 hover:bg-slate-50'}`}>{label}</button>;
}