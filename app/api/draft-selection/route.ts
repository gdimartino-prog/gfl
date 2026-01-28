import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';

// 1/28/26 3:33pm

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    // 🔍 This will show up in your TERMINAL
    console.log("DEBUG: Received Body:", body);
  

    const { overallPick, playerIdentity, playerName, playerPosition, newOwnerCode, coachName } = body;

    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York', 
      hour12: false
    }).replace(',', '');

    // 1. Find Draft Row
    const picksRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!C:C',
    });
    const draftRows = picksRes.data.values || [];
    
    // Use .trim() to avoid hidden space mismatches
    const foundIndex = draftRows.findIndex(row => String(row[0]).trim() === String(overallPick).trim());
    
    if (foundIndex === -1) {
      console.error("❌ ERROR: Pick Number not found in Column C:", overallPick);
      return NextResponse.json({ error: `Pick #${overallPick} not found.` }, { status: 400 });
    }

    const draftRowIndex = foundIndex + 1;
    const draftString = `${playerPosition} - ${playerName}`;

    // 2. Update DraftPicks
    console.log(`DEBUG: Updating DraftPicks Row ${draftRowIndex}`);
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!F${draftRowIndex}:J${draftRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { 
        values: [['Completed', draftString, timestamp, '', coachName || 'Admin']] 
      },
    });

    // 3. Update Players Sheet
    const playersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV', 
    });
    const allPlayerRows = playersRes.data.values || [];
    const parsedPlayers = parsePlayers(allPlayerRows);

    const playerToUpdate = parsedPlayers.find(
      (p) => p.identity?.toLowerCase().trim() === playerIdentity?.toLowerCase().trim()
    );

    if (playerToUpdate) {
      const playerRowIndex = findPlayerRowIndex(allPlayerRows, playerToUpdate);
      
      // 🚀 CRITICAL CHECK: Ensure the index is valid for Sheets
      if (playerRowIndex > 0) {
        console.log(`DEBUG: Updating Player Row ${playerRowIndex}`);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Players!A${playerRowIndex}`, 
          valueInputOption: 'USER_ENTERED',
          requestBody: { values: [[newOwnerCode]] },
        });
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    // 🔍 CHECK YOUR TERMINAL FOR THIS MESSAGE
    console.error("❌ SERVER CRASH:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}