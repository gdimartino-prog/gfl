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

    // 1. Fetch the data directly in this function
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!A2:G`,
    });

    const rows = res.data.values || [];

    // 2. Find the row index
    const rowIndex = rows.findIndex(r => {
      const matchesYear = Number(r[0]) === Number(year);
      const matchesRound = Number(r[1]) === Number(round);
      
      // If we have an overall pick number, use it for 100% accuracy
      if (overall) {
        return matchesYear && matchesRound && Number(r[2]) === Number(overall);
      }
      // Fallback to matching the owner
      return matchesYear && matchesRound && r[4]?.toLowerCase() === fromTeam.toLowerCase();
    });

    if (rowIndex === -1) {
      return NextResponse.json({ error: 'Pick not found' }, { status: 404 });
    }

    const sheetRow = rowIndex + 2;

    // 3. Update Column E (Current Owner) directly
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!E${sheetRow}`, 
      valueInputOption: 'RAW',
      requestBody: {
        values: [[toTeam]],
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: 'Transfer failed' }, { status: 500 });
  }
}