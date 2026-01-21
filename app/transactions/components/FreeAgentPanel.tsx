'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

export default function FreeAgentPanel({ 
  team, 
  coach, 
  onComplete 
}: { 
  team: string; 
  coach: string; 
  onComplete?: () => void 
}) {
  const [freeAgents, setFreeAgents] = useState<any[]>([]);
  const [myRoster, setMyRoster] = useState<any[]>([]);
  const [teamMetadata, setTeamMetadata] = useState<any[]>([]); // Added for name resolution
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

  const loadData = useCallback(async () => {
    try {
      const [faRes, playersRes, teamsRes] = await Promise.all([
        fetch('/api/free-agents').then(res => res.json()),
        fetch('/api/players').then(res => res.json()),
        fetch('/api/teams').then(res => res.json()) // Fetch teams metadata
      ]);
      setFreeAgents(Array.isArray(faRes) ? faRes : []);
      setTeamMetadata(Array.isArray(teamsRes) ? teamsRes : []);
      
      if (activeCode) {
        const filtered = Array.isArray(playersRes) 
          ? playersRes.filter((p: any) => resolveCode(p.team) === activeCode) 
          : [];
        setMyRoster(filtered);
      }
    } catch (err) { console.error("Failed to load FA data:", err); }
  }, [activeCode]);

  useEffect(() => { loadData(); }, [loadData]);

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
    setLoading(true);

    // FIX: Resolve the full team name (e.g., "Vico") from shortcode "VV"
    const entry = teamMetadata.find(t => 
      t.short?.toString().trim().toUpperCase() === activeCode
    );
    const fullTeamName = entry ? entry.name : team;

    const weekBack = (Number(weekOccurred) || 0) + (Number(duration) || 0);

    const payload = {
      type: isInjuryMode ? 'INJURY PICKUP' : 'ADD',
      identity: selectedIdentity,
      fromTeam: 'FA',
      toTeam: fullTeamName, // Sends "Vico" instead of "VV"
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
        setSelectedIdentity(''); setInjuredIdentity(''); setIsInjuryMode(false);
        await loadData();
        if (onComplete) onComplete();
        alert('Transaction Successful');
      }
    } catch (err) { alert('Error processing pickup'); } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-blue-100 text-left text-black">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-blue-700 italic">FA Pickup</h3>
        <label className="flex items-center gap-2 text-[10px] font-black text-amber-600 cursor-pointer uppercase">
          <input type="checkbox" checked={isInjuryMode} onChange={(e) => setIsInjuryMode(e.target.checked)} />
          Injury Replacement?
        </label>
      </div>

      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Available Players</label>
        <select value={selectedIdentity} onChange={e => setSelectedIdentity(e.target.value)} className="border p-3 w-full rounded text-black font-medium">
          <option value="">-- Choose Player --</option>
          {freeAgents.sort((a,b)=> a.last.localeCompare(b.last)).map((p, i) => (
            <option key={i} value={p.identity}>{p.last}, {p.first} ({p.position})</option>
          ))}
        </select>
      </div>

      {isInjuryMode && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl space-y-3">
          <select value={injuredIdentity} onChange={e => setInjuredIdentity(e.target.value)} className="w-full p-2 border rounded text-black font-medium">
            <option value="">-- Select Injured Player --</option>
            {myRoster.map((p, i) => <option key={i} value={p.identity}>{p.last}, {p.first} ({p.position})</option>)}
          </select>
          <div className="flex gap-2">
            <input type="number" placeholder="Wk" value={weekOccurred} onChange={e => setWeekOccurred(e.target.value)} className="w-1/2 p-2 border rounded text-black" />
            <input type="number" placeholder="Duration" value={duration} onChange={e => setDuration(e.target.value)} className="w-1/2 p-2 border rounded text-black" />
          </div>
        </div>
      )}

      {selectedIdentity && (
        <div className="p-2 bg-slate-50 border rounded text-[10px] font-mono text-slate-600 italic">
          Preview: {logPreview}
        </div>
      )}

      <button onClick={handleAdd} disabled={loading || !selectedIdentity} className="w-full p-4 bg-blue-600 text-white rounded-xl font-black uppercase tracking-widest disabled:bg-gray-200">
        {loading ? 'Processing...' : 'Submit Pickup'}
      </button>
    </div>
  );
}