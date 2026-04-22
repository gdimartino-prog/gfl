'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Search, Check } from 'lucide-react';
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

function ToggleList<T extends string>({
  items,
  selected,
  onToggle,
  renderLabel,
  renderSub,
  color,
}: {
  items: { key: T; label: string; sub?: string }[];
  selected: T[];
  onToggle: (key: T) => void;
  renderLabel?: (item: { key: T; label: string; sub?: string }) => React.ReactNode;
  renderSub?: (item: { key: T; label: string; sub?: string }) => React.ReactNode;
  color: 'blue' | 'red';
}) {
  const ring = color === 'blue' ? 'border-blue-400 bg-blue-50' : 'border-red-400 bg-red-50';
  const check = color === 'blue' ? 'bg-blue-500' : 'bg-red-500';
  return (
    <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
      {items.length === 0 && (
        <p className="text-center text-[10px] text-slate-400 italic py-4">No assets found</p>
      )}
      {items.map(item => {
        const isSelected = selected.includes(item.key);
        return (
          <button
            key={item.key}
            type="button"
            onClick={() => onToggle(item.key)}
            className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl border text-left transition-all active:scale-[0.98]
              ${isSelected ? ring + ' border-2' : 'border border-slate-100 bg-white hover:bg-slate-50'}`}
          >
            <div className="min-w-0">
              <p className={`text-xs font-bold truncate ${isSelected ? 'text-slate-900' : 'text-slate-700'}`}>
                {renderLabel ? renderLabel(item) : item.label}
              </p>
              {(renderSub || item.sub) && (
                <p className="text-[10px] text-slate-400 truncate">{renderSub ? renderSub(item) : item.sub}</p>
              )}
            </div>
            <div className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center transition-all
              ${isSelected ? check + ' text-white' : 'border-2 border-slate-200'}`}>
              {isSelected && <Check size={11} strokeWidth={3} />}
            </div>
          </button>
        );
      })}
    </div>
  );
}

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
      if (!tRes.ok || !pRes.ok || !dRes.ok) throw new Error("One or more trade data sources failed to load.");
      const [tData, pData, dData] = await Promise.all([tRes.json(), pRes.json(), dRes.json()]);
      setTeams(Array.isArray(tData) ? tData : []);
      setPlayers(Array.isArray(pData) ? pData : []);
      setDraftPicks(Array.isArray(dData) ? dData : []);
    } catch (err) {
      console.error("Failed to load trade data:", err);
      setStatus('❌ Error: Could not synchronize trade assets.');
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

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

  const toggle = <T extends string>(arr: T[], val: T): T[] =>
    arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];

  const sortPlayers = (list: Player[]) =>
    [...list].sort((a, b) => (a.last || '').localeCompare(b.last || '') || (a.first || '').localeCompare(b.first || ''));

  const sortPicks = (list: DraftPick[]) =>
    [...list].sort((a, b) => a.year !== b.year ? a.year - b.year : a.round - b.round);

  const fromTeamPlayers = useMemo(() => sortPlayers(
    players.filter(p => resolveCode(p.team) === activeCode &&
      (fromPlayers.includes(p.identity) || `${p.first} ${p.last}`.toLowerCase().includes(fromSearch.toLowerCase())))
  ), [players, activeCode, fromSearch, fromPlayers]);

  const toTeamPlayers = useMemo(() => sortPlayers(
    players.filter(p => resolveCode(p.team) === partnerCode &&
      (toPlayers.includes(p.identity) || `${p.first} ${p.last}`.toLowerCase().includes(toSearch.toLowerCase())))
  ), [players, partnerCode, toSearch, toPlayers]);

  const fromTeamDraftPicks = useMemo(() => sortPicks(
    draftPicks.filter(p => resolveCode(p.currentOwner) === activeCode)
  ), [draftPicks, activeCode]);

  const toTeamDraftPicks = useMemo(() => sortPicks(
    draftPicks.filter(p => resolveCode(p.currentOwner) === partnerCode)
  ), [draftPicks, partnerCode]);

  const selectedSummary = () => {
    const parts: string[] = [];
    if (fromPlayers.length) parts.push(`${fromPlayers.length} player${fromPlayers.length > 1 ? 's' : ''} from you`);
    if (fromDraftPicks.length) parts.push(`${fromDraftPicks.length} pick${fromDraftPicks.length > 1 ? 's' : ''} from you`);
    if (toPlayers.length) parts.push(`${toPlayers.length} player${toPlayers.length > 1 ? 's' : ''} from ${partnerFullName}`);
    if (toDraftPicks.length) parts.push(`${toDraftPicks.length} pick${toDraftPicks.length > 1 ? 's' : ''} from ${partnerFullName}`);
    return parts.length ? parts.join(' · ') : 'No assets selected';
  };

  const handleTrade = async () => {
    const fromHasAssets = fromPlayers.length > 0 || fromDraftPicks.length > 0;
    const toHasAssets = toPlayers.length > 0 || toDraftPicks.length > 0;
    if (!toTeam || !fromHasAssets || !toHasAssets) {
      setStatus('⚠️ Please select assets for both sides.');
      return;
    }
    setLoading(true);
    setStatus('⏳ Processing trade assets...');
    try {
      const formattedPlayersFrom = players.filter(p => fromPlayers.includes(p.identity))
        .map(p => `${(p.position || '').toUpperCase()} - ${p.first} ${p.last}`);
      const formattedPlayersTo = players.filter(p => toPlayers.includes(p.identity))
        .map(p => `${(p.position || '').toUpperCase()} - ${p.first} ${p.last}`);
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
          fromTeam: activeCode, toTeam: partnerCode,
          fromFull: activeFullName, toFull: partnerFullName,
          playersFrom: formattedPlayersFrom, playersTo: formattedPlayersTo,
          draftPicksFrom: formattedPicksFrom, draftPicksTo: formattedPicksTo,
          rawIdentitiesFrom: fromPlayers, rawIdentitiesTo: toPlayers,
          rawPicksFrom: fromDraftPicks, rawPicksTo: toDraftPicks,
          submittedBy: coach, status: 'PENDING'
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
    <div className="space-y-5 border p-5 rounded-xl bg-white shadow-lg border-purple-100 text-left text-black">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-purple-700 tracking-tighter italic">Trade Center</h3>
        <span className="text-[10px] bg-purple-100 text-purple-700 px-3 py-1.5 rounded-full font-bold uppercase italic tracking-tighter">
          {activeFullName} Proposing
        </span>
      </div>

      {/* Trade partner */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">Select Trade Partner</label>
        <select
          value={toTeam}
          onChange={e => { setToTeam(e.target.value); setStatus(''); }}
          className="border-2 border-gray-100 p-3 w-full rounded-lg text-sm text-black outline-none focus:border-purple-300 transition-colors font-medium"
        >
          <option value="">-- Choose Partner Team --</option>
          {teams.filter(t => resolveCode(t.short) !== activeCode).map(t => (
            <option key={t.short} value={t.short}>{t.name} ({t.short})</option>
          ))}
        </select>
      </div>

      {/* Two-side asset picker */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* YOUR side */}
        <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100 space-y-3">
          <p className="text-[11px] font-black text-blue-700 uppercase text-center tracking-widest">
            Your Assets — {activeFullName}
            {(fromPlayers.length + fromDraftPicks.length) > 0 && (
              <span className="ml-2 bg-blue-500 text-white rounded-full px-2 py-0.5 text-[9px]">
                {fromPlayers.length + fromDraftPicks.length}
              </span>
            )}
          </p>

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
            <input type="text" placeholder="Search your roster..."
              className="w-full p-2 pl-7 text-[10px] border rounded-lg bg-white text-black outline-none focus:border-blue-400"
              value={fromSearch} onChange={e => setFromSearch(e.target.value)} />
          </div>

          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest">Players</p>
          <ToggleList
            color="blue"
            items={fromTeamPlayers.map(p => ({ key: p.identity, label: playerOptionLabel(p) }))}
            selected={fromPlayers}
            onToggle={key => setFromPlayers(prev => toggle(prev, key))}
          />

          <p className="text-[9px] font-black text-blue-400 uppercase tracking-widest mt-1">Draft Picks</p>
          <ToggleList
            color="blue"
            items={fromTeamDraftPicks.map(p => ({
              key: String(p.overall),
              label: `${p.year} Round ${p.round}`,
              sub: `Pick #${p.overall} · Originally ${p.originalTeam}`,
            }))}
            selected={fromDraftPicks}
            onToggle={key => setFromDraftPicks(prev => toggle(prev, key))}
          />
        </div>

        {/* PARTNER side */}
        <div className={`p-4 rounded-xl border space-y-3 ${toTeam ? 'bg-red-50/50 border-red-100' : 'bg-slate-50 border-slate-100'}`}>
          <p className="text-[11px] font-black text-red-700 uppercase text-center tracking-widest">
            {toTeam ? `${partnerFullName} Assets` : 'Select a partner'}
            {(toPlayers.length + toDraftPicks.length) > 0 && (
              <span className="ml-2 bg-red-500 text-white rounded-full px-2 py-0.5 text-[9px]">
                {toPlayers.length + toDraftPicks.length}
              </span>
            )}
          </p>

          {toTeam ? (
            <>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
                <input type="text" placeholder="Search partner roster..."
                  className="w-full p-2 pl-7 text-[10px] border rounded-lg bg-white text-black outline-none focus:border-red-400"
                  value={toSearch} onChange={e => setToSearch(e.target.value)} />
              </div>

              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest">Players</p>
              <ToggleList
                color="red"
                items={toTeamPlayers.map(p => ({ key: p.identity, label: playerOptionLabel(p) }))}
                selected={toPlayers}
                onToggle={key => setToPlayers(prev => toggle(prev, key))}
              />

              <p className="text-[9px] font-black text-red-400 uppercase tracking-widest mt-1">Draft Picks</p>
              <ToggleList
                color="red"
                items={toTeamDraftPicks.map(p => ({
                  key: String(p.overall),
                  label: `${p.year} Round ${p.round}`,
                  sub: `Pick #${p.overall} · Originally ${p.originalTeam}`,
                }))}
                selected={toDraftPicks}
                onToggle={key => setToDraftPicks(prev => toggle(prev, key))}
              />
            </>
          ) : (
            <p className="text-center text-xs text-slate-400 italic py-8">Choose a trade partner above to see their assets</p>
          )}
        </div>
      </div>

      {/* Summary bar */}
      {(fromPlayers.length + fromDraftPicks.length + toPlayers.length + toDraftPicks.length) > 0 && (
        <div className="bg-purple-50 border border-purple-100 rounded-xl px-4 py-3 text-[11px] text-purple-700 font-bold">
          {selectedSummary()}
        </div>
      )}

      <button
        onClick={handleTrade}
        disabled={loading || !toTeam || (fromPlayers.length === 0 && fromDraftPicks.length === 0) || (toPlayers.length === 0 && toDraftPicks.length === 0)}
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
