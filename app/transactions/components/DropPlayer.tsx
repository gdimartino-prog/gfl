'use client';

import { useEffect, useState } from 'react';

export default function DropPlayer({ team, coach }: { team: string; coach: string }) {
  const [players, setPlayers] = useState<any[]>([]);
  const [identity, setIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/players').then(res => res.json()).then(setPlayers);
  }, []);

  // Filter players to only show those currently on the selected active team
  const teamPlayers = players.filter(p => p.team === team);

  async function submit() {
    if (!identity) return;
    setLoading(true);

    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'DROP',
          identity: identity,
          fromTeam: team,
          coach: coach
        }),
      });

      if (response.ok) {
        alert('Player waived');
        setPlayers(prev => prev.filter(p => p.identity !== identity));
        setIdentity('');
      }
    } catch (error) {
      alert('Error processing waiver');
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="border p-4 rounded bg-white shadow-sm border-red-200">
      <h3 className="font-bold text-lg uppercase text-red-600">Waive Player</h3>
      <p className="text-sm text-gray-500">Dropping from: <span className="font-semibold">{team}</span></p>
      
      <select 
        className="border p-2 w-full rounded mt-4" 
        value={identity} 
        onChange={e => setIdentity(e.target.value)}
      >
        <option value="">-- Select Player to Drop --</option>
        {teamPlayers.map((p, i) => (
          <option key={`${p.identity}-${i}`} value={p.identity}>
            {p.first} {p.last} ({p.position})
          </option>
        ))}
      </select>

      <button 
        onClick={submit} 
        disabled={loading || !identity}
        className={`w-full p-3 mt-4 rounded font-bold text-white transition-all ${
          loading || !identity ? 'bg-gray-300' : 'bg-red-600 hover:bg-red-700'
        }`}
      >
        {loading ? 'Updating Sheets...' : 'Confirm Waiver'}
      </button>
    </section>
  );
}