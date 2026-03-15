'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search } from 'lucide-react';
import { playerOptionLabel } from '@/lib/playerUtils';

interface Team { name: string; short: string; coach: string; }
interface Player {
  first: string; last: string; team: string; position: string; identity: string;
  offense?: string; defense?: string; special?: string;
  run?: string; pass?: string; rush?: string; int?: string; sack?: string; dur?: string;
  passAtt?: string; passComp?: string; passYds?: string; passTD?: string; passInt?: string;
  rushAtt?: string; rushTD?: string;
  rec?: string; recYds?: string; recTD?: string;
  totalDef?: string; runDef?: string; passDef?: string; passRush?: string; tackles?: string; games?: string;
}
interface DraftPick { year: number; round: number; currentOwner: string; overall: number; originalTeam: string; }

export default function TradePanel({
  team,
  coach,
  onComplete
}: {
  team: string;
  coach: string;
  onComplete?: () => void
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [draftPicks, setDraftPicks] = useState<DraftPick[]>([]);

  const [toTeam, setToTeam] = useState('');
  const [fromPlayers, setFromPlayers] = useState<string[]>([]);
  const [toPlayers, setToPlayers] = useState<string[]>([]);
  const [fromDraftPicks, setFromDraftPicks] = useState<string[]>([]);
  const [toDraftPicks, setToDraftPicks] = useState<string[]>([]);

  const [fromSearch, setFromSearch] = useState('');
  const [toSearch, setToSearch] = useState('');

  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const [tRes, pRes, dRes] = await Promise.all([
        fetch(`/api/teams?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/players?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/draft-picks?t=${timestamp}`, { cache: 'no-store' })
      ]);

      if (!tRes.ok || !pRes.ok || !dRes.ok) {
        throw new Error("One or more trade data sources failed to load.");
      }

      const [tData, pData, dData] = await Promise.all([
        tRes.json(),
        pRes.json(),
        dRes.json()
      ]);

      setTeams(Array.isArray(tData) ? tData : []);
      setPlayers(Array.isArray(pData) ? pData : []);
      setDraftPicks(Array.isArray(dData) ? dData : []);
    } catch (err) {
      console.error("Failed to load trade data:", err);
      setStatus('❌ Error: Could not synchronize trade assets.');
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const resolveCode = (teamString: string) => {
    if (!teamString) return "";
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  const activeCode = useMemo(() => resolveCode(team), [team]);
  const partnerCode = useMemo(() => resolveCode(toTeam), [toTeam]);

  const activeFullName = useMemo(() => {
    const entry = teams.find(t => resolveCode(t.short) === activeCode);
    return entry ? entry.name : team;
  }, [teams, activeCode, team]);

  const partnerFullName = useMemo(() => {
    if (!toTeam) return '...';
    const entry = teams.find(t => resolveCode(t.short) === partnerCode);
    return entry ? entry.name : toTeam;
  }, [teams, partnerCode, toTeam]);

  const sortPlayers = (playerList: Player[]) => {
    return [...playerList].sort((a, b) => {
      const lastA = (a.last || "").toLowerCase();
      const lastB = (b.last || "").toLowerCase();
      if (lastA !== lastB) return lastA.localeCompare(lastB);
      return (a.first || "").toLowerCase().localeCompare((b.first || "").toLowerCase());
    });
  };

  const sortPicks = (pickList: DraftPick[]) => {
    return [...pickList].sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return a.round - b.round;
    });
  };

  const fromTeamPlayers = useMemo(() => {
    const list = players.filter(p =>
      resolveCode(p.team) === activeCode &&
      (fromPlayers.includes(p.identity) || `${p.first} ${p.last}`.toLowerCase().includes(fromSearch.toLowerCase()))
    );
    return sortPlayers(list);
  }, [players, activeCode, fromSearch, fromPlayers]);

  const toTeamPlayers = useMemo(() => {
    const list = players.filter(p =>
      resolveCode(p.team) === partnerCode &&
      (toPlayers.includes(p.identity) || `${p.first} ${p.last}`.toLowerCase().includes(toSearch.toLowerCase()))
    );
    return sortPlayers(list);
  }, [players, partnerCode, toSearch, toPlayers]);

  const fromTeamDraftPicks = useMemo(() => {
    const list = draftPicks.filter(p => resolveCode(p.currentOwner) === activeCode);
    return sortPicks(list);
  }, [draftPicks, activeCode]);

  const toTeamDraftPicks = useMemo(() => {
    const list = draftPicks.filter(p => resolveCode(p.currentOwner) === partnerCode);
    return sortPicks(list);
  }, [draftPicks, partnerCode]);

  const handleTrade = async () => {
    if (!toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0 && toPlayers.length === 0 && toDraftPicks.length === 0)) {
      setStatus('⚠️ Please select assets for both sides.');
      return;
    }

    setLoading(true);
    setStatus('⏳ Processing trade assets...');

    const fullFrom = activeFullName;
    const fullTo = partnerFullName;

    try {
      const formattedPlayersFrom = players
        .filter(p => fromPlayers.includes(p.identity))
        .map(p => `${(p.position || "").toUpperCase()} - ${p.first} ${p.last}`);

      const formattedPlayersTo = players
        .filter(p => toPlayers.includes(p.identity))
        .map(p => `${(p.position || "").toUpperCase()} - ${p.first} ${p.last}`);

      const formattedPicksFrom = fromDraftPicks.map(id => {
        const p = draftPicks.find(pick => String(pick.overall) === String(id));
        return p ? `${p.year} Draft Pick Rd ${p.round} (#${p.overall})` : `Pick #${id}`;
      });

      const formattedPicksTo = toDraftPicks.map(id => {
        const p = draftPicks.find(pick => String(pick.overall) === String(id));
        return p ? `${p.year} Draft Pick Rd ${p.round} (#${p.overall})` : `Pick #${id}`;
      });

      const res = await fetch('/api/trades', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fromTeam: activeCode,
          toTeam: partnerCode,
          fromFull: fullFrom,
          toFull: fullTo,
          playersFrom: formattedPlayersFrom,
          playersTo: formattedPlayersTo,
          draftPicksFrom: formattedPicksFrom,
          draftPicksTo: formattedPicksTo,
          rawIdentitiesFrom: fromPlayers,
          rawIdentitiesTo: toPlayers,
          rawPicksFrom: fromDraftPicks,
          rawPicksTo: toDraftPicks,
          submittedBy: coach,
          status: 'PENDING'
        }),
      });

      if (res.ok) {
        setStatus('✅ Trade Logged and Assets Moved.');
        setFromPlayers([]); setToPlayers([]); setFromDraftPicks([]); setToDraftPicks([]); setToTeam('');
        await loadData();
        if (onComplete) onComplete();
      } else {
        const errData = await res.json();
        setStatus(`❌ Trade failed: ${errData.error || 'Server Error'}`);
      }
    } catch {
      setStatus('❌ Network error processing trade.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-purple-100 text-left text-black">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-purple-700 tracking-tighter italic">Trade Center</h3>
        <span className="text-[10px] bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-bold uppercase italic tracking-tighter">
          {activeFullName} Proposing
        </span>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select Trade Partner</label>
        <select
          value={toTeam}
          onChange={(e) => { setToTeam(e.target.value); setStatus(''); }}
          className="border-2 border-gray-100 p-3 w-full rounded-lg text-sm text-black outline-none focus:border-purple-300 transition-colors font-medium"
        >
          <option value="">-- Choose Partner Team --</option>
          {teams.filter(t => resolveCode(t.short) !== activeCode).map(t => (
            <option key={t.short} value={t.short}>{t.name} ({t.short})</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="p-4 bg-blue-50/50 rounded-lg border border-blue-100">
          <p className="text-[11px] font-black text-blue-700 uppercase mb-3 text-center tracking-widest">Your Assets ({activeFullName})</p>
          <p className="text-[9px] text-blue-400 text-center mb-2 italic">Hold Ctrl (Win) or Cmd (Mac) to select multiple assets</p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
              <input
                type="text"
                placeholder="Search your roster..."
                className="w-full p-2 pl-7 text-[10px] border rounded bg-white text-black outline-none focus:border-blue-400"
                value={fromSearch}
                onChange={e => setFromSearch(e.target.value)}
              />
            </div>
            <select
              multiple
              className="border-2 border-white w-full h-80 text-xs rounded-lg p-2 bg-white outline-none text-black font-semibold custom-scrollbar"
              value={fromPlayers}
              onChange={e => setFromPlayers(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {fromTeamPlayers.map(p => (
                <option key={p.identity} value={p.identity}>{playerOptionLabel(p)}</option>
              ))}
            </select>
            <select
              multiple
              className="border-2 border-white w-full h-48 text-xs rounded-lg p-2 bg-white outline-none text-black font-semibold custom-scrollbar"
              value={fromDraftPicks}
              onChange={e => setFromDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {fromTeamDraftPicks.map(p => (
                <option key={p.overall} value={p.overall}>{p.year} Rd {p.round} (#{p.overall})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="p-4 bg-red-50/50 rounded-lg border border-red-100">
          <p className="text-[11px] font-black text-red-700 uppercase mb-3 text-center tracking-widest">Partner Assets ({partnerFullName})</p>
          <p className="text-[9px] text-red-400 text-center mb-2 italic">Hold Ctrl (Win) or Cmd (Mac) to select multiple assets</p>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
              <input
                type="text"
                placeholder="Search partner roster..."
                className="w-full p-2 pl-7 text-[10px] border rounded bg-white text-black outline-none focus:border-red-400"
                value={toSearch}
                onChange={e => setToSearch(e.target.value)}
              />
            </div>
            <select
              multiple
              className="border-2 border-white w-full h-80 text-xs rounded-lg p-2 bg-white outline-none text-black font-semibold custom-scrollbar"
              value={toPlayers}
              onChange={e => setToPlayers(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {toTeamPlayers.map(p => (
                <option key={p.identity} value={p.identity}>{playerOptionLabel(p)}</option>
              ))}
            </select>
            <select
              multiple
              className="border-2 border-white w-full h-48 text-xs rounded-lg p-2 bg-white outline-none text-black font-semibold custom-scrollbar"
              value={toDraftPicks}
              onChange={e => setToDraftPicks(Array.from(e.target.selectedOptions, o => o.value))}
            >
              {toTeamDraftPicks.map(p => (
                <option key={p.overall} value={p.overall}>{p.year} Rd {p.round} (#{p.overall})</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <button
        onClick={handleTrade}
        disabled={loading || !toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0 && toPlayers.length === 0 && toDraftPicks.length === 0)}
        className="w-full bg-purple-600 text-white p-4 rounded-xl font-black hover:bg-purple-700 disabled:bg-gray-200 transition-all uppercase tracking-widest shadow-lg active:scale-95"
      >
        {loading ? 'Processing...' : 'Submit Trade'}
      </button>

      {status && (
        <div className={`p-4 rounded-lg text-xs font-bold text-center border ${
          status.includes('✅') ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600'
        }`}>
          {status}
        </div>
      )}
    </div>
  );
}
