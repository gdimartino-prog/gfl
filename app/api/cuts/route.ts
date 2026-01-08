export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get('team');
  const yearParam = req.nextUrl.searchParams.get('year');

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J',
    });

    const rows = result.data.values || [];
    let lastTime = "";
    const leagueSummary: Record<string, { protected: number, pullback: number, lastUpdated: string }> = {};

    rows.slice(1).forEach(row => {
      if (row && row.length >= 2) {
        const rowYear = String(row[0] || '').trim();
        // Only count if it matches the requested year
        if (rowYear === yearParam) {
          const teamCode = String(row[1] || '').trim();
          const status = String(row[8] || '').trim().toLowerCase();
          const rowTime = row[9] || '';

          if (teamCode) {
            if (!leagueSummary[teamCode]) {
              leagueSummary[teamCode] = { protected: 0, pullback: 0, lastUpdated: "" };
            }
            if (status === 'protected') leagueSummary[teamCode].protected++;
            if (status === 'pullback') leagueSummary[teamCode].pullback++;
            
            if (rowTime && (!leagueSummary[teamCode].lastUpdated || rowTime > leagueSummary[teamCode].lastUpdated)) {
              leagueSummary[teamCode].lastUpdated = rowTime;
            }
          }
        }
      }
    });

    const previousCuts = rows.reduce((acc: Record<string, string>, row) => {
      if (row && row.length >= 2) {
        if (String(row[0]).trim() === yearParam && String(row[1]).trim() === String(team).trim()) {
          const identity = `${row[2]}|${row[3]}|${row[4]}|${row[5]}|${row[6]}|${row[7]}`.toLowerCase();
          acc[identity] = String(row[8] || '').toLowerCase(); 
          if (row[9]) lastTime = row[9];
        }
      }
      return acc;
    }, {});

    return NextResponse.json({ 
      selections: previousCuts, 
      lastUpdated: lastTime,
      summary: leagueSummary 
    });
  } catch (err) {
    console.error('Cuts GET Error:', err);
    return NextResponse.json({ selections: {}, lastUpdated: "", summary: {} });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { team, year, selections } = await req.json();
    
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York',
      month: '2-digit', day: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
    }).replace(',', '');

    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', 
    });

    const allRows = currentSheet.data.values || [];
    const header = allRows[0] || ["Year", "Team", "First", "Last", "Pos", "Age", "Team2", "ID", "Status", "Timestamp"]; 

    const cleanedRows = allRows.filter((row, index) => {
      if (index === 0) return false; 
      return !(String(row[0]).trim() === String(year).trim() && String(row[1]).trim() === String(team).trim());
    });

    const newTeamRows = selections.map((p: any) => {
      const identityParts = p.identity.split('|'); 
      const displayStatus = p.status.charAt(0).toUpperCase() + p.status.slice(1);
      return [year, team, ...identityParts, displayStatus, timestamp];
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A1', 
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [header, ...cleanedRows, ...newTeamRows] },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json({ error: 'Failed to update Cuts sheet' }, { status: 500 });
  }
}