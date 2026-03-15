'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import PlayerCard from '@/components/PlayerCard';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';
import { useSession } from "next-auth/react";
import {
  Clock,
  Search,
  UserCheck,
  Scissors,
  RotateCw
} from 'lucide-react';
import { Team, Player } from '@/types';
import StatCard from './StatCard';

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
        setTimeLeft("EXPIRED");
        setIsPast(true);
        clearInterval(interval);
        return;
      }
      const days = Math.floor(distance / (1000 * 60 * 60 * 24));
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      setTimeLeft(`${days}D ${hours}H ${minutes}M`);
    }, 1000);
    return () => clearInterval(interval);
  }, [dueDate]);

  return (
    <div className="flex flex-col items-end">
      <div className="flex items-center gap-2 text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">
        <Clock size={12} /> Deadline
      </div>
      <span className={`text-2xl font-black tabular-nums tracking-tighter italic ${isPast ? 'text-red-500' : 'text-amber-500'}`}>
        {timeLeft || "SYNCING..."}
      </span>
    </div>
  );
}

export default function CutsClient() {
  const { data: session, status } = useSession();
  const [teams, setTeams] = useState<Team[]>([]);
  const { selectedTeam, setSelectedTeam } = useTeam();

  const [roster, setRoster] = useState<Player[]>([]);
  const [initialSelections, setInitialSelections] = useState<Record<string, string>>({});
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [orphanedPlayers, setOrphanedPlayers] = useState<OrphanedPlayer[]>([]);
  const [summary, setSummary] = useState<Record<string, TeamSummary>>({});
  const [config, setConfig] = useState<Config>({ cuts_year: '', draft_year: '', protected: 30, pullback: 8, cuts_due_date: '' });

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'protected' | 'pullback' | 'cut'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);

  const hasSynced = useRef(false);
  const rosterHeaderRef = useRef<HTMLDivElement>(null);

  const userRole = (session?.user as { role?: string })?.role;
  const isCommissioner = userRole === "admin" || userRole === "superuser";
  const userTeamId = (session?.user as { id?: string })?.id;
  const canEdit = isCommissioner || (selectedTeam === userTeamId);

  const isExpired = useMemo(() => {
    if (!config?.cuts_due_date) return false;
    return new Date().getTime() > new Date(config.cuts_due_date).getTime();
  }, [config?.cuts_due_date]);

  useEffect(() => {
    if (status === "authenticated" && userTeamId && !hasSynced.current) {
      setSelectedTeam(userTeamId);
      hasSynced.current = true;
    }
  }, [status, userTeamId, setSelectedTeam]);

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const rulesRes = await fetch(`/api/rules?ts=${Date.now()}`, { cache: 'no-store' });
        const rulesArr = await rulesRes.json();
        const newCfg: Config = { protected: 30, pullback: 8, cuts_year: '', draft_year: '', cuts_due_date: '' };

        if (Array.isArray(rulesArr)) {
          rulesArr.forEach((r: { setting: string; value: string }) => {
            const s = r.setting;
            if (s === 'limit_protected' || s === 'protected') newCfg.protected = parseInt(r.value);
            else if (s === 'limit_pullback' || s === 'pullback') newCfg.pullback = parseInt(r.value);
            else if (s === 'cuts_year') newCfg.cuts_year = r.value;
            else if (s === 'draft_year') newCfg.draft_year = r.value;
            else if (s === 'cuts_due_date') newCfg.cuts_due_date = r.value;
          });
        }
        setConfig(newCfg);

        const [tRes, sRes] = await Promise.all([
          fetch(`/api/teams?ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?year=${newCfg.cuts_year || newCfg.draft_year}&ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
        ]);
        setTeams([...tRes].sort((a: Team, b: Team) => (a.name || '').localeCompare(b.name || '')));
        setSummary(sRes.summary || {});
      } catch (e) { console.error(e); } finally { setLoading(false); }
    }
    init();
  }, []);

  useEffect(() => {
    if (!selectedTeam || !config?.cuts_year) return;
    async function loadTeam() {
      try {
        const [pRes, cRes] = await Promise.all([
          fetch(`/api/players?team=${selectedTeam}&ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?team=${selectedTeam}&year=${config.cuts_year}&ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.json())
        ]);

        const processedRoster = pRes.map((p: Player) => ({
          ...p,
          identity: [p.first, p.last, p.age, p.offense, p.defense, p.special].map(v => String(v || '').trim().toLowerCase()).join('|')
        }));

        const currentRosterIdentities = new Set(processedRoster.map((p: Player) => p.identity));
        const cutsData = cRes.selections || {};
        const orphaned = Object.entries(cutsData)
          .filter(([id, s]) => s !== 'cut' && !currentRosterIdentities.has(id))
          .map(([id, s]): OrphanedPlayer => {
            const parts = id.split('|');
            return { id, status: String(s), name: `${parts[0]} ${parts[1]}`.toUpperCase() };
          });

        setInitialSelections(cutsData);
        setOrphanedPlayers(orphaned);
        setRoster(processedRoster.sort((a: Player, b: Player) => (a.last || '').localeCompare(b.last || '')));
        setSelections(cutsData);
      } catch (e) { console.error(e); }
    }
    loadTeam();
  }, [selectedTeam, config?.cuts_year]);

  const stats = useMemo(() => {
    const getStats = (type: string): GroupStats => {
      const rosterList = roster.filter(p => (selections[p.identity] || 'cut') === type);
      const orphanedList = orphanedPlayers.filter(p => p.status === type);
      const totalAge = rosterList.reduce((sum, p) => sum + (p.age || 0), 0);
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

  const save = useCallback(async (isAutoSave = false) => {
    if (isExpired || !canEdit) return;
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
        const sRes = await fetch(`/api/cuts?year=${config.cuts_year}&ts=${Date.now()}`, { cache: 'no-store' }).then(r => r.json());
        setSummary(sRes.summary || {});
        setInitialSelections(selections);
        if (!isAutoSave) {
          alert("Roster changes saved to secure database.");
        }
      } else {
        if (!isAutoSave) alert("Error saving cuts.");
      }
    } catch {
      if (!isAutoSave) alert("Error saving cuts.");
    } finally { setSaving(false); }
  }, [isExpired, canEdit, roster, orphanedPlayers, selections, selectedTeam, config.cuts_year]);

  useEffect(() => {
    const hasChanged = JSON.stringify(selections) !== JSON.stringify(initialSelections);
    if (!hasChanged || Object.keys(selections).length === 0) return;

    const handler = setTimeout(() => save(true), 2000);
    return () => clearTimeout(handler);
  }, [selections, initialSelections, save]);

  const handleToggle = (id: string, s: string) => {
    if (isExpired || !canEdit) return;
    const currentStatus = selections[id] || 'cut';
    if (s !== currentStatus) {
      const player = roster.find(p => p.identity === id);
      if (player && player.offense === 'QB' && (s === 'protected' || s === 'pullback')) {
        const keptQBs = roster.filter(p => {
          const sel = selections[p.identity] || 'cut';
          return (sel === 'protected' || sel === 'pullback') && p.offense === 'QB';
        });
        if (keptQBs.length >= 2) {
          alert("You can only keep a maximum of 2 QBs.");
          return;
        }
      }
      if (s === 'protected' && stats.protected.count >= config.protected) return alert(`Limit ${config.protected} Protected.`);
      if (s === 'pullback' && stats.pullback.count >= config.pullback) return alert(`Limit ${config.pullback} Pullback.`);
    }
    setSelections(prev => ({ ...prev, [id]: prev[id] === s ? 'cut' : s }));
  };

  const fetchPlayerDetails = async (id: string) => {
    try {
      const r = await fetch(`/api/players/details/${encodeURIComponent(id)}`);
      if (r.ok) setViewingPlayer(await r.json());
      else alert("Could not load stats.");
    } catch { alert("Network error."); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 font-black text-slate-300 animate-pulse uppercase tracking-[0.3em] text-sm italic">
      Synchronizing Compliance Database...
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-slate-900">

      {/* COMPLIANCE MONITOR */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 md:p-12 shadow-2xl border border-slate-800">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6 text-left">
          <div>
            <h2 className="text-blue-500 text-[10px] font-black uppercase tracking-[0.4em] flex items-center gap-3">
              <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(59,130,246,0.5)]"></span>
              League Compliance Monitor — {config?.cuts_year}
            </h2>
            <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest mt-2">Active Roster Verification</p>
          </div>
          {config?.cuts_due_date && <CountdownTimer dueDate={config.cuts_due_date} />}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {teams.map(t => {
            const s = summary[t.short] || { protected: 0, pullback: 0 };
            const isComplete = s.protected === config.protected && s.pullback === config.pullback;
            const isSelected = selectedTeam === t.short;
            return (
              <div
                key={t.short}
                onClick={() => { setSelectedTeam(t.short); rosterHeaderRef.current?.scrollIntoView({ behavior: 'smooth' }); }}
                className={`p-4 rounded-2xl border-2 transition-all cursor-pointer group text-left ${
                  isSelected ? 'bg-blue-600/20 border-blue-500' :
                  isComplete ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-slate-800/40 border-slate-800 hover:border-slate-700'
                }`}
              >
                <p className={`text-[10px] font-black uppercase truncate mb-3 ${isSelected ? 'text-blue-400' : isComplete ? 'text-emerald-400' : 'text-slate-500'}`}>{t.name}</p>
                <div className="space-y-1 text-[9px] font-black text-slate-600 uppercase">
                  <div className="flex justify-between"><span>PROT</span><span className={isComplete ? 'text-emerald-400' : 'text-slate-300'}>{s.protected}</span></div>
                  <div className="flex justify-between"><span>PULL</span><span className={isComplete ? 'text-emerald-400' : 'text-slate-300'}>{s.pullback}</span></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* HEADER SECTION */}
      <div ref={rosterHeaderRef} className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8 text-left">
        <div className="space-y-1">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Roster <span className="text-blue-600">Cuts</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-2 flex items-center gap-2">
            <Scissors size={14} className="text-red-500" /> Authorized Personnel Only • Submission Portal{config?.cuts_year ? ` • Season ${config.cuts_year}` : ''}
          </p>
        </div>
        <div className="w-full md:w-96">
          <TeamSelector />
        </div>
      </div>

      {selectedTeam && (
        <div className="space-y-10 pb-20">
          {/* STAT CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatCard title="Protected" stats={stats.protected} color="text-emerald-500" border="border-emerald-500" icon={<UserCheck size={20}/>}/>
            <StatCard title="Pullback" stats={stats.pullback} color="text-blue-500" border="border-blue-500" icon={<RotateCw size={20}/>}/>
            <StatCard title="Released" stats={stats.cut} color="text-red-500" border="border-red-500" icon={<Scissors size={20}/>}/>
          </div>

          {/* STICKY CONTROL PANEL */}
          <div className="sticky top-6 z-50 bg-slate-900 shadow-2xl p-6 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center px-10 border border-slate-800 gap-8">
            <div className="flex gap-12">
              <div className="text-left">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Protected Capacity</p>
                <p className={`text-4xl font-black italic tracking-tighter ${stats?.protected?.count === config?.protected ? 'text-emerald-400' : 'text-white'}`}>
                  {stats?.protected?.count || 0}<span className="text-slate-600 text-lg italic ml-2">/ {config?.protected || 30}</span>
                </p>
              </div>
              <div className="text-left">
                <p className="text-[9px] text-slate-500 font-black uppercase tracking-widest mb-1">Pullback Capacity</p>
                <p className={`text-4xl font-black italic tracking-tighter ${stats?.pullback?.count === config?.pullback ? 'text-blue-400' : 'text-white'}`}>
                  {stats?.pullback?.count || 0}<span className="text-slate-600 text-lg italic ml-2">/ {config?.pullback || 8}</span>
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2 flex-1 max-w-lg w-full">
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                <input type="text" placeholder="Filter roster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full bg-slate-800 border-none rounded-2xl px-12 py-4 text-white font-bold text-sm focus:ring-2 focus:ring-blue-500" />
              </div>
              <div className="flex gap-2">
                {([
                  { key: 'all',       label: 'All' },
                  { key: 'protected', label: 'Protected' },
                  { key: 'pullback',  label: 'Pullback' },
                  { key: 'cut',       label: 'Released' },
                ] as const).map(({ key, label }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setStatusFilter(key)}
                    className={`flex-1 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all ${
                      statusFilter === key
                        ? key === 'protected' ? 'bg-emerald-500 text-white'
                        : key === 'pullback'  ? 'bg-blue-500 text-white'
                        : key === 'cut'       ? 'bg-red-500 text-white'
                        : 'bg-white text-slate-900'
                        : 'bg-slate-800 text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <button
              onClick={() => save(false)}
              disabled={saving || isExpired || !canEdit}
              className={`px-12 py-5 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shadow-xl active:scale-95 ${ (isExpired || !canEdit) ? 'bg-slate-800 text-slate-600 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
            >
              {!canEdit ? 'Scouting Access Only' : isExpired ? 'Deadline Passed' : saving ? 'Syncing...' : 'Submit Roster Cut List'}
            </button>
          </div>

          {/* ROSTER LIST */}
          <div className="grid grid-cols-1 gap-4">
            {roster.filter(p => {
              if (!`${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase())) return false;
              if (statusFilter !== 'all' && (selections[p.identity] || 'cut') !== statusFilter) return false;
              return true;
            }).map((p) => {
              const s = selections[p.identity] || 'cut';
              return (
                <div key={p.identity} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center group hover:shadow-xl transition-all gap-6">
                  <div className="text-left flex-1">
                    <div className="flex items-center gap-4">
                      <h3 onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(p.first + ' ' + p.last)}`, '_blank')} className="font-black text-2xl text-slate-800 uppercase italic tracking-tighter leading-none cursor-pointer hover:text-blue-600 transition-all">{p.first} {p.last}</h3>
                      <button onClick={() => fetchPlayerDetails(p.identity)} className="bg-slate-50 text-slate-400 text-[8px] font-black px-3 py-1 rounded-full uppercase tracking-widest hover:bg-blue-600 hover:text-white transition-all italic">Stats Terminal</button>
                    </div>
                    <div className="flex items-center gap-3 mt-3">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg uppercase tracking-widest">{p.offense || p.defense || p.special || 'UNK'}</span>
                      <span className="text-[10px] font-black text-slate-300 uppercase italic">Age {p.age}</span>
                    </div>
                  </div>
                  <div className={`flex gap-3 w-full sm:w-auto ${!canEdit ? 'pointer-events-none grayscale opacity-30' : ''}`}>
                    <StatusBtn label="Protect" active={s === 'protected'} color="bg-emerald-500" onClick={() => handleToggle(p.identity, 'protected')} />
                    <StatusBtn label="Pullback" active={s === 'pullback'} color="bg-blue-500" onClick={() => handleToggle(p.identity, 'pullback')} />
                    <StatusBtn label="Release" active={s === 'cut'} color="bg-red-500" onClick={() => handleToggle(p.identity, 'cut')} isCutType />
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

function StatusBtn({ label, active, color, onClick, isCutType }: { label: string, active: boolean, color: string, onClick: () => void, isCutType?: boolean }) {
  const base = "flex-1 sm:flex-none px-8 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest border-2 transition-all min-w-[125px] italic shadow-sm active:scale-95";
  if (active) return <button onClick={onClick} className={`${base} ${color} text-white border-transparent shadow-lg scale-105 z-10`}>{label}</button>;
  return <button onClick={onClick} className={`${base} bg-white ${isCutType ? 'text-red-500 border-red-50 hover:bg-red-50' : 'text-slate-300 border-slate-100 hover:bg-slate-50'}`}>{label}</button>;
}
