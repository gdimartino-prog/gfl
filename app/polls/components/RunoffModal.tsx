'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RULE_CHANGE_DEFAULT_DAYS } from '@/lib/pollRules';
import type { PollItem } from '@/types';

interface RunoffModalProps {
  parentPoll: PollItem;
  onClose: () => void;
  onCreated: () => Promise<void>;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function RunoffModal({ parentPoll, onClose, onCreated }: RunoffModalProps) {
  const [mountTimeMs] = useState(() => Date.now());
  const defaultCloseStr = useMemo(
    () => toLocalDateTimeInput(new Date(mountTimeMs + RULE_CHANGE_DEFAULT_DAYS * 86_400_000)),
    [mountTimeMs],
  );

  const sortedOptions = useMemo(
    () =>
      [...parentPoll.options].sort(
        (a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0) || a.sortOrder - b.sortOrder,
      ),
    [parentPoll.options],
  );

  const outcome = parentPoll.computedOutcome;
  const tiedIds = new Set(outcome?.tiedAtCutoffOptionIds ?? []);

  const [selectedIds, setSelectedIds] = useState<number[]>(() => {
    if (outcome && !outcome.hasRunoffTie && outcome.suggestedRunoffOptionIds.length === 2) {
      return outcome.suggestedRunoffOptionIds;
    }
    return [];
  });
  const [title, setTitle] = useState(`Runoff: ${parentPoll.title}`.slice(0, 200));
  const [closesAt, setClosesAt] = useState(defaultCloseStr);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const toggleOption = (id: number) => {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (selectedIds.length !== 2) {
      setError('Select exactly 2 options to advance to the runoff.');
      return;
    }
    const parsedClose = new Date(closesAt);
    if (!closesAt || Number.isNaN(parsedClose.getTime())) {
      setError('Valid closing date and time is required.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/polls/${parentPoll.id}/runoff`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          optionIds: selectedIds,
          title: title.trim() || undefined,
          closesAt: parsedClose.toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Failed to launch runoff.');
        return;
      }
      await onCreated();
      onClose();
    } catch {
      setError('Network error while launching runoff.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="runoff-modal-title"
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 text-left">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600">
              Constitution E11 · Top-2 Runoff
            </p>
            <h2 id="runoff-modal-title" className="text-xl font-black uppercase italic text-slate-900 mt-1">
              Launch Runoff Ballot
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

        {outcome?.hasRunoffTie && (
          <div className="mb-4 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-2">
            <AlertTriangle size={16} className="shrink-0 mt-0.5" />
            <span>
              Tie detected at the top-2 cutoff. Select the exact 2 choices that should advance to the runoff vote.
            </span>
          </div>
        )}

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="runoff-title" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Runoff Poll Title
            </label>
            <input
              id="runoff-title"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="runoff-closes" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Runoff Close Date (Default 14 Days)
            </label>
            <input
              id="runoff-closes"
              type="datetime-local"
              required
              value={closesAt}
              onChange={(e) => setClosesAt(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
              Select 2 Advancing Choices ({selectedIds.length}/2 selected)
            </p>
            <div className="space-y-2">
              {sortedOptions.map((opt) => {
                const checked = selectedIds.includes(opt.id);
                const isTiedAtCutoff = tiedIds.has(opt.id);
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => toggleOption(opt.id)}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-2.5 rounded-xl border text-left transition-all ${
                      checked
                        ? 'border-blue-600 bg-blue-50 ring-2 ring-blue-500/20'
                        : isTiedAtCutoff
                          ? 'border-amber-300 bg-amber-50/40 hover:border-amber-400'
                          : 'border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center text-[10px] font-black ${
                          checked ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                        }`}
                      >
                        {checked ? '✓' : ''}
                      </span>
                      <span className="font-bold text-sm text-slate-800 truncate">{opt.label}</span>
                      {isTiedAtCutoff && (
                        <span className="text-[9px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                          Tied Cutoff
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-slate-500 shrink-0">
                      {opt.voteCount ?? 0} ({opt.percentage ?? 0}%)
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || selectedIds.length !== 2}>
              {submitting ? 'Creating Runoff...' : 'Launch Runoff & Notify'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
