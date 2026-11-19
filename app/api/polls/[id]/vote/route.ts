import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { isPrivileged } from '@/lib/auth';
import { logSystemEvent } from '@/lib/db-helpers';
import {
  getActorIdentity,
  requirePollMutationAccess,
  resolveCallerTeam,
  toPollErrorResponse,
} from '@/lib/polls';
import { PollHttpError, isPollVotingOpen, parsePositiveInt } from '@/lib/pollRules';
import { pollOptions, pollVotes, polls, teams } from '@/schema';
import type { PollStatus } from '@/types';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requirePollMutationAccess(false);
  if (!access.ok) return access.response;
  const { session, leagueId } = access;

  const { id } = await params;
  const pollId = parsePositiveInt(id);
  if (!pollId) {
    return NextResponse.json({ message: 'Invalid poll id' }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    const optionId = parsePositiveInt(body?.optionId);
    if (!optionId) {
      return NextResponse.json({ message: 'Valid optionId is required' }, { status: 400 });
    }

    const callerTeam = await resolveCallerTeam(session, leagueId);
    let targetTeamId: number;
    let isProxy = false;

    const rawTargetTeamId = body?.targetTeamId;
    if (rawTargetTeamId !== undefined && rawTargetTeamId !== null && rawTargetTeamId !== '') {
      const parsedTarget = parsePositiveInt(rawTargetTeamId);
      if (!parsedTarget) {
        return NextResponse.json({ message: 'Invalid targetTeamId' }, { status: 400 });
      }
      if (!callerTeam || parsedTarget !== callerTeam.id) {
        if (!(await isPrivileged())) {
          return NextResponse.json({ message: 'Commissioner only for proxy votes' }, { status: 403 });
        }
        isProxy = true;
      }
      targetTeamId = parsedTarget;
    } else {
      if (!callerTeam) {
        return NextResponse.json(
          { message: 'No active team found in this league — use Proxy Vote to record a team ballot' },
          { status: 403 },
        );
      }
      targetTeamId = callerTeam.id;
    }

    const now = new Date();
    const { actorName, touchId } = getActorIdentity(session);

    const outcome = await db.transaction(async (tx) => {
      const pollRows = await tx
        .select({
          id: polls.id,
          title: polls.title,
          status: polls.status,
          closesAt: polls.closesAt,
        })
        .from(polls)
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)))
        .for('update')
        .limit(1);

      const poll = pollRows[0];
      if (!poll) {
        throw new PollHttpError(404, 'Poll not found');
      }
      if (!isPollVotingOpen(poll.status as PollStatus, poll.closesAt, now)) {
        throw new PollHttpError(409, 'Poll voting window has closed');
      }

      const [optionRows, teamRows, existingVoteRows] = await Promise.all([
        tx
          .select({ id: pollOptions.id })
          .from(pollOptions)
          .where(
            and(
              eq(pollOptions.id, optionId),
              eq(pollOptions.pollId, pollId),
              eq(pollOptions.leagueId, leagueId),
            ),
          )
          .limit(1),
        tx
          .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
          .from(teams)
          .where(
            and(
              eq(teams.id, targetTeamId),
              eq(teams.leagueId, leagueId),
              eq(teams.status, 'active'),
            ),
          )
          .limit(1),
        tx
          .select({ id: pollVotes.id })
          .from(pollVotes)
          .where(
            and(
              eq(pollVotes.pollId, pollId),
              eq(pollVotes.teamId, targetTeamId),
              eq(pollVotes.leagueId, leagueId),
            ),
          )
          .limit(1),
      ]);

      if (!optionRows[0]) {
        throw new PollHttpError(400, 'Selected option does not belong to this poll');
      }
      const targetTeam = teamRows[0];
      if (!targetTeam) {
        throw new PollHttpError(400, 'Selected team is not active in this league');
      }

      const hadPriorVote = Boolean(existingVoteRows[0]);

      await tx
        .insert(pollVotes)
        .values({
          leagueId,
          pollId,
          optionId,
          teamId: targetTeamId,
          castBy: actorName,
          isProxy,
          votedAt: now,
          touch_dt: now,
          touch_id: touchId,
        })
        .onConflictDoUpdate({
          target: [pollVotes.pollId, pollVotes.teamId],
          set: {
            optionId,
            castBy: actorName,
            isProxy,
            votedAt: now,
            touch_dt: now,
            touch_id: touchId,
          },
        });

      return { poll, targetTeam, hadPriorVote };
    });

    revalidateTag('polls', { expire: 0 });

    // Audit action omits option label to protect open-ballot secrecy
    const action = isProxy
      ? 'POLL_PROXY_VOTE'
      : outcome.hadPriorVote
        ? 'POLL_VOTE_UPDATED'
        : 'POLL_VOTE_CAST';
    await logSystemEvent(
      actorName,
      outcome.targetTeam.teamshort || outcome.targetTeam.name,
      action,
      `Poll #${outcome.poll.id}: "${outcome.poll.title}" — ballot recorded${isProxy ? ' (Commissioner proxy)' : ''}`,
      leagueId,
    );

    return NextResponse.json({
      message: isProxy
        ? `Proxy vote recorded for ${outcome.targetTeam.name}`
        : outcome.hadPriorVote
          ? 'Vote updated'
          : 'Vote cast',
    });
  } catch (error) {
    return toPollErrorResponse(error, 'polls vote POST', 'Failed to record vote');
  }
}
