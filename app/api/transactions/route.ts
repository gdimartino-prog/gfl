import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction } from '@/lib/transactions';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions!A:J', 
    });

    const rows = response.data.values || [];
    if (rows.length === 0) return Response.json([]);

    // Mapping based on your Google Sheet columns
    const data = rows.slice(1).map((row) => ({
      timestamp: row[0] || '',
      type: row[1] || '',
      details: row[2] || '',      // Column C: "Desc" (The Description)
      fromFull: row[3] || '',     // Column D
      toFull: row[4] || '',       // Column E
      fromShort: row[5] || '',    // Column F
      toShort: row[6] || '',      // Column G
      coach: row[7] || '',        // Column H: "Owner" (Coach Name)
      status: row[8] || '',       // Column I
      weekBack: row[9] || ''      // Column J
    })).reverse();

    return Response.json(data);
  } catch (error: any) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, identity, toTeam, coach, details, status, weekBack, fromTeam } = body;

    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID, range: 'Players',
    });

    const rows = res.data.values || [];
    const player = parsePlayers(rows).find(p => p.identity.trim().toLowerCase() === identity.trim().toLowerCase());

    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const rowIndex = findPlayerRowIndex(rows, player);
    let newTeamValue = player.team;

    if (type === 'ADD' || type === 'INJURY PICKUP') newTeamValue = toTeam;
    else if (type === 'DROP') newTeamValue = 'FA';
    else if (type === 'IR') newTeamValue = `${player.team}-IR`;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newTeamValue]] },
    });

    await logTransaction({
      ...body,
      fromTeam: fromTeam || player.team,
      details: details 
    });

    return Response.json({ success: true });
  } catch (err: any) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}