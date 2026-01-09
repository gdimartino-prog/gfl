'use client';

import React, { useState, useEffect, useMemo } from 'react';

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

// 1. COUNTDOWN COMPONENT
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
      const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
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
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [orphanedPlayers, setOrphanedPlayers] = useState<OrphanedPlayer[]>([]);
  const [summary, setSummary] = useState<Record<string, TeamSummary>>({});
  const [config, setConfig] = useState<Config>({ cuts_year: '', draft_year: '', protected: 30, pullback: 8, cuts_due_date: '' });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Computed value to lock down the UI
  const isExpired = useMemo(() => {
    if (!config.cuts_due_date) return false;
    return new Date().getTime() > new Date(config.cuts_due_date).getTime();
  }, [config.cuts_due_date]);

  const getTS = () => `ts=${new Date().getTime()}`;

  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const configRes = await fetch(`/api/cuts/config?${getTS()}`, { cache: 'no-store' });
        const cfg = await configRes.json();
        setConfig(cfg);

        const [tRes, sRes] = await Promise.all([
          fetch(`/api/teams?${getTS()}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?year=${cfg.cuts_year}&${getTS()}`, { cache: 'no-store' }).then(r => r.json())
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
    return { protected: getStats('protected'), pullback: getStats('pullback'), cut: getStats('cut') };
  }, [roster, selections, orphanedPlayers]);

  const filteredRoster = roster.filter(p => 
    `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (id: string, s: string) => {
    if (isExpired) return alert("Deadline passed. Submissions are locked.");
    const currentStatus = selections[id] || 'cut';
    if (s !== currentStatus) {
      if (s === 'protected' && stats.protected.count >= config.protected) return alert(`Limit ${config.protected} Protected.`);
      if (s === 'pullback' && stats.pullback.count >= config.pullback) return alert(`Limit ${config.pullback} Pullback.`);
    }
    setSelections(prev => {
      const newSelections = { ...prev, [id]: prev[id] === s ? 'cut' : s };
      if (newSelections[id] === 'cut' && orphanedPlayers.some(p => p.id === id)) {
        setOrphanedPlayers(prevO => prevO.filter(p => p.id !== id));
      }
      return newSelections;
    });
  };

  const save = async () => {
    if (isExpired) return alert("Submissions are closed.");
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
    } catch { alert("Error connecting to server."); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-[#f8fafc] font-black text-slate-400 animate-pulse uppercase tracking-widest text-center px-4 text-sm">
      Establishing Secure Link...
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-[#f8fafc] min-h-screen font-sans">
      
      {/* 1. COMPLIANCE DASHBOARD */}
      <div className="bg-[#1e293b] rounded-[2rem] p-8 shadow-2xl border border-slate-700">
        <div className="flex justify-between items-start mb-8">
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
            return (
              <div key={t.short} className={`p-5 rounded-2xl border-2 transition-all duration-300 ${isComplete ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-slate-800/40 border-slate-700'}`}>
                <p className={`text-[12px] font-black uppercase mb-3 truncate ${isComplete ? 'text-emerald-400' : 'text-slate-200'}`}>{t.name}</p>
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Protected</span>
                    <span className={`px-2 py-0.5 rounded ${isComplete ? 'text-emerald-300 bg-emerald-500/20' : 'text-white'}`}>{s.protected} / {config.protected}</span>
                  </div>
                  <div className="flex justify-between items-center text-[10px] font-bold">
                    <span className="text-slate-500 uppercase tracking-wider">Pullback</span>
                    <span className={`px-2 py-0.5 rounded ${isComplete ? 'text-emerald-300 bg-emerald-500/20' : 'text-white'}`}>{s.pullback} / {config.pullback}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-end gap-6 pt-4">
        <div className="space-y-1">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Cuts Portal</h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Authorized Access: {config.draft_year} Season</p>
        </div>
        <div className="w-full md:w-96 group">
          <label className="text-[10px] font-black text-slate-400 uppercase mb-2 block ml-1 tracking-widest">Select Franchise</label>
          <select 
            value={selectedTeam} 
            onChange={(e) => setSelectedTeam(e.target.value)} 
            className="p-5 border-2 border-slate-200 rounded-3xl font-black bg-white w-full shadow-xl outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer text-slate-800"
          >
            <option value="">Choose a team...</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name}</option>)}
          </select>
        </div>
      </div>

      {selectedTeam && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 pt-4">
            <StatCard title="Protected" stats={stats.protected} color="text-emerald-500" border="border-emerald-500" />
            <StatCard title="Pullback" stats={stats.pullback} color="text-blue-500" border="border-blue-500" />
            <StatCard title="Released" stats={stats.cut} color="text-red-500" border="border-red-500" />
          </div>

          <div className="sticky top-6 z-50 bg-[#0f172a] shadow-[0_20px_50px_rgba(0,0,0,0.3)] p-5 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center px-10 border border-slate-700 gap-6">
             <div className="flex gap-12 text-white font-black">
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1">Protected</span>
                  <span className={`text-3xl tracking-tighter ${stats.protected.count === config.protected ? 'text-emerald-400' : 'text-white'}`}>
                    {stats.protected.count}<span className="text-slate-600 text-lg ml-1">/ {config.protected}</span>
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-slate-500 uppercase tracking-[0.2em] mb-1">Pullback</span>
                  <span className={`text-3xl tracking-tighter ${stats.pullback.count === config.pullback ? 'text-blue-400' : 'text-white'}`}>
                    {stats.pullback.count}<span className="text-slate-600 text-lg ml-1">/ {config.pullback}</span>
                  </span>
                </div>
             </div>

             <div className="flex-1 max-w-xl w-full">
                <div className="relative">
                  <input 
                    type="text" 
                    placeholder="Search roster..." 
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-slate-800/50 border border-slate-600 rounded-2xl px-6 py-4 text-white font-bold text-sm outline-none focus:border-blue-400 focus:bg-slate-800 transition-all"
                  />
                </div>
             </div>

             <button 
               onClick={save} 
               disabled={saving || rosterLoading || isExpired} 
               className={`px-12 py-5 rounded-2xl font-black uppercase text-xs transition-all shadow-xl active:scale-95 flex items-center gap-3 min-w-[200px] justify-center ${isExpired ? 'bg-red-900 text-red-400 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-500 text-white'}`}
             >
               {isExpired ? 'CLOSED' : saving ? 'Syncing...' : 'Submit Final Cuts'}
             </button>
          </div>

          {orphanedPlayers.length > 0 && (
            <div className="bg-amber-50 border-2 border-amber-200 rounded-[2rem] p-6 mb-6">
              <p className="text-amber-700 text-xs font-bold mb-4 italic italic uppercase tracking-wider">Traded players detected. Release these slots to regain compliance.</p>
              <div className="grid gap-3">
                {orphanedPlayers.map((p) => (
                  <div key={p.id} className="bg-white/50 p-4 rounded-xl flex justify-between items-center border border-amber-100">
                    <span className="text-slate-900 font-black text-sm uppercase">{p.name} ({p.status})</span>
                    <button onClick={() => handleToggle(p.id, p.status)} className="text-[10px] font-black uppercase bg-white border border-amber-300 text-amber-600 px-4 py-2 rounded-lg hover:bg-amber-600 hover:text-white transition-all">Release Slot</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 pb-20">
            {filteredRoster.map((p) => {
              const s = selections[p.identity] || 'cut';
              return (
                <div key={p.identity} className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex flex-col sm:flex-row justify-between items-center group hover:shadow-xl transition-all gap-4">
                  <div className="text-center sm:text-left">
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(p.first + ' ' + p.last + ' NFL')}`}
                      target="_blank" rel="noopener noreferrer"
                      className="font-black text-2xl text-slate-800 uppercase leading-none tracking-tight hover:text-blue-600"
                    >
                      {p.first} {p.last}
                    </a>
                    <div className="flex items-center gap-3 mt-2 justify-center sm:justify-start">
                      <span className="text-[11px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase">{p.offense || p.defense || p.special || 'UNK'}</span>
                      <span className="text-[11px] font-bold text-slate-400 uppercase tracking-widest">Age {p.age}</span>
                    </div>
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <StatusBtn label="Protect" active={s === 'protected'} color="bg-emerald-500" onClick={() => handleToggle(p.identity, 'protected')} />
                    <StatusBtn label="Pullback" active={s === 'pullback'} color="bg-blue-500" onClick={() => handleToggle(p.identity, 'pullback')} />
                    <StatusBtn label="Cut" active={s === 'cut'} color="bg-red-500" onClick={() => handleToggle(p.identity, 'cut')} isCutType />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

function StatCard({ title, stats, color, border }: any) {
  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border-t-[14px] ${border} shadow-lg space-y-6`}>
      <div className="flex justify-between items-start">
        <p className="text-[12px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
        <div className="text-right">
          <p className={`text-5xl font-black italic tracking-tighter leading-none ${color}`}>{stats.count}</p>
          <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest">Avg Age {stats.avgAge}</p>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
        {Object.entries(stats.posMap).map(([pos, count]: any) => (
          <span key={pos} className="bg-slate-50 text-slate-600 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase border border-slate-100">{pos} {count}</span>
        ))}
      </div>
    </div>
  );
}

function StatusBtn({ label, active, color, onClick, isCutType }: any) {
  const base = "flex-1 sm:flex-none px-8 py-4 rounded-2xl text-[11px] font-black uppercase border-2 transition-all min-w-[110px]";
  if (active) return <button onClick={onClick} className={`${base} ${color} text-white border-transparent shadow-xl scale-105 z-10`}>{label}</button>;
  return <button onClick={onClick} className={`${base} bg-white ${isCutType ? 'text-red-500 border-red-50' : 'text-slate-300 border-slate-100'}`}>{label}</button>;
}