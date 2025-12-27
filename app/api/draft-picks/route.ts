import { NextResponse } from 'next/server';
import { getAllDraftPicks, transferDraftPick } from '@/lib/draftPicks';

export async function GET() {
  try {
    const picks = await getAllDraftPicks();

    // If picks is already an array of objects (from your lib), just return it.
    // If it's raw rows from Google Sheets, we map it using the 6-column indices:
    const formattedPicks = Array.isArray(picks) ? picks.map((p: any) => {
      // If 'p' is already an object (has a 'year' property), return it as is
      if (p.year) return p;

      // If 'p' is a raw array row, map it:
      // Index 0: Year | 1: Round | 2: Overall | 3: Original | 4: Owner | 5: Status
      return {
        year: p[0],
        round: p[1],
        overall: p[2],
        originalTeam: p[3],
        currentOwner: p[4], // This is Column E
        status: p[5]
      };
    }) : [];

    return NextResponse.json(formattedPicks);
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
    const { fromTeam, toTeam, year, round, overall } = body;

    // Use 'overall' if you have it, as it's the most precise way to find a pick
    if (!fromTeam || !toTeam || !year || !round) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // This updates the 'current owner' column in your Google Sheet
    await transferDraftPick(
      fromTeam,
      toTeam,
      Number(year),
      Number(round),
      overall ? Number(overall) : undefined
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