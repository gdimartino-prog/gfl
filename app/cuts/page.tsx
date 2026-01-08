'use client';

import React, { useState, useEffect, useMemo } from 'react';

// Define the shape of our stats for TypeScript
interface GroupStats {
  avgAge: string | number;
  posMap: Record<string, number>;
  count: number;
}

export default function CutsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState({ protected: 30, pullback: 8 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [rosterLoading, setRosterLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const currentYear = 2026;

  // 1. Initial Load: Teams and Limits
  useEffect(() => {
    setLoading(true);
    Promise.all([
      fetch('/api/teams').then(res => res.json()),
      fetch('/api/cuts/config').then(res => res.json()).catch(() => ({ protected: 30, pullback: 8 }))
    ]).then(([teamData, config]) => {
      setTeams(teamData);
      setLimits(config);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // 2. Load Roster AND Previous Saves
  useEffect(() => {
    if (!selectedTeam) { setRoster([]); setSelections({}); setLastUpdated(''); return; }
    setRosterLoading(true);

    Promise.all([
      fetch(`/api/players?team=${selectedTeam}`).then(res => res.json()),
      fetch(`/api/cuts?team=${selectedTeam}&year=${currentYear}`).then(res => res.json())
    ]).then(([playerData, savedData]) => {
      const sorted = [...playerData].sort((a, b) => (a.last || '').localeCompare(b.last || ''));
      setRoster(sorted);
      // Backend returns { selections: {}, lastUpdated: "" }
      setSelections(savedData.selections || {});
      setLastUpdated(savedData.lastUpdated || '');
      setRosterLoading(false);
    }).catch(() => setRosterLoading(false));
  }, [selectedTeam]);

  // Comprehensive Stats Calculation
  const stats = useMemo(() => {
    const getStatsFor = (type: string): GroupStats => {
      const list = roster.filter(p => (selections[p.identity] || 'cut') === type);
      const totalAge = list.reduce((sum, p) => sum + (parseInt(p.age) || 0), 0);
      const avgAge = list.length > 0 ? (totalAge / list.length).toFixed(1) : 0;
      
      const posMap: Record<string, number> = {};
      list.forEach(p => { 
        const pos = p.position || 'UNK';
        posMap[pos] = (posMap[pos] || 0) + 1; 
      });
      
      return { avgAge, posMap, count: list.length };
    };

    return {
      protected: getStatsFor('protected'),
      pullback: getStatsFor('pullback'),
      cut: getStatsFor('cut')
    };
  }, [roster, selections]);

  const filteredRoster = useMemo(() => {
    return roster.filter(p => 
      `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (p.position || '').toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [roster, searchTerm]);

  const counts = useMemo(() => {
    const vals = Object.values(selections);
    return {
      protected: vals.filter(v => v === 'protected').length,
      pullback: vals.filter(v => v === 'pullback').length,
    };
  }, [selections]);

  const handleToggle = (playerKey: string, status: string) => {
    if (selections[playerKey] !== status) {
      if (status === 'protected' && counts.protected >= limits.protected) {
        alert(`Limit: ${limits.protected} max.`); return;
      }
      if (status === 'pullback' && counts.pullback >= limits.pullback) {
        alert(`Limit: ${limits.pullback} max.`); return;
      }
    }
    setSelections(prev => ({ ...prev, [playerKey]: prev[playerKey] === status ? 'cut' : status }));
  };

  const handleSubmit = async () => {
    setSaving(true);
    const submissionData = roster.map(p => ({ identity: p.identity, status: selections[p.identity] || 'cut' }));
    try {
      const res = await fetch('/api/cuts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team: selectedTeam, year: currentYear, selections: submissionData })
      });
      if (res.ok) {
        alert("Cuts Saved Successfully.");
        setLastUpdated(new Date().toLocaleString());
      }
    } catch { alert("Error saving."); } finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
      <p className="text-sm font-black uppercase tracking-widest text-slate-400 animate-pulse">Initializing Data...</p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900">
      
      {/* 1. HEADER & SEARCH */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-800 leading-none">Offseason Cut Tool</h1>
            {lastUpdated && <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">Last Saved: {lastUpdated}</p>}
          </div>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="p-3 border-2 rounded-lg font-bold bg-gray-50 focus:ring-2 focus:ring-blue-500 outline-none transition-all">
            <option value="">Choose a Team...</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name}</option>)}
          </select>
        </div>
        {selectedTeam && (
          <input type="text" placeholder="Search roster..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 rounded-xl border-2 focus:border-blue-500 outline-none font-medium" />
        )}
      </div>

      {selectedTeam && (
        <>
          {/* 2. DASHBOARD STATS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <StatCard title="Protected" data={stats.protected} accent="border-green-500" />
            <StatCard title="Pullback" data={stats.pullback} accent="border-blue-500" />
            <StatCard title="Released (Cuts)" data={stats.cut} accent="border-red-500" />
          </div>

          {/* 3. STICKY CONTROLS */}
          <div className="sticky top-4 z-50 bg-slate-900 shadow-2xl p-4 rounded-2xl flex justify-between items-center px-8 border border-slate-700">
             <div className="flex gap-8">
                <Counter label="Protected" current={counts.protected} max={limits.protected} color="text-green-400" />
                <Counter label="Pullback" current={counts.pullback} max={limits.pullback} color="text-blue-400" />
             </div>
             <button onClick={handleSubmit} disabled={saving || rosterLoading} className="bg-blue-500 hover:bg-blue-600 text-white px-8 py-3 rounded-xl font-black uppercase text-xs transition-all shadow-lg active:scale-95">
               {saving ? 'Saving...' : 'Submit Final Cuts'}
             </button>
          </div>

          {/* 4. ROSTER TABLE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden relative">
            {rosterLoading && <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center"><div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" /></div>}
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-50">
                {filteredRoster.map((p, idx) => {
                  const pKey = p.identity || `${p.first}-${idx}`;
                  const status = selections[pKey] || 'cut';
                  const searchUrl = `https://www.google.com/search?q=${encodeURIComponent(`${p.first} ${p.last} fantasy`)}`;
                  return (
                    <tr key={pKey} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <a href={searchUrl} target="_blank" rel="noreferrer" className="font-bold uppercase text-slate-800 hover:text-blue-600 transition-colors">
                          {p.first} {p.last}
                        </a>
                        <p className="text-[10px] font-mono text-slate-400 font-black uppercase">{p.position} — Age {p.age}</p>
                      </td>
                      <td className="px-6 py-4 flex justify-end gap-2">
                        <StatusButton label="Protect" active={status === 'protected'} type="protected" onClick={() => handleToggle(pKey, 'protected')} />
                        <StatusButton label="Pullback" active={status === 'pullback'} type="pullback" onClick={() => handleToggle(pKey, 'pullback')} />
                        <StatusButton label="Cut" active={status === 'cut'} type="cut" onClick={() => handleToggle(pKey, 'cut')} />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// Fixed StatCard with Type Definition
function StatCard({ title, data, accent }: { title: string, data: GroupStats, accent: string }) {
  return (
    <div className={`bg-white p-5 rounded-2xl border-t-4 ${accent} shadow-sm space-y-3`}>
      <div className="flex justify-between items-end">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
        <p className="text-2xl font-black italic tracking-tighter leading-none">{data.count}</p>
      </div>
      <div className="flex justify-between items-center border-t border-gray-50 pt-2">
        <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Age</span>
        <span className="text-xs font-black text-slate-700">{data.avgAge} yrs</span>
      </div>
      <div className="flex flex-wrap gap-1 mt-1">
        {Object.entries(data.posMap).map(([pos, count]) => (
          <span key={pos} className="text-[9px] font-bold bg-gray-50 px-1.5 py-0.5 rounded border border-gray-100">
            {pos}:<span className="text-blue-500 ml-0.5">{count as number}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function StatusButton({ label, active, type, onClick }: { label: string, active: boolean, type: string, onClick: () => void }) {
  const activeClasses: Record<string, string> = { 
    protected: 'bg-green-600 text-white border-transparent shadow-md scale-105', 
    pullback: 'bg-blue-600 text-white border-transparent shadow-md scale-105', 
    cut: 'bg-red-600 text-white border-transparent shadow-md scale-105' 
  };
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all ${active ? activeClasses[type] : 'bg-white text-gray-300 border-gray-100 hover:border-gray-300'}`}>
      {label}
    </button>
  );
}

function Counter({ label, current, max, color }: { label: string, current: number, max: number, color: string }) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{label}</p>
      <p className={`text-xl font-black leading-none ${current > max ? 'text-red-500' : color}`}>{current} / {max}</p>
    </div>
  );
}