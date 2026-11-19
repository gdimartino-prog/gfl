'use client';

import { useEffect, useMemo, useState } from 'react';
import { X, Plus, Trash2, AlertTriangle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { RULE_CHANGE_DEFAULT_DAYS, POLL_MIN_OPTIONS, POLL_MAX_OPTIONS } from '@/lib/pollRules';
import type { PollItem, PollType } from '@/types';

interface CreateEditPollModalProps {
  mode: 'create' | 'edit';
  poll?: PollItem;
  currentSeason: number | null;
  enactedDecisions: PollItem[];
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function toLocalDateTimeInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function CreateEditPollModal({
  mode,
  poll,
  currentSeason,
  enactedDecisions,
  onClose,
  onSaved,
}: CreateEditPollModalProps) {
  const [mountTimeMs] = useState(() => Date.now());
  const defaultCloseStr = useMemo(
    () => toLocalDateTimeInput(new Date(mountTimeMs + RULE_CHANGE_DEFAULT_DAYS * 86_400_000)),
    [mountTimeMs],
  );
  const defaultGeneralCloseStr = useMemo(
    () => toLocalDateTimeInput(new Date(mountTimeMs + 7 * 86_400_000)),
    [mountTimeMs],
  );

  const [title, setTitle] = useState(poll?.title ?? '');
  const [description, setDescription] = useState(poll?.description ?? '');
  const [pollType, setPollType] = useState<PollType>(poll?.pollType ?? 'rule_change');
  const [closesAt, setClosesAt] = useState(
    poll?.closesAt ? toLocalDateTimeInput(new Date(poll.closesAt)) : defaultCloseStr,
  );
  const [effectiveSeason, setEffectiveSeason] = useState(
    poll?.effectiveSeason != null
      ? String(poll.effectiveSeason)
      : currentSeason != null
        ? String(currentSeason)
        : '',
  );
  const [constitutionRef, setConstitutionRef] = useState(poll?.constitutionRef ?? '');
  const [options, setOptions] = useState<string[]>(
    poll?.options?.length ? poll.options.map((o) => o.label) : ['Approve', 'Reject'],
  );
  const [showE10Ref, setShowE10Ref] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const optionsLocked = mode === 'edit' && (poll?.votesCast ?? 0) > 0;
  const activeE10Locks = useMemo(
    () => enactedDecisions.filter((p) => p.e10Locked),
    [enactedDecisions],
  );

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isShortRuleChangeWindow = useMemo(() => {
    if (pollType !== 'rule_change' || !closesAt) return false;
    const parsed = new Date(closesAt);
    if (Number.isNaN(parsed.getTime())) return false;
    const baseline = mode === 'edit' && poll ? new Date(poll.createdAt).getTime() : mountTimeMs;
    return parsed.getTime() - baseline < (RULE_CHANGE_DEFAULT_DAYS * 86_400_000 - 3_600_000);
  }, [pollType, closesAt, mode, poll, mountTimeMs]);

  const handleTypeChange = (nextType: PollType) => {
    setPollType(nextType);
    if (mode === 'create') {
      setClosesAt(nextType === 'rule_change' ? defaultCloseStr : defaultGeneralCloseStr);
    }
  };

  const handleOptionChange = (idx: number, val: string) => {
    setOptions((prev) => prev.map((o, i) => (i === idx ? val : o)));
  };

  const handleAddOption = () => {
    if (options.length >= POLL_MAX_OPTIONS) return;
    setOptions((prev) => [...prev, '']);
  };

  const handleRemoveOption = (idx: number) => {
    if (options.length <= POLL_MIN_OPTIONS) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      setError('Poll title is required.');
      return;
    }

    const parsedClose = new Date(closesAt);
    if (!closesAt || Number.isNaN(parsedClose.getTime())) {
      setError('Valid closing date and time is required.');
      return;
    }

    const cleanOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!optionsLocked && (cleanOptions.length < POLL_MIN_OPTIONS || cleanOptions.length > POLL_MAX_OPTIONS)) {
      setError(`Provide between ${POLL_MIN_OPTIONS} and ${POLL_MAX_OPTIONS} non-empty choices.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = {
        title: trimmedTitle,
        description: description.trim() || null,
        closesAt: parsedClose.toISOString(),
        effectiveSeason: effectiveSeason.trim() ? Number(effectiveSeason.trim()) : null,
        constitutionRef: constitutionRef.trim() || null,
      };
      if (mode === 'create') {
        payload.pollType = pollType;
      }
      if (!optionsLocked) {
        payload.options = cleanOptions;
      }

      const res = await fetch(mode === 'create' ? '/api/polls' : `/api/polls/${poll!.id}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setError(data.message || 'Failed to save poll.');
        return;
      }
      await onSaved();
      onClose();
    } catch {
      setError('Network error while saving poll.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="poll-modal-title"
    >
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-xs" onClick={onClose} />
      <div className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 md:p-8 text-left">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-4 mb-6">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600">
              Commissioner Action · Constitution E9
            </p>
            <h2 id="poll-modal-title" className="text-2xl font-black uppercase italic text-slate-900 tracking-tight mt-1">
              {mode === 'create' ? 'Post New League Poll' : 'Edit Open Poll'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            aria-label="Close modal"
          >
            <X size={20} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-bold flex items-center gap-2">
            <AlertTriangle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {mode === 'create' && (
            <div>
              <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">
                Poll Category
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => handleTypeChange('rule_change')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    pollType === 'rule_change'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-black text-xs uppercase text-slate-900">Rule Change Proposal</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    14-day default (E12), 50% quorum (E13), 50%+1 / runoff (E11), 1-season lock (E10).
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('general')}
                  className={`p-3 rounded-2xl border text-left transition-all ${
                    pollType === 'general'
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="font-black text-xs uppercase text-slate-900">General / League Poll</p>
                  <p className="text-[11px] text-slate-500 mt-1">
                    Custom close window, simple plurality wins. Great for dates, scheduling & surveys.
                  </p>
                </button>
              </div>
            </div>
          )}

          {pollType === 'rule_change' && activeE10Locks.length > 0 && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-3 text-xs">
              <button
                type="button"
                onClick={() => setShowE10Ref((v) => !v)}
                className="w-full flex items-center justify-between font-bold text-amber-900"
              >
                <span className="flex items-center gap-1.5">
                  <Lock size={14} />
                  Rule E10 Reference: {activeE10Locks.length} enacted decision(s) active this season
                </span>
                <span className="text-[10px] uppercase tracking-wider underline">
                  {showE10Ref ? 'Hide' : 'Review'}
                </span>
              </button>
              {showE10Ref && (
                <ul className="mt-2 pt-2 border-t border-amber-200/80 space-y-1 text-[11px] text-amber-900">
                  {activeE10Locks.map((d) => (
                    <li key={d.id}>
                      <strong>{d.title}</strong>
                      {d.constitutionRef ? ` (${d.constitutionRef})` : ''} — Season {d.effectiveSeason}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div>
            <label htmlFor="poll-title-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Proposal / Question Title *
            </label>
            <input
              id="poll-title-input"
              type="text"
              required
              maxLength={200}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Increase Injured Reserve Cap from 5 to 6"
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label htmlFor="poll-desc-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
              Details / Rationale
            </label>
            <textarea
              id="poll-desc-input"
              rows={3}
              maxLength={2000}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Context, wording changes, effective rules, etc."
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label htmlFor="poll-closes-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Voting Closes *
              </label>
              <input
                id="poll-closes-input"
                type="datetime-local"
                required
                value={closesAt}
                onChange={(e) => setClosesAt(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="poll-season-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Effective Season (E10)
              </label>
              <input
                id="poll-season-input"
                type="number"
                min={1990}
                max={2100}
                value={effectiveSeason}
                onChange={(e) => setEffectiveSeason(e.target.value)}
                placeholder="e.g., 2026"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div>
              <label htmlFor="poll-ref-input" className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1.5">
                Constitution Ref
              </label>
              <input
                id="poll-ref-input"
                type="text"
                maxLength={100}
                value={constitutionRef}
                onChange={(e) => setConstitutionRef(e.target.value)}
                placeholder="e.g., B7, D1"
                className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {isShortRuleChangeWindow && (
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-2">
              <AlertTriangle size={15} className="shrink-0" />
              <span>
                Constitution E12 specifies a two-week (14-day) voting window for league rule change proposals.
              </span>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                Ballot Choices ({options.length}/{POLL_MAX_OPTIONS})
              </label>
              {!optionsLocked && options.length < POLL_MAX_OPTIONS && (
                <button
                  type="button"
                  onClick={handleAddOption}
                  className="inline-flex items-center gap-1 text-xs font-black text-blue-600 hover:text-blue-700"
                >
                  <Plus size={14} /> Add Choice
                </button>
              )}
            </div>

            {optionsLocked && (
              <p className="text-[11px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 mb-2">
                Choices are locked because at least one vote has already been cast.
              </p>
            )}

            <div className="space-y-2">
              {options.map((opt, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-400 w-5 text-right">{idx + 1}.</span>
                  <input
                    type="text"
                    required
                    maxLength={200}
                    disabled={optionsLocked}
                    value={opt}
                    onChange={(e) => handleOptionChange(idx, e.target.value)}
                    placeholder={`Choice ${idx + 1}`}
                    className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-sm disabled:bg-slate-100 disabled:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  {!optionsLocked && options.length > POLL_MIN_OPTIONS && (
                    <button
                      type="button"
                      onClick={() => handleRemoveOption(idx)}
                      className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                      aria-label={`Remove choice ${idx + 1}`}
                    >
                      <Trash2 size={15} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
            <Button type="button" variant="outline" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Saving...' : mode === 'create' ? 'Post Poll & Notify' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
