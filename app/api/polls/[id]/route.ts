import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { getActorIdentity, requirePollMutationAccess, toPollErrorResponse } from '@/lib/polls';
import {
  PollHttpError,
  parseEffectiveSeason,
  parseFutureDate,
  parsePositiveInt,
  validatePollOptionsList,
} from '@/lib/pollRules';
import { pollOptions, pollVotes, polls } from '@/schema';

export async function PATCH(
  req: NextRequest,
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
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const now = new Date();
    const { actorName, actorTeam, touchId } = getActorIdentity(session);

    const updatedTitle = await db.transaction(async (tx) => {
      const existingRows = await tx
        .select()
        .from(polls)
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)))
        .for('update')
        .limit(1);

      const existing = existingRows[0];
      if (!existing) {
        throw new PollHttpError(404, 'Poll not found');
      }
      if (existing.status !== 'open') {
        throw new PollHttpError(409, 'Finalized polls cannot be edited');
      }

      const updates: {
        title?: string;
        description?: string | null;
        closesAt?: Date;
        effectiveSeason?: number | null;
        constitutionRef?: string | null;
        touch_dt: Date;
        touch_id: string;
      } = {
        touch_dt: now,
        touch_id: touchId,
      };

      if (body.title !== undefined) {
        const trimmed = typeof body.title === 'string' ? body.title.trim() : '';
        if (!trimmed || trimmed.length > 200) {
          throw new PollHttpError(400, 'Title is required (max 200 characters)');
        }
        updates.title = trimmed;
      }

      if (body.description !== undefined) {
        if (body.description === null) {
          updates.description = null;
        } else if (typeof body.description === 'string' && body.description.trim().length <= 2000) {
          updates.description = body.description.trim() || null;
        } else {
          throw new PollHttpError(400, 'Description must be 2000 characters or fewer');
        }
      }

      if (body.closesAt !== undefined) {
        const dateCheck = parseFutureDate(body.closesAt, now);
        if (!dateCheck.ok) {
          throw new PollHttpError(400, dateCheck.error);
        }
        updates.closesAt = dateCheck.date;
      }

      if (body.effectiveSeason !== undefined) {
        const seasonCheck = parseEffectiveSeason(body.effectiveSeason);
        if (!seasonCheck.ok) {
          throw new PollHttpError(400, seasonCheck.error);
        }
        updates.effectiveSeason = seasonCheck.value;
      }

      if (body.constitutionRef !== undefined) {
        if (body.constitutionRef === null) {
          updates.constitutionRef = null;
        } else if (typeof body.constitutionRef === 'string' && body.constitutionRef.trim().length <= 100) {
          updates.constitutionRef = body.constitutionRef.trim() || null;
        } else {
          throw new PollHttpError(400, 'Constitution reference must be 100 characters or fewer');
        }
      }

      if (body.options !== undefined) {
        const optCheck = validatePollOptionsList(body.options);
        if (!optCheck.ok) {
          throw new PollHttpError(400, optCheck.error);
        }
        const voteRows = await tx
          .select({ count: sql<number>`count(*)::int` })
          .from(pollVotes)
          .where(and(eq(pollVotes.pollId, pollId), eq(pollVotes.leagueId, leagueId)));
        const voteCount = voteRows[0]?.count ?? 0;
        if (voteCount > 0) {
          throw new PollHttpError(409, 'Cannot modify poll choices after votes have been cast');
        }

        await tx
          .delete(pollOptions)
          .where(and(eq(pollOptions.pollId, pollId), eq(pollOptions.leagueId, leagueId)));

        await tx.insert(pollOptions).values(
          optCheck.options.map((label, idx) => ({
            leagueId,
            pollId,
            label,
            sortOrder: idx,
            touch_dt: now,
            touch_id: touchId,
          })),
        );
      }

      await tx
        .update(polls)
        .set(updates)
        .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)));

      return updates.title ?? existing.title;
    });

    revalidateTag('polls', { expire: 0 });

    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_UPDATED',
      `Updated poll #${pollId}: "${updatedTitle}"`,
      leagueId,
    );

    return NextResponse.json({ message: 'Poll updated' });
  } catch (error) {
    return toPollErrorResponse(error, 'polls PATCH', 'Failed to update poll');
  }
}

export async function DELETE(
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
    const deleted = await db
      .delete(polls)
      .where(and(eq(polls.id, pollId), eq(polls.leagueId, leagueId)))
      .returning({ id: polls.id, title: polls.title });

    if (!deleted[0]) {
      return NextResponse.json({ message: 'Poll not found' }, { status: 404 });
    }

    revalidateTag('polls', { expire: 0 });

    const { actorName, actorTeam } = getActorIdentity(session);
    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_DELETED',
      `Deleted poll #${deleted[0].id}: "${deleted[0].title}"`,
      leagueId,
    );

    return NextResponse.json({ message: 'Poll deleted' });
  } catch (error) {
    return toPollErrorResponse(error, 'polls DELETE', 'Failed to delete poll');
  }
}
