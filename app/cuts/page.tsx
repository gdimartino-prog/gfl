'use client';

import React, { useState, useEffect, useMemo } from 'react';

export default function CutsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [roster, setRoster] = useState<any[]>([]);
  const [selections, setSelections] = useState<Record<string, string>>({});
  const [limits, setLimits] = useState({ protected: 30, pullback: 8 });
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('');

  const currentYear = 2026;

  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
    fetch('/api/cuts/config').then(res => res.json()).then(setLimits).catch(() => {});
  }, []);

  useEffect(() => {
    if (!selectedTeam) { setRoster([]); setSelections({}); setLastUpdated(''); return; }
    setLoading(true);

    Promise.all([
      fetch(`/api/players?team=${selectedTeam}`).then(res => res.json()),
      fetch(`/api/cuts?team=${selectedTeam}&year=${currentYear}`).then(res => res.json())
    ]).then(([playerData, savedData]) => {
      const sorted = [...playerData].sort((a, b) => (a.last || '').localeCompare(b.last || ''));
      setRoster(sorted);
      setSelections(savedData.selections || {});
      setLastUpdated(savedData.lastUpdated || '');
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [selectedTeam]);

  const filteredRoster = useMemo(() => {
    return roster.filter(p => 
      `${p.first} ${p.last}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
      p.position?.toLowerCase().includes(searchTerm.toLowerCase())
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

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-6 bg-gray-50 min-h-screen text-slate-900">
      
      {/* HEADER */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black italic uppercase tracking-tighter text-slate-800 leading-none">Offseason Cut Tool</h1>
            {lastUpdated && (
              <p className="text-[10px] font-bold text-green-600 uppercase tracking-widest mt-1">
                Last Saved: {lastUpdated}
              </p>
            )}
          </div>
          <select value={selectedTeam} onChange={(e) => setSelectedTeam(e.target.value)} className="p-3 border-2 rounded-lg font-bold bg-gray-50 focus:ring-2 focus:ring-green-500">
            <option value="">Select Team...</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name}</option>)}
          </select>
        </div>
        {selectedTeam && (
          <input type="text" placeholder="Search by name or position..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full p-4 rounded-xl border-2 focus:border-green-500 outline-none font-medium" />
        )}
      </div>

      {selectedTeam && (
        <>
          {/* STATS */}
          <div className="sticky top-4 z-50 bg-white shadow-xl p-4 rounded-2xl border border-green-100 flex flex-wrap justify-around items-center gap-4">
            <Counter label="Protected" current={counts.protected} max={limits.protected} colorClass="text-green-600" />
            <Counter label="Pullback" current={counts.pullback} max={limits.pullback} colorClass="text-blue-600" />
            <button onClick={handleSubmit} disabled={saving} className="bg-slate-900 text-white px-10 py-3 rounded-xl font-black uppercase text-sm shadow-lg hover:bg-black transition-all active:scale-95">
              {saving ? 'Saving...' : 'Submit Final Cuts'}
            </button>
          </div>

          {/* TABLE */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            <table className="w-full text-left">
              <tbody className="divide-y divide-gray-50">
                {filteredRoster.map((p, idx) => {
                  const pKey = p.identity || `${p.first}-${idx}`;
                  const status = selections[pKey] || 'cut';
                  return (
                    <tr key={pKey} className="hover:bg-gray-50/50">
                      <td className="px-6 py-4">
                        <p className="font-bold uppercase text-slate-800">{p.first} {p.last}</p>
                        <p className="text-[10px] font-mono text-slate-400 font-black uppercase">{p.position}</p>
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

// Components remain the same as previous color-corrected versions
function StatusButton({ label, active, type, onClick }: any) {
  const activeClasses: any = { 
    protected: 'bg-green-600 text-white border-transparent', 
    pullback: 'bg-blue-600 text-white border-transparent', 
    cut: 'bg-red-600 text-white border-transparent' 
  };
  return (
    <button onClick={onClick} className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase border-2 transition-all ${active ? activeClasses[type] : 'bg-white text-gray-300 border-gray-100'}`}>
      {label}
    </button>
  );
}

function Counter({ label, current, max, colorClass }: any) {
  return (
    <div className="text-center">
      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{label}</p>
      <p className={`text-2xl font-black ${current > max ? 'text-red-600 animate-pulse' : colorClass}`}>{current} / {max}</p>
    </div>
  );
}