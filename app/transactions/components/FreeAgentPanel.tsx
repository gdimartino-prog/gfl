'use client';

import { useEffect, useState } from 'react';

export default function FreeAgentPanel({ team, coach }: { team: string; coach: string }) {
  const [freeAgents, setFreeAgents] = useState<any[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch('/api/free-agents')
      .then(res => res.json())
      .then(setFreeAgents)
      .catch(console.error);
  }, []);

  async function addPlayer() {
    if (!selectedIdentity || !team) return;
    setLoading(true);

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'ADD',
          identity: selectedIdentity,
          toTeam: team,
          coach,
        }),
      });

      if (res.ok) {
        alert('Player added successfully');
        setFreeAgents(prev => prev.filter(p => p.identity !== selectedIdentity));
        setSelectedIdentity('');
      }
    } catch (err) {
      alert('Error adding player');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-4 rounded bg-white shadow-sm border-blue-200">
      <h3 className="font-bold text-lg uppercase text-blue-600">Free Agent Pickup</h3>
      <p className="text-sm text-gray-500">Signing to: <span className="font-semibold">{team}</span></p>

      <select
        value={selectedIdentity}
        onChange={e => setSelectedIdentity(e.target.value)}
        className="border p-2 w-full rounded focus:ring-2 focus:ring-blue-500 outline-none"
      >
        <option value="">-- Select Free Agent --</option>
        {freeAgents.map((p, i) => (
          <option key={`${p.identity}-${i}`} value={p.identity}>
            {p.first} {p.last} ({p.position})
          </option>
        ))}
      </select>

      <button
        onClick={addPlayer}
        disabled={loading || !selectedIdentity}
        className={`w-full p-3 rounded font-bold text-white transition-all ${
          loading || !selectedIdentity ? 'bg-gray-300' : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading ? 'Processing...' : 'Confirm Pickup'}
      </button>
    </div>
  );
}