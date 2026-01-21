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
  const [teamMetadata, setTeamMetadata] = useState<any[]>([]); 
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  // 1. Helper to parse team codes from "Team Name (CODE)" format
  const resolveCode = (teamString: string) => {
    if (!teamString) return "";
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  // 2. Compute the clean active team code (e.g., "VV")
  const activeCode = useMemo(() => resolveCode(team), [team]);

  const loadData = useCallback(async () => {
    if (!activeCode) return;
    try {
      const [playerRes, teamRes] = await Promise.all([
        fetch('/api/players'),
        fetch('/api/teams')
      ]);
      
      const playerData = await playerRes.json();
      const teamData = await teamRes.json();
      
      // Filter for players belonging to this specific team
      const players = Array.isArray(playerData) 
        ? playerData.filter((p: any) => resolveCode(p.team) === activeCode) 
        : [];
        
      setRoster(players);
      setTeamMetadata(teamData); 
    } catch (err) {
      console.error("Failed to load IR data:", err);
    }
  }, [activeCode]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleIR() {
    if (!selectedIdentity || !team) return;

    // 1. Resolve Player Details for readable Description
    const p = roster.find(player => player.identity === selectedIdentity);
    const pos = (p?.position || p?.pos || "").toUpperCase();
    const cleanName = p ? `${p.first || ''} ${p.last || p.name || ''}`.trim() : selectedIdentity;
    const fullDescription = `${pos ? `${pos} - ` : ""}${cleanName}`;

    // 2. Resolve the FULL TEAM NAME (e.g., "Vico") from the shortcode "VV"
    const entry = teamMetadata.find(t => 
      t.short?.toString().trim().toUpperCase() === activeCode
    );
    const fullTeamName = entry ? entry.name : team; 

    const confirmMove = confirm(`Move ${fullDescription} to IR?`);
    if (!confirmMove) return;

    setLoading(true);

    try {
      const payload = {
        type: 'IR MOVE',
        identity: selectedIdentity,
        fromTeam: fullTeamName,      // FIX: Sends "Vico" instead of "VV"
        toTeam: 'IR',                // Destination
        coach,                       
        details: `Placed on IR: ${fullDescription}`,
        status: 'PENDING' 
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setSelectedIdentity('');
        await loadData();
        if (onComplete) onComplete();
        alert(`Successfully moved ${fullDescription} to IR`);
      }
    } catch (err) {
      alert('Error saving transaction');
    } finally {
      setLoading(false);
    }
  }

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const lastA = (a.last || a.name || "").toLowerCase();
      const lastB = (b.last || b.name || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [roster]);

  return (
    <div className="space-y-4 border p-4 rounded-xl bg-white shadow-sm border-amber-200 text-left text-black">
      <div className="flex justify-between items-center">
        <h3 className="font-bold text-lg uppercase text-amber-600 italic tracking-tight italic">IR Player</h3>
        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold uppercase tracking-widest italic">Injured Reserve Move</span>
      </div>

      <select
        value={selectedIdentity}
        onChange={e => setSelectedIdentity(e.target.value)}
        className="border-2 border-amber-50 p-3 w-full rounded-lg text-sm outline-none focus:border-amber-400 transition-colors text-black font-medium bg-gray-50"
      >
        <option value="">-- Select Player for IR --</option>
        {sortedRoster.map((p, i) => (
          <option key={i} value={p.identity}>
            {p.last || p.name}, {p.first || ''} ({(p.position || p.pos || "??").toUpperCase()})
          </option>
        ))}
      </select>

      <button
        onClick={handleIR}
        disabled={loading || !selectedIdentity}
        className="w-full p-4 rounded-xl font-black uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 transition-all active:scale-95 shadow-md"
      >
        {loading ? 'Processing IR Move...' : 'Confirm IR Move'}
      </button>

      <p className="text-[10px] text-gray-400 italic leading-none mt-2">
        * Moves player from active roster to the Injured Reserve status.
      </p>
    </div>
  );
}