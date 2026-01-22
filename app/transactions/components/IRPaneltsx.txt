'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

export default function IRPanel({ 
  team, 
  coach, 
  onComplete 
}: { 
  team: string; 
  coach: string; 
  onComplete?: () => void 
}) {
  const [roster, setRoster] = useState<any[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  // Extracted to useCallback to allow refreshing after the move
  const fetchRoster = useCallback(async () => {
    if (!team) return;
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      const players = Array.isArray(data) 
        ? data.filter((p: any) => p.teamShort === team || p.team === team) 
        : [];
      setRoster(players);
    } catch (err) {
      console.error("Failed to load roster for IR move:", err);
    }
  }, [team]);

  useEffect(() => {
    fetchRoster();
  }, [fetchRoster]);

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const lastA = (a.last || a.name || "").toLowerCase();
      const lastB = (b.last || b.name || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [roster]);

  async function handleIR() {
    if (!selectedIdentity || !team) return;
    
    const confirmMove = confirm(`Move ${selectedIdentity} to Injured Reserve? This will open a roster spot.`);
    if (!confirmMove) return;

    setLoading(true);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toLocaleString(),
          type: 'IR MOVE',
          identity: selectedIdentity,
          toTeam: 'IR',
          fromShort: team,
          coach,
          details: `Placed on IR: ${selectedIdentity}`,
          status: 'SUCCESS' // Marking as success for the log
        }),
      });

      if (res.ok) {
        // 1. Clear selection
        setSelectedIdentity('');
        
        // 2. Refresh local roster and trigger parent refresh (Logs/Router)
        await fetchRoster();
        if (onComplete) onComplete();
        
        alert('Player moved to IR successfully');
      }
    } catch (err) {
      alert('Error moving player to IR');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-4 rounded-xl bg-white shadow-sm border-amber-200 text-left">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg uppercase text-amber-600 tracking-tight">Move to IR</h3>
        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold uppercase">Reserve List</span>
      </div>

      <select
        value={selectedIdentity}
        onChange={e => setSelectedIdentity(e.target.value)}
        className="border p-2 w-full rounded outline-none focus:ring-2 focus:ring-amber-500 text-black bg-gray-50"
      >
        <option value="">-- Select Player for IR --</option>
        {sortedRoster.map((p, i) => (
          <option key={i} value={p.identity}>
            {p.last || p.name}, {p.first || ''} ({p.position || p.pos})
          </option>
        ))}
      </select>

      <button
        onClick={handleIR}
        disabled={loading || !selectedIdentity}
        className={`w-full p-3 rounded font-black uppercase tracking-widest text-white transition-all ${
          loading || !selectedIdentity 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
            : 'bg-amber-500 hover:bg-amber-600 shadow-md active:transform active:scale-[0.98]'
        }`}
      >
        {loading ? 'Processing...' : 'Confirm IR Move'}
      </button>

      <p className="text-[10px] text-gray-400 italic">
        * Moving a player to IR exempts them from the active roster count.
      </p>
    </div>
  );
}