'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, X } from 'lucide-react';
import { Player, Team } from '@/types';
import { playerOptionLabel } from '@/lib/playerUtils';

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
  const [confirmPlayer, setConfirmPlayer] = useState<{ identity: string; description: string; fullTeamName: string } | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadData = useCallback(async () => {
    if (!team) return;
    try {
      const timestamp = Date.now();
      const [playerRes, teamRes] = await Promise.all([
        fetch(`/api/players?t=${timestamp}`, { cache: 'no-store' }),
        fetch(`/api/teams?t=${timestamp}`, { cache: 'no-store' })
      ]);

      if (!playerRes.ok || !teamRes.ok) {
        throw new Error("Failed to load fresh IR roster data.");
      }

      const playerData = await playerRes.json();
      const teamData = await teamRes.json();

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

  function handleIRClick() {
    if (!selectedIdentity || !team) return;
    const p = roster.find(player => player.identity === selectedIdentity);
    const pos = (p?.position || p?.pos || "").toUpperCase();
    const cleanName = p ? `${p.first || ''} ${p.last || p.name || ''}`.trim() : selectedIdentity;
    const fullDescription = `${pos ? `${pos} - ` : ""}${cleanName}`;
    const entry = teamMetadata.find(t => t.short === team);
    const fullTeamName = entry ? entry.name : team;
    setConfirmPlayer({ identity: selectedIdentity, description: fullDescription, fullTeamName });
  }

  async function handleConfirmIR() {
    if (!confirmPlayer) return;
    setConfirmPlayer(null);
    setLoading(true);

    try {
      const payload = {
        type: 'IR MOVE',
        identity: confirmPlayer.identity,
        fromTeam: confirmPlayer.fullTeamName,
        toTeam: 'IR',
        coach,
        details: `Placed on IR: ${confirmPlayer.description}`,
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
        showToast(`${confirmPlayer.description} moved to IR.`);
      } else {
        showToast('Error saving IR transaction.', 'error');
      }
    } catch {
      showToast('Error saving IR transaction.', 'error');
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
    <div className="space-y-4 border p-4 rounded-xl bg-white shadow-sm border-amber-200 text-left text-black relative">
      {toast && (
        <div className={`fixed top-6 right-6 z-50 px-6 py-4 rounded-2xl shadow-2xl text-white font-black text-sm uppercase tracking-widest flex items-center gap-3 animate-in fade-in slide-in-from-top-4 ${toast.type === 'success' ? 'bg-emerald-500' : 'bg-red-500'}`}>
          {toast.message}
          <button onClick={() => setToast(null)}><X size={14} /></button>
        </div>
      )}

      {confirmPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setConfirmPlayer(null)} />
          <div className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-5 text-center">
            <div className="text-4xl">🏥</div>
            <h3 className="text-xl font-black uppercase text-amber-600 tracking-tighter">Confirm IR Move</h3>
            <p className="text-sm font-bold text-slate-600">
              Move <span className="text-amber-600">{confirmPlayer.description}</span> to Injured Reserve?
            </p>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest">Their roster slot will be tagged with -IR.</p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmPlayer(null)} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black uppercase text-xs hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleConfirmIR} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black uppercase text-xs hover:bg-amber-600 transition-all shadow-lg">Move to IR</button>
            </div>
          </div>
        </div>
      )}

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
            <option key={i} value={p.identity}>{playerOptionLabel(p)}</option>
          ))}
        </select>
      </div>

      <button
        onClick={handleIRClick}
        disabled={loading || !selectedIdentity}
        className="w-full p-4 rounded-xl font-black uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 transition-all active:scale-95 shadow-md"
      >
        {loading ? 'Processing IR Move...' : 'Confirm IR Move'}
      </button>
    </div>
  );
}
