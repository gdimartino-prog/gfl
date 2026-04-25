import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { cuts, teams } from '@/schema';
import { eq, and, asc } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { logSystemEvent } from '@/lib/db-helpers';
import { auth } from '@/auth';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get('team');
  const yearParam = searchParams.get('year');
  const yearsOnly = searchParams.get('yearsOnly') === 'true';

  try {
    const leagueId = await getLeagueId();

    if (yearsOnly) {
      const rows = await db
        .selectDistinct({ year: cuts.year })
        .from(cuts)
        .where(eq(cuts.leagueId, leagueId))
        .orderBy(asc(cuts.year));
      const years = rows.map(r => String(r.year)).filter(Boolean);
      return NextResponse.json({ years });
    }

    const year = yearParam ? parseInt(yearParam) : null;
    if (!year) return NextResponse.json({ summary: {}, selections: {}, lastUpdated: '' });

    const rows = await db.select({
      teamshort: teams.teamshort,
      firstName: cuts.firstName,
      lastName: cuts.lastName,
      age: cuts.age,
      offense: cuts.offense,
      defense: cuts.defense,
      special: cuts.special,
      status: cuts.status,
      datetime: cuts.datetime,
    })
    .from(cuts)
    .leftJoin(teams, eq(cuts.teamId, teams.id))
    .where(and(eq(cuts.leagueId, leagueId), eq(cuts.year, year)));

    const leagueSummary: Record<string, { protected: number; pullback: number; lastUpdated: string }> = {};
    const selections: Record<string, string> = {};
    let lastTime = '';

    for (const row of rows) {
      const rowTeam = row.teamshort || '';
      const status = (row.status || '').trim().toLowerCase();
      const dt = row.datetime ? new Date(row.datetime).toLocaleString('en-US', { timeZone: 'America/New_York' }) : '';

      // League summary
      if (rowTeam) {
        if (!leagueSummary[rowTeam]) leagueSummary[rowTeam] = { protected: 0, pullback: 0, lastUpdated: '' };
        if (status === 'protected') leagueSummary[rowTeam].protected++;
        if (status === 'pullback') leagueSummary[rowTeam].pullback++;
        if (dt && (!leagueSummary[rowTeam].lastUpdated || dt > leagueSummary[rowTeam].lastUpdated)) {
          leagueSummary[rowTeam].lastUpdated = dt;
        }
      }

      // Player selections for requested team
      if (team && rowTeam.toLowerCase() === team.trim().toLowerCase()) {
        const identity = [
          row.firstName, row.lastName, row.age,
          row.offense, row.defense, row.special,
        ].map(v => String(v || '').trim().toLowerCase()).join('|');
        selections[identity] = status;
        if (dt && (!lastTime || dt > lastTime)) lastTime = dt;
      }
    }

    return NextResponse.json({ summary: leagueSummary, selections, lastUpdated: lastTime }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' },
    });
  } catch (err: unknown) {
    console.error('[Cuts GET]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal Server Error', summary: {}, selections: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const { team, year, selections } = await req.json();
    const leagueId = await getLeagueId();

    // Verify caller owns this team unless admin/commissioner
    const callerTeamshort = (session.user as { id?: string }).id || '';
    const role = (session.user as { role?: string }).role || '';
    const isSuperuser = role === 'superuser' || role === 'admin';
    if (!isSuperuser && callerTeamshort.toLowerCase() !== (team || '').toLowerCase()) {
      return NextResponse.json({ error: 'Forbidden: you can only submit cuts for your own team' }, { status: 403 });
    }

    const teamRow = await db.select({ id: teams.id })
      .from(teams)
      .where(and(eq(teams.teamshort, team), eq(teams.leagueId, leagueId)))
      .limit(1);

    if (!teamRow[0]) return NextResponse.json({ error: 'Team not found' }, { status: 400 });
    const teamId = teamRow[0].id;
    const yearInt = parseInt(year);

    // Delete existing cuts for this team/year, then re-insert
    await db.delete(cuts).where(and(
      eq(cuts.leagueId, leagueId),
      eq(cuts.teamId, teamId),
      eq(cuts.year, yearInt),
    ));

    if (selections?.length > 0) {
      const now = new Date();
      const rows = selections.map((sel: { identity: string; status: string }) => {
        const parts = sel.identity.split('|');
        const statusFormatted = sel.status.charAt(0).toUpperCase() + sel.status.slice(1);
        return {
          leagueId,
          teamId,
          year: yearInt,
          firstName: parts[0] || null,
          lastName: parts[1] || null,
          age: parts[2] ? parseInt(parts[2]) || null : null,
          offense: parts[3] || null,
          defense: parts[4] || null,
          special: parts[5] || null,
          status: statusFormatted,
          datetime: now,
          touch_id: team,
        };
      });
      await db.insert(cuts).values(rows);
    }

    const protCount = selections?.filter((s: { status: string }) => s.status === 'protected').length ?? 0;
    const pullCount = selections?.filter((s: { status: string }) => s.status === 'pullback').length ?? 0;
    logSystemEvent(team, team, 'CUTS_SUBMITTED', `Year ${year}: ${protCount} protected, ${pullCount} pullback`, leagueId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('[Cuts POST]', err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
