'use client';

import { useEffect, useState, useMemo } from 'react';

export default function FreeAgentPanel({ team, coach, onComplete }: { team: string; coach: string; onComplete?: () => void }) {
  const [freeAgents, setFreeAgents] = useState<any[]>([]);
  const [myRoster, setMyRoster] = useState<any[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  const [isInjuryMode, setIsInjuryMode] = useState(false);
  const [injuredIdentity, setInjuredIdentity] = useState('');
  const [weekOccurred, setWeekOccurred] = useState('');
  const [duration, setDuration] = useState('');

  const resolveCode = (teamString: string) => {
    if (!teamString) return "";
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  const activeCode = useMemo(() => resolveCode(team), [team]);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [faRes, playersRes] = await Promise.all([
          fetch('/api/free-agents').then(res => res.json()),
          fetch('/api/players').then(res => res.json())
        ]);
        setFreeAgents(Array.isArray(faRes) ? faRes : []);
        if (activeCode) {
          const filtered = Array.isArray(playersRes) 
            ? playersRes.filter((p: any) => resolveCode(p.team) === activeCode) 
            : [];
          setMyRoster(filtered);
        }
      } catch (err) { console.error(err); }
    };
    loadData();
  }, [activeCode]);

  const sortedFreeAgents = useMemo(() => [...freeAgents].sort((a, b) => a.last.toLowerCase().localeCompare(b.last.toLowerCase())), [freeAgents]);
  const sortedMyRoster = useMemo(() => [...myRoster].sort((a, b) => (a.last || a.name || "").toLowerCase().localeCompare((b.last || b.name || "").toLowerCase())), [myRoster]);

  const weekBack = (Number(weekOccurred) || 0) + (Number(duration) || 0);

  // --- LOG PREVIEW LOGIC ---
  const logPreview = useMemo(() => {
    if (!selectedIdentity) return "";
    
    const fa = freeAgents.find(p => p.identity === selectedIdentity);
    const faName = fa ? `${fa.first} ${fa.last}` : "Player";
    const faPos = fa?.position || "??";

    if (!isInjuryMode) return `${faPos} - ${faName}`;

    const injured = myRoster.find(p => p.identity === injuredIdentity);
    const injuredName = injured ? (injured.name || `${injured.first} ${injured.last}`) : "___";
    const injuredPos = injured?.position || "??";

    // FORMAT: G - Logan Bruss for injury to G - Jon Smith in week 1 for 3 weeks
    return `${faPos} - ${faName} for injury to ${injuredPos} - ${injuredName} in week ${weekOccurred || 'X'} for ${duration || 'Y'} weeks`;
  }, [selectedIdentity, isInjuryMode, injuredIdentity, weekOccurred, duration, freeAgents, myRoster]);

  async function handleAdd() {
    if (!selectedIdentity) return alert("Select a player.");
    if (isInjuryMode && (!injuredIdentity || !weekOccurred || !duration)) {
      return alert("Complete injury details first.");
    }

    setLoading(true);

    const payload = {
      type: isInjuryMode ? 'INJURY PICKUP' : 'ADD',
      identity: selectedIdentity,
      fromTeam: 'Free Agent',
      toTeam: team,
      coach: coach,
      details: logPreview, // Send the exact string from the preview
      weekBack: isInjuryMode ? String(weekBack) : '',
      status: isInjuryMode ? 'PENDING' : 'INSTANT'
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        alert('Transaction Logged!');
        setFreeAgents(prev => prev.filter(p => p.identity !== selectedIdentity));
        setSelectedIdentity('');
        setInjuredIdentity('');
        setWeekOccurred('');
        setDuration('');
        setIsInjuryMode(false);
        if (onComplete) onComplete();
      }
    } catch (err) { alert('Error'); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-blue-100 text-left">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-blue-700 tracking-tighter">Free Agent Pickup</h3>
        <label className="flex items-center gap-2 text-[10px] font-black text-amber-600 cursor-pointer uppercase">
          <input type="checkbox" checked={isInjuryMode} onChange={(e) => setIsInjuryMode(e.target.checked)} />
          Injury Replacement?
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase">Available Free Agents</label>
        <select value={selectedIdentity} onChange={e => setSelectedIdentity(e.target.value)} className="border-2 border-gray-100 p-3 w-full rounded-lg text-sm text-black">
          <option value="">-- Choose Player --</option>
          {sortedFreeAgents.map((p, i) => <option key={i} value={p.identity}>{p.last}, {p.first} ({p.position})</option>)}
        </select>
      </div>

      {isInjuryMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-4">
          <label className="text-[10px] font-black text-amber-700 uppercase">Injured Player ({activeCode})</label>
          <select value={injuredIdentity} onChange={e => setInjuredIdentity(e.target.value)} className="border-2 border-white p-2 w-full rounded-lg text-sm bg-white text-black">
            <option value="">-- Select Player --</option>
            {sortedMyRoster.map((p, i) => <option key={i} value={p.identity}>{p.last || p.name}, {p.first || ''} ({p.position})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-4">
            <input type="number" placeholder="Week" value={weekOccurred} onChange={e => setWeekOccurred(e.target.value)} className="p-2 border rounded text-black text-sm" />
            <input type="number" placeholder="Duration" value={duration} onChange={e => setDuration(e.target.value)} className="p-2 border rounded text-black text-sm" />
          </div>
        </div>
      )}

      {selectedIdentity && (
        <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
          <p className="text-[9px] font-bold text-slate-400 uppercase mb-1">Log Entry Preview:</p>
          <p className="text-xs font-mono text-slate-700 italic leading-relaxed">{logPreview}</p>
        </div>
      )}

      <button onClick={handleAdd} disabled={loading || !selectedIdentity} className={`w-full p-4 rounded-xl font-black text-white uppercase tracking-widest ${loading || !selectedIdentity ? 'bg-gray-200' : isInjuryMode ? 'bg-amber-500' : 'bg-blue-600'}`}>
        {loading ? 'Processing...' : 'Submit Pickup'}
      </button>
    </div>
  );
}