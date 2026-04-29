import { NextRequest, NextResponse } from 'next/server';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { rules, pickTransfers, teams, draftPicks } from '@/schema';
import { and, eq, isNull } from 'drizzle-orm';
import { auth } from '@/auth';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';
import { revalidateTag } from 'next/cache';
import {
  getDraftPicksExist,
  hasDraftStarted,
  deleteDraftPicksByYearAndType,
  generateDraftPickRows,
  applyPickTransfers,
  DraftOrderEntry,
} from '@/lib/draftPicks';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });
  }

  const session = await auth();
  const actor = session?.user?.name || 'Commissioner';

  try {
    const body = await req.json();
    const { year, draftType, rounds, order, salaries, confirmed, startAt, hoursPerPick } = body as {
      year: number;
      draftType: string;
      rounds: number;
      order: DraftOrderEntry[];
      salaries?: Record<number, number | string>;
      confirmed?: boolean;
      startAt?: string;
      hoursPerPick?: number;
    };

    if (!year || !draftType || !rounds || !order?.length) {
      return NextResponse.json({ error: 'year, draftType, rounds, and order are required' }, { status: 400 });
    }

    const leagueId = await getLeagueId();

    // Safety check: conflict
    const exists = await getDraftPicksExist(leagueId, year, draftType);
    if (exists && !confirmed) {
      const started = await hasDraftStarted(leagueId, year, draftType);
      return NextResponse.json({ conflict: true, started }, { status: 409 });
    }

    // Delete existing picks if confirmed
    if (exists) {
      await deleteDraftPicksByYearAndType(leagueId, year, draftType, actor);
    }

    // Generate and insert picks
    const rows = generateDraftPickRows({
      leagueId, year, draftType, rounds, order, touchId: actor,
      startAt: startAt ? new Date(startAt) : undefined,
      hoursPerPick: hoursPerPick || undefined,
    });
    await db.insert(draftPicks).values(rows);
    const transferred = await applyPickTransfers(leagueId, year, draftType);

    // Upsert salary rules if provided
    if (salaries) {
      const prefix = draftType === 'rookie' ? 'rookie_draft_round_' : 'fa_draft_round_';
      for (const [roundNum, salary] of Object.entries(salaries)) {
        if (!salary && salary !== 0) continue;
        const ruleName = `${prefix}${roundNum}_salary`;
        const ruleValue = String(salary);
        await db.delete(rules).where(and(eq(rules.leagueId, leagueId), eq(rules.rule, ruleName), isNull(rules.year)));
        await db.insert(rules).values({
          leagueId,
          rule: ruleName,
          value: ruleValue,
          year: null,
          desc: `Salary for ${draftType === 'rookie' ? 'Rookie' : 'Free Agent'} Draft Round ${roundNum}`,
          touch_id: actor,
        });
      }
    }

    logSystemEvent(actor, 'admin', 'DRAFT_SETUP_GENERATED',
      `Generated ${rows.length} picks for ${year} ${draftType} draft (${rounds} rounds)`, leagueId);

    return NextResponse.json({ success: true, inserted: rows.length, transferred });
  } catch (error) {
    console.error('POST /api/draft-setup failed:', error);
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 });
  }
}

export async function GET() {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const leagueId = await getLeagueId();
  const origTeam = alias(teams, 'orig');
  const currTeam = alias(teams, 'curr');

  const rows = await db.select({
    id: pickTransfers.id,
    year: pickTransfers.year,
    round: pickTransfers.round,
    draftType: pickTransfers.draftType,
    from: origTeam.name,
    fromShort: origTeam.teamshort,
    to: currTeam.name,
    toShort: currTeam.teamshort,
    history: pickTransfers.history,
    touch_dt: pickTransfers.touch_dt,
  })
    .from(pickTransfers)
    .innerJoin(origTeam, eq(pickTransfers.originalTeamId, origTeam.id))
    .innerJoin(currTeam, eq(pickTransfers.currentTeamId, currTeam.id))
    .where(eq(pickTransfers.leagueId, leagueId))
    .orderBy(pickTransfers.year, pickTransfers.round);

  // Resolve history team IDs to teamshorts
  const allTeams = await db.select({ id: teams.id, teamshort: teams.teamshort, name: teams.name }).from(teams).where(eq(teams.leagueId, leagueId));
  const teamMap = Object.fromEntries(allTeams.map(t => [t.id, { short: t.teamshort, name: t.name }]));

  const enriched = rows.map(r => ({
    ...r,
    historyShorts: (r.history ?? []).map(id => teamMap[id]?.short ?? String(id)),
    historyNames: (r.history ?? []).map(id => teamMap[id]?.name ?? String(id)),
    canUndo: (r.history ?? []).length > 0,
  }));

  return NextResponse.json(enriched);
}

export async function DELETE(req: NextRequest) {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const session = await auth();
  const actor = session?.user?.name || 'Commissioner';
  const leagueId = await getLeagueId();
  const { id } = await req.json() as { id: number };

  // Get the transfer so we can reset the pick's currentTeamId
  const transfer = await db.select().from(pickTransfers)
    .where(and(eq(pickTransfers.id, id), eq(pickTransfers.leagueId, leagueId)))
    .limit(1);

  if (!transfer[0]) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });

  const { year, round, draftType: dtype, originalTeamId } = transfer[0];

  // Reset currentTeamId on the draft pick back to originalTeamId
  await db.update(draftPicks)
    .set({ currentTeamId: originalTeamId, touch_id: actor })
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, year),
      eq(draftPicks.round, round),
      eq(draftPicks.draftType, dtype),
      eq(draftPicks.originalTeamId, originalTeamId!),
    ));

  await db.delete(pickTransfers).where(eq(pickTransfers.id, id));
  revalidateTag('draft-picks', 'max');
  logSystemEvent(actor, 'admin', 'PICK_TRANSFER_DELETED', `Removed pick transfer ID=${id} (${year} Rd${round})`, leagueId);

  return NextResponse.json({ success: true });
}

// Update the current owner of a pick transfer, or undo the last trade
export async function PATCH(req: NextRequest) {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
  }
  const session = await auth();
  const actor = session?.user?.name || 'Commissioner';
  const leagueId = await getLeagueId();
  const body = await req.json() as { id: number; toTeamshort?: string; undo?: boolean };
  const { id } = body;

  const transfer = await db.select().from(pickTransfers)
    .where(and(eq(pickTransfers.id, id), eq(pickTransfers.leagueId, leagueId)))
    .limit(1);
  if (!transfer[0]) return NextResponse.json({ error: 'Transfer not found' }, { status: 404 });

  const { year, round, draftType, originalTeamId, history } = transfer[0];

  if (body.undo) {
    const prevHistory = history ?? [];

    if (prevHistory.length === 0) {
      // No history — revert to original owner by deleting the transfer row
      await Promise.all([
        db.delete(pickTransfers).where(eq(pickTransfers.id, id)),
        db.update(draftPicks)
          .set({ currentTeamId: originalTeamId })
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.year, year!),
            eq(draftPicks.round, round),
            eq(draftPicks.draftType, draftType!),
            eq(draftPicks.originalTeamId, originalTeamId!),
          )),
      ]);
      logSystemEvent(actor, 'admin', 'PICK_TRANSFER_UNDO', `Undid last trade for transfer ID=${id} — reverted to original owner`, leagueId);
    } else {
      const newHistory = [...prevHistory];
      const revertToId = newHistory.pop()!;
      await Promise.all([
        db.update(pickTransfers)
          .set({ currentTeamId: revertToId, history: newHistory })
          .where(eq(pickTransfers.id, id)),
        db.update(draftPicks)
          .set({ currentTeamId: revertToId })
          .where(and(
            eq(draftPicks.leagueId, leagueId),
            eq(draftPicks.year, year!),
            eq(draftPicks.round, round),
            eq(draftPicks.draftType, draftType!),
            eq(draftPicks.originalTeamId, originalTeamId!),
          )),
      ]);
      logSystemEvent(actor, 'admin', 'PICK_TRANSFER_UNDO', `Undid last trade for transfer ID=${id} → reverted to team ID ${revertToId}`, leagueId);
    }

    revalidateTag('draft-picks', 'max');
    return NextResponse.json({ success: true });
  }

  // Edit: change to a specific team
  const toTeamRow = await db.select({ id: teams.id, name: teams.name }).from(teams)
    .where(and(eq(teams.teamshort, body.toTeamshort!), eq(teams.leagueId, leagueId)))
    .limit(1);
  if (!toTeamRow[0]) return NextResponse.json({ error: 'Team not found' }, { status: 404 });

  const toTeamId = toTeamRow[0].id;
  await Promise.all([
    db.update(pickTransfers)
      .set({ currentTeamId: toTeamId })
      .where(eq(pickTransfers.id, id)),
    db.update(draftPicks)
      .set({ currentTeamId: toTeamId })
      .where(and(
        eq(draftPicks.leagueId, leagueId),
        eq(draftPicks.year, year!),
        eq(draftPicks.round, round),
        eq(draftPicks.draftType, draftType!),
        eq(draftPicks.originalTeamId, originalTeamId!),
      )),
  ]);

  revalidateTag('draft-picks', 'max');
  logSystemEvent(actor, 'admin', 'PICK_TRANSFER_UPDATED', `Updated pick transfer ID=${id} → ${toTeamRow[0].name}`, leagueId);

  return NextResponse.json({ success: true });
}
