import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

// Force the API to fetch fresh data every time in production
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get('team');
  const yearParam = searchParams.get('year');

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J',
    });

    const rows = result.data.values || [];
    const leagueSummary: Record<string, { protected: number, pullback: number, lastUpdated: string }> = {};
    const selections: Record<string, string> = {};
    let lastTime = "";

    // Skip header and process rows
    rows.slice(1).forEach(row => {
      if (!row || row.length < 2) return;
      
      const rowYear = String(row[0] || '').trim();
      const rowTeam = String(row[1] || '').trim();
      const targetYear = String(yearParam || '').trim();

      if (rowYear === targetYear) {
        // 1. Compliance Summary Logic
        if (rowTeam) {
          if (!leagueSummary[rowTeam]) {
            leagueSummary[rowTeam] = { protected: 0, pullback: 0, lastUpdated: "" };
          }
          const status = String(row[8] || '').trim().toLowerCase();
          if (status === 'protected') leagueSummary[rowTeam].protected++;
          if (status === 'pullback') leagueSummary[rowTeam].pullback++;
          if (row[9] && (!leagueSummary[rowTeam].lastUpdated || row[9] > leagueSummary[rowTeam].lastUpdated)) {
            leagueSummary[rowTeam].lastUpdated = row[9];
          }
        }

        // 2. Specific Team Selection Logic
        if (team && rowTeam === String(team).trim()) {
          // Construct identity from the middle columns to match frontend
          const identity = `${row[2]}|${row[3]}|${row[4]}|${row[5]}|${row[6]}|${row[7]}`.toLowerCase();
          selections[identity] = String(row[8] || '').toLowerCase();
          if (row[9]) lastTime = row[9];
        }
      }
    });

    return NextResponse.json({ 
      summary: leagueSummary, 
      selections, 
      lastUpdated: lastTime 
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      }
    });

  } catch (err: any) {
    console.error('API GET ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { team, year, selections } = await req.json();
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false 
    }).replace(',', '');

    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', 
    });

    const allRows = currentSheet.data.values || [];
    const header = allRows[0] || ["Year", "Team", "First", "Last", "Pos", "Age", "Team2", "ID", "Status", "Timestamp"]; 

    // Filter out previous entries for this team/year
    const otherRows = allRows.filter((row, index) => {
      if (index === 0) return false;
      return !(String(row[0]).trim() === String(year).trim() && String(row[1]).trim() === String(team).trim());
    });

    // Format new rows
    const newTeamRows = selections.map((p: any) => {
      const parts = p.identity.split('|');
      const statusFormatted = p.status.charAt(0).toUpperCase() + p.status.slice(1);
      return [year, team, ...parts, statusFormatted, timestamp];
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A1',
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [header, ...otherRows, ...newTeamRows] },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('API POST ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}