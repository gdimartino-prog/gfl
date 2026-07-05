import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, teams, rules } from '@/schema';
import { eq, and, gt, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';
import { revalidateTag } from 'next/cache';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { overallPick } = await req.json();
    if (!overallPick) return NextResponse.json({ error: 'overallPick required' }, { status: 400 });

    const leagueId = await getLeagueId();

    const draftYearRow = await db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, leagueId)))
      .limit(1);
    const draftYear = parseInt(draftYearRow[0]?.value || '0') || new Date().getFullYear();

    const currentTeams = alias(teams, 'currentTeams');

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const callerName = (session.user as { name?: string }).name || callerTeamshort;
    const role = (session.user as { role?: string }).role || '';
    const isSuperuser = role === 'superuser' || role === 'admin';

    const pickRows = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      playerId: draftPicks.playerId,
      passed: draftPicks.passed,
      selectedPlayerName: draftPicks.selectedPlayerName,
      currentTeamId: draftPicks.currentTeamId,
      currentOwnerShort: currentTeams.teamshort,
    })
    .from(draftPicks)
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(
      eq(draftPicks.leagueId, leagueId),
      eq(draftPicks.year, draftYear),
      eq(draftPicks.pick, parseInt(String(overallPick))),
    ))
    .limit(1);

    if (!pickRows[0]) return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 404 });

    const pick = pickRows[0];

    // Ownership check first
    if (!isSuperuser && callerTeamshort.toLowerCase() !== (pick.currentOwnerShort || '').toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: you do not own this pick' }, { status: 403 });
    }

    if (pick.playerId) return NextResponse.json({ error: 'Pick already made — cannot unpass.' }, { status: 400 });

    const isSkipped = pick.selectedPlayerName?.startsWith('SKIPPED') ?? false;

    if (!isSkipped && !pick.passed) return NextResponse.json({ success: true, alreadyUnpassed: true });

    if (isSkipped) {
      // Restore a cron-skipped pick back to active (clears the SKIPPED marker)
      await db.update(draftPicks)
        .set({ selectedPlayerName: null, pickedAt: null, touch_id: callerTeamshort || 'draft' })
        .where(eq(draftPicks.id, pick.id));
    } else {
      await db.update(draftPicks)
        .set({ passed: false, pickedAt: null, touch_id: callerTeamshort || 'draft' })
        .where(eq(draftPicks.id, pick.id));
    }

    // Cascade: clear passed on all future picks for this team (exclude skipped ones — they stay as-is)
    if (pick.currentTeamId) {
      await db.update(draftPicks)
        .set({ passed: false, pickedAt: null, touch_id: callerTeamshort || 'draft' })
        .where(and(
          eq(draftPicks.leagueId, leagueId),
          eq(draftPicks.year, draftYear),
          eq(draftPicks.currentTeamId, pick.currentTeamId),
          gt(draftPicks.pick, pick.pick),
          isNull(draftPicks.playerId),
          isNull(draftPicks.selectedPlayerName),
          eq(draftPicks.passed, true),
        ));
    }

    revalidateTag('draft-picks', 'max');
    await logSystemEvent(callerName, pick.currentOwnerShort || '', 'DRAFT_UNPASS', `R${pick.round} #${overallPick}: UNPASS`, leagueId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft unpass error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
