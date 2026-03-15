import { getPlayers } from '@/lib/players';
import { getAllDraftPicks } from '@/lib/draftPicks';
import { getLeagueId } from '@/lib/getLeagueId';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ team: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const teamShort = resolvedParams.team.toUpperCase();

    const leagueId = await getLeagueId();
    const [allPlayers, allPicks] = await Promise.all([
      getPlayers(leagueId),
      getAllDraftPicks(leagueId)
    ]);

    const roster = allPlayers
      .filter(p => p.team?.toUpperCase() === teamShort)
      .map(p => ({
        identity: p.identity,
        name: `${p.first} ${p.last}`.trim() || p.name,
        first: p.first,
        last: p.last,
        age: p.age?.toString() ?? '',
        offensePos: p.offense,
        defensePos: p.defense,
        specialPos: p.special,
        position: p.position,
        pos: (p.position ?? '??').toUpperCase(),
        group: p.offense ? 'OFF' : p.defense ? 'DEF' : 'SPEC',
        overall: p.overall,
        isIR: p.isIR,
        run: p.run,
        pass: p.pass,
        rush: p.rush,
        int: p.int,
        sack: p.sack,
        dur: p.dur,
      }));

    const picks = allPicks
      .filter(p => p.currentOwner?.toUpperCase() === teamShort)
      .map(p => ({
        year: p.year,
        round: p.round,
        overall: p.overall,
        originalTeam: p.originalTeam,
        currentOwner: p.currentOwner
      }))
      .sort((a, b) => (a.year ?? 0) - (b.year ?? 0) || (a.overall ?? 0) - (b.overall ?? 0));

    return NextResponse.json({ roster, picks });
  } catch (error: unknown) {
    console.error("Roster API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}
