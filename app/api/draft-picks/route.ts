import { NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-cloud';
import { transferDraftPick } from '@/lib/draftPicks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    // UPDATED: Extended range to A:J to capture Columns I and J
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:K', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return NextResponse.json([]);

    // Map the rows to objects including the new G, H, and J columns
    const formattedPicks = rows.slice(1).map((p: string[]) => ({
      year: p[0] || '',
      round: p[1] || '',
      overall: p[2] || '',
      originalTeam: p[3] || '',
      currentOwner: p[4] || '',
      status: p[5] || '',
      draftedPlayer: p[6] || '', // Column G
      timestamp: p[7] || '',     // Column H
      // p[8] is Column I (Notes/Skipped Logic)
      processedBy: p[9] || '',    // Column J: The Coach's Name
      history: p[10] || ''       // Column K: The History Column
    }));

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
    const { fromTeam, toTeam, year, round, overall, coachName } = body;

    // Validation check
    if (!fromTeam || !toTeam || !year || !round) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Call the helper from @/lib/draftPicks
    // IMPORTANT: Ensure transferDraftPick in lib/draftPicks.ts 
    // is updated to accept 'coachName' as the 6th argument.
    await transferDraftPick(
      fromTeam,
      toTeam,
      Number(year),
      Number(round),
      overall ? Number(overall) : undefined,
      coachName // Passing the coach name to be saved in Column J
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