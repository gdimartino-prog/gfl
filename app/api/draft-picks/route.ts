// app/api/draft-picks/route.ts
import { NextResponse } from 'next/server';
import { getAllDraftPicks, transferDraftPick } from '@/lib/draftPicks';

export async function GET() {
  try {
    const picks = await getAllDraftPicks();

    // SAFETY: always return an array
    return NextResponse.json(Array.isArray(picks) ? picks : []);
  } catch (error) {
    console.error('API /draft-picks GET failed:', error);

    return NextResponse.json(
      { error: 'Failed to load draft picks' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromTeam, toTeam, year, round } = body;

    if (!fromTeam || !toTeam || !year || !round) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await transferDraftPick(
      fromTeam,
      toTeam,
      Number(year),
      Number(round)
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('API /draft-picks POST failed:', error);

    return NextResponse.json(
      { error: 'Draft pick transfer failed' },
      { status: 500 }
    );
  }
}
