import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { draftPicks, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { alias } from 'drizzle-orm/pg-core';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const { overallPick, coachName } = await req.json();
    if (!overallPick) return NextResponse.json({ error: 'overallPick required' }, { status: 400 });

    const leagueId = await getLeagueId();
    const currentTeams = alias(teams, 'currentTeams');

    const pickRows = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      playerId: draftPicks.playerId,
      passed: draftPicks.passed,
      currentOwner: currentTeams.teamshort,
    })
    .from(draftPicks)
    .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
    .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.pick, parseInt(String(overallPick)))))
    .limit(1);

    if (!pickRows[0]) return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 404 });

    const pick = pickRows[0];
    if (pick.playerId) return NextResponse.json({ error: 'Pick already made.' }, { status: 400 });
    if (pick.passed) return NextResponse.json({ error: 'Pick already passed.' }, { status: 400 });

    await db.update(draftPicks)
      .set({ passed: true, pickedAt: new Date(), touch_id: coachName || 'draft' })
      .where(eq(draftPicks.id, pick.id));

    logSystemEvent(coachName || '', pick.currentOwner || '', 'DRAFT_PASS', `R${pick.round} #${overallPick}: PASSED`);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Draft pass error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
