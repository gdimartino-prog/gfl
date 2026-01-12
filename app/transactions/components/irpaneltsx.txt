'use client';

import { useEffect, useState, useMemo } from 'react';

export default function IRPanel({ team, coach, onComplete }: { team: string; coach: string; onComplete?: () => void }) {
  const [roster, setRoster] = useState<any[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (team) {
      fetch('/api/players')
        .then(res => res.json())
        .then(data => {
          const players = Array.isArray(data) ? data.filter((p: any) => p.teamShort === team || p.team === team) : [];
          setRoster(players);
        })
        .catch(console.error);
    }
  }, [team]);

  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const lastA = (a.last || a.name || "").toLowerCase();
      const lastB = (b.last || b.name || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [roster]);

  async function handleIR() {
    if (!selectedIdentity || !team) return;
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
          status: 'PENDING'
        }),
      });

      if (res.ok) {
        alert('Player moved to IR');
        setRoster(prev => prev.filter(p => p.identity !== selectedIdentity));
        setSelectedIdentity('');
        if (onComplete) onComplete();
      }
    } catch (err) {
      alert('Error moving to IR');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-4 rounded bg-white shadow-sm border-amber-200 text-left">
      <h3 className="font-bold text-lg uppercase text-amber-600">Move to IR</h3>
      <select
        value={selectedIdentity}
        onChange={e => setSelectedIdentity(e.target.value)}
        className="border p-2 w-full rounded outline-none focus:ring-2 focus:ring-amber-500 text-black"
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
        className={`w-full p-3 rounded font-bold text-white ${loading || !selectedIdentity ? 'bg-gray-300' : 'bg-amber-600 hover:bg-amber-700'}`}
      >
        {loading ? 'Processing...' : 'Confirm IR Move'}
      </button>
    </div>
  );
}