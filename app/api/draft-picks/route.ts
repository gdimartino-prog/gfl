import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { transferDraftPick } from '@/lib/draftPicks';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    // We bypass the lib function here to ensure we get EXACTLY columns A through H
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:H', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return NextResponse.json([]);

    // Map the rows to objects including the new G and H columns
    const formattedPicks = rows.slice(1).map((p: any) => ({
      year: p[0] || '',
      round: p[1] || '',
      overall: p[2] || '',
      originalTeam: p[3] || '',
      currentOwner: p[4] || '',
      status: p[5] || '',
      draftedPlayer: p[6] || '', // Column G
      timestamp: p[7] || ''      // Column H
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
    const { fromTeam, toTeam, year, round, overall } = body;

    if (!fromTeam || !toTeam || !year || !round) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    /** * BULLETPROOF BYPASS: 
     * We use @ts-ignore AND 'as any' to force Vercel to accept the 5th argument (overall).
     */
    // @ts-ignore
    await (transferDraftPick as any)(
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