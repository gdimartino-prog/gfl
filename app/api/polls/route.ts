import { NextRequest, NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { logSystemEvent } from '@/lib/db-helpers';
import { getLeagueId } from '@/lib/getLeagueId';
import { notifyPollOpened } from '@/lib/notify';
import { getActorIdentity, getPollsForViewer, requirePollMutationAccess, toPollErrorResponse } from '@/lib/polls';
import {
  defaultRuleChangeClosesAt,
  parseEffectiveSeason,
  parseFutureDate,
  validatePollOptionsList,
} from '@/lib/pollRules';
import { pollOptions, polls } from '@/schema';
import type { PollType } from '@/types';

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }
  try {
    const leagueId = await getLeagueId();
    const payload = await getPollsForViewer(session, leagueId);
    return NextResponse.json(payload, {
      headers: { 'Cache-Control': 'private, max-age=15' },
    });
  } catch (error) {
    return toPollErrorResponse(error, 'polls GET', 'Failed to load league polls');
  }
}

export async function POST(req: NextRequest) {
  const access = await requirePollMutationAccess(true);
  if (!access.ok) return access.response;
  const { session, leagueId } = access;

  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const rawTitle = typeof body.title === 'string' ? body.title.trim() : '';
    if (!rawTitle || rawTitle.length > 200) {
      return NextResponse.json({ message: 'Title is required (max 200 characters)' }, { status: 400 });
    }

    let description: string | null = null;
    if (body.description !== undefined && body.description !== null) {
      if (typeof body.description !== 'string' || body.description.trim().length > 2000) {
        return NextResponse.json({ message: 'Description must be 2000 characters or fewer' }, { status: 400 });
      }
      description = body.description.trim() || null;
    }

    const rawType = body.pollType ?? 'rule_change';
    if (rawType !== 'rule_change' && rawType !== 'general') {
      return NextResponse.json({ message: 'pollType must be rule_change or general' }, { status: 400 });
    }
    const pollType: PollType = rawType;

    const optionsCheck = validatePollOptionsList(body.options);
    if (!optionsCheck.ok) {
      return NextResponse.json({ message: optionsCheck.error }, { status: 400 });
    }

    const now = new Date();
    let closesAt: Date;
    if (body.closesAt === undefined || body.closesAt === null || body.closesAt === '') {
      if (pollType !== 'rule_change') {
        return NextResponse.json({ message: 'Close date/time is required for general polls' }, { status: 400 });
      }
      closesAt = defaultRuleChangeClosesAt(now);
    } else {
      const dateCheck = parseFutureDate(body.closesAt, now);
      if (!dateCheck.ok) {
        return NextResponse.json({ message: dateCheck.error }, { status: 400 });
      }
      closesAt = dateCheck.date;
    }

    const seasonCheck = parseEffectiveSeason(body.effectiveSeason);
    if (!seasonCheck.ok) {
      return NextResponse.json({ message: seasonCheck.error }, { status: 400 });
    }

    let constitutionRef: string | null = null;
    if (body.constitutionRef !== undefined && body.constitutionRef !== null) {
      if (typeof body.constitutionRef !== 'string' || body.constitutionRef.trim().length > 100) {
        return NextResponse.json({ message: 'Constitution reference must be 100 characters or fewer' }, { status: 400 });
      }
      constitutionRef = body.constitutionRef.trim() || null;
    }

    const { actorName, actorTeam, touchId } = getActorIdentity(session);

    const created = await db.transaction(async (tx) => {
      const [inserted] = await tx
        .insert(polls)
        .values({
          leagueId,
          title: rawTitle,
          description,
          pollType,
          status: 'open',
          effectiveSeason: seasonCheck.value,
          constitutionRef,
          closesAt,
          createdAt: now,
          createdBy: actorName,
          touch_dt: now,
          touch_id: touchId,
        })
        .returning({ id: polls.id, title: polls.title, description: polls.description });

      await tx.insert(pollOptions).values(
        optionsCheck.options.map((label, idx) => ({
          leagueId,
          pollId: inserted.id,
          label,
          sortOrder: idx,
          touch_dt: now,
          touch_id: touchId,
        })),
      );

      return inserted;
    });

    revalidateTag('polls', { expire: 0 });

    await logSystemEvent(
      actorName,
      actorTeam,
      'POLL_CREATED',
      `Poll #${created.id}: "${created.title}" (${pollType}, ${optionsCheck.options.length} options, closes ${closesAt.toISOString()})`,
      leagueId,
    );

    await notifyPollOpened({
      title: created.title,
      description: created.description,
      pollType,
      options: optionsCheck.options,
      closesAt,
      isRunoff: false,
      leagueId,
    }).catch((e) => console.error('[polls POST] notify failed:', e));

    return NextResponse.json({ id: created.id, message: 'Poll created' }, { status: 201 });
  } catch (error) {
    return toPollErrorResponse(error, 'polls POST', 'Failed to create poll');
  }
}
