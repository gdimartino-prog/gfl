'use client';

import { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import {
  Search,
  X,
  HeartPulse,
  Lock,
  ArrowRight,
  ShieldAlert,
} from 'lucide-react';
import { Player, Team } from '@/types';
import { playerOptionLabel } from '@/lib/playerUtils';
import {
  extractUnitGroups,
  matchesPositionFilter,
} from '@/lib/pickupRules';

const BASE_POS_FILTERS = ['ALL', 'QB', 'RB/HB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K/P'] as const;

type FreeAgentPanelProps = {
  mode: 'FA' | 'INJURY';
  team: string;
  coach: string;
  teams?: Team[];
  faFee?: number;
  faDeadlineRaw?: string;
  faDeadlineLabel?: string | null;
  isFaClosed?: boolean;
  isCommissioner?: boolean;
  onSwitchMode?: (mode: 'FA' | 'INJURY') => void;
  onComplete?: () => void;
};

export default function FreeAgentPanel({
  mode,
  team,
  coach,
  teams: teamsProp,
  faFee = 0,
  faDeadlineRaw = '',
  faDeadlineLabel = null,
  isFaClosed = false,
  isCommissioner = false,
  onSwitchMode,
  onComplete,
}: FreeAgentPanelProps) {
  const [freeAgents, setFreeAgents] = useState<Player[]>([]);
  const [myRoster, setMyRoster] = useState<Player[]>([]);
  const [fetchedTeams, setFetchedTeams] = useState<Team[]>([]);
  const [selectedIdentity, setSelectedIdentity] = useState('');
  const [loading, setLoading] = useState(false);
  const [injuredIdentity, setInjuredIdentity] = useState('');
  const [weekOccurred, setWeekOccurred] = useState('');
  const [duration, setDuration] = useState('');
  const [rosterSearch, setRosterSearch] = useState('');
  const [faSearch, setFaSearch] = useState('');
  const [faPosFilter, setFaPosFilter] = useState('ALL');
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToast(null), 4000);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  const resolveCode = (teamString: string) => {
    if (!teamString) return '';
    const match = teamString.match(/\(([^)]+)\)/);
    return (match ? match[1] : teamString).trim().toUpperCase();
  };

  const activeCode = useMemo(() => resolveCode(team), [team]);
  const hasTeamsProp = teamsProp !== undefined;
  const teamMetadata = useMemo(
    () => (hasTeamsProp && teamsProp.length > 0 ? teamsProp : fetchedTeams),
    [hasTeamsProp, teamsProp, fetchedTeams],
  );

  // Reset team-scoped selections when switching teams via TeamSelector
  useEffect(() => {
    setInjuredIdentity('');
    setSelectedIdentity('');
    setSubmitError(null);
    setShowConfirm(false);
  }, [activeCode]);

  // Escape closes the confirmation modal when not submitting
  useEffect(() => {
    if (!showConfirm) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !loading) {
        setShowConfirm(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showConfirm, loading]);

  const isLockedForCoach = mode === 'FA' && isFaClosed && !isCommissioner;

  // Plain fetches honor the API's Cache-Control headers; pass fresh=true
  // only right after a mutation so the browser skips its HTTP cache.
  const loadData = useCallback(async (fresh = false) => {
    try {
      const opts: RequestInit = fresh ? { cache: 'no-store' } : {};
      const needTeams = !hasTeamsProp;
      const [playersRes, teamsRes] = await Promise.all([
        fetch('/api/players', opts),
        needTeams ? fetch('/api/teams', opts) : Promise.resolve(null),
      ]);

      if (!playersRes.ok || (teamsRes && !teamsRes.ok)) {
        throw new Error('Failed to fetch player data.');
      }

      const playersData: Player[] = await playersRes.json();
      if (teamsRes) {
        const teamsData = await teamsRes.json();
        setFetchedTeams(Array.isArray(teamsData) ? teamsData : []);
      }

      const safePlayers = Array.isArray(playersData) ? playersData : [];
      setFreeAgents(safePlayers.filter(p => (p.team || '').trim().toUpperCase() === 'FA'));

      if (activeCode) {
        setMyRoster(safePlayers.filter(p => resolveCode(p.team || '') === activeCode));
      } else {
        setMyRoster([]);
      }
    } catch (err) {
      console.error('Failed to load FA data:', err);
    }
  }, [activeCode, hasTeamsProp]);

  useEffect(() => {
    if (!isLockedForCoach) {
      loadData();
    }
  }, [isLockedForCoach, loadData]);

  const sortedFreeAgents = useMemo(
    () => [...freeAgents].sort((a, b) => (a.last || '').localeCompare(b.last || '')),
    [freeAgents],
  );

  const sortedRoster = useMemo(
    () => [...myRoster].sort((a, b) => (a.last || '').localeCompare(b.last || '')),
    [myRoster],
  );

  const injuredPlayer = useMemo(
    () => myRoster.find(p => p.identity === injuredIdentity) || null,
    [myRoster, injuredIdentity],
  );

  const selectedFa = useMemo(
    () => freeAgents.find(p => p.identity === selectedIdentity) || null,
    [freeAgents, selectedIdentity],
  );

  const activePosFilter = (mode === 'FA' || !injuredPlayer) && faPosFilter === 'MATCH' ? 'ALL' : faPosFilter;

  const baseFilteredFreeAgents = useMemo(() => {
    const search = faSearch.toLowerCase();
    const injuredGroups =
      mode === 'INJURY' && injuredPlayer ? extractUnitGroups(injuredPlayer) : null;

    return sortedFreeAgents.filter(p => {
      if (search && !`${p.first} ${p.last}`.toLowerCase().includes(search)) return false;
      if (activePosFilter === 'MATCH' && injuredGroups) {
        if (injuredGroups.length === 0) return true;
        const candidateGroups = extractUnitGroups(p);
        if (candidateGroups.length === 0) return true;
        return injuredGroups.some(g => candidateGroups.includes(g));
      }
      return matchesPositionFilter(p, activePosFilter, mode === 'INJURY' ? injuredPlayer : null);
    });
  }, [sortedFreeAgents, faSearch, activePosFilter, mode, injuredPlayer]);

  // Preserve an already-selected FA inside the <select> even if filters change
  const displayedFreeAgents = useMemo(() => {
    if (!selectedFa || baseFilteredFreeAgents.some(p => p.identity === selectedFa.identity)) {
      return baseFilteredFreeAgents;
    }
    return [selectedFa, ...baseFilteredFreeAgents];
  }, [baseFilteredFreeAgents, selectedFa]);

  const wkTrim = weekOccurred.trim();
  const durTrim = duration.trim();
  const wkNum = /^\d+$/.test(wkTrim) ? parseInt(wkTrim, 10) : NaN;
  const durNum = /^\d+$/.test(durTrim) ? parseInt(durTrim, 10) : NaN;
  const weekBackNum = !Number.isNaN(wkNum) && !Number.isNaN(durNum) ? wkNum + durNum : NaN;
  const isInjuryWindowValid =
    !Number.isNaN(wkNum) &&
    !Number.isNaN(durNum) &&
    wkNum >= 1 &&
    durNum >= 1 &&
    weekBackNum <= 30;
  const isWkInvalid = wkTrim !== '' && (!/^\d+$/.test(wkTrim) || wkNum < 1 || wkNum > 29);
  const isDurInvalid = durTrim !== '' && (!/^\d+$/.test(durTrim) || durNum < 1 || durNum > 29);
  const showInjuryWindowError =
    isWkInvalid || isDurInvalid || (wkTrim !== '' && durTrim !== '' && !isInjuryWindowValid);

  const injuredPos = (injuredPlayer?.position || injuredPlayer?.pos || '??').toUpperCase();
  const injuredUnitLabel = injuredPlayer
    ? extractUnitGroups(injuredPlayer).join(' / ') || injuredPos
    : injuredPos;
  const faPos = (selectedFa?.position || selectedFa?.pos || '??').toUpperCase();
  const faName = selectedFa ? `${selectedFa.first} ${selectedFa.last}`.trim() : 'Player';
  const injuredName = injuredPlayer
    ? (injuredPlayer.name || `${injuredPlayer.first} ${injuredPlayer.last}`.trim())
    : '___';

  const entry = teamMetadata.find(
    t => (t.short || t.teamshort || '').toString().trim().toUpperCase() === activeCode,
  );
  const fullTeamName = entry ? entry.name : team;

  const logPreview = useMemo(() => {
    if (!selectedFa) return '';
    if (mode === 'FA') return `${faPos} - ${faName}`;
    return `${faPos} - ${faName} for injury to ${injuredPos} - ${injuredName} in week ${wkTrim || 'X'} for ${durTrim || 'Y'} weeks`;
  }, [selectedFa, mode, faPos, faName, injuredPos, injuredName, wkTrim, durTrim]);

  function handleInjuredSelect(identity: string) {
    setInjuredIdentity(identity);
    setSubmitError(null);
    if (!identity && faPosFilter === 'MATCH') {
      setFaPosFilter('ALL');
    }
  }

  function handleReviewClick() {
    setSubmitError(null);
    if (!selectedFa) return;
    if (mode === 'INJURY' && (!injuredPlayer || !isInjuryWindowValid)) {
      showToast('Select your injured player and enter valid whole numbers (≥ 1) for Week and Duration.', 'error');
      return;
    }
    setShowConfirm(true);
  }

  async function handleConfirmSubmit() {
    if (!selectedFa) return;
    if (mode === 'INJURY' && (!injuredPlayer || !isInjuryWindowValid)) return;

    setLoading(true);
    setSubmitError(null);
    const payload = {
      type: mode === 'INJURY' ? 'INJURY PICKUP' : 'ADD',
      identity: selectedFa.identity,
      fromTeam: 'FA',
      toTeam: fullTeamName,
      coach,
      details: logPreview,
      weekBack: mode === 'INJURY' ? String(weekBackNum) : '',
      status: 'PENDING',
    };

    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      setShowConfirm(false);
      if (res.ok) {
        setSelectedIdentity('');
        setInjuredIdentity('');
        setWeekOccurred('');
        setDuration('');
        setFaPosFilter('ALL');
        await loadData(true);
        if (onComplete) onComplete();
        showToast(
          mode === 'INJURY'
            ? `Injury pickup submitted ($0): ${faPos} - ${faName}.`
            : `Free agent pickup submitted: ${faPos} - ${faName}.`,
        );
      } else {
        // Surface the server's actual message (deadline lock, race-lost pickup, etc.)
        const err = await res.json().catch(() => ({}));
        const message = err.error || 'Error processing pickup';
        setSubmitError(message);
        showToast(message, 'error');
      }
    } catch {
      setShowConfirm(false);
      const message = 'Error processing pickup';
      setSubmitError(message);
      showToast(message, 'error');
    } finally {
      setLoading(false);
    }
  }

  const toastBanner = toast && (
    <div
      role={toast.type === 'error' ? 'alert' : 'status'}
      aria-live="polite"
      className={`fixed top-20 inset-x-4 sm:inset-x-auto sm:right-6 z-[150] max-w-md px-5 py-3.5 rounded-2xl shadow-2xl text-white font-black text-xs sm:text-sm uppercase tracking-wider flex items-center justify-between gap-3 animate-in fade-in slide-in-from-top-4 ${
        toast.type === 'success' ? 'bg-emerald-700' : 'bg-red-700'
      }`}
    >
      <span className="break-words">{toast.message}</span>
      <button
        type="button"
        onClick={() => setToast(null)}
        aria-label="Dismiss notification"
        className="min-h-11 min-w-11 flex items-center justify-center rounded-lg hover:bg-white/10 shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X size={16} />
      </button>
    </div>
  );

  // Locked view for non-privileged coaches after fa_trade_deadline
  if (isLockedForCoach) {
    return (
      <div className="space-y-6 border-2 border-slate-200 p-6 sm:p-8 md:p-12 rounded-2xl bg-slate-50 text-center text-slate-900 relative">
        {toastBanner}
        <div className="w-16 h-16 rounded-2xl bg-slate-200 text-slate-600 flex items-center justify-center mx-auto">
          <Lock size={28} />
        </div>
        <div className="space-y-2 max-w-lg mx-auto">
          <h3 className="font-black text-2xl uppercase tracking-tighter italic text-slate-900">
            Free Agent Pickups Closed
          </h3>
          <p className="text-xs font-bold text-slate-600 uppercase tracking-widest">
            Deadline Passed{faDeadlineLabel ? `: ${faDeadlineLabel}` : faDeadlineRaw ? `: ${faDeadlineRaw}` : ''}
          </p>
          <p className="text-sm text-slate-700 pt-2">
            Paid Free Agent pickups close at the NFL Trade Deadline.{' '}
            <span className="font-bold text-teal-700">$0 Injury Replacements</span> remain open for injured roster players.
          </p>
        </div>
        {onSwitchMode && (
          <button
            type="button"
            onClick={() => onSwitchMode('INJURY')}
            className="min-h-11 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-teal-700 hover:bg-teal-800 text-white font-black text-xs uppercase tracking-widest shadow-lg transition-all active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2"
          >
            <HeartPulse size={16} />
            Go to Injury Pickup ($0)
            <ArrowRight size={16} />
          </button>
        )}
      </div>
    );
  }

  const posFilterPills =
    mode === 'INJURY' && injuredPlayer
      ? (['MATCH', ...BASE_POS_FILTERS] as const)
      : BASE_POS_FILTERS;

  const canReview =
    mode === 'FA'
      ? Boolean(selectedFa)
      : Boolean(selectedFa && injuredPlayer && isInjuryWindowValid);

  const missingSteps: string[] = [];
  if (mode === 'INJURY') {
    if (!injuredPlayer) missingSteps.push('injured player');
    if (!isInjuryWindowValid) missingSteps.push('week & duration');
  }
  if (!selectedFa) missingSteps.push('replacement free agent');

  return (
    <div
      className={`space-y-5 border p-4 sm:p-5 rounded-xl bg-white shadow-lg text-left text-black relative ${
        mode === 'INJURY' ? 'border-teal-200' : 'border-blue-100'
      }`}
    >
      {toastBanner}

      {/* PRE-SUBMIT CONFIRMATION MODAL */}
      {showConfirm && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            onClick={() => !loading && setShowConfirm(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="pickup-confirm-title"
            className="relative bg-white rounded-3xl shadow-2xl p-6 sm:p-8 max-w-md w-full max-h-[90vh] overflow-y-auto space-y-5 text-center"
          >
            {mode === 'FA' ? (
              <>
                <div className="w-12 h-12 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center mx-auto font-black text-lg">
                  ${faFee}
                </div>
                <h3
                  id="pickup-confirm-title"
                  className="text-xl font-black uppercase text-blue-700 tracking-tighter"
                >
                  Confirm FA Pickup
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-left text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Player</span>
                    <span className="font-black text-slate-900 text-right break-words">{faPos} - {faName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Team</span>
                    <span className="font-black text-slate-900 text-right break-words">{fullTeamName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Type &amp; Fee</span>
                    <span className="font-black text-blue-700 text-right">
                      Permanent Signing • ${faFee} Fee
                    </span>
                  </div>
                </div>
                {isFaClosed && isCommissioner && (
                  <p className="text-xs font-bold text-amber-800 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                    Commissioner Override — FA deadline has passed{faDeadlineLabel ? ` (${faDeadlineLabel})` : ''}.
                  </p>
                )}
                <p className="text-xs text-slate-600">
                  Submitting logs this pickup as Pending for Commissioner review and notifies the league.
                </p>
                {onSwitchMode && (
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => {
                      setShowConfirm(false);
                      onSwitchMode('INJURY');
                    }}
                    className="w-full min-h-11 inline-flex items-center justify-center px-3.5 py-2.5 rounded-xl bg-teal-50 border border-teal-300 text-teal-800 hover:bg-teal-100 font-black uppercase text-xs tracking-wider transition-colors"
                  >
                    Wait — Switch to Injury Pickup ($0) →
                  </button>
                )}
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 min-h-11 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-black uppercase text-xs hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmSubmit}
                    className="flex-1 min-h-11 py-3 rounded-xl bg-blue-600 text-white font-black uppercase text-xs hover:bg-blue-700 transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : `Confirm FA Pickup${faFee > 0 ? ` ($${faFee})` : ''}`}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center mx-auto">
                  <HeartPulse size={24} />
                </div>
                <h3
                  id="pickup-confirm-title"
                  className="text-xl font-black uppercase text-teal-800 tracking-tighter"
                >
                  Confirm Injury Pickup
                </h3>
                <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-2 text-left text-xs">
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Pickup</span>
                    <span className="font-black text-slate-900 text-right break-words">{faPos} - {faName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Replacing</span>
                    <span className="font-black text-slate-900 text-right break-words">{injuredPos} - {injuredName}</span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Window</span>
                    <span className="font-black text-teal-800 text-right">
                      Wk {wkNum} + {durNum} wk{durNum === 1 ? '' : 's'} → Return Wk {weekBackNum}
                    </span>
                  </div>
                  <div className="flex justify-between gap-3">
                    <span className="shrink-0 font-bold text-slate-600 uppercase tracking-wider">Fee</span>
                    <span className="font-black text-emerald-700 text-right">$0 (Return to FA when healed)</span>
                  </div>
                </div>
                <p className="text-xs text-slate-600">
                  Submitting logs this pickup as Pending for Commissioner review and notifies the league.
                </p>
                <div className="flex gap-3">
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setShowConfirm(false)}
                    className="flex-1 min-h-11 py-3 rounded-xl border-2 border-slate-200 text-slate-700 font-black uppercase text-xs hover:bg-slate-50 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={handleConfirmSubmit}
                    className="flex-1 min-h-11 py-3 rounded-xl bg-teal-700 text-white font-black uppercase text-xs hover:bg-teal-800 transition-all shadow-lg disabled:opacity-50"
                  >
                    {loading ? 'Processing...' : 'Confirm Injury Pickup ($0)'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* PANEL HEADER */}
      <div className="flex flex-wrap justify-between items-center gap-3 border-b pb-3">
        <div>
          <h3
            className={`font-black text-xl uppercase italic ${
              mode === 'INJURY' ? 'text-teal-800' : 'text-blue-700'
            }`}
          >
            {mode === 'INJURY' ? 'Injury Replacement Pickup' : 'Permanent Free Agent Pickup'}
          </h3>
          <p className="text-[11px] font-bold text-slate-600 uppercase tracking-widest mt-0.5">
            {mode === 'INJURY'
              ? 'Any position • Temporary $0 replacement — player returns to FA when injured player heals'
              : `Permanent roster addition${faDeadlineLabel ? ` • Deadline: ${faDeadlineLabel}` : ''}`}
          </p>
        </div>
        <span
          className={`px-3 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest ${
            mode === 'INJURY'
              ? 'bg-teal-50 text-teal-800 border border-teal-200'
              : 'bg-blue-50 text-blue-700 border border-blue-200'
          }`}
        >
          {mode === 'INJURY' ? '$0 Fee • Temporary' : faFee > 0 ? `$${faFee} Fee` : '$0 Fee'}
        </span>
      </div>

      {/* MODE CONTEXT / OVERRIDE CALLOUTS */}
      {mode === 'FA' && isFaClosed && isCommissioner && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <ShieldAlert size={16} className="text-amber-700 shrink-0" />
            <span>
              FA Deadline passed{faDeadlineLabel ? ` (${faDeadlineLabel})` : ''} — Commissioner override active.
            </span>
          </div>
          {onSwitchMode && (
            <button
              type="button"
              onClick={() => onSwitchMode('INJURY')}
              className="min-h-11 inline-flex items-center justify-center px-3.5 py-2.5 rounded-lg bg-teal-700 text-white text-xs font-black uppercase tracking-wider hover:bg-teal-800 transition-colors"
            >
              Switch to Injury Pickup ($0)
            </button>
          )}
        </div>
      )}

      {mode === 'FA' && !isFaClosed && onSwitchMode && (
        <div className="p-3 rounded-xl bg-teal-50/70 border border-teal-200 flex flex-wrap items-center justify-between gap-2">
          <span className="text-xs font-bold text-teal-900">
            Replacing an injured player temporarily for $0?
          </span>
          <button
            type="button"
            onClick={() => onSwitchMode('INJURY')}
            className="min-h-11 inline-flex items-center justify-center px-3.5 py-2.5 text-xs font-black uppercase tracking-wider text-teal-800 hover:text-teal-950 underline underline-offset-2 rounded-lg"
          >
            Switch to Injury Pickup →
          </button>
        </div>
      )}

      {/* INJURY MODE STEP 1: INJURED PLAYER + WEEK/DURATION */}
      {mode === 'INJURY' && (
        <div className="p-4 bg-teal-50/60 border border-teal-200 rounded-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label
              htmlFor="injured-player-select"
              className="text-[11px] font-black text-teal-900 uppercase tracking-widest"
            >
              Step 1 — Select Your Injured Player &amp; Injury Window
            </label>
            {injuredPlayer && (
              <span className="text-[10px] font-black text-teal-800 bg-white px-2.5 py-0.5 rounded-full border border-teal-200">
                {injuredPos} • {injuredName}
              </span>
            )}
          </div>
          <div className="space-y-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-teal-700" size={14} />
              <input
                id="injured-roster-search"
                type="text"
                aria-label="Search your roster"
                placeholder="Search your roster..."
                className="w-full p-2.5 pl-8 text-base sm:text-xs border rounded bg-white text-black outline-none focus:border-teal-600"
                value={rosterSearch}
                onChange={e => setRosterSearch(e.target.value)}
              />
            </div>
            <select
              id="injured-player-select"
              size={6}
              value={injuredIdentity}
              onChange={e => handleInjuredSelect(e.target.value)}
              className="w-full h-44 p-2 border rounded text-xs text-black font-medium bg-white outline-none focus:border-teal-600 custom-scrollbar"
            >
              <option value="">-- Select Injured Player --</option>
              {sortedRoster
                .filter(
                  p =>
                    p.identity === injuredIdentity ||
                    `${p.first} ${p.last} ${p.name || ''}`
                      .toLowerCase()
                      .includes(rosterSearch.toLowerCase()),
                )
                .map((p, i) => (
                  <option key={i} value={p.identity}>
                    {playerOptionLabel(p)}
                    {p.isIR ? ' [ON IR]' : ''}
                  </option>
                ))}
            </select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <label
                htmlFor="injury-week-input"
                className="text-[11px] font-bold text-teal-900 uppercase tracking-widest"
              >
                Week Injury Occurred
              </label>
              <input
                id="injury-week-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={29}
                step={1}
                placeholder="e.g. 10"
                value={weekOccurred}
                onChange={e => setWeekOccurred(e.target.value)}
                className="w-full p-2.5 border rounded bg-white text-black text-base sm:text-sm font-bold outline-none focus:border-teal-600"
              />
            </div>
            <div className="space-y-1">
              <label
                htmlFor="injury-duration-input"
                className="text-[11px] font-bold text-teal-900 uppercase tracking-widest"
              >
                Duration (Weeks Out)
              </label>
              <input
                id="injury-duration-input"
                type="number"
                inputMode="numeric"
                min={1}
                max={29}
                step={1}
                placeholder="e.g. 4"
                value={duration}
                onChange={e => setDuration(e.target.value)}
                className="w-full p-2.5 border rounded bg-white text-black text-base sm:text-sm font-bold outline-none focus:border-teal-600"
              />
            </div>
          </div>
          {isInjuryWindowValid ? (
            <div className="px-3 py-2 rounded-lg bg-white border border-teal-200 text-xs font-black text-teal-800 flex items-center justify-between">
              <span>Eligible to Return (Week Back)</span>
              <span className="bg-teal-100 text-teal-900 px-2.5 py-0.5 rounded-full">
                Week {weekBackNum}
              </span>
            </div>
          ) : showInjuryWindowError ? (
            <p role="alert" className="text-xs font-bold text-red-700">
              Week and Duration must be whole numbers ≥ 1 with return week (Week + Duration) ≤ 30.
            </p>
          ) : null}
        </div>
      )}

      {/* AVAILABLE FREE AGENTS */}
      <div className="space-y-2">
        <label
          htmlFor="fa-player-select"
          className="text-[11px] font-bold text-slate-600 uppercase tracking-widest block"
        >
          {mode === 'INJURY'
            ? 'Step 2 — Replacement Free Agent'
            : 'Available Players'}
        </label>
        <div className="flex flex-wrap gap-1.5">
          {posFilterPills.map(f => {
            const label = f === 'MATCH' ? `MATCH (${injuredUnitLabel})` : f;
            const isActive = activePosFilter === f;
            return (
              <button
                key={f}
                type="button"
                aria-pressed={isActive}
                onClick={() => setFaPosFilter(f)}
                className={`min-h-11 sm:min-h-9 px-3.5 py-2 sm:py-1.5 text-xs sm:text-[10px] font-bold rounded-full uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-1 ${
                  isActive
                    ? mode === 'INJURY'
                      ? 'bg-teal-700 text-white'
                      : 'bg-blue-600 text-white'
                    : f === 'MATCH'
                      ? 'bg-teal-50 text-teal-800 border border-teal-300 hover:bg-teal-100'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {label}
              </button>
            );
          })}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" size={14} />
          <input
            id="fa-player-search"
            type="text"
            aria-label="Search available free agents by name"
            placeholder="Search by name..."
            className={`w-full p-2.5 pl-8 text-base sm:text-xs border rounded bg-white text-black outline-none ${
              mode === 'INJURY' ? 'focus:border-teal-600' : 'focus:border-blue-500'
            }`}
            value={faSearch}
            onChange={e => setFaSearch(e.target.value)}
          />
        </div>
        {baseFilteredFreeAgents.length === 0 ? (
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-center space-y-2">
            <p className="text-xs font-bold text-slate-600">
              No available free agents match this filter.
            </p>
            {(activePosFilter !== 'ALL' || faSearch) && (
              <button
                type="button"
                onClick={() => {
                  setFaPosFilter('ALL');
                  setFaSearch('');
                }}
                className="min-h-11 inline-flex items-center justify-center px-4 py-2 rounded-lg border border-slate-300 bg-white text-xs font-black uppercase tracking-wider text-slate-700 hover:bg-slate-100"
              >
                Show All Positions
              </button>
            )}
          </div>
        ) : null}
        <select
          id="fa-player-select"
          size={10}
          value={selectedIdentity}
          onChange={e => {
            setSelectedIdentity(e.target.value);
            setSubmitError(null);
          }}
          className={`border-2 border-gray-100 w-full text-xs rounded-lg p-2 bg-white text-black font-semibold custom-scrollbar outline-none h-64 ${
            mode === 'INJURY' ? 'focus:border-teal-600' : 'focus:border-blue-500'
          }`}
        >
          <option value="">-- Choose Player --</option>
          {displayedFreeAgents.map((p, i) => (
            <option key={i} value={p.identity}>
              {playerOptionLabel(p)}
            </option>
          ))}
        </select>
        <p className="text-[11px] font-semibold text-slate-600 text-right">
          {baseFilteredFreeAgents.length} player{baseFilteredFreeAgents.length !== 1 ? 's' : ''} available
        </p>
      </div>

      {/* INLINE SERVER / VALIDATION ERROR */}
      {submitError && (
        <div
          role="alert"
          className="p-3.5 bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-800 flex items-center justify-between gap-2"
        >
          <span>{submitError}</span>
          <button
            type="button"
            onClick={() => setSubmitError(null)}
            aria-label="Dismiss error"
            className="p-1 text-red-700 hover:text-red-900 shrink-0"
          >
            <X size={14} />
          </button>
        </div>
      )}

      {/* LOG PREVIEW */}
      {selectedFa && (
        <div className="p-2.5 bg-slate-50 border rounded text-[11px] font-mono text-slate-700 italic">
          Preview: {logPreview}
        </div>
      )}

      {/* DISABLED GUIDANCE */}
      {!canReview && missingSteps.length > 0 && (
        <p className="text-xs font-bold text-slate-600 text-center">
          Complete to continue: {missingSteps.join(' • ')}
        </p>
      )}

      {/* SUBMIT BUTTON */}
      <button
        type="button"
        onClick={handleReviewClick}
        disabled={loading || !canReview}
        className={`w-full min-h-11 p-4 text-white rounded-xl font-black uppercase tracking-widest disabled:bg-slate-200 disabled:text-slate-600 transition-all active:scale-95 shadow-md ${
          mode === 'INJURY'
            ? 'bg-teal-700 hover:bg-teal-800'
            : 'bg-blue-600 hover:bg-blue-700'
        }`}
      >
        {loading
          ? 'Processing...'
          : mode === 'INJURY'
            ? 'Review Injury Pickup ($0)'
            : `Review FA Pickup${faFee > 0 ? ` ($${faFee})` : ''}`}
      </button>
    </div>
  );
}
