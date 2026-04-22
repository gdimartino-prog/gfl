import { NextRequest, NextResponse } from 'next/server';
import { getPlayers } from '@/lib/players';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const teamFilter = searchParams.get('team');
  const includeScouting = searchParams.get('scouting') === '1';

  try {
    // 1. Fetch parsed players from the centralized utility
    const leagueId = await getLeagueId();
    const players = await getPlayers(leagueId);
    
    // 2. Map to ensure compatibility and STRIP heavy scouting data for the list view
    // This keeps the JSON response small and fast.
    const processedPlayers = players.map((p) => {
      return {
        team: p.team,
        first: p.first,
        last: p.last,
        age: p.age,
        offense: p.offense,
        defense: p.defense,
        special: p.special,
        position: p.position,
        isIR: p.isIR,
        identity: p.identity,
        run: p.run,
        pass: p.pass,
        rush: p.rush,
        int: p.int,
        sack: p.sack,
        dur: p.dur,
        overall: p.overall,
        salary: p.scouting?.salary ?? null,
        ...(includeScouting ? { scouting: p.scouting ?? null } : {}),
        name: `${p.first} ${p.last}`.trim(),
        pos: p.position // Map 'position' to 'pos' for frontend consistency
      };
    });

    // 3. Handle filtering
    if (teamFilter) {
      const filtered = processedPlayers.filter(p => 
        p.team?.toString().toUpperCase() === teamFilter.toUpperCase()
      );
      return NextResponse.json(filtered);
    }

    // 4. Return the processed array directly
    return NextResponse.json(processedPlayers);
    
  } catch (err: unknown) {
    console.error('API Error (Players):', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}