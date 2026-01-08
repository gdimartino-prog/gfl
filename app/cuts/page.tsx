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
}

export default function CutsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [summary, setSummary] = useState<Record<string, TeamSummary>>({});
  const [config, setConfig] = useState<Config>({ cuts_year: '', draft_year: '', protected: 30, pullback: 8 });
  
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // 1. Initial Load: Get Config and League Summary
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const configRes = await fetch('/api/cuts/config', { cache: 'no-store' });
        const cfg = await configRes.json();
        setConfig(cfg);

        const [tRes, sRes] = await Promise.all([
          fetch('/api/teams', { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?year=${cfg.cuts_year}`, { cache: 'no-store' }).then(r => r.json())
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

  // 2. Load Team Data (Roster + Saved Selections)
  useEffect(() => {
    if (!selectedTeam || !config.cuts_year) return;
    async function loadTeam() {
      setRosterLoading(true);
      try {
        const [pRes, cRes] = await Promise.all([
          fetch(`/api/players?team=${selectedTeam}`, { cache: 'no-store' }).then(r => r.json()),
          fetch(`/api/cuts?team=${selectedTeam}&year=${config.cuts_year}`, { cache: 'no-store' }).then(r => r.json())
        ]);
        setRoster([...pRes].sort((a, b) => (a.last || '').localeCompare(b.last || '')));
        setSelections(cRes.selections || {});
      } catch (e) {
        console.error("Load team error:", e);
      } finally {
        setRosterLoading(false);
      }
    }
    loadTeam();
  }, [selectedTeam, config.cuts_year]);

  // 3. Stats Logic (Calculates totals and position counts)
  const stats = useMemo(() => {
    const getStats = (type: string): GroupStats => {
      const list = roster.filter(p => (selections[p.identity] || 'cut') === type);
      const totalAge = list.reduce((sum, p) => sum + (parseInt(p.age) || 0), 0);
      const posMap: Record<string, number> = {};
      list.forEach(p => { 
        const pos = p.position || 'UNK';
        posMap[pos] = (posMap[pos] || 0) + 1; 
      });
      return {
        count: list.length,
        avgAge: list.length ? (totalAge / list.length).toFixed(1) : 0,
        posMap
      };
    };
    return { 
      protected: getStats('protected'), 
      pullback: getStats('pullback'), 
      cut: getStats('cut') 
    };
  }, [roster, selections]);

  const filteredRoster = roster.filter(p => 
    `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.position?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleToggle = (id: string, s: string) => {
    if (selections[id] !== s) {
      if (s === 'protected' && stats.protected.count >= config.protected) return alert(`Max ${config.protected} Protected reached.`);
      if (s === 'pullback' && stats.pullback.count >= config.pullback) return alert(`Max ${config.pullback} Pullback reached.`);
    }
    setSelections(prev => ({ ...prev, [id]: prev[id] === s ? 'cut' : s }));
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/cuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          team: selectedTeam, 
          year: config.cuts_year, 
          selections: roster.map(p => ({ identity: p.identity, status: selections[p.identity] || 'cut' })) 
        })
      });
      if (res.ok) {
        const sRes = await fetch(`/api/cuts?year=${config.cuts_year}`, { cache: 'no-store' }).then(r => r.json());
        setSummary(sRes.summary || {});
        alert("Roster Updated Successfully.");
      }
    } catch { 
      alert("Error saving roster."); 
    } finally { 
      setSaving(false); 
    }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50 uppercase font-black text-slate-400 animate-pulse">
      Syncing {config.cuts_year || 'League'} Data...
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-6 bg-[#f8fafc] min-h-screen">
      
      {/* 1. COMPLIANCE DASHBOARD (Long Names) */}
      <div className="bg-[#1e293b] rounded-3xl p-6 shadow-2xl border border-slate-700">
        <h2 className="text-blue-400 text-[10px] font-black uppercase tracking-[0.3em] mb-6 flex items-center gap-2">
           LEAGUE COMPLIANCE BOARD ({config.cuts_year})
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {teams.map(t => {
            const s = summary[t.short] || { protected: 0, pullback: 0 };
            const isComplete = s.protected === config.protected && s.pullback === config.pullback;
            return (
              <div key={t.short} className={`p-4 rounded-2xl border-2 transition-all ${isComplete ? 'bg-emerald-500/10 border-emerald-500/40 shadow-inner' : 'bg-slate-800/50 border-slate-700'}`}>
                <p className={`text-[11px] font-black uppercase mb-2 ${isComplete ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {t.name}
                </p>
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">Prot</span>
                    <span className="text-white">{s.protected} / {config.protected}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-bold">
                    <span className="text-slate-500 uppercase">Pull</span>
                    <span className="text-white">{s.pullback} / {config.pullback}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-end gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">Management Portal</h1>
          <p className="text-[10px] font-black text-slate-400 uppercase mt-2 tracking-widest leading-none italic">Finalizing Roster for {config.draft_year}</p>
        </div>
        <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="p-4 border-2 rounded-2xl font-black bg-white w-full md:w-80 shadow-sm outline-none">
          <option value="">Select Team...</option>
          {teams.map(t => <option key={t.short} value={t.short}>{t.name}</option>)}
        </select>
      </div>

      {selectedTeam && (
        <>
          {/* STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title="Protected" stats={stats.protected} color="text-emerald-500" border="border-emerald-500" />
            <StatCard title="Pullback" stats={stats.pullback} color="text-blue-500" border="border-blue-500" />
            <StatCard title="Released (Cuts)" stats={stats.cut} color="text-red-500" border="border-red-500" />
          </div>

          {/* STICKY ACTION BAR */}
          <div className="sticky top-4 z-50 bg-[#0f172a] shadow-2xl p-4 rounded-[2rem] flex flex-col md:flex-row justify-between items-center px-8 border border-slate-700 gap-4">
             <div className="flex gap-10 text-white font-black">
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-tight">Protected</span>
                  <span className={`text-2xl ${stats.protected.count === config.protected ? 'text-emerald-400' : 'text-white'}`}>{stats.protected.count} / {config.protected}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[9px] text-slate-500 uppercase tracking-widest leading-tight">Pullback</span>
                  <span className={`text-2xl ${stats.pullback.count === config.pullback ? 'text-blue-400' : 'text-white'}`}>{stats.pullback.count} / {config.pullback}</span>
                </div>
             </div>

             <div className="flex-1 max-w-md w-full">
                <input 
                  type="text" 
                  placeholder="SEARCH PLAYER OR POSITION..." 
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-xl px-4 py-3 text-white font-bold text-xs outline-none focus:border-blue-400"
                />
             </div>

             <button onClick={save} disabled={saving || rosterLoading} className="bg-blue-600 hover:bg-blue-500 text-white px-10 py-4 rounded-2xl font-black uppercase text-xs transition-all shadow-lg active:scale-95 disabled:opacity-50">
               {saving ? 'SAVING...' : 'Submit Final Cuts'}
             </button>
          </div>

          {/* PLAYER LIST */}
          <div className="space-y-3">
            {filteredRoster.map((p) => {
              const s = selections[p.identity] || 'cut';
              return (
                <div key={p.identity} className="bg-white p-5 rounded-3xl shadow-sm border border-slate-100 flex justify-between items-center group hover:shadow-md transition-all">
                  <div>
                    <h3 className="font-black text-xl text-slate-800 uppercase leading-none">{p.first} {p.last}</h3>
                    <p className="text-[11px] font-bold text-slate-400 uppercase mt-1">{p.position} — AGE {p.age}</p>
                  </div>
                  <div className="flex gap-2">
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
    <div className={`bg-white p-6 rounded-[2rem] border-t-[12px] ${border} shadow-sm space-y-4`}>
      <div className="flex justify-between items-start">
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <div className="text-right">
          <p className={`text-4xl font-black italic tracking-tighter ${color}`}>{stats.count}</p>
          <p className="text-[10px] font-black text-slate-500 uppercase leading-none">AVG AGE {stats.avgAge}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-1">
        {Object.entries(stats.posMap).map(([pos, count]: any) => (
          <span key={pos} className="bg-slate-50 text-slate-600 px-2 py-1 rounded-lg text-[10px] font-black uppercase border border-slate-100">
            {pos}: <span className="text-slate-900">{count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusBtn({ label, active, color, onClick, isCutType }: any) {
  const baseClasses = "px-6 py-3 rounded-2xl text-[10px] font-black uppercase border-2 transition-all min-w-[100px]";
  
  if (active) {
    return <button onClick={onClick} className={`${baseClasses} ${color} text-white border-transparent shadow-lg`}>{label}</button>;
  }

  const inactiveStyle = isCutType 
    ? "bg-white text-red-500 border-red-50 hover:bg-red-50" 
    : "bg-white text-slate-300 border-slate-100 hover:border-slate-200";

  return (
    <button onClick={onClick} className={`${baseClasses} ${inactiveStyle}`}>
      {label}
    </button>
  );
}
