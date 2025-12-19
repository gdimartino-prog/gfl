import { sheets, SHEET_ID } from '../../../lib/googleSheets';
import { parsePlayers } from '../../../lib/players';
import { findPlayerRowIndex } from '../../../lib/playerLookup';
import { logTransaction } from '../../../lib/transactions';
import { getCoaches } from '../../../lib/config';

// Trade type
type Trade = {
  id: string;
  playersFrom: string[];
  playersTo: string[];
  fromTeam: string;
  toTeam: string;
  submittedBy: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  timestamp: string;
};

// -------------------- POST /api/trades --------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { playersFrom, playersTo, fromTeam, toTeam, submittedBy } = body;

    if (!playersFrom || !playersTo || !fromTeam || !toTeam || !submittedBy) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Load all players
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });
    const rows = res.data.values || [];
    const players = parsePlayers(rows);

    // Validate all players exist and belong to correct team
    for (const identity of playersFrom) {
      const p = players.find(pl => pl.identity === identity);
      if (!p) return Response.json({ success: false, error: `Player not found: ${identity}` }, { status: 404 });
      if (p.team !== fromTeam) return Response.json({ success: false, error: `Player ${identity} not on team ${fromTeam}` }, { status: 400 });
    }

    for (const identity of playersTo) {
      const p = players.find(pl => pl.identity === identity);
      if (!p) return Response.json({ success: false, error: `Player not found: ${identity}` }, { status: 404 });
      if (p.team !== toTeam) return Response.json({ success: false, error: `Player ${identity} not on team ${toTeam}` }, { status: 400 });
    }

    const timestamp = new Date().toISOString();
    const tradeId = `${timestamp}-${Math.floor(Math.random() * 1000)}`;

    // Log trade as PENDING in Transactions tab
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Transactions',
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          timestamp,
          'TRADE',
          [...playersFrom, ...playersTo].join(','),
          fromTeam,
          toTeam,
          submittedBy,
          'PENDING',
          tradeId
        ]]
      }
    });

    return Response.json({ success: true, tradeId });

  } catch (err: any) {
    console.error('TRADE POST ERROR:', err);
    return Response.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}

// -------------------- PATCH /api/trades --------------------
export async function PATCH(req: Request) {
  try {
    const body = await req.json();
    const { tradeId, approve, commissioner } = body;

    if (!tradeId || typeof approve !== 'boolean' || !commissioner) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    // Validate commissioner
    const coaches = await getCoaches(); // from config tab
    const comm = coaches.find(c => c.coach === commissioner && c.isCommissioner);
    if (!comm) return Response.json({ success: false, error: 'Not authorized' }, { status: 403 });

    // Load Transactions
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions',
    });
    const transRows = transRes.data.values || [];

    const index = transRows.findIndex(r => r[7] === tradeId); // tradeId is column H (index 7)
    if (index === -1) return Response.json({ success: false, error: 'Trade not found' }, { status: 404 });

    const tradeRow = transRows[index];
    const status = approve ? 'APPROVED' : 'REJECTED';
    const fromTeam = tradeRow[3];
    const toTeam = tradeRow[4];
    const identities = tradeRow[2].split(',');

    // If approved, swap players
    if (approve) {
      const resPlayers = await sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players' });
      const rows = resPlayers.data.values || [];
      const players = parsePlayers(rows);

      for (const identity of identities) {
        const player = players.find(p => p.identity === identity);
        if (!player) continue;

        let newTeam = player.team;
        if (player.team === fromTeam) newTeam = toTeam;
        else if (player.team === toTeam) newTeam = fromTeam;

        const rowIndex = findPlayerRowIndex(rows, player);
        await sheets.spreadsheets.values.update({
          spreadsheetId: SHEET_ID,
          range: `Players!A${rowIndex}`,
          valueInputOption: 'RAW',
          requestBody: { values: [[newTeam]] }
        });
      }
    }

    // Update trade status in Transactions tab
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Transactions!G${index + 1}`, // column G = status
      valueInputOption: 'RAW',
      requestBody: { values: [[status]] }
    });

    return Response.json({ success: true, tradeId, status });

  } catch (err: any) {
    console.error('TRADE PATCH ERROR:', err);
    return Response.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}

// -------------------- GET /api/trades --------------------
export async function GET(req: Request) {
  try {
    const transRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Transactions',
    });
    const transRows = transRes.data.values || [];

    const trades = transRows
      .filter(r => r[1] === 'TRADE')
      .map(r => ({
        timestamp: r[0],
        type: r[1],
        identities: r[2].split(','),
        fromTeam: r[3],
        toTeam: r[4],
        submittedBy: r[5],
        status: r[6],
        tradeId: r[7]
      }));

    return Response.json({ success: true, trades });

  } catch (err: any) {
    console.error('TRADE GET ERROR:', err);
    return Response.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
