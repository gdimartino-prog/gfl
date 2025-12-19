import { sheets, SHEET_ID } from '../../../lib/googleSheets';

// -------------------- POST /api/trades --------------------
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const {
      fromTeam,
      toTeam,
      playersFrom = [],
      playersTo = [],
      draftPicksFrom = [],
      draftPicksTo = [],
      submittedBy,
      logMessage // formatted string from frontend
    } = body;

    if (!fromTeam || !toTeam || !submittedBy) {
      return Response.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const timestamp = new Date().toLocaleDateString(); // e.g., "10/26/2025"
    const tradeId = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    const appendRows: any[][] = [];

    // Entry for fromTeam → toTeam
    if (playersFrom.length || draftPicksFrom.length) {
      appendRows.push([
        timestamp,
        'Trade',
        logMessage, // contains players & draft picks
        '', // empty column (optional)
        fromTeam,
        toTeam,
        submittedBy,
        tradeId
      ]);
    }

    // Entry for toTeam → fromTeam
    if (playersTo.length || draftPicksTo.length) {
      const logMessageTo = [...playersTo, ...draftPicksTo].join(', '); // simple fallback
      appendRows.push([
        timestamp,
        'Trade',
        logMessageTo,
        '',
        toTeam,
        fromTeam,
        submittedBy,
        tradeId
      ]);
    }

    // Append to Transactions tab
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: 'Transactions',
      valueInputOption: 'RAW',
      requestBody: {
        values: appendRows
      }
    });

    return Response.json({ success: true, tradeId });

  } catch (err: any) {
    console.error('TRADE POST ERROR:', err);
    return Response.json({ success: false, error: err.message || 'Unknown error' }, { status: 500 });
  }
}
