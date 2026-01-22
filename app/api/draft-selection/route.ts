import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';

export async function POST(req: NextRequest) {
  try {
    const { overallPick, playerIdentity, playerName, playerPosition, newOwnerCode } = await req.json();

    // 1. Generate Timestamp
    const timestamp = new Date().toLocaleString('en-US', {
      timeZone: 'America/New_York', 
      month: '2-digit', 
      day: '2-digit', 
      year: 'numeric',
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit', 
      hour12: false
    }).replace(',', '');

    // 2. Find and Update DraftPicks Status
    const picksRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'DraftPicks!C:C',
    });
    const draftRows = picksRes.data.values || [];
    const draftRowIndex = draftRows.findIndex(row => row[0] === String(overallPick)) + 1;

    if (draftRowIndex === 0) throw new Error('Pick not found');

    const draftString = `${playerPosition} - ${playerName}`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!F${draftRowIndex}:H${draftRowIndex}`,
      valueInputOption: 'USER_ENTERED',
      requestBody: { values: [['Completed', draftString, timestamp]] },
    });

    // 3. Update Players Sheet (Assign team)
    const playersRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV', 
    });
    const allPlayerRows = playersRes.data.values || [];

    // Parse players using your library to handle header mapping and identities
    const parsedPlayers = parsePlayers(allPlayerRows);

    // Match by stable identity string
    const playerToUpdate = parsedPlayers.find(
      (p) => p.identity.toLowerCase().trim() === playerIdentity.toLowerCase().trim()
    );

    if (playerToUpdate) {
      const playerRowIndex = findPlayerRowIndex(allPlayerRows, playerToUpdate);
      
      console.log(`Match found at row ${playerRowIndex}. Updating team to ${newOwnerCode}`);
      
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `Players!A${playerRowIndex}`, 
        valueInputOption: 'USER_ENTERED',
        requestBody: { values: [[newOwnerCode]] },
      });
    } else {
      // This is where the error was happening; the brace before this else was incorrect
      console.error("No player match found for identity:", playerIdentity);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Draft API Error:", error.message);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}