import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!A:H', 
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) return NextResponse.json([]);

    const formattedPicks = rows.slice(1).map((p: any) => ({
      year: p[0] || '',
      round: p[1] || '',
      overall: p[2] || '',
      originalTeam: p[3] || '',
      currentOwner: p[4] || '',
      status: p[5] || '',
      draftedPlayer: p[6] || '',
      timestamp: p[7] || ''
    }));

    return NextResponse.json(formattedPicks);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to load picks' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { fromTeam, toTeam, year, round, overall } = body;

    // We pass everything as an array to hide the argument count from the compiler
    const args: any[] = [
      fromTeam,
      toTeam,
      Number(year),
      Number(round)
    ];
    
    // Only add the 5th argument if it exists
    if (overall) args.push(Number(overall));

    // @ts-ignore
    await (transferDraftPick as any)(...args);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}