import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { buildPlayerReportPrompt } from '@/lib/gemini';
import { logSystemEvent } from '@/lib/db-helpers';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const body = await req.json();
    const teamShortIn: string = body.teamShort ? String(body.teamShort).toUpperCase().trim() : '';
    if (!teamShortIn) return NextResponse.json({ error: 'teamShort is required' }, { status: 400 });

    const callerTeam = ((session.user as { id?: string }).id || '').toUpperCase();
    const role = (session.user as { role?: string }).role;
    const privileged = role === 'admin' || role === 'superuser';
    if (!privileged && callerTeam !== teamShortIn) {
      return NextResponse.json({ error: 'You can only bulk-generate prompts for your own team.' }, { status: 403 });
    }

    const leagueId = await getLeagueId();

    const rows = await db
      .select({ name: players.name, position: players.position })
      .from(players)
      .innerJoin(teams, eq(players.teamId, teams.id))
      .where(and(
        eq(players.leagueId, leagueId),
        sql`upper(${teams.teamshort}) = ${teamShortIn}`,
      ))
      .orderBy(players.name);

    if (rows.length === 0) {
      return NextResponse.json({ error: 'Team not found or has no players' }, { status: 404 });
    }

    const playerPrompts = rows.map(p => ({
      name: p.name ?? '',
      position: p.position ?? null,
      prompt: buildPlayerReportPrompt(p.name ?? '', p.position ?? null),
    }));

    const combinedPrompt = playerPrompts
      .map(p => `### ${p.name}${p.position ? ` (${p.position})` : ''}\n\n${p.prompt}`)
      .join('\n\n---\n\n');

    const callerCoachName = session.user.name || 'Unknown Coach';
    const callerTeamshort = (session.user as { id?: string }).id || '';
    await logSystemEvent(
      callerCoachName,
      callerTeamshort,
      'SCOUT_BULK_PROMPTS',
      `team=${teamShortIn} count=${rows.length}`,
      leagueId,
    );

    return NextResponse.json({ combinedPrompt, count: rows.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('[scout/bulk-player-prompts]', msg);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
