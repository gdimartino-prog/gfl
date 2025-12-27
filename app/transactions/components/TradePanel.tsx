'use client';

import React, { useEffect, useState } from 'react';

interface Team { name: string; short: string; coach: string; }
interface Player { first: string; last: string; team: string; position: string; identity: string; }
interface DraftPick { year: number; round: number; currentOwner: string; overall: number; originalTeam: string; }

export default function TradePanel({ team, coach }: { team: string; coach: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);

  const [toTeam, setToTeam] = useState('');
  const [fromPlayers, setFromPlayers] = useState<string[]>([]);
  const [toPlayers, setToPlayers] = useState<string[]>([]);
  const [fromDraftPicks, setFromDraftPicks] = useState<string[]>([]);
  const [toDraftPicks, setToDraftPicks] = useState<string[]>([]);

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [tRes, pRes, dRes] = await Promise.all([
          fetch('/api/teams').then(res => res.json()),
          fetch('/api/players').then(res => res.json()),
          fetch('/api/draft-picks').then(res => res.json())
        ]);
        setTeams(tRes);
        setPlayers(pRes);
        setDraftPicks(dRes);
      } catch (err) { console.error("Failed to load trade data:", err); }
    };
    loadData();
  }, []);

  const resolveCode = (teamString: string) => {
    if (!teamString) return "";
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  const activeCode = resolveCode(team);
  const partnerCode = resolveCode(toTeam);

  const fromTeamPlayers = players.filter(p => resolveCode(p.team) === activeCode);
  const toTeamPlayers = players.filter(p => resolveCode(p.team) === partnerCode);
  const fromTeamDraftPicks = draftPicks.filter(p => resolveCode(p.currentOwner) === activeCode);
  const toTeamDraftPicks = draftPicks.filter(p => resolveCode(p.currentOwner) === partnerCode);

  const handleTrade = async () => {
    if (!toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0 && toPlayers.length === 0 && toDraftPicks.length === 0)) {
      setStatus('⚠️ Please select at least one asset to trade.');
      return;
    }

    setLoading(true);
    setStatus('⏳ Updating Master Sheets...');

    try {
      // --- UPDATED MAPPING LOGIC ---
      // Formats to: "Draft Pick 2026 Round 1 (#1)"
      const formattedPicksFrom = fromDraftPicks.map(id => {
        const p = draftPicks.find(pick => String(pick.overall) === String(id));
        return p ? `Draft Pick ${p.year} Round ${p.round} (#${p.overall})` : id;
      });

      const formattedPicksTo = toDraftPicks.map(id => {
        const p = draftPicks.find(pick => String(pick.overall) === String(id));
        return p ? `Draft Pick ${p.year} Round ${p.round} (#${p.overall})` : id;
      });

      const rawIdentitiesFrom = players
        .filter(p => fromPlayers.includes(p.identity))
        .map(p => p.identity);

      const rawIdentitiesTo = players
        .filter(p => toPlayers.includes(p.identity))
        .map(p => p.identity);
      // --- END OF MAPPING LOGIC ---

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeam: activeCode,
          toTeam: partnerCode,
          playersFrom: fromPlayers,
          playersTo: toPlayers,
          draftPicksFrom: formattedPicksFrom, 
          draftPicksTo: formattedPicksTo,     
          rawIdentitiesFrom,        
          rawIdentitiesTo,          
          submittedBy: coach
        }),
      });

      if (res.ok) {
        setStatus('✅ Trade Successful! Transaction History updated.');
        setFromPlayers([]); setToPlayers([]); setFromDraftPicks([]); setToDraftPicks([]); setToTeam('');
      } else {
        setStatus('❌ Trade failed. Check API logs.');
      }
    } catch (err) {
      setStatus('❌ Network error processing trade.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-purple-100 text-left">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-purple-700 tracking-tighter">Transaction Center</h3>
        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">{activeCode} Proposing</span>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select Trade Partner</label>
        <select value={toTeam} onChange={(e) => setToTeam(e.target.value)} className="border-2 border-gray-100 p-3 w-full rounded-lg text-sm outline-none">
          <option value="">-- Choose Partner Team --</option>
          {teams.filter(t => resolveCode(t.short) !== activeCode).map(t => (
            <option key={t.short} value={t.short}>{t.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
          <p className="text-[11px] font-black text-blue-700 uppercase mb-3 text-center">Your Assets ({activeCode})</p>
          <div className="space-y-3">
            <select multiple className="border-2 border-white w-full h-32 text-xs rounded-lg p-2 bg-white" value={fromPlayers} onChange={e => setFromPlayers(Array.from(e.target.selectedOptions, o => o.value))}>
              <optgroup label="Players">{fromTeamPlayers.map(p => <option key={p.identity} value={p.identity}>{p.last}, {p.first} ({p.position})</option>)}</optgroup>
            </select>
            <select multiple className="border-2 border-white w-full h-24 text-xs rounded-lg p-2 bg-white" value={fromDraftPicks} onChange={e => setFromDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}>
              <optgroup label="Draft Picks">{fromTeamDraftPicks.map(p => <option key={p.overall} value={p.overall}>{p.year} Rd {p.round} (#{p.overall})</option>)}</optgroup>
            </select>
          </div>
        </div>

        <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
          <p className="text-[11px] font-black text-red-700 uppercase mb-3 text-center">Partner Assets ({partnerCode || '...' })</p>
          <div className="space-y-3">
            <select multiple className="border-2 border-white w-full h-32 text-xs rounded-lg p-2 bg-white" value={toPlayers} onChange={e => setToPlayers(Array.from(e.target.selectedOptions, o => o.value))}>
              <optgroup label="Players">{toTeamPlayers.map(p => <option key={p.identity} value={p.identity}>{p.last}, {p.first} ({p.position})</option>)}</optgroup>
            </select>
            <select multiple className="border-2 border-white w-full h-24 text-xs rounded-lg p-2 bg-white" value={toDraftPicks} onChange={e => setToDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}>
              <optgroup label="Draft Picks">{toTeamDraftPicks.map(p => <option key={p.overall} value={p.overall}>{p.year} Rd {p.round} (#{p.overall})</option>)}</optgroup>
            </select>
          </div>
        </div>
      </div>

      <button onClick={handleTrade} disabled={loading || !toTeam} className="w-full bg-purple-600 text-white p-4 rounded-xl font-black hover:bg-purple-700 disabled:bg-gray-200 transition-all uppercase tracking-widest shadow-lg">
        {loading ? 'Processing...' : 'Submit Official Trade'}
      </button>

      {status && <div className={`p-3 rounded-lg text-[10px] font-bold text-center border ${status.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>{status}</div>}
    </div>
  );
}