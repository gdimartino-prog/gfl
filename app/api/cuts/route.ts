import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export async function GET(req: NextRequest) {
  const team = req.nextUrl.searchParams.get('team');
  const year = req.nextUrl.searchParams.get('year');

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', // Extended to Col J for timestamps
    });

    const rows = result.data.values || [];
    let lastTime = "";

    const previousCuts = rows.reduce((acc: Record<string, string>, row) => {
      if (row[0] === year && row[1] === team) {
        const identity = `${row[2]}|${row[3]}|${row[4]}|${row[5]}|${row[6]}|${row[7]}`.toLowerCase();
        acc[identity] = row[8]; 
        if (row[9]) lastTime = row[9]; // Capture timestamp from Col J
      }
      return acc;
    }, {});

    return NextResponse.json({ selections: previousCuts, lastUpdated: lastTime });
  } catch (err) {
    return NextResponse.json({ selections: {}, lastUpdated: "" });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { team, year, selections } = await req.json();
    const timestamp = new Date().toLocaleString();

    // 1. Fetch current data from the Cuts sheet
    const currentSheet = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A:J', // Adjust range to match your column count
    });

    const allRows = currentSheet.data.values || [];
    const header = allRows[0]; // Preserve the header row

    // 2. Filter out any existing rows for this Team and Year
    // Assumes Column A (index 0) is Year and Column B (index 1) is Team
    const cleanedRows = allRows.filter((row, index) => {
      if (index === 0) return false; // Remove header from this array for now
      const rowYear = row[0];
      const rowTeam = row[1];
      return !(rowYear == year && rowTeam == team);
    });

    // 3. Prepare the new rows for this team
    const newTeamRows = selections.map((p: any) => {
      const identityParts = p.identity.split('|'); 
      return [
        year,
        team,
        ...identityParts,
        p.status,
        timestamp
      ];
    });

    // 4. Combine: Header + Remaining Old Data + New Submission
    const finalData = [header, ...cleanedRows, ...newTeamRows];

    // 5. Overwrite the sheet with the clean, updated data
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Cuts!A1', 
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: finalData },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Submit Error:', err);
    return NextResponse.json({ error: 'Failed to update Cuts sheet' }, { status: 500 });
  }
}