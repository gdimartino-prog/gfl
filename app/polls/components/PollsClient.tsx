'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  Vote,
  Plus,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Lock,
  AlertCircle,
  CheckCircle2,
  Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/components/ConfirmDialog';
import PollCard from './PollCard';
import CreateEditPollModal from './CreateEditPollModal';
import RunoffModal from './RunoffModal';
import ProxyVoteModal from './ProxyVoteModal';
import type { PollItem, PollsPayload } from '@/types';

interface PollsClientProps {
  initialData: PollsPayload;
}

type PollsTab = 'open' | 'archive' | 'enacted';

function formatShortDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function PollsClient({ initialData }: PollsClientProps) {
  const [data, setData] = useState<PollsPayload>(initialData);
  const [activeTab, setActiveTab] = useState<PollsTab>('open');
  const [showRulesGuide, setShowRulesGuide] = useState(false);
  const [banner, setBanner] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const [createEditModal, setCreateEditModal] = useState<
    { mode: 'create' } | { mode: 'edit'; poll: PollItem } | null
  >(null);
  const [runoffPoll, setRunoffPoll] = useState<PollItem | null>(null);
  const [proxyPoll, setProxyPoll] = useState<PollItem | null>(null);

  const [confirm, ConfirmDialog] = useConfirm();

  const loadData = useCallback(async (fresh = false) => {
    const res = await fetch('/api/polls', fresh ? { cache: 'no-store' } : undefined);
    if (!res.ok) {
      throw new Error('Failed to refresh polls');
    }
    const next = (await res.json()) as PollsPayload;
    setData(next);
  }, []);

  // Open Polls tab: actively open polls + expired polls awaiting finalization (expired first)
  const openPolls = useMemo(() => {
    return data.polls
      .filter((p) => p.status === 'open')
      .sort((a, b) => {
        if (a.isExpiredPendingFinalization !== b.isExpiredPendingFinalization) {
          return a.isExpiredPendingFinalization ? -1 : 1;
        }
        return new Date(a.closesAt).getTime() - new Date(b.closesAt).getTime();
      });
  }, [data.polls]);

  const archivePolls = useMemo(
    () => data.polls.filter((p) => p.status !== 'open'),
    [data.polls],
  );

  const enactedDecisions = useMemo(
    () =>
      data.polls.filter(
        (p) => p.pollType === 'rule_change' && p.status === 'closed' && p.winnerOptionId != null,
      ),
    [data.polls],
  );

  const handleCastVote = async (pollId: number, optionId: number): Promise<boolean> => {
    setBanner(null);
    setBusyAction(`${pollId}:vote`);
    try {
      const res = await fetch(`/api/polls/${pollId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setBanner({ type: 'error', text: json.message || 'Failed to record vote.' });
        return false;
      }
      await loadData(true);
      setBanner({ type: 'success', text: json.message || 'Ballot recorded.' });
      return true;
    } catch {
      setBanner({ type: 'error', text: 'Network error while casting vote.' });
      return false;
    } finally {
      setBusyAction(null);
    }
  };

  const handleRemind = async (poll: PollItem) => {
    setBanner(null);
    setBusyAction(`${poll.id}:remind`);
    try {
      const res = await fetch(`/api/polls/${poll.id}/remind`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setBanner({ type: 'error', text: json.message || 'Failed to send reminder.' });
        return;
      }
      await loadData(true);
      setBanner({ type: 'success', text: json.message || 'Reminder sent to non-voters.' });
    } catch {
      setBanner({ type: 'error', text: 'Network error while sending reminder.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleFinalize = async (poll: PollItem) => {
    const promptMsg = poll.isVotingOpen
      ? `Close voting early and finalize official results for "${poll.title}"?`
      : `Finalize official results for "${poll.title}" and publish results?`;
    const ok = await confirm(promptMsg, {
      title: 'Finalize Poll',
      confirmLabel: 'Finalize Results',
    });
    if (!ok) return;

    setBanner(null);
    setBusyAction(`${poll.id}:close`);
    try {
      const res = await fetch(`/api/polls/${poll.id}/close`, { method: 'POST' });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setBanner({ type: 'error', text: json.message || 'Failed to finalize poll.' });
        return;
      }
      await loadData(true);
      setBanner({ type: 'success', text: 'Poll finalized and recorded.' });
      setActiveTab('archive');
    } catch {
      setBanner({ type: 'error', text: 'Network error while finalizing poll.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleDelete = async (poll: PollItem) => {
    const ok = await confirm(
      `Permanently delete poll "${poll.title}" and all ${poll.votesCast} vote(s)?`,
      {
        title: 'Delete Poll',
        confirmLabel: 'Delete Poll',
        destructive: true,
      },
    );
    if (!ok) return;

    setBanner(null);
    setBusyAction(`${poll.id}:delete`);
    try {
      const res = await fetch(`/api/polls/${poll.id}`, { method: 'DELETE' });
      const json = (await res.json().catch(() => ({}))) as { message?: string };
      if (!res.ok) {
        setBanner({ type: 'error', text: json.message || 'Failed to delete poll.' });
        return;
      }
      await loadData(true);
      setBanner({ type: 'success', text: 'Poll deleted.' });
    } catch {
      setBanner({ type: 'error', text: 'Network error while deleting poll.' });
    } finally {
      setBusyAction(null);
    }
  };

  const handleJumpToPoll = useCallback(
    (pollId: number) => {
      const target = data.polls.find((p) => p.id === pollId);
      if (!target) return;
      setActiveTab(target.status === 'open' ? 'open' : 'archive');
      requestAnimationFrame(() => {
        document.getElementById(`poll-${pollId}`)?.scrollIntoView({
          behavior: 'smooth',
          block: 'center',
        });
      });
    },
    [data.polls],
  );

  const visiblePolls = activeTab === 'open' ? openPolls : archivePolls;

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen text-slate-900 text-left">
      <ConfirmDialog />

      {createEditModal && (
        <CreateEditPollModal
          key={createEditModal.mode === 'edit' ? `edit-${createEditModal.poll.id}` : 'create'}
          mode={createEditModal.mode}
          poll={createEditModal.mode === 'edit' ? createEditModal.poll : undefined}
          currentSeason={data.currentSeason}
          enactedDecisions={enactedDecisions}
          onClose={() => setCreateEditModal(null)}
          onSaved={async () => {
            await loadData(true);
            if (createEditModal.mode === 'create') {
              setActiveTab('open');
            }
            setBanner({
              type: 'success',
              text:
                createEditModal.mode === 'create'
                  ? 'Poll posted and opened for voting.'
                  : 'Poll updated.',
            });
          }}
        />
      )}

      {runoffPoll && (
        <RunoffModal
          key={`runoff-${runoffPoll.id}`}
          parentPoll={runoffPoll}
          onClose={() => setRunoffPoll(null)}
          onCreated={async () => {
            await loadData(true);
            setActiveTab('open');
            setBanner({ type: 'success', text: 'Runoff ballot posted and opened for voting.' });
          }}
        />
      )}

      {proxyPoll && (
        <ProxyVoteModal
          key={`proxy-${proxyPoll.id}`}
          poll={proxyPoll}
          activeTeams={data.activeTeams}
          onClose={() => setProxyPoll(null)}
          onVoted={async () => {
            await loadData(true);
            setBanner({ type: 'success', text: 'Proxy ballot recorded.' });
          }}
        />
      )}

      {/* Header */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
        <div>
          <h1 className="text-5xl md:text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            League <span className="text-indigo-600">Polls</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
            <Vote size={14} className="text-indigo-500" />
            Official Voting & Rule Governance
            {data.currentSeason ? ` • Season ${data.currentSeason}` : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowRulesGuide((v) => !v)}
          >
            <BookOpen size={15} />
            Rules E9–E13
            {showRulesGuide ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </Button>

          {data.viewer.canManage && (
            <Button type="button" onClick={() => setCreateEditModal({ mode: 'create' })}>
              <Plus size={16} /> Create Poll
            </Button>
          )}
        </div>
      </header>

      {/* Demo Read-Only Banner */}
      {data.viewer.isDemo && (
        <div className="p-4 rounded-2xl bg-slate-900 text-white text-xs font-bold flex items-center gap-3 shadow-sm">
          <Eye size={18} className="text-blue-400 shrink-0" />
          <span>
            Demo League Mode (Read-Only): You can inspect open ballots, participation roll call, and archived results, but voting and poll management are disabled.
          </span>
        </div>
      )}

      {/* Constitution Rules Quick Reference */}
      {showRulesGuide && (
        <section className="bg-white rounded-3xl border border-indigo-100 shadow-sm p-6 text-xs space-y-2 text-slate-700">
          <h2 className="text-sm font-black uppercase tracking-wider text-indigo-700 mb-2">
            Constitution Governance Rules (E9–E13)
          </h2>
          <p><strong>E9 · Posting Polls:</strong> Only the Commissioner may post official league polls; coaches request polls from the Commissioner.</p>
          <p><strong>E10 · One-Season Rule Lock:</strong> Enacted vote results remain effective for at least one completed season before re-voting on the same issue.</p>
          <p><strong>E11 · Majority & Runoffs:</strong> Polls with more than 2 choices require 50% + 1 vote to win; otherwise the top 2 choices advance to a runoff vote.</p>
          <p><strong>E12 · Two-Week Window:</strong> Online rule change proposals have a 14-day voting window, with Commissioner follow-up for coaches who have not voted.</p>
          <p><strong>E13 · 50% Quorum:</strong> At least half of active league teams must vote for a result to be official; otherwise the poll is null and status quo remains.</p>
        </section>
      )}

      {/* Status Banner */}
      {banner && (
        <div
          className={`p-4 rounded-2xl border text-xs font-bold flex items-center justify-between gap-3 ${
            banner.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-emerald-50 border-emerald-200 text-emerald-800'
          }`}
        >
          <span className="flex items-center gap-2">
            {banner.type === 'error' ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            {banner.text}
          </span>
          <button
            type="button"
            onClick={() => setBanner(null)}
            className="text-[10px] font-black uppercase tracking-wider underline"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {(
          [
            { id: 'open', label: 'Open Polls', count: openPolls.length },
            { id: 'archive', label: 'Closed & Archive', count: archivePolls.length },
            { id: 'enacted', label: 'Enacted Decisions (E10)', count: enactedDecisions.length },
          ] as const
        ).map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-full text-xs font-black uppercase tracking-wider transition-all flex items-center gap-2 ${
                active
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] ${
                  active ? 'bg-indigo-500 text-white' : 'bg-slate-100 text-slate-700'
                }`}
              >
                {tab.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === 'enacted' ? (
        <div className="bg-white rounded-[2rem] shadow-md border border-slate-100 overflow-hidden">
          {enactedDecisions.length === 0 ? (
            <div className="p-16 text-center text-slate-400 font-black uppercase italic text-sm tracking-widest">
              No enacted rule decisions recorded yet
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-[0.15em]">
                    <th className="px-6 py-4">Proposal</th>
                    <th className="px-6 py-4">Adopted Decision</th>
                    <th className="px-6 py-4">Ref</th>
                    <th className="px-6 py-4">Season</th>
                    <th className="px-6 py-4">Tally</th>
                    <th className="px-6 py-4">E10 Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {enactedDecisions.map((poll) => {
                    const winner = poll.options.find((o) => o.id === poll.winnerOptionId);
                    return (
                      <tr key={poll.id} className="hover:bg-slate-50/70">
                        <td className="px-6 py-4">
                          <p className="font-black text-slate-900">{poll.title}</p>
                          <p className="text-[11px] text-slate-500">
                            Closed {formatShortDate(poll.closedAt ?? poll.closesAt)}
                          </p>
                        </td>
                        <td className="px-6 py-4 font-bold text-emerald-700">
                          {winner?.label ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {poll.constitutionRef || '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-700">
                          {poll.effectiveSeason ?? '—'}
                        </td>
                        <td className="px-6 py-4 text-xs font-bold text-slate-600">
                          {winner ? `${winner.voteCount ?? 0} (${winner.percentage ?? 0}%)` : '—'}
                          <span className="block text-[10px] text-slate-400">
                            {poll.votesCast}/{poll.eligibleTeamCount} voted
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          {poll.e10Locked ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black uppercase">
                              <Lock size={11} /> E10 Locked
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black uppercase">
                              Season Completed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : visiblePolls.length === 0 ? (
        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-16 text-center space-y-3">
          <p className="font-black uppercase italic text-slate-400 text-sm tracking-widest">
            {activeTab === 'open' ? 'No open polls at this time' : 'No closed polls in archive yet'}
          </p>
          {activeTab === 'open' && !data.viewer.canManage && (
            <p className="text-xs text-slate-500">
              Per Constitution E9, coaches can ask the Commissioner to post a new league poll.
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {visiblePolls.map((poll) => (
            <PollCard
              key={poll.id}
              poll={poll}
              viewer={data.viewer}
              busyAction={busyAction}
              onCastVote={handleCastVote}
              onOpenProxyVote={(p) => setProxyPoll(p)}
              onRemind={handleRemind}
              onFinalize={handleFinalize}
              onOpenEdit={(p) => setCreateEditModal({ mode: 'edit', poll: p })}
              onDelete={handleDelete}
              onOpenRunoff={(p) => setRunoffPoll(p)}
              onJumpToPoll={handleJumpToPoll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
