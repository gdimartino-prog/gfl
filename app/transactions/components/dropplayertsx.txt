'use client';

import { useEffect, useState, useMemo } from 'react';

export default function DropPlayer({ team, coach, onComplete }: { team: string; coach: string; onComplete?: () => void }) {
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

  // Sort roster by Last Name
  const sortedRoster = useMemo(() => {
    return [...roster].sort((a, b) => {
      const lastA = (a.last || a.name || "").toLowerCase();
      const lastB = (b.last || b.name || "").toLowerCase();
      return lastA.localeCompare(lastB);
    });
  }, [roster]);

  async function handleDrop() {
    if (!selectedIdentity || !team) return;
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
          status: 'PENDING'
        }),
      });

      if (res.ok) {
        alert('Player dropped successfully');
        setRoster(prev => prev.filter(p => p.identity !== selectedIdentity));
        setSelectedIdentity('');
        if (onComplete) onComplete();
      }
    } catch (err) {
      alert('Error dropping player');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4 border p-4 rounded bg-white shadow-sm border-red-200 text-left">
      <h3 className="font-bold text-lg uppercase text-red-600">Waive Player</h3>
      <select
        value={selectedIdentity}
        onChange={e => setSelectedIdentity(e.target.value)}
        className="border p-2 w-full rounded outline-none focus:ring-2 focus:ring-red-500 text-black"
      >
        <option value="">-- Select Player to Drop --</option>
        {sortedRoster.map((p, i) => (
          <option key={i} value={p.identity}>
            {p.last || p.name}, {p.first || ''} ({p.position || p.pos})
          </option>
        ))}
      </select>
      <button
        onClick={handleDrop}
        disabled={loading || !selectedIdentity}
        className={`w-full p-3 rounded font-bold text-white ${loading || !selectedIdentity ? 'bg-gray-300' : 'bg-red-600 hover:bg-red-700'}`}
      >
        {loading ? 'Processing...' : 'Confirm Waive'}
      </button>
    </div>
  );
}