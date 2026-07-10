import { NextResponse } from 'next/server';
import { getFAPlayersWithScouting } from '@/lib/players';
import { executeFreeAgentMove } from '@/lib/freeAgency';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { revalidateTag } from 'next/cache';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  try {
    const leagueId = await getLeagueId();
    const freeAgents = await getFAPlayersWithScouting(leagueId);
    return NextResponse.json(freeAgents, {
      headers: { 'Cache-Control': 'private, max-age=60, stale-while-revalidate=120' },
    });
  } catch (error: unknown) {
    console.error('API Error (Free Agents):', error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Failed to fetch free agents' }, { status: 500 });
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
    revalidateTag('players', 'max');
    revalidateTag('players-fa', 'max');

    return NextResponse.json({ success: true });
  } catch (err: unknown) {
    console.error('❌ Free agency POST error:', err instanceof Error ? err.message : String(err));
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal Server Error' },
      { status: 500 }
    );
  }
}