'use client';

import { useEffect, useState } from 'react';

export default function IRPanel({ team, coach }: { team: string; coach: string }) {
  const [players, setPlayers] = useState<any[]>([]);
  const [identity, setIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/players')
      .then(res => res.json())
      .then(data => {
        // Ensure data is an array before setting state
        setPlayers(Array.isArray(data) ? data : []);
      })
      .catch(err => console.error("Error fetching players:", err));
  }, []);

  // Filter with safety checks for undefined properties
  const eligiblePlayers = players.filter(p => 
    p.team === team && 
    typeof p.team === 'string' && 
    !p.team.endsWith('-IR')
  );

  async function moveToIR() {
    if (!identity) return;
    setLoading(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'IR',
          identity: identity,
          fromTeam: team,
          coach: coach
        }),
      });

      if (response.ok) {
        alert('Player moved to IR');
        setPlayers(prev => prev.map(p => 
          p.identity === identity ? { ...p, team: `${team}-IR` } : p
        ));
        setIdentity('');
      }
    } catch (error) {
      alert('Error moving player to IR');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-4 rounded bg-white shadow-sm border-orange-200">
      <h3 className="font-bold text-lg uppercase text-orange-600">Injured Reserve</h3>
      <p className="text-sm text-gray-500">Managing IR for: <span className="font-semibold">{team}</span></p>

      <select 
        className="border p-2 w-full rounded" 
        value={identity} 
        onChange={e => setIdentity(e.target.value)}
      >
        <option value="">-- Select Player for IR --</option>
        {eligiblePlayers.map((p, i) => (
          <option key={`${p.identity}-${i}`} value={p.identity}>
            {p.first} {p.last} ({p.position})
          </option>
        ))}
      </select>

      <button 
        onClick={moveToIR} 
        disabled={loading || !identity}
        className={`w-full p-3 rounded font-bold text-white transition-all ${
          loading || !identity ? 'bg-gray-300' : 'bg-orange-500 hover:bg-orange-600'
        }`}
      >
        {loading ? 'Updating Roster...' : 'Place on IR'}
      </button>
    </div>
  );
}