'use client';

import { useEffect, useState } from 'react';
import { X, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PollActiveTeam, PollItem } from '@/types';

interface ProxyVoteModalProps {
  poll: PollItem;
  activeTeams: PollActiveTeam[];
  onClose: () => void;
  onVoted: () => Promise<void>;
}

export default function ProxyVoteModal({
  poll,
  activeTeams,
  onClose,
  onVoted,
}: ProxyVoteModalProps) {
  const votedTeamIds = new Set(poll.votedTeams.map((v) => v.teamId));
  const defaultTeam = poll.nonVotedTeams[0]?.id ?? activeTeams[0]?.id ?? '';

  const [targetTeamId, setTargetTeamId] = useState<string>(defaultTeam ? String(defaultTeam) : '');
  const [optionId, setOptionId] = useState<number | null>(poll.options[0]?.id ?? null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!targetTeamId || !optionId) {
      setError('Select both a team and a ballot choice.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${poll.id}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionId,
          targetTeamId: Number(targetTeamId),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Failed to record proxy vote.');
        return;
      }
      await onVoted();
      onClose();
    } catch {
      setError('Network error while recording proxy vote.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="proxy-vote-title"
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-md w-full p-6 md:p-7 text-left">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">
              Commissioner Proxy Ballot
            </p>
            <h2 id="proxy-vote-title" className="text-xl font-black uppercase italic text-slate-900 mt-1">
              Record Proxy Vote
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs font-bold text-slate-600 mb-4 line-clamp-2">{poll.title}</p>

        <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-[11px] font-semibold flex items-start gap-2">
          <ShieldAlert size={15} className="shrink-0 mt-0.5" />
          <span>
            Proxy ballots are tagged as Commissioner proxy in the roll call and recorded in the league audit log (choice remains secret until close).
          </span>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="proxy-team-select" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Target Team
            </label>
            <select
              id="proxy-team-select"
              value={targetTeamId}
              onChange={(e) => setTargetTeamId(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {activeTeams.map((team) => {
                const alreadyVoted = votedTeamIds.has(team.id);
                return (
                  <option key={team.id} value={team.id}>
                    {team.name} ({team.teamshort}){alreadyVoted ? ' — Already Voted (Overwrite)' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Ballot Choice
            </p>
            <div className="space-y-2">
              {poll.options.map((opt) => (
                <label
                  key={opt.id}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl border cursor-pointer transition-all ${
                    optionId === opt.id
                      ? 'border-blue-600 bg-blue-50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="proxy-option"
                    checked={optionId === opt.id}
                    onChange={() => setOptionId(opt.id)}
                    className="accent-blue-600"
                  />
                  <span className="text-sm font-bold text-slate-800">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !targetTeamId || !optionId}>
              {submitting ? 'Submitting...' : 'Submit Proxy Vote'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
