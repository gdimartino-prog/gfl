import { NextRequest, NextResponse } from 'next/server';
import { getSheetsClient } from '@/lib/google-cloud';
import { parsePlayers } from '@/lib/players';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get('team');
  const yearParam = searchParams.get('year');

  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J',
    });

    const rows = result.data.values || [];
    const leagueSummary: Record<string, { protected: number, pullback: number, lastUpdated: string }> = {};
    const selections: Record<string, string> = {};
    let lastTime = "";

    // We use the first row of the Cuts sheet to map columns dynamically

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

        // 2. PLAYER SELECTIONS (Using header-aware identity mapping)
        if (team && rowTeam.toLowerCase() === String(team).trim().toLowerCase()) {
          // We build the identity exactly how lib/players.ts does it
          const identity = [
            row[2], // First
            row[3], // Last
            row[4], // Age
            row[5], // Offense
            row[6], // Defense
            row[7]  // Special
          ].map(val => String(val || '').trim().toLowerCase()).join('|');
          
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

  } catch (err: unknown) {
    console.error('[DEBUG] GET ERROR:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error', summary: {}, selections: {} }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { team, year, selections } = await req.json();
    
    const timestamp = new Date().toLocaleString('en-US', { 
      timeZone: 'America/New_York',
      hour12: false 
    }).replace(',', '');

    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    // Fetch master player list to get fresh data for identities
    const playersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV',
    });
    const playerRows = playersRes.data.values || [];
    const parsedPlayers = parsePlayers(playerRows);

    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', 
    });

    const allRows = currentSheet.data.values || [];
    const header = allRows[0] || ["Year", "Team", "First", "Last", "Age", "Offense", "Defense", "Special", "Status", "Timestamp"]; 

    const otherRows = allRows.slice(1).filter((row) => {
      const isMatch = String(row[0]).trim() === String(year).trim() && 
                      String(row[1]).trim() === String(team).trim();
      return !isMatch;
    });

    const newTeamRows = selections.map((sel: { identity: string; status: string }) => {
      // Find the player in our master list to get accurate fields
      const p = parsedPlayers.find(player => player.identity === sel.identity);
      
      const first = p ? p.first : sel.identity.split('|')[0];
      const last = p ? p.last : sel.identity.split('|')[1];
      const age = p ? p.age : sel.identity.split('|')[2];
      const off = p ? p.offense : sel.identity.split('|')[3];
      const def = p ? p.defense : sel.identity.split('|')[4];
      const spec = p ? p.special : sel.identity.split('|')[5];

      const statusFormatted = sel.status.charAt(0).toUpperCase() + sel.status.slice(1);
      
      return [year, team, first, last, age, off, def, spec, statusFormatted, timestamp];
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
  } catch (err: unknown) {
    console.error('[DEBUG] POST ERROR:', err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}