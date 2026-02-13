import { getSheetsClient } from '@/lib/google-cloud';
import { parsePlayers } from '@/lib/players';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction } from '@/lib/transactions';
import { getCoaches } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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
      coach: row[5] || '',        // Column G: "Owner" (Coach Name)
      status: row[6] || '',       // Column G
      weekBack: row[7] || ''      // Column H
    })).reverse();

    return Response.json(data);
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, identity, toTeam, details, fromTeam } = body;

    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const [res, coaches] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:CV' }),
      getCoaches()
    ]);

    const rows = res.data.values || [];
    
    // Create a map of Full Name -> Shortcode
    const teamMap = new Map(coaches.map(c => [c.team.toLowerCase(), c.teamshort]));

    const player = parsePlayers(rows).find(p => p.identity.trim().toLowerCase() === identity.trim().toLowerCase());
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const rowIndex = findPlayerRowIndex(rows, player);
    let newTeamValue = player.team;

    if (type === 'ADD' || type === 'INJURY PICKUP') {
      // Resolve "Vico" to "VV" using the map
      const lookup = toTeam.trim().toLowerCase();
      newTeamValue = teamMap.get(lookup) || toTeam; 
    } else if (type === 'DROP' || type === 'WAIVE') {
      newTeamValue = 'FA'; 
    } else if (type === 'IR' || type === 'IR MOVE') {
      // Keep existing shortcode but append -IR
      newTeamValue = `${player.team}-IR`;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newTeamValue]] },
    });

    await logTransaction({ ...body, fromTeam: fromTeam || player.team, details });

    return Response.json({ success: true });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
