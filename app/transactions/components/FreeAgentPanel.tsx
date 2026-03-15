'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Player, Team } from '@/types';
import { playerOptionLabel } from '@/lib/playerUtils';

export default function FreeAgentPanel({
  team,
  coach,
  onComplete
}: {
  team: string;
  coach: string;
  onComplete?: () => void
}) {
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [teamMetadata, setTeamMetadata] = useState<Team[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);
  const [isInjuryMode, setIsInjuryMode] = useState(false);
  const [injuredIdentity, setInjuredIdentity] = useState('');
  const [weekOccurred, setWeekOccurred] = useState('');
  const [duration, setDuration] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [faSearch, setFaSearch] = useState('');
  const [faPosFilter, setFaPosFilter] = useState('ALL');

  const resolveCode = (teamString: string) => {
    if (!teamString) return "";
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  const activeCode = useMemo(() => resolveCode(team), [team]);

  const OL_POS = new Set(['OL','OT','OG','OC','C','C-G','C-T','G','G-T','T','FB']);

  const filteredFreeAgents = useMemo(() => {
    const search = faSearch.toLowerCase();
    return [...freeAgents]
      .filter(p => {
        if (search && !`${p.first} ${p.last}`.toLowerCase().includes(search)) return false;
        const off = (p.offense || '').toUpperCase();
        const def = (p.defense || '').toUpperCase();
        const spec = (p.special || '').toUpperCase();
        switch (faPosFilter) {
          case 'QB':    return off === 'QB';
          case 'RB/HB': return off === 'RB' || off === 'HB';
          case 'WR/TE': return off === 'WR' || off === 'TE';
          case 'OL':    return OL_POS.has(off);
          case 'DEF':   return def !== '';
          case 'K/P':   return (spec === 'K' || spec === 'P') && !off && !def;
          default:      return true;
        }
      })
      .sort((a, b) => (a.last || '').localeCompare(b.last || ''));
  }, [freeAgents, faSearch, faPosFilter]);

  const loadData = useCallback(async () => {
    try {
      const timestamp = Date.now();
      const [faRes, playersRes, teamsRes] = await Promise.all([
        fetch(`/api/free-agents?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/players?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/teams?t=${timestamp}`, { cache: 'no-store' })
      ]);

      if (!faRes.ok || !playersRes.ok || !teamsRes.ok) {
        throw new Error("Failed to fetch fresh data from one or more APIs.");
      }

      const [faData, playersData, teamsData] = await Promise.all([
        faRes.json(),
        playersRes.json(),
        teamsRes.json()
      ]);

      setFreeAgents(Array.isArray(faData) ? faData : []);
      setTeamMetadata(Array.isArray(teamsData) ? teamsData : []);

      if (activeCode) {
        const filtered = Array.isArray(playersData)
          ? playersData.filter((p: Player) => resolveCode(p.team || '') === activeCode)
          : [];
        setMyRoster(filtered);
      }
    } catch (err) {
      console.error("Failed to load FA data:", err);
    }
  }, [activeCode]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const logPreview = useMemo(() => {
    if (!selectedIdentity) return "";
    const fa = freeAgents.find(p => p.identity === selectedIdentity);
    const faName = fa ? `${fa.first} ${fa.last}` : "Player";
    const faPos = (fa?.position || fa?.pos || "??").toUpperCase();

    if (!isInjuryMode) return `${faPos} - ${faName}`;

    const injured = myRoster.find(p => p.identity === injuredIdentity);
    const injuredName = injured ? (injured.name || `${injured.first} ${injured.last}`) : "___";
    const injuredPos = (injured?.position || injured?.pos || "??").toUpperCase();

    return `${faPos} - ${faName} for injury to ${injuredPos} - ${injuredName} in week ${weekOccurred || 'X'} for ${duration || 'Y'} weeks`;
  }, [selectedIdentity, isInjuryMode, injuredIdentity, weekOccurred, duration, freeAgents, myRoster]);

  async function handleAdd() {
    if (!selectedIdentity) return;

    if (isInjuryMode) {
      const wk = parseInt(weekOccurred);
      const dur = parseInt(duration);
      if (!injuredIdentity || isNaN(wk) || isNaN(dur)) {
        alert("⚠️ Please provide a valid Week, Duration, and Injured Player.");
        return;
      }
    }

    setLoading(true);

    const entry = teamMetadata.find(t =>
      t.short?.toString().trim().toUpperCase() === activeCode
    );
    const fullTeamName = entry ? entry.name : team;
    const weekBack = (Number(weekOccurred) || 0) + (Number(duration) || 0);

    const payload = {
      type: isInjuryMode ? 'INJURY PICKUP' : 'ADD',
      identity: selectedIdentity,
      fromTeam: 'FA',
      toTeam: fullTeamName,
      coach,
      details: logPreview,
      weekBack: isInjuryMode ? String(weekBack) : '',
      status: 'PENDING'
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSelectedIdentity('');
        setInjuredIdentity('');
        setIsInjuryMode(false);
        await loadData();
        if (onComplete) onComplete();
        alert('Transaction Successful');
      } else {
        throw new Error("Transaction failed on server");
      }
    } catch {
      alert('Error processing pickup');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-blue-100 text-left text-black">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-blue-700 italic">Free Agent Pickup</h3>
        <label className="flex items-center gap-3 text-xs font-black text-amber-600 cursor-pointer uppercase">
          <input
            type="checkbox"
            className="w-5 h-5 cursor-pointer accent-amber-600"
            checked={isInjuryMode}
            onChange={(e) => setIsInjuryMode(e.target.checked)}
          />
          Injury Replacement?
        </label>
      </div>

      <div className="space-y-2">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available Players</label>
        <div className="flex flex-wrap gap-1">
          {(['ALL', 'QB', 'RB/HB', 'WR/TE', 'OL', 'DEF', 'K/P'] as const).map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setFaPosFilter(f)}
              className={`px-2 py-0.5 text-[9px] font-bold rounded-full uppercase transition-colors ${
                faPosFilter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-slate-300" size={12} />
          <input
            type="text"
            placeholder="Search by name..."
            className="w-full p-2 pl-7 text-[10px] border rounded bg-white text-black outline-none focus:border-blue-400"
            value={faSearch}
            onChange={e => setFaSearch(e.target.value)}
          />
        </div>
        <select
          size={10}
          value={selectedIdentity}
          onChange={e => setSelectedIdentity(e.target.value)}
          className="border-2 border-gray-100 w-full text-xs rounded-lg p-2 bg-white text-black font-semibold custom-scrollbar outline-none focus:border-blue-400 h-64"
        >
          <option value="">-- Choose Player --</option>
          {filteredFreeAgents.map((p, i) => (
            <option key={i} value={p.identity}>{playerOptionLabel(p)}</option>
          ))}
        </select>
        <p className="text-[9px] text-gray-400 text-right">{filteredFreeAgents.length} player{filteredFreeAgents.length !== 1 ? 's' : ''} available</p>
      </div>

      {isInjuryMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3 animate-in fade-in zoom-in duration-200">
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-amber-400" size={14} />
              <input
                type="text"
                placeholder="Search your roster..."
                className="w-full p-2 pl-8 text-xs border rounded bg-white text-black outline-none focus:border-amber-400"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
              />
            </div>
            <select
              size={6}
              value={injuredIdentity}
              onChange={e => setInjuredIdentity(e.target.value)}
              className="w-full h-48 p-2 border rounded text-black font-medium bg-white outline-none focus:border-amber-400 custom-scrollbar"
            >
              <option value="">-- Select Injured Player --</option>
              {[...myRoster]
                .sort((a, b) => (a.last || "").localeCompare(b.last || ""))
                .filter(p => p.identity === injuredIdentity || `${p.first} ${p.last}`.toLowerCase().includes(rosterSearch.toLowerCase()))
                .map((p, i) => (
                <option key={i} value={p.identity}>{playerOptionLabel(p)}</option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Week Injury Occurred"
              value={weekOccurred}
              onChange={e => setWeekOccurred(e.target.value)}
              className="w-1/2 p-2 border rounded text-black outline-none focus:border-amber-400"
            />
            <input
              type="number"
              placeholder="Duration"
              value={duration}
              onChange={e => setDuration(e.target.value)}
              className="w-1/2 p-2 border rounded text-black outline-none focus:border-amber-400"
            />
          </div>
        </div>
      )}

      {selectedIdentity && (
        <div className="p-2 bg-slate-50 border rounded text-[10px] font-mono text-slate-600 italic">
          Preview: {logPreview}
        </div>
      )}

      <button
        onClick={handleAdd}
        disabled={loading || !selectedIdentity}
        className="w-full p-4 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black uppercase tracking-widest disabled:bg-gray-200 transition-all active:scale-95 shadow-md"
      >
        {loading ? 'Processing...' : 'Submit Pickup'}
      </button>
    </div>
  );
}
