import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction } from '@/lib/transactions';

// --- GET: Fetch all logs from the Transactions sheet ---
export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions!A:H', 
    });

    const rows = response.data.values || [];
    
    return Response.json(rows.slice(1).map((row) => ({
      timestamp: row[0],
      type: row[1],
      details: row[2],
      fullFrom: row[3], // Philadelphia Eagles
      fullTo: row[4],   // Dallas Cowboys
      fromShort: row[5], // PHI
      toShort: row[6],   // DAL
      coach: row[7],
      status: row[8]
    })).reverse());
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

// --- POST: Process single-player moves (Add/Drop/IR) ---
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, identity, toTeam, coach } = body;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    const rows = res.data.values || [];
    const players = parsePlayers(rows);
    const player = players.find(p => p.identity.trim().toLowerCase() === identity.trim().toLowerCase());

    if (!player) return Response.json({ success: false, error: 'Player not found' }, { status: 404 });

    const rowIndex = findPlayerRowIndex(rows, player);
    let newTeam = player.team;

    if (type === 'ADD') newTeam = toTeam;
    else if (type === 'DROP') newTeam = 'FA';
    else if (type === 'IR') newTeam = `${player.team}-IR`;

    // Update Player Sheet
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newTeam]] },
    });

    // Log to Transactions Sheet
    await logTransaction({
      type,
      identity,
      fromTeam: player.team,
      toTeam: newTeam,
      coach,
    });

    return Response.json({ success: true, updatedTeam: newTeam });
  } catch (err: any) {
    return Response.json({ success: false, error: err.message }, { status: 500 });
  }
}