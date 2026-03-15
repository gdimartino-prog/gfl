import { NextRequest, NextResponse } from 'next/server';
import { isAdmin } from '@/lib/auth';
import { db } from '@/lib/db';
import { standings, teams } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

// GET /api/admin/standings?year=2025
// Returns all standings rows for the active league + year, joined with team names
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get('year') ?? '');
  if (isNaN(year)) return NextResponse.json({ error: 'year required' }, { status: 400 });

  const leagueId = await getLeagueId();
  const rows = await db.select({
    id: standings.id,
    teamId: standings.teamId,
    teamName: teams.name,
    teamshort: teams.teamshort,
    nickname: teams.nickname,
    wins: standings.wins,
    losses: standings.losses,
    ties: standings.ties,
    division: standings.division,
    offPts: standings.offPts,
    defPts: standings.defPts,
    isDivWinner: standings.isDivWinner,
    isPlayoff: standings.isPlayoff,
    isSuperBowl: standings.isSuperBowl,
    isChampion: standings.isChampion,
  }).from(standings)
    .leftJoin(teams, eq(standings.teamId, teams.id))
    .where(and(eq(standings.leagueId, leagueId), eq(standings.year, year)))
    .orderBy(standings.wins);

  return NextResponse.json(rows.reverse()); // most wins first
}

// PATCH /api/admin/standings
// Body: { id, isDivWinner, isPlayoff, isSuperBowl, isChampion }
export async function PATCH(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const body = await req.json();
  const { id, isDivWinner, isPlayoff, isSuperBowl, isChampion } = body;
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  await db.update(standings).set({
    isDivWinner: !!isDivWinner,
    isPlayoff: !!isPlayoff,
    isSuperBowl: !!isSuperBowl,
    isChampion: !!isChampion,
    touch_id: 'admin-awards',
  }).where(eq(standings.id, Number(id)));

  return NextResponse.json({ success: true });
}
