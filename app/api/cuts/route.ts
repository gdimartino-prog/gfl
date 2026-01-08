import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

// Force the API to fetch fresh data every time in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get('team');
  const yearParam = searchParams.get('year');

  console.log(`[DEBUG] API Triggered - Year: ${yearParam}, Team: ${team}`);

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J',
    });

    const rows = result.data.values || [];
    console.log(`[DEBUG] Total rows fetched from Sheets: ${rows.length}`);

    const leagueSummary: Record<string, { protected: number, pullback: number, lastUpdated: string }> = {};
    const selections: Record<string, string> = {};
    let lastTime = "";

    rows.slice(1).forEach((row, index) => {
      const rowYear = String(row[0] || '').trim();
      const rowTeam = String(row[1] || '').trim();
      const targetYear = String(yearParam || '').trim();

      if (rowYear === targetYear) {
        // Summary Logic
        if (rowTeam) {
          if (!leagueSummary[rowTeam]) {
            leagueSummary[rowTeam] = { protected: 0, pullback: 0, lastUpdated: "" };
          }
          const status = String(row[8] || '').trim().toLowerCase();
          if (status === 'protected') leagueSummary[rowTeam].protected++;
          if (status === 'pullback') leagueSummary[rowTeam].pullback++;
        }

        // Team Selection Logic
        if (team && rowTeam === String(team).trim()) {
          const identity = `${row[2]}|${row[3]}|${row[4]}|${row[5]}|${row[6]}|${row[7]}`.toLowerCase();
          selections[identity] = String(row[8] || '').trim().toLowerCase();
        }
      }
    });

    console.log(`[DEBUG] Summary Count: ${Object.keys(leagueSummary).length} teams`);
    console.log(`[DEBUG] Selections found for ${team}: ${Object.keys(selections).length}`);

    return NextResponse.json({ summary: leagueSummary, selections, lastUpdated: lastTime }, {
      headers: { 'Cache-Control': 'no-store' }
    });

  } catch (err: any) {
    console.error('[DEBUG] API ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}


export async function POST(req: NextRequest) {
  try {
    const { team, year, selections } = await req.json();
    
    // Create consistent timestamp
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false 
    }).replace(',', '');

    // Fetch current data to preserve other teams
    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', 
    });

    const allRows = currentSheet.data.values || [];
    const header = allRows[0] || ["Year", "Team", "First", "Last", "Pos", "Age", "Team2", "ID", "Status", "Timestamp"]; 

    // Filter out previous entries ONLY for the specific team and year being saved
    const otherRows = allRows.slice(1).filter((row) => {
      const isMatch = String(row[0]).trim() === String(year).trim() && 
                      String(row[1]).trim() === String(team).trim();
      return !isMatch;
    });

    // Format new selections into sheet rows
    const newTeamRows = selections.map((p: any) => {
      const parts = p.identity.split('|');
      const statusFormatted = p.status.charAt(0).toUpperCase() + p.status.slice(1);
      return [year, team, ...parts, statusFormatted, timestamp];
    });

    // Overwrite the sheet with the merged data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [header, ...otherRows, ...newTeamRows] 
      },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API POST ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}