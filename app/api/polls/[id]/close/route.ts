import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { notifyPollFinalized } from '@/lib/notify';
import { getActorIdentity, requirePollMutationAccess, toPollErrorResponse } from '@/lib/polls';
import { PollHttpError, evaluatePollOutcome, parsePositiveInt } from '@/lib/pollRules';
import { pollOptions, pollVotes, polls, teams } from '@/schema';
import type { PollType } from '@/types';

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requirePollMutationAccess(true);
  if (!access.ok) return access.response;
  const { session, leagueId } = access;

  const { id } = await params;
  const pollId = parsePositiveInt(id);
  if (!pollId) {
    return NextResponse.json({ message: 'Invalid poll id' }, { status: 400 });
  }

  try {
    const now = new Date();
    const { actorName, actorTeam, touchId } = getActorIdentity(session);

    const finalized = await db.transaction(async (tx) => {
      const pollRows = await tx
        .select()
        .from(polls)
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)))
        .for('update')
        .limit(1);

      const poll = pollRows[0];
      if (!poll) {
        throw new PollHttpError(404, 'Poll not found');
      }
      if (poll.status !== 'open') {
        throw new PollHttpError(409, 'Poll is already finalized');
      }

      const [activeTeamRows, optionRows, voteRows] = await Promise.all([
        tx
          .select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.leagueId, leagueId), eq(teams.status, 'active'))),
        tx
          .select({
            id: pollOptions.id,
            label: pollOptions.label,
            sortOrder: pollOptions.sortOrder,
          })
          .from(pollOptions)
          .where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.leagueId, leagueId)))
          .orderBy(asc(pollOptions.sortOrder), asc(pollOptions.id)),
        tx
          .select({ optionId: pollVotes.optionId })
          .from(pollVotes)
          .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.leagueId, leagueId))),
      ]);

      const eligibleTeamCount = activeTeamRows.length;
      const voteCounts = new Map<number, number>();
      for (const v of voteRows) {
        voteCounts.set(v.optionId, (voteCounts.get(v.optionId) ?? 0) + 1);
      }

      const pollType: PollType = poll.pollType === 'general' ? 'general' : 'rule_change';
      const outcome = evaluatePollOutcome({
        pollType,
        options: optionRows.map((o) => ({ id: o.id, sortOrder: o.sortOrder })),
        voteCounts,
        eligibleTeamCount,
      });

      await tx
        .update(polls)
        .set({
          status: outcome.status,
          winnerOptionId: outcome.winnerOptionId,
          eligibleTeamCount,
          closedAt: now,
          touch_dt: now,
          touch_id: touchId,
        })
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)));

      const winnerOption = optionRows.find((o) => o.id === outcome.winnerOptionId);
      const optionTallies = optionRows.map((o) => {
        const count = voteCounts.get(o.id) ?? 0;
        const pct = outcome.totalVotes > 0 ? Math.round((count / outcome.totalVotes) * 1000) / 10 : 0;
        return { label: o.label, count, pct };
      });

      return {
        poll,
        pollType,
        outcome,
        eligibleTeamCount,
        winnerLabel: winnerOption?.label ?? null,
        optionTallies,
      };
    });

    revalidateTag('polls', { expire: 0 });

    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_FINALIZED',
      `Finalized poll #${finalized.poll.id}: "${finalized.poll.title}" → ${finalized.outcome.status} (${finalized.outcome.totalVotes}/${finalized.eligibleTeamCount} votes${finalized.winnerLabel ? `, winner: "${finalized.winnerLabel}"` : ''})`,
      leagueId,
    );

    await notifyPollFinalized({
      title: finalized.poll.title,
      pollType: finalized.pollType,
      status: finalized.outcome.status,
      winnerLabel: finalized.winnerLabel,
      votesCast: finalized.outcome.totalVotes,
      eligibleTeamCount: finalized.eligibleTeamCount,
      optionTallies: finalized.optionTallies,
      leagueId,
    }).catch((e) => console.error('[polls close POST] notify failed:', e));

    return NextResponse.json({
      message: 'Poll finalized',
      status: finalized.outcome.status,
      winnerOptionId: finalized.outcome.winnerOptionId,
    });
  } catch (error) {
    return toPollErrorResponse(error, 'polls close POST', 'Failed to close poll');
  }
}
