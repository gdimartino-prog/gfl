// app/api/draft-picks/route.ts
import { NextResponse } from 'next/server';
import { getAllDraftPicks, transferDraftPick } from '@/lib/draftPicks';

export async function GET() {
  try {
    const picks = await getAllDraftPicks();
    return NextResponse.json(picks);
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message },
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

    await transferDraftPick(fromTeam, toTeam, Number(year), Number(round));

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Draft pick transfer error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}
