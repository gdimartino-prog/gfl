import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { and, asc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { notifyPollOpened } from '@/lib/notify';
import { getActorIdentity, requirePollMutationAccess, toPollErrorResponse } from '@/lib/polls';
import {
  PollHttpError,
  defaultRuleChangeClosesAt,
  evaluatePollOutcome,
  parseFutureDate,
  parsePositiveInt,
} from '@/lib/pollRules';
import { pollOptions, pollVotes, polls } from '@/schema';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requirePollMutationAccess(true);
  if (!access.ok) return access.response;
  const { session, leagueId } = access;

  const { id } = await params;
  const parentPollId = parsePositiveInt(id);
  if (!parentPollId) {
    return NextResponse.json({ message: 'Invalid poll id' }, { status: 400 });
  }

  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
    const now = new Date();
    const { actorName, actorTeam, touchId } = getActorIdentity(session);

    let closesAt: Date;
    if (body.closesAt === undefined || body.closesAt === null || body.closesAt === '') {
      closesAt = defaultRuleChangeClosesAt(now);
    } else {
      const dateCheck = parseFutureDate(body.closesAt, now);
      if (!dateCheck.ok) {
        return NextResponse.json({ message: dateCheck.error }, { status: 400 });
      }
      closesAt = dateCheck.date;
    }

    const customTitle = typeof body.title === 'string' ? body.title.trim() : '';
    if (customTitle.length > 200) {
      return NextResponse.json({ message: 'Title must be 200 characters or fewer' }, { status: 400 });
    }

    const created = await db.transaction(async (tx) => {
      const parentRows = await tx
        .select()
        .from(polls)
        .where(and(eq(polls.id, parentPollId), eq(polls.leagueId, leagueId)))
        .for('update')
        .limit(1);

      const parent = parentRows[0];
      if (!parent) {
        throw new PollHttpError(404, 'Parent poll not found');
      }
      if (parent.status !== 'runoff_needed') {
        throw new PollHttpError(409, 'Only polls awaiting a runoff can launch a runoff');
      }

      const [existingChild, parentOptions, parentVotes] = await Promise.all([
        tx
          .select({ id: polls.id })
          .from(polls)
          .where(and(eq(polls.parentPollId, parent.id), eq(polls.leagueId, leagueId)))
          .limit(1),
        tx
          .select({
            id: pollOptions.id,
            label: pollOptions.label,
            sortOrder: pollOptions.sortOrder,
          })
          .from(pollOptions)
          .where(and(eq(pollOptions.pollId, parent.id), eq(pollOptions.leagueId, leagueId)))
          .orderBy(asc(pollOptions.sortOrder), asc(pollOptions.id)),
        tx
          .select({ optionId: pollVotes.optionId })
          .from(pollVotes)
          .where(and(eq(pollVotes.pollId, parent.id), eq(pollVotes.leagueId, leagueId))),
      ]);

      if (existingChild[0]) {
        throw new PollHttpError(409, 'A runoff poll has already been created for this vote');
      }

      let selectedOptionIds: number[] = [];
      if (Array.isArray(body.optionIds) && body.optionIds.length > 0) {
        const parsed = body.optionIds.map(parsePositiveInt);
        if (parsed.some((v) => v === null)) {
          throw new PollHttpError(400, 'optionIds must contain valid option IDs');
        }
        selectedOptionIds = Array.from(new Set(parsed.filter((v): v is number => v !== null)));
      } else {
        const voteCounts = new Map<number, number>();
        for (const v of parentVotes) {
          voteCounts.set(v.optionId, (voteCounts.get(v.optionId) ?? 0) + 1);
        }
        const outcome = evaluatePollOutcome({
          pollType: 'rule_change',
          options: parentOptions.map((o) => ({ id: o.id, sortOrder: o.sortOrder })),
          voteCounts,
          eligibleTeamCount: parent.eligibleTeamCount ?? 0,
        });
        if (outcome.hasRunoffTie) {
          throw new PollHttpError(
            400,
            'Tie detected at the runoff cutoff — select exactly 2 choices to advance',
          );
        }
        selectedOptionIds = outcome.suggestedRunoffOptionIds;
      }

      if (selectedOptionIds.length !== 2) {
        throw new PollHttpError(400, 'Exactly 2 choices must advance to a runoff poll (Rule E11)');
      }

      const optionById = new Map(parentOptions.map((o) => [o.id, o]));
      const advancing = selectedOptionIds.map((optId) => optionById.get(optId));
      if (advancing.some((o) => !o)) {
        throw new PollHttpError(400, 'Selected runoff options do not belong to the parent poll');
      }

      const runoffTitle = customTitle || `Runoff: ${parent.title}`.slice(0, 200);
      const labels = advancing.map((o) => o!.label);

      const [child] = await tx
        .insert(polls)
        .values({
          leagueId,
          title: runoffTitle,
          description: parent.description,
          pollType: 'rule_change',
          status: 'open',
          effectiveSeason: parent.effectiveSeason,
          constitutionRef: parent.constitutionRef,
          parentPollId: parent.id,
          closesAt,
          createdAt: now,
          createdBy: actorName,
          touch_dt: now,
          touch_id: touchId,
        })
        .returning({ id: polls.id, title: polls.title, description: polls.description });

      await tx.insert(pollOptions).values(
        labels.map((label, idx) => ({
          leagueId,
          pollId: child.id,
          label,
          sortOrder: idx,
          touch_dt: now,
          touch_id: touchId,
        })),
      );

      return { child, parent, labels };
    });

    revalidateTag('polls', { expire: 0 });

    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_RUNOFF_CREATED',
      `Created runoff poll #${created.child.id} ("${created.child.title}") from parent poll #${created.parent.id}: [${created.labels.join(' vs ')}]`,
      leagueId,
    );

    await notifyPollOpened({
      title: created.child.title,
      description: created.child.description,
      pollType: 'rule_change',
      options: created.labels,
      closesAt,
      isRunoff: true,
      leagueId,
    }).catch((e) => console.error('[polls runoff POST] notify failed:', e));

    return NextResponse.json(
      { id: created.child.id, message: 'Runoff poll created' },
      { status: 201 },
    );
  } catch (error) {
    return toPollErrorResponse(error, 'polls runoff POST', 'Failed to create runoff poll');
  }
}
