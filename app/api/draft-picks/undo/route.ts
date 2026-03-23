import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { getLastPickForTeam, getNextOnClockTeamId, clearPickSelection } from '@/lib/draftPicks';
import { logSystemEvent } from '@/lib/db-helpers';

export async function POST() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const teamshort = (session.user as { id?: string }).id || '';

    // Resolve teamshort → teamId
    const teamRow = await db.select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.teamshort, teamshort), eq(teams.leagueId, leagueId)))
      .limit(1);

    if (!teamRow[0]) return NextResponse.json({ error: 'Team not found' }, { status: 400 });
    const teamId = teamRow[0].id;

    // Get the draft year from rules
    const { db: drizzleDb } = await import('@/lib/db');
    const { rules } = await import('@/schema');
    const yearRow = await drizzleDb.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year')))
      .limit(1);
    const year = yearRow[0]?.value ? Number(yearRow[0].value) : new Date().getFullYear();

    // Get the last pick this team made
    const lastPick = await getLastPickForTeam(teamId, leagueId, year);
    if (!lastPick) return NextResponse.json({ error: 'No pick found to undo' }, { status: 400 });

    // Get who is currently on the clock
    const nextOnClockTeamId = await getNextOnClockTeamId(leagueId, year);

    // The pick immediately after the coach's last pick should be the one on the clock
    // i.e., the next team has NOT picked yet — their slot is still empty
    // We check: the on-clock pick number should equal lastPick.pick + 1 (next sequential pick)
    // If nextOnClockTeamId is null, draft is over — block undo
    if (nextOnClockTeamId === null) {
      return NextResponse.json({ error: 'Draft is complete — cannot undo' }, { status: 409 });
    }

    // Verify the next on-clock pick immediately follows the coach's last pick
    const { draftPicks } = await import('@/schema');
    const { asc } = await import('drizzle-orm');
    const nextPickRow = await drizzleDb.select({ pick: draftPicks.pick, currentTeamId: draftPicks.currentTeamId })
      .from(draftPicks)
      .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, year), eq(draftPicks.playerId, null as unknown as number)))
      .orderBy(asc(draftPicks.pick))
      .limit(1);

    const nextPickNumber = nextPickRow[0]?.pick;
    if (!nextPickNumber || nextPickNumber !== lastPick.pick + 1) {
      return NextResponse.json({ error: 'Next team has already picked — undo not allowed' }, { status: 409 });
    }

    await clearPickSelection(lastPick.id, teamshort);
    logSystemEvent(session.user.name || teamshort, teamshort, 'DRAFT_UNDO_PICK', `Undid pick #${lastPick.pick} (year ${year})`, leagueId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft undo error:', error);
    return NextResponse.json({ error: 'Failed to undo pick' }, { status: 500 });
  }
}
