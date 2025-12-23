'use client';

import React, { useEffect, useState } from 'react';

interface Team { name: string; short: string; coach: string; }
interface Player { first: string; last: string; team: string; position: string; identity: string; }
interface DraftPick { year: number; round: number; team: string; }

export default function TradePanel({ team, coach }: { team: string; coach: string }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);

  // Selection State
  const [toTeam, setToTeam] = useState('');
  const [fromPlayers, setFromPlayers] = useState<string[]>([]);
  const [toPlayers, setToPlayers] = useState<string[]>([]);
  const [fromDraftPicks, setFromDraftPicks] = useState<string[]>([]);
  const [toDraftPicks, setToDraftPicks] = useState<string[]>([]);
  
  // Feedback State
  const [status, setStatus] = useState('');
  const [tradeLogs, setTradeLogs] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
    fetch('/api/players').then(res => res.json()).then(setPlayers);
    fetch('/api/draft-picks').then(res => res.json()).then(setDraftPicks).catch(() => []);
  }, []);

  const fromTeamPlayers = players.filter((p) => p.team === team);
  const toTeamPlayers = players.filter((p) => p.team === toTeam);
  const fromTeamDraftPicks = draftPicks.filter((p) => p.team === team);
  const toTeamDraftPicks = draftPicks.filter((p) => p.team === toTeam);

  const handleTrade = async () => {
    if (!toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0)) {
      setStatus('⚠️ Select a partner and at least one asset to trade.');
      return;
    }

    setLoading(true);
    setStatus('⏳ Processing trade and updating rosters...');
    setTradeLogs([]);

    try {
      // Create Payload with Pretty names for logs and Raw IDs for DB updates
      const payload = {
        fromTeam: team,
        toTeam,
        playersFrom: fromPlayers.map(id => {
          const p = players.find(player => player.identity === id);
          return p ? `${p.position} - ${p.first} ${p.last}` : id;
        }),
        playersTo: toPlayers.map(id => {
          const p = players.find(player => player.identity === id);
          return p ? `${p.position} - ${p.first} ${p.last}` : id;
        }),
        rawIdentitiesFrom: fromPlayers, 
        rawIdentitiesTo: toPlayers,
        draftPicksFrom: fromDraftPicks,
        draftPicksTo: toDraftPicks,
        submittedBy: coach
      };

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok && data.success) {
        setStatus('✅ Trade successfully submitted');
        setTradeLogs(data.logs || []);
        // Reset Form
        setFromPlayers([]);
        setToPlayers([]);
        setFromDraftPicks([]);
        setToDraftPicks([]);
        setToTeam('');
      } else {
        throw new Error(data.error || 'Failed to process trade');
      }
    } catch (err: any) {
      setStatus(`⚠️ Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border p-4 rounded bg-white shadow-sm border-purple-200">
      <h3 className="font-bold text-lg uppercase text-purple-600">Propose Trade</h3>
      
      <div className="bg-purple-50 p-3 rounded text-sm border border-purple-100">
        <strong>Active Team:</strong> {team} ({coach})
      </div>

      <label className="block text-xs font-bold text-gray-500 uppercase">Partner Team</label>
      <select
        value={toTeam}
        onChange={(e) => setToTeam(e.target.value)}
        className="border p-2 w-full rounded focus:ring-2 focus:ring-purple-500 outline-none"
      >
        <option value="">-- Select Partner --</option>
        {teams.filter(t => t.short !== team).map((t) => (
          <option key={t.short} value={t.short}>{t.name}</option>
        ))}
      </select>

      <div className="grid grid-cols-2 gap-4">
        {/* Left: Your Assets */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Your Assets</p>
          <select multiple className="border p-2 w-full h-32 text-xs rounded" value={fromPlayers}
            onChange={e => setFromPlayers(Array.from(e.target.selectedOptions, o => o.value))}>
            {fromTeamPlayers.map(p => <option key={p.identity} value={p.identity}>{p.last} ({p.position})</option>)}
          </select>
          <select multiple className="border p-2 w-full h-24 text-xs rounded" value={fromDraftPicks}
            onChange={e => setFromDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}>
            {fromTeamDraftPicks.map(pick => (
              <option key={`${pick.year}-${pick.round}`} value={`${pick.year}-${pick.round}`}>
                {pick.year} - Rd {pick.round}
              </option>
            ))}
          </select>
        </div>

        {/* Right: Partner Assets */}
        <div className="space-y-3">
          <p className="text-[10px] font-bold text-gray-400 uppercase">Partner Assets</p>
          <select multiple className="border p-2 w-full h-32 text-xs rounded" value={toPlayers}
            onChange={e => setToPlayers(Array.from(e.target.selectedOptions, o => o.value))}>
            {toTeamPlayers.map(p => <option key={p.identity} value={p.identity}>{p.last} ({p.position})</option>)}
          </select>
          <select multiple className="border p-2 w-full h-24 text-xs rounded" value={toDraftPicks}
            onChange={e => setToDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}>
            {toTeamDraftPicks.map(pick => (
              <option key={`${pick.year}-${pick.round}`} value={`${pick.year}-${pick.round}`}>
                {pick.year} - Rd {pick.round}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleTrade}
        disabled={loading || !toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0)}
        className="w-full bg-purple-600 text-white p-3 rounded font-bold hover:bg-purple-700 disabled:bg-gray-200 transition-all mt-2"
      >
        {loading ? 'Processing...' : 'Submit Trade Proposal'}
      </button>

      {status && (
        <div className={`mt-4 p-3 rounded text-sm ${status.includes('✅') ? 'bg-green-50 border border-green-200' : 'bg-amber-50 border border-amber-200'}`}>
          <p className={`font-bold ${status.includes('✅') ? 'text-green-800' : 'text-amber-800'}`}>{status}</p>
          {tradeLogs.length > 0 && (
            <div className="mt-2 pt-2 border-t border-green-200 space-y-1">
              <p className="text-[10px] font-bold text-green-600 uppercase">Logged in Transaction History:</p>
              {tradeLogs.map((log, i) => (
                <p key={i} className="text-[11px] font-mono text-green-700 leading-tight">
                  {i + 1}. {log}
                </p>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}