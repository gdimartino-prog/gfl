import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { notifyPollReminder } from '@/lib/notify';
import { getActorIdentity, requirePollMutationAccess, toPollErrorResponse } from '@/lib/polls';
import {
  PollHttpError,
  REMINDER_COOLDOWN_MS,
  isPollVotingOpen,
  parsePositiveInt,
} from '@/lib/pollRules';
import { pollVotes, polls, teams } from '@/schema';
import type { PollStatus } from '@/types';

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

    const reminder = await db.transaction(async (tx) => {
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
      if (!isPollVotingOpen(poll.status as PollStatus, poll.closesAt, now)) {
        throw new PollHttpError(409, 'Poll voting window is closed');
      }

      if (poll.lastReminderAt) {
        const elapsed = now.getTime() - new Date(poll.lastReminderAt).getTime();
        if (elapsed < REMINDER_COOLDOWN_MS) {
          const remainingMs = REMINDER_COOLDOWN_MS - elapsed;
          const hoursLeft = Math.floor(remainingMs / 3_600_000);
          const minsLeft = Math.ceil((remainingMs % 3_600_000) / 60_000);
          const waitText = hoursLeft > 0 ? `${hoursLeft}h ${minsLeft}m` : `${minsLeft}m`;
          throw new PollHttpError(
            429,
            `Reminder already sent recently — wait ${waitText} before sending another`,
          );
        }
      }

      const [activeTeamRows, voteRows] = await Promise.all([
        tx
          .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
          .from(teams)
          .where(and(eq(teams.leagueId, leagueId), eq(teams.status, 'active')))
          .orderBy(asc(teams.name)),
        tx
          .select({ teamId: pollVotes.teamId })
          .from(pollVotes)
          .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.leagueId, leagueId))),
      ]);

      const votedIds = new Set(voteRows.map((v) => v.teamId));
      const nonVotedTeams = activeTeamRows
        .filter((t) => !votedIds.has(t.id))
        .map((t) => (t.teamshort ? `${t.name} (${t.teamshort})` : t.name));

      if (nonVotedTeams.length === 0) {
        throw new PollHttpError(400, 'All active teams have already voted');
      }

      await tx
        .update(polls)
        .set({ lastReminderAt: now, touch_dt: now, touch_id: touchId })
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)));

      return {
        poll,
        votesCast: voteRows.length,
        eligibleTeamCount: activeTeamRows.length,
        nonVotedTeams,
      };
    });

    revalidateTag('polls', { expire: 0 });

    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_REMINDER_SENT',
      `Sent non-voter reminder for poll #${reminder.poll.id}: "${reminder.poll.title}" (${reminder.nonVotedTeams.length} pending)`,
      leagueId,
    );

    await notifyPollReminder({
      title: reminder.poll.title,
      closesAt: new Date(reminder.poll.closesAt),
      votesCast: reminder.votesCast,
      eligibleTeamCount: reminder.eligibleTeamCount,
      nonVotedTeams: reminder.nonVotedTeams,
      leagueId,
    }).catch((e) => console.error('[polls remind POST] notify failed:', e));

    return NextResponse.json({
      message: `Reminder logged${leagueId === 1 ? ' and sent' : ''} for ${reminder.nonVotedTeams.length} non-voting team(s)`,
    });
  } catch (error) {
    return toPollErrorResponse(error, 'polls remind POST', 'Failed to send poll reminder');
  }
}
