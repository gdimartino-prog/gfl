'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';

export default function DropPlayer({ 
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

  // Wrapped in useCallback so it's stable across renders
  const fetchRoster = useCallback(async () => {
    if (!team) return;
    try {
      const res = await fetch('/api/players');
      const data = await res.json();
      
      // Filter players belonging to the active team
      const players = Array.isArray(data) 
        ? data.filter((p: any) => p.teamShort === team || p.team === team) 
        : [];
      setRoster(players);
    } catch (err) {
      console.error("Failed to load roster:", err);
    }
  }, [team]);

  // Initial fetch on mount or when team changes
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

  async function handleDrop() {
    if (!selectedIdentity || !team) return;
    
    const confirmMove = confirm(`Are you sure you want to waive ${selectedIdentity}?`);
    if (!confirmMove) return;

    setLoading(true);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: new Date().toLocaleString(),
          type: 'DROP',
          identity: selectedIdentity,
          fromTeam: team,
          fromShort: team,
          coach,
          details: `Dropped/Waived: ${selectedIdentity}`,
          status: 'SUCCESS' 
        }),
      });

      if (res.ok) {
        // 1. Clear local selection
        setSelectedIdentity('');
        
        // 2. Refresh local roster data
        await fetchRoster(); 
        
        // 3. Trigger the parent refresh (increments refreshKey in page.tsx)
        if (onComplete) onComplete();
        
        alert('Player dropped successfully');
      }
    } catch (err) {
      alert('Error dropping player');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-5 rounded-xl bg-white shadow-lg border-red-100 text-left">
      <div className="flex justify-between items-center border-b pb-3">
        <h3 className="font-black text-xl uppercase text-red-600 tracking-tighter italic">Waive Player</h3>
        <span className="text-[10px] bg-red-50 text-red-600 px-2 py-1 rounded font-black uppercase tracking-widest">
          Roster Release
        </span>
      </div>
      
      <div className="space-y-1">
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Select Player to Release</label>
        <select
          value={selectedIdentity}
          onChange={e => setSelectedIdentity(e.target.value)}
          className="border-2 border-gray-100 p-3 w-full rounded-lg text-sm outline-none focus:border-red-400 transition-colors text-black font-medium"
        >
          <option value="">-- Choose Player --</option>
          {sortedRoster.map((p, i) => (
            <option key={i} value={p.identity}>
              {p.last || p.name}, {p.first || ''} ({p.position || p.pos})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleDrop}
        disabled={loading || !selectedIdentity}
        className={`w-full p-4 rounded-xl font-black uppercase tracking-widest text-white transition-all shadow-md ${
          loading || !selectedIdentity 
            ? 'bg-gray-200 text-gray-400 cursor-not-allowed shadow-none' 
            : 'bg-red-600 hover:bg-red-700 active:scale-95'
        }`}
      >
        {loading ? 'Processing...' : 'Confirm Waive'}
      </button>
      
      <div className="p-3 bg-red-50/50 rounded-lg border border-red-100">
        <p className="text-[10px] text-red-700 leading-tight">
          <span className="font-bold uppercase">Note:</span> Waived players are moved to the Free Agent pool immediately. This action cannot be undone.
        </p>
      </div>
    </div>
  );
}