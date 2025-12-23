import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction } from '@/lib/transactions';

export async function POST(req: Request) {
  try {
    // 1️⃣ Parse request body
    const body = await req.json();
    console.log('TRANSACTION REQUEST:', body);

    const {
      type,        // ADD | DROP | IR
      identity,    // first|last|age|offense|defense|special
      fromTeam,
      toTeam,
      coach
    } = body;

    // 2️⃣ Basic validation
    if (!type || !identity || !coach) {
      return Response.json(
        { success: false, error: 'Missing required fields (type, identity, or coach)' },
        { status: 400 }
      );
    }

    // 3️⃣ Load Players sheet to find the current state of the player
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    const rows = res.data.values || [];
    const players = parsePlayers(rows);

    // 4️⃣ Find player by identity
    // We trim and lowercase to ensure a perfect match
    const player = players.find(p => p.identity.trim().toLowerCase() === identity.trim().toLowerCase());

    if (!player) {
      return Response.json(
        { success: false, error: `Player not found: ${identity}` },
        { status: 404 }
      );
    }

    // 5️⃣ Find row index in sheet (Helper usually returns 1-based index or index + offset)
    const rowIndex = findPlayerRowIndex(rows, player);
    if (rowIndex === -1) {
      throw new Error('Player found in list but row index could not be determined.');
    }

    // 6️⃣ Handle transaction types and determine the new Team value
    let newTeam = player.team;

    if (type === 'ADD') {
      if (!toTeam) {
        return Response.json({ success: false, error: 'toTeam required for ADD' }, { status: 400 });
      }
      newTeam = toTeam;
    }

    else if (type === 'DROP') {
      newTeam = 'FA';
    }

    else if (type === 'IR') {
      if (player.team.endsWith('-IR')) {
        return Response.json(
          { success: false, error: 'Player is already on Injured Reserve' },
          { status: 400 }
        );
      }
      // Only move to IR if they are currently on a team
      if (player.team === 'FA') {
        return Response.json(
          { success: false, error: 'Cannot move Free Agent to IR. Add them to a team first.' },
          { status: 400 }
        );
      }
      newTeam = `${player.team}-IR`;
    }

    // 7️⃣ Update team column (Column A) in the Spreadsheet
    // We target 'Players!A' + rowIndex
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[newTeam]],
      },
    });

    // 8️⃣ Log the transaction to the 'Transactions' sheet for history
    await logTransaction({
      type,
      identity,
      fromTeam: player.team,
      toTeam: newTeam,
      coach,
    });

    // 9️⃣ Final Success Response
    return Response.json({ 
      success: true, 
      message: `Successfully processed ${type} for ${identity}`,
      updatedTeam: newTeam 
    });

  } catch (err: any) {
    console.error('TRANSACTION SERVER ERROR:', err);
    return Response.json(
      { success: false, error: err.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}