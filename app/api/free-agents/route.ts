import { NextResponse } from 'next/server';
import { getPlayersWithScouting } from '@/lib/players';
import { executeFreeAgentMove } from '@/lib/freeAgency';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    const allPlayers = await getPlayersWithScouting(leagueId);

    const freeAgents = allPlayers.filter(
      (p) => p.team?.trim().toUpperCase() === 'FA'
    );

    return NextResponse.json(freeAgents, {
      headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
    });
  } catch (error: unknown) {
    console.error('API Error (Free Agents):', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch free agents', details: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { addIdentity, dropIdentity } = body;

    // Always use the session team — never trust client-supplied team value
    const team = (session.user as { id?: string }).id;
    if (!team) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!addIdentity || !dropIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields: addIdentity or dropIdentity' },
        { status: 400 }
      );
    }

    const leagueId = await getLeagueId();
    await executeFreeAgentMove(team, addIdentity, dropIdentity, leagueId);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('❌ Free agency POST error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}