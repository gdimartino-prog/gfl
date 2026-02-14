'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Player, Team } from '@/types';

export default function IRPanel({ 
  team, 
  coach, 
  onComplete 
}: { 
  team: string; 
  coach: string; 
  onComplete?: () => void 
}) {
  const [roster, setRoster] = useState<Player[]>([]);
  const [teamMetadata, setTeamMetadata] = useState<Team[]>([]); 
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);
  const [rosterSearch, setRosterSearch] = useState('');

  const loadData = useCallback(async () => {
    if (!team) return;
    try {
      const timestamp = Date.now();
      // 1. Force both fetches to bypass cache using no-store and a timestamp
      const [playerRes, teamRes] = await Promise.all([
        fetch(`/api/players?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/teams?t=${timestamp}`, { cache: 'no-store' })
      ]);
      
      // 2. Safety check: prevent crashes if server returns HTML error pages
      if (!playerRes.ok || !teamRes.ok) {
        throw new Error("Failed to load fresh IR roster data.");
      }

      const playerData = await playerRes.json();
      const teamData = await teamRes.json();
      
      // 3. Filter for active roster only (not already on IR)
      const players = Array.isArray(playerData) 
        ? playerData.filter((p: Player) => p.team === team) 
        : [];
          
      setRoster(players);
      setTeamMetadata(teamData); 
    } catch (err) {
      console.error("Failed to load IR data:", err);
    }
  }, [team]);

  useEffect(() => { loadData(); }, [loadData]);

  async function handleIR() {
    if (!selectedIdentity || !team) return;

    const p = roster.find(player => player.identity === selectedIdentity);
    const pos = (p?.position || p?.pos || "").toUpperCase();
    const cleanName = p ? `${p.first || ''} ${p.last || p.name || ''}`.trim() : selectedIdentity;
    const fullDescription = `${pos ? `${pos} - ` : ""}${cleanName}`;

    const entry = teamMetadata.find(t => t.short === team);
    const fullTeamName = entry ? entry.name : team; 

    const confirmMove = confirm(`Move ${fullDescription} to IR?`);
    if (!confirmMove) return;

    setLoading(true);

    try {
      const payload = {
        type: 'IR MOVE',
        identity: selectedIdentity,
        fromTeam: fullTeamName,
        toTeam: 'IR',                
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
        // RESET selection and REFETCH data
        setSelectedIdentity('');
        await loadData();
        
        if (onComplete) onComplete();
        alert(`Successfully moved ${fullDescription} to IR`);
      }
    } catch {
      alert('Error saving IR transaction');
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
        <h3 className="font-bold text-lg uppercase text-amber-600 italic tracking-tight">IR Player</h3>
        <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold uppercase tracking-widest italic">Injured Reserve Move</span>
      </div>

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
          value={selectedIdentity}
          onChange={e => setSelectedIdentity(e.target.value)}
          className="border-2 border-amber-50 p-2 w-full h-48 rounded-lg text-sm outline-none focus:border-amber-400 transition-colors text-black font-medium bg-white custom-scrollbar"
        >
          <option value="">-- Select Player for IR --</option>
          {sortedRoster
            .filter(p => p.identity === selectedIdentity || `${p.first} ${p.last} ${p.name}`.toLowerCase().includes(rosterSearch.toLowerCase()))
            .map((p, i) => (
            <option key={i} value={p.identity}>
              {p.last || p.name}, {p.first || ''} ({(p.position || p.pos || "??").toUpperCase()})
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleIR}
        disabled={loading || !selectedIdentity}
        className="w-full p-4 rounded-xl font-black uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 transition-all active:scale-95 shadow-md"
      >
        {loading ? 'Processing IR Move...' : 'Confirm IR Move'}
      </button>
    </div>
  );
}