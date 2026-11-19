'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { Search, X, AlertTriangle, Lock } from 'lucide-react';
import { Player, Team } from '@/types';
import { playerOptionLabel } from '@/lib/playerUtils';
import { isIrCapReached } from '@/lib/irRules';

export default function IRPanel({
  team,
  coach,
  irLimit = null,
  isCommissioner = false,
  onComplete
}: {
  team: string;
  coach: string;
  irLimit?: number | null;
  isCommissioner?: boolean;
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

  // Plain fetches honor the API's Cache-Control headers; pass fresh=true
  // only right after a mutation so the browser skips its HTTP cache.
  const loadData = useCallback(async (fresh = false) => {
    if (!team) return;
    try {
      const opts: RequestInit = fresh ? { cache: 'no-store' } : {};
      const [rosterRes, teamRes] = await Promise.all([
        fetch(`/api/rosters/${encodeURIComponent(team)}`, opts),
        fetch('/api/teams', opts)
      ]);

      if (!rosterRes.ok || !teamRes.ok) {
        throw new Error("Failed to load fresh IR roster data.");
      }

      const rosterData = await rosterRes.json();
      const teamData = await teamRes.json();

      const players = Array.isArray(rosterData?.roster)
        ? rosterData.roster
        : Array.isArray(rosterData) ? rosterData : [];

      setRoster(players);
      setTeamMetadata(teamData);
    } catch (err) {
      console.error("Failed to load IR data:", err);
    }
  }, [team]);

  useEffect(() => { loadData(); }, [loadData]);

  const currentIrCount = useMemo(() => roster.filter(p => Boolean(p.isIR)).length, [roster]);
  const atIrCap = isIrCapReached(currentIrCount, irLimit);
  const isLockedForCoach = atIrCap && !isCommissioner;

  function handleIRClick() {
    if (!selectedIdentity || !team) return;
    if (isLockedForCoach) {
      showToast(`Injured Reserve limit reached (${currentIrCount}/${irLimit}).`, 'error');
      return;
    }
    const p = roster.find(player => player.identity === selectedIdentity);
    if (p?.isIR) {
      showToast('Player is already on Injured Reserve (IR).', 'error');
      return;
    }
    const pos = (p?.position || p?.pos || "").toUpperCase();
    const cleanName = p ? `${p.first || ''} ${p.last || p.name || ''}`.trim() : selectedIdentity;
    const fullDescription = `${pos ? `${pos} - ` : ""}${cleanName}`;
    const entry = teamMetadata.find(t => (t.short || t.teamshort || '').toUpperCase() === team.toUpperCase());
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
        await loadData(true);
        if (onComplete) onComplete();
        showToast(`${confirmPlayer.description} moved to IR.`);
      } else {
        const err = await res.json().catch(() => ({}));
        showToast(err.error || 'Error saving IR transaction.', 'error');
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
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="ir-confirm-title"
            className="relative bg-white rounded-3xl shadow-2xl p-8 max-w-sm w-full space-y-5 text-center"
          >
            <div className="text-4xl">🏥</div>
            <h3 id="ir-confirm-title" className="text-xl font-black uppercase text-amber-600 tracking-tighter">Confirm IR Move</h3>
            <p className="text-sm font-bold text-slate-600">
              Move <span className="text-amber-600">{confirmPlayer.description}</span> to Injured Reserve?
            </p>
            <p className="text-[11px] text-slate-500 leading-relaxed">
              Once placed on IR, this player is out for the season and does not count against the active roster limit.
            </p>
            {atIrCap && isCommissioner && (
              <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-left flex items-start gap-2.5">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs font-bold text-amber-900">
                  Commissioner override: team already has {currentIrCount}/{irLimit} players on IR.
                </p>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => setConfirmPlayer(null)} className="flex-1 py-3 rounded-xl border-2 border-slate-200 text-slate-500 font-black uppercase text-xs hover:bg-slate-50 transition-all">Cancel</button>
              <button onClick={handleConfirmIR} className="flex-1 py-3 rounded-xl bg-amber-500 text-white font-black uppercase text-xs hover:bg-amber-600 transition-all shadow-lg">Move to IR</button>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-wrap justify-between items-center gap-2">
        <h3 className="font-bold text-lg uppercase text-amber-600 italic tracking-tight">IR Player</h3>
        <div className="flex items-center gap-2">
          <span
            className={`text-[10px] px-2.5 py-1 rounded font-black uppercase tracking-widest ${
              atIrCap
                ? 'bg-red-100 text-red-700'
                : 'bg-amber-50 text-amber-700'
            }`}
          >
            {irLimit != null ? `IR Slots: ${currentIrCount}/${irLimit}` : `On IR: ${currentIrCount}`}
          </span>
          <span className="text-[10px] bg-amber-50 text-amber-600 px-2 py-1 rounded font-bold uppercase tracking-widest italic">Injured Reserve Move</span>
        </div>
      </div>

      {isLockedForCoach && (
        <div
          role="alert"
          className="bg-red-50 border-2 border-red-200 rounded-xl p-4 flex items-start gap-3 text-red-900"
        >
          <Lock size={18} className="text-red-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-black uppercase tracking-wider text-red-800">
              Injured Reserve Full ({currentIrCount}/{irLimit})
            </p>
            <p className="font-medium text-red-800/90 leading-relaxed">
              Constitution Rule B7 caps Injured Reserve at {irLimit} players per team. You must waive/drop a player currently on IR before placing another player on IR.
            </p>
          </div>
        </div>
      )}

      {atIrCap && isCommissioner && (
        <div
          role="alert"
          className="bg-amber-50 border-2 border-amber-200 rounded-xl p-4 flex items-start gap-3 text-amber-900"
        >
          <AlertTriangle size={18} className="text-amber-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-xs">
            <p className="font-black uppercase tracking-wider text-amber-800">
              Commissioner Override — IR Limit Reached ({currentIrCount}/{irLimit})
            </p>
            <p className="font-medium text-amber-800/90 leading-relaxed">
              Coaches are blocked at {irLimit} IR players. Proceeding as Commissioner will move this team to {currentIrCount + 1}/{irLimit} players on IR.
            </p>
          </div>
        </div>
      )}

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
          disabled={isLockedForCoach}
          onChange={e => setSelectedIdentity(e.target.value)}
          className="border-2 border-amber-50 p-2 w-full h-48 rounded-lg text-sm outline-none focus:border-amber-400 transition-colors text-black font-medium bg-white disabled:bg-slate-50 disabled:text-slate-500 custom-scrollbar"
        >
          <option value="">-- Select Player for IR --</option>
          {sortedRoster
            .filter(p => p.identity === selectedIdentity || `${p.first} ${p.last} ${p.name}`.toLowerCase().includes(rosterSearch.toLowerCase()))
            .map((p, i) => (
            <option key={i} value={p.identity} disabled={Boolean(p.isIR) || isLockedForCoach}>
              {playerOptionLabel(p)}{p.isIR ? ' [ON IR]' : ''}
            </option>
          ))}
        </select>
      </div>

      <button
        onClick={handleIRClick}
        disabled={loading || isLockedForCoach || !selectedIdentity || Boolean(roster.find(p => p.identity === selectedIdentity)?.isIR)}
        className="w-full p-4 rounded-xl font-black uppercase tracking-widest text-white bg-amber-500 hover:bg-amber-600 disabled:bg-gray-200 disabled:text-gray-500 transition-all active:scale-95 shadow-md"
      >
        {loading
          ? 'Processing IR Move...'
          : isLockedForCoach
            ? `IR Limit Reached (${currentIrCount}/${irLimit})`
            : 'Confirm IR Move'}
      </button>
    </div>
  );
}
