'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search } from 'lucide-react';
import { Player, Team } from '@/types';

export default function DropPlayer({ 
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

  // Consolidated Data Fetching
  const fetchData = useCallback(async () => {
    if (!team) return;
    try {
      const timestamp = Date.now();
      const [playerRes, teamRes] = await Promise.all([
        fetch(`/api/players?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/teams?t=${timestamp}`, { cache: 'no-store' })
      ]);
      
      // Safety check for HTML error pages
      if (!playerRes.ok || !teamRes.ok) {
        throw new Error("Failed to load fresh roster data.");
      }

      const playerData = await playerRes.json();
      const teamData = await teamRes.json();
      
      const players = Array.isArray(playerData) 
        ? playerData.filter((p: Player) => p.team === team) 
        : [];
        
      setRoster(players);
      setTeamMetadata(teamData);
    } catch (err) {
      console.error("Failed to load roster data:", err);
    }
  }, [team]);

useEffect(() => {
    fetchData();
  }, [fetchData]);

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const lastA = (a.last || a.name || "").toLowerCase();
      const lastB = (b.last || b.name || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [roster]);

  async function handleDrop() {
    if (!selectedIdentity || !team) return;
    
    const p = roster.find(player => player.identity === selectedIdentity);
    const pos = (p?.position || p?.pos || "").toUpperCase();
    const cleanName = p ? `${p.first || ''} ${p.last || p.name || ''}`.trim() : selectedIdentity;
    const fullDescription = `${pos ? `${pos} - ` : ""}${cleanName}`;

    // Resolve full name for the transaction log (e.g., "Vico")
    const entry = teamMetadata.find(t => t.short === team);
    const fullTeamName = entry ? entry.name : team;   

    const confirmMove = confirm(`Are you sure you want to WAIVE ${fullDescription}?`);
    if (!confirmMove) return;

    setLoading(true);

    try {
      const payload = {
        type: 'WAIVE',
        identity: selectedIdentity,
        fromTeam: fullTeamName,     
        toTeam: 'FA',        
        coach,               
        details: fullDescription,
        status: 'PENDING' 
      };

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        // RESET selection and REFETCH data to remove the player from the list
        setSelectedIdentity('');
        await fetchData(); 
        
        if (onComplete) onComplete(); 
        alert(`${fullDescription} waived successfully.`);
      }
    } catch {
      alert('Error waiving player.');
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
        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Select Player to Release</label>
        <div className="space-y-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 text-red-400" size={14} />
            <input 
              type="text" 
              placeholder="Search your roster..." 
              className="w-full p-2 pl-8 text-xs border rounded bg-white text-black outline-none focus:border-red-400"
              value={rosterSearch}
              onChange={e => setRosterSearch(e.target.value)}
            />
          </div>
          <select
            size={6}
            value={selectedIdentity}
            onChange={e => setSelectedIdentity(e.target.value)}
            className="border-2 border-gray-100 p-2 w-full h-48 rounded-lg text-sm outline-none focus:border-red-400 transition-colors text-black font-medium bg-white custom-scrollbar"
          >
            <option value="">-- Choose Player --</option>
            {sortedRoster
              .filter(p => p.identity === selectedIdentity || `${p.first} ${p.last} ${p.name}`.toLowerCase().includes(rosterSearch.toLowerCase()))
              .map((p, i) => (
              <option key={i} value={p.identity}>
                {p.last || p.name}, {p.first || ''} ({p.position || p.pos})
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={handleDrop}
        disabled={loading || !selectedIdentity}
        className="w-full p-4 rounded-xl font-black uppercase tracking-widest text-white bg-red-600 hover:bg-red-700 disabled:bg-gray-200 shadow-md transition-all active:scale-95"
      >
        {loading ? 'Processing...' : 'Confirm Waive'}
      </button>
    </div>
  );
}