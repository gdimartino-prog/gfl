import { getPlayers } from '@/lib/players';
import { getAllDraftPicks } from '@/lib/draftPicks';
import { NextResponse } from 'next/server';

type RouteContext = {
  params: Promise<{ team: string }>;
};

export async function GET(_req: Request, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const teamShort = resolvedParams.team.toUpperCase();

    // 1. Fetch both datasets using centralized utilities (handles caching internally)
    const [allPlayers, allPicks] = await Promise.all([
      getPlayers(),
      getAllDraftPicks()
    ]);

    // 2. Process Roster
    const roster = allPlayers
      .filter(p => p.team?.toUpperCase() === teamShort)
      .map(p => ({
        identity: p.identity,
        name: `${p.first} ${p.last}`.trim(),
        age: p.age.toString(),
        offensePos: p.offense,
        defensePos: p.defense,
        specialPos: p.special,
        // Logic for unit grouping
        group: p.offense ? 'OFF' : p.defense ? 'DEF' : 'SPEC',
        pos: p.position.toUpperCase() || '??'
      }));
    
    // 3. Process Draft Picks
    const picks = allPicks
      .filter(p => p.currentOwner?.toUpperCase() === teamShort)
      .map(p => ({
        year: p.year,
        round: p.round,
        overall: p.overall,
        originalTeam: p.originalTeam,
        currentOwner: p.currentOwner
      }))
      .sort((a, b) => a.year - b.year || a.overall - b.overall);

    return NextResponse.json({ roster, picks });
  } catch (error: unknown) {
    console.error("Roster API Error:", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}