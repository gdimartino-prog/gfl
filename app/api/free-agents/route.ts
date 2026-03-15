import { NextResponse } from 'next/server';
import { getPlayers } from '@/lib/players';
import { executeFreeAgentMove } from '@/lib/freeAgency';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    // 1. Fetch parsed players from the centralized utility (handles caching internally)
    const allPlayers = await getPlayers(leagueId);

    // 2. Filter for Free Agents (Case-insensitive 'FA')
    const freeAgents = allPlayers.filter(
      (p) => p.team?.trim().toUpperCase() === 'FA'
    );

    return NextResponse.json(freeAgents);
  } catch (error: unknown) {
    console.error('API Error (Free Agents):', error instanceof Error ? error.message : String(error));
    return NextResponse.json(
      { error: 'Failed to fetch free agents', details: error instanceof Error ? error.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, addIdentity, dropIdentity } = body;

    // Validation for Free Agent moves (Drafting/Signing)
    if (!team || !addIdentity || !dropIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields: team, addIdentity, or dropIdentity' },
        { status: 400 }
      );
    }

    // executeFreeAgentMove handles the Google Sheets row updates
    await executeFreeAgentMove(team, addIdentity, dropIdentity);

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('❌ Free agency POST error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}