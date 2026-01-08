import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

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

    rows.slice(1).forEach((row) => {
      if (!row || row.length < 2) return;

      const rowYear = String(row[0] || '').trim();
      const rowTeam = String(row[1] || '').trim();
      const targetYear = String(yearParam || '').trim();

      if (rowYear === targetYear) {
        // 1. LEAGUE SUMMARY
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

        // 2. PLAYER SELECTIONS (Identity Mapping)
        if (team && rowTeam.toLowerCase() === String(team).trim().toLowerCase()) {
          // INDEX MAP BASED ON YOUR SHEET:
          // 2:First, 3:Last, 4:Age, 5:Off, 6:Def, 7:Spec
          const identity = [2, 3, 4, 5, 6, 7]
            .map(i => String(row[i] || '').trim().toLowerCase())
            .join('|');
          
          selections[identity] = String(row[8] || '').trim().toLowerCase();
          
          if (row[9] && (!lastTime || row[9] > lastTime)) {
            lastTime = row[9];
          }
        }
      }
    });

    return NextResponse.json({ 
      summary: leagueSummary, 
      selections, 
      lastUpdated: lastTime 
    }, {
      headers: { 'Cache-Control': 'no-store, max-age=0, must-revalidate' }
    });

  } catch (err: any) {
    console.error('[DEBUG] GET ERROR:', err.message);
    return NextResponse.json({ error: err.message, summary: {}, selections: {} }, { status: 500 });
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
    // Updated Header to match your actual sheet columns
    const header = allRows[0] || ["Year", "Team", "First", "Last", "Age", "Offense", "Defense", "Special", "Status", "Timestamp"]; 

    const otherRows = allRows.slice(1).filter((row) => {
      const isMatch = String(row[0]).trim() === String(year).trim() && 
                      String(row[1]).trim() === String(team).trim();
      return !isMatch;
    });

    const newTeamRows = selections.map((p: any) => {
      const parts = p.identity.split('|'); // Splits back into [First, Last, Age, Off, Def, Spec]
      const statusFormatted = p.status.charAt(0).toUpperCase() + p.status.slice(1);
      
      // Structure: Year, Team, First, Last, Age, Offense, Defense, Special, Status, Timestamp
      return [year, team, ...parts, statusFormatted, timestamp];
    });

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
    console.error('[DEBUG] POST ERROR:', err.message);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}