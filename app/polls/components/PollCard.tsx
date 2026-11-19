'use client';

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  Lock,
  Bell,
  Users,
  ChevronDown,
  ChevronUp,
  Edit3,
  Trash2,
  GitBranch,
  UserCheck,
  ShieldCheck,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PollItem, PollsViewer } from '@/types';

interface PollCardProps {
  poll: PollItem;
  viewer: PollsViewer;
  busyAction: string | null;
  onCastVote: (pollId: number, optionId: number) => Promise<boolean>;
  onOpenProxyVote: (poll: PollItem) => void;
  onRemind: (poll: PollItem) => Promise<void>;
  onFinalize: (poll: PollItem) => Promise<void>;
  onOpenEdit: (poll: PollItem) => void;
  onDelete: (poll: PollItem) => Promise<void>;
  onOpenRunoff: (poll: PollItem) => void;
  onJumpToPoll: (pollId: number) => void;
}

function formatEasternDate(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getStatusBadge(poll: PollItem): { label: string; classes: string } {
  if (poll.isVotingOpen) {
    return { label: 'Voting Open', classes: 'bg-blue-100 text-blue-800 border-blue-200' };
  }
  if (poll.isExpiredPendingFinalization) {
    return { label: 'Expired — Ready to Finalize', classes: 'bg-amber-100 text-amber-800 border-amber-200' };
  }
  if (poll.status === 'runoff_needed') {
    return { label: 'Runoff Required (E11)', classes: 'bg-orange-100 text-orange-800 border-orange-200' };
  }
  if (poll.status === 'null_quorum') {
    return { label: 'Null — Quorum Not Met (E13)', classes: 'bg-rose-100 text-rose-800 border-rose-200' };
  }
  if (poll.status === 'tied') {
    return { label: 'Tied — Status Quo', classes: 'bg-slate-200 text-slate-800 border-slate-300' };
  }
  return { label: poll.winnerOptionId ? 'Approved / Closed' : 'Closed', classes: 'bg-emerald-100 text-emerald-800 border-emerald-200' };
}

export default function PollCard({
  poll,
  viewer,
  busyAction,
  onCastVote,
  onOpenProxyVote,
  onRemind,
  onFinalize,
  onOpenEdit,
  onDelete,
  onOpenRunoff,
  onJumpToPoll,
}: PollCardProps) {
  const [draftChoice, setDraftChoice] = useState<number | null>(null);
  const [showRollCall, setShowRollCall] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(false);

  const selectedOptionId = draftChoice ?? poll.myVoteOptionId;
  const statusBadge = getStatusBadge(poll);

  const turnoutPct =
    poll.eligibleTeamCount > 0
      ? Math.min(100, Math.round((poll.votesCast / poll.eligibleTeamCount) * 100))
      : 0;

  const isBusy = busyAction?.startsWith(`${poll.id}:`) ?? false;

  const displayedOutcome = poll.computedOutcome;
  const effectiveWinnerId = poll.winnerOptionId ?? displayedOutcome?.winnerOptionId ?? null;
  const effectiveStatus = poll.status !== 'open' ? poll.status : (displayedOutcome?.status ?? 'open');

  const sortedResultOptions = poll.choicesHidden
    ? poll.options
    : [...poll.options].sort(
        (a, b) => (b.voteCount ?? 0) - (a.voteCount ?? 0) || a.sortOrder - b.sortOrder,
      );

  const handleVoteSubmit = async () => {
    if (!selectedOptionId) return;
    const ok = await onCastVote(poll.id, selectedOptionId);
    if (ok) {
      setDraftChoice(null);
    }
  };

  return (
    <article
      id={`poll-${poll.id}`}
      className="bg-white rounded-[2rem] shadow-md border border-slate-100 p-6 md:p-8 space-y-5 text-left"
    >
      {/* Top badges */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${
              poll.pollType === 'rule_change'
                ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                : 'bg-slate-100 text-slate-700 border-slate-200'
            }`}
          >
            {poll.pollType === 'rule_change' ? 'Rule Change (E11–E13)' : 'General Poll'}
          </span>

          <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider border ${statusBadge.classes}`}>
            {statusBadge.label}
          </span>

          {poll.parentPollId != null && (
            <button
              type="button"
              onClick={() => onJumpToPoll(poll.parentPollId!)}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 transition-colors"
            >
              <GitBranch size={11} /> Runoff Ballot (From #{poll.parentPollId})
            </button>
          )}

          {poll.constitutionRef && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-900 text-white">
              Rule {poll.constitutionRef}
            </span>
          )}

          {poll.effectiveSeason != null && (
            <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-700">
              Season {poll.effectiveSeason}
            </span>
          )}

          {poll.e10Locked && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-100 text-amber-800 border border-amber-200"
              title="Constitution E10: results remain in effect for at least one completed season"
            >
              <Lock size={11} /> E10 Active Lock
            </span>
          )}
        </div>

        <span className="text-[11px] font-bold text-slate-400">Poll #{poll.id}</span>
      </div>

      {/* Title & description */}
      <div>
        <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight leading-snug">
          {poll.title}
        </h3>
        {poll.description && (
          <p className="mt-2 text-sm text-slate-600 leading-relaxed whitespace-pre-line">
            {poll.description}
          </p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs font-semibold text-slate-500">
          <span>Posted by {poll.createdBy}</span>
          <span className="inline-flex items-center gap-1">
            <Clock size={13} className="text-slate-400" />
            {poll.closedAt
              ? `Finalized ${formatEasternDate(poll.closedAt)} ET`
              : `${poll.isVotingOpen ? 'Closes' : 'Closed'} ${formatEasternDate(poll.closesAt)} ET`}
          </span>
        </div>
      </div>

      {/* OPEN VOTING VIEW (Choices & Tallies Hidden) */}
      {poll.choicesHidden ? (
        <div className="space-y-4">
          <div className="px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-600 flex items-start gap-2.5">
            <ShieldCheck size={16} className="text-blue-600 shrink-0 mt-0.5" />
            <span>
              Ballot tallies and individual team choices remain private until voting closes.
              {viewer.canVote
                ? ' You may change your selection at any time before the closing deadline.'
                : ''}
            </span>
          </div>

          <div className="space-y-2.5">
            {poll.options.map((opt) => {
              const isSelected = selectedOptionId === opt.id;
              const isSavedVote = poll.myVoteOptionId === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  disabled={!viewer.canVote || isBusy}
                  onClick={() => viewer.canVote && setDraftChoice(opt.id)}
                  className={`w-full flex items-center justify-between gap-3 px-4 py-3.5 rounded-2xl border text-left transition-all ${
                    isSelected
                      ? 'border-blue-600 bg-blue-50/70 ring-2 ring-blue-500/20'
                      : viewer.canVote
                        ? 'border-slate-200 hover:border-blue-300 hover:bg-slate-50'
                        : 'border-slate-200 bg-slate-50/60 cursor-default'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'border-blue-600 bg-blue-600'
                          : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                    </span>
                    <span className="font-bold text-sm md:text-base text-slate-900">
                      {opt.label}
                    </span>
                  </div>
                  {isSavedVote && (
                    <span className="shrink-0 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase tracking-wider">
                      <CheckCircle2 size={11} /> Your Vote
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {viewer.canVote ? (
            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <p className="text-xs font-semibold text-slate-500">
                Voting as <strong className="text-slate-800">{viewer.teamName}</strong>
                {poll.myVoteOptionId != null ? ' · Vote recorded' : ' · No vote cast yet'}
              </p>
              <Button
                type="button"
                disabled={
                  isBusy ||
                  selectedOptionId == null ||
                  selectedOptionId === poll.myVoteOptionId
                }
                onClick={handleVoteSubmit}
              >
                {busyAction === `${poll.id}:vote`
                  ? 'Submitting...'
                  : poll.myVoteOptionId != null
                    ? 'Update Vote'
                    : 'Cast Vote'}
              </Button>
            </div>
          ) : !viewer.isDemo ? (
            <p className="text-xs font-semibold text-slate-500">
              Your account is not linked to an active franchise in this league. Commissioners can record team ballots via Proxy Vote.
            </p>
          ) : null}

          {/* Quorum progress bar */}
          <div className="pt-2 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">
                Participation: {poll.votesCast} / {poll.eligibleTeamCount} teams ({turnoutPct}%)
              </span>
              <span className={poll.quorumMet ? 'text-emerald-700' : 'text-amber-700'}>
                {poll.pollType === 'rule_change'
                  ? poll.quorumMet
                    ? `✓ Quorum Reached (${poll.quorumRequired}+ per E13)`
                    : `Quorum: ${poll.quorumRequired} required (E13)`
                  : `${poll.votedTeams.length} voted`}
              </span>
            </div>
            <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  poll.quorumMet ? 'bg-emerald-500' : 'bg-blue-500'
                }`}
                style={{ width: `${turnoutPct}%` }}
              />
            </div>
          </div>

          {/* Roll call toggle (shows Voted / Not Yet Voted without choices) */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowRollCall((v) => !v)}
              className="flex items-center justify-between w-full text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900"
            >
              <span className="inline-flex items-center gap-2">
                <Users size={14} />
                Roll Call (E12 Follow-Up) — {poll.votedTeams.length} Voted · {poll.nonVotedTeams.length} Pending
              </span>
              {showRollCall ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showRollCall && (
              <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="rounded-2xl bg-emerald-50/60 border border-emerald-100 p-3.5">
                  <p className="font-black uppercase tracking-wider text-emerald-800 mb-2">
                    Voted ({poll.votedTeams.length})
                  </p>
                  {poll.votedTeams.length === 0 ? (
                    <p className="text-slate-500 italic">No votes cast yet.</p>
                  ) : (
                    <ul className="space-y-1 text-slate-700 font-semibold">
                      {poll.votedTeams.map((v) => (
                        <li key={v.teamId} className="flex items-center justify-between gap-2">
                          <span>
                            {v.teamName} {v.teamshort ? `(${v.teamshort})` : ''}
                          </span>
                          {v.isProxy && (
                            <span className="text-[10px] font-black uppercase px-1.5 py-0.5 rounded bg-amber-100 text-amber-800">
                              Proxy
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="rounded-2xl bg-slate-50 border border-slate-200 p-3.5">
                  <p className="font-black uppercase tracking-wider text-slate-700 mb-2">
                    Not Yet Voted ({poll.nonVotedTeams.length})
                  </p>
                  {poll.nonVotedTeams.length === 0 ? (
                    <p className="text-emerald-700 font-semibold">All active teams have voted!</p>
                  ) : (
                    <ul className="space-y-1 text-slate-600 font-semibold">
                      {poll.nonVotedTeams.map((t) => (
                        <li key={t.id}>
                          {t.name} {t.teamshort ? `(${t.teamshort})` : ''}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* CLOSED / EXPIRED RESULTS VIEW */
        <div className="space-y-4">
          {poll.isExpiredPendingFinalization && (
            <div className="px-4 py-3 rounded-2xl bg-amber-50 border border-amber-200 text-xs font-bold text-amber-900 flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>
                Voting window ended. Preview below — Commissioner should click Finalize & Announce Results to lock official records and send league notifications.
              </span>
            </div>
          )}

          {/* Outcome banner */}
          <div
            className={`px-4 py-3 rounded-2xl border text-xs md:text-sm font-bold ${
              effectiveStatus === 'null_quorum'
                ? 'bg-rose-50 border-rose-200 text-rose-900'
                : effectiveStatus === 'runoff_needed'
                  ? 'bg-orange-50 border-orange-200 text-orange-900'
                  : effectiveStatus === 'tied'
                    ? 'bg-slate-100 border-slate-300 text-slate-800'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            {effectiveStatus === 'null_quorum' && (
              <span>
                Null Result (Rule E13): {poll.votesCast} of {poll.eligibleTeamCount} teams voted (quorum required: {poll.quorumRequired}). Status quo remains.
              </span>
            )}
            {effectiveStatus === 'runoff_needed' && (
              <span>
                Runoff Required (Rule E11): No choice reached 50% + 1 ({poll.majorityRequired} votes needed out of {poll.votesCast}). Top 2 advance.
              </span>
            )}
            {effectiveStatus === 'tied' && (
              <span>Tied Vote: No winner selected — status quo remains.</span>
            )}
            {effectiveStatus === 'closed' && (
              <span>
                {effectiveWinnerId != null
                  ? `Official Result: "${poll.options.find((o) => o.id === effectiveWinnerId)?.label ?? 'Approved'}"`
                  : 'Poll closed with no votes cast.'}
              </span>
            )}
          </div>

          {poll.majorityRequired != null && poll.votesCast > 0 && (
            <p className="text-xs font-bold text-slate-500">
              E11 Majority Threshold (50% + 1): {poll.majorityRequired} of {poll.votesCast} votes · Turnout: {poll.votesCast}/{poll.eligibleTeamCount} (Quorum: {poll.quorumRequired})
            </p>
          )}

          {/* Option result bars */}
          <div className="space-y-3">
            {sortedResultOptions.map((opt) => {
              const isWinner = effectiveWinnerId === opt.id;
              const isMyVote = poll.myVoteOptionId === opt.id;
              const pct = opt.percentage ?? 0;
              return (
                <div
                  key={opt.id}
                  className={`p-3.5 rounded-2xl border ${
                    isWinner
                      ? 'border-emerald-300 bg-emerald-50/40'
                      : 'border-slate-200 bg-slate-50/40'
                  }`}
                >
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-bold text-sm text-slate-900">{opt.label}</span>
                      {isWinner && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-black uppercase">
                          Winner
                        </span>
                      )}
                      {isMyVote && (
                        <span className="px-2 py-0.5 rounded-full bg-blue-600 text-white text-[10px] font-black uppercase">
                          Your Vote
                        </span>
                      )}
                    </div>
                    <span className="text-xs font-black text-slate-700 shrink-0">
                      {opt.voteCount ?? 0} vote{(opt.voteCount ?? 0) === 1 ? '' : 's'} ({pct}%)
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded-full bg-slate-200/80 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        isWinner ? 'bg-emerald-600' : 'bg-blue-600'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {poll.childRunoffPollId != null && (
            <div className="text-xs font-bold text-purple-700">
              <button
                type="button"
                onClick={() => onJumpToPoll(poll.childRunoffPollId!)}
                className="underline hover:text-purple-900"
              >
                → Jump to Runoff Poll #{poll.childRunoffPollId}
              </button>
            </div>
          )}

          {/* Expandable Team-by-Team Breakdown */}
          <div className="border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setShowBreakdown((v) => !v)}
              className="flex items-center justify-between w-full text-xs font-black uppercase tracking-wider text-slate-600 hover:text-slate-900"
            >
              <span className="inline-flex items-center gap-2">
                <Users size={14} />
                Team-by-Team Breakdown ({poll.votesCast} voted · {poll.nonVotedTeams.length} did not vote)
              </span>
              {showBreakdown ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>

            {showBreakdown && (
              <div className="mt-3 space-y-3 text-xs">
                {sortedResultOptions.map((opt) => (
                  <div key={opt.id} className="rounded-2xl border border-slate-200 p-3.5 bg-slate-50/50">
                    <p className="font-black text-slate-800 mb-2">
                      {opt.label} ({opt.voters.length})
                    </p>
                    {opt.voters.length === 0 ? (
                      <p className="text-slate-400 italic">No votes for this choice.</p>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {opt.voters.map((v) => (
                          <span
                            key={v.teamId}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-slate-200 font-semibold text-slate-700"
                          >
                            {v.teamName}
                            {v.teamshort ? ` (${v.teamshort})` : ''}
                            {v.isProxy && (
                              <span className="text-[9px] font-black uppercase text-amber-700">Proxy</span>
                            )}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {poll.nonVotedTeams.length > 0 && (
                  <div className="rounded-2xl border border-slate-200 p-3.5 bg-white">
                    <p className="font-black text-slate-600 mb-2">
                      Did Not Vote ({poll.nonVotedTeams.length})
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {poll.nonVotedTeams.map((t) => (
                        <span
                          key={t.id}
                          className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 font-semibold"
                        >
                          {t.name} {t.teamshort ? `(${t.teamshort})` : ''}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Commissioner Actions Bar */}
      {viewer.canManage && (
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          {poll.isVotingOpen && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => onOpenProxyVote(poll)}
              >
                <UserCheck size={14} /> Proxy Vote
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy || poll.nonVotedTeams.length === 0}
                onClick={() => onRemind(poll)}
              >
                <Bell size={14} />
                {busyAction === `${poll.id}:remind` ? 'Sending...' : 'Remind Non-Voters'}
              </Button>
              <Button
                type="button"
                variant="default"
                size="sm"
                disabled={isBusy}
                onClick={() => onFinalize(poll)}
              >
                {busyAction === `${poll.id}:close` ? 'Finalizing...' : 'Close & Finalize'}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => onOpenEdit(poll)}
              >
                <Edit3 size={14} /> Edit
              </Button>
            </>
          )}

          {poll.isExpiredPendingFinalization && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={() => onFinalize(poll)}
            >
              {busyAction === `${poll.id}:close` ? 'Finalizing...' : 'Finalize & Announce Results'}
            </Button>
          )}

          {poll.status === 'runoff_needed' && poll.childRunoffPollId == null && (
            <Button
              type="button"
              variant="default"
              size="sm"
              disabled={isBusy}
              onClick={() => onOpenRunoff(poll)}
            >
              <GitBranch size={14} /> Launch Top-2 Runoff (E11)
            </Button>
          )}

          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isBusy}
            onClick={() => onDelete(poll)}
            className="ml-auto"
          >
            <Trash2 size={14} />
            {busyAction === `${poll.id}:delete` ? 'Deleting...' : 'Delete'}
          </Button>
        </div>
      )}
    </article>
  );
}
