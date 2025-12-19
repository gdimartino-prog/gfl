import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction } from '@/lib/transactions';

export async function POST(req: Request) {
  try {
    // 1️⃣ Parse request body
    const body = await req.json();
    console.log('TRANSACTION BODY:', body);

    const {
      type,        // ADD | DROP | IR
      identity,    // concatenated identity string
      fromTeam,
      toTeam,
      coach
    } = body;

    // 2️⃣ Basic validation
    if (!type || !identity || !coach) {
      return Response.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // 3️⃣ Load Players sheet
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    const rows = res.data.values || [];
    const players = parsePlayers(rows);

    // 4️⃣ Find player by identity
    const player = players.find(p => p.identity === identity);

    if (!player) {
      return Response.json(
        { success: false, error: 'Player not found' },
        { status: 404 }
      );
    }

    // 5️⃣ Find row index in sheet
    const rowIndex = findPlayerRowIndex(rows, player);

    // 6️⃣ Handle transaction types
    let newTeam = player.team;

    if (type === 'ADD') {
      if (!toTeam) {
        return Response.json(
          { success: false, error: 'toTeam required for ADD' },
          { status: 400 }
        );
      }

      newTeam = toTeam;
    }

    if (type === 'DROP') {
      newTeam = 'FA';
    }

    if (type === 'IR') {
      if (player.team.endsWith('-IR')) {
        return Response.json(
          { success: false, error: 'Player already on IR' },
          { status: 400 }
        );
      }

      newTeam = `${player.team}-IR`;
    }

    // 7️⃣ Update team column (column A)
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[newTeam]],
      },
    });

    // 8️⃣ Log transaction
    await logTransaction({
      type,
      identity,
      fromTeam: player.team,
      toTeam: newTeam,
      coach,
    });

    // 9️⃣ Success
    return Response.json({ success: true });

  } catch (err: any) {
    console.error('TRANSACTION ERROR:', err);

    return Response.json(
      { success: false, error: err.message || 'Unknown error' },
      { status: 500 }
    );
  }
}
