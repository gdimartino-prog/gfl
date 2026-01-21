import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { logTransaction } from '@/lib/transactions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      fromTeam, toTeam, fromFull, toFull, submittedBy,
      playersFrom, playersTo, rawIdentitiesFrom, rawIdentitiesTo,
      draftPicksFrom, draftPicksTo, rawPicksFrom, rawPicksTo, status 
    } = body;

    const [playerRes, draftRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:A' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'DraftPicks!C:C' })
    ]);

    const playerRows = playerRes.data.values || [];
    const draftRows = draftRes.data.values || [];
    const updatePromises: Promise<any>[] = [];

    // --- EXECUTE ASSET MOVEMENT (Ownership Updates) ---
    rawIdentitiesFrom?.forEach((id: string) => {
      const idx = playerRows.findIndex(r => r[0] === id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, toTeam));
    });

    rawPicksFrom?.forEach((overall: string) => {
      const idx = draftRows.findIndex(r => String(r[0]).trim() === String(overall).trim());
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, toTeam));
    });

    rawIdentitiesTo?.forEach((id: string) => {
      const idx = playerRows.findIndex(r => r[0] === id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, fromTeam));
    });

    rawPicksTo?.forEach((overall: string) => {
      const idx = draftRows.findIndex(r => String(r[0]).trim() === String(overall).trim());
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, fromTeam));
    });

    await Promise.all(updatePromises);

    // --- LOG TRANSACTIONS ---
    const proposerAssets = [...(playersFrom || []), ...(draftPicksFrom || [])].join(', ');
    const partnerAssets = [...(playersTo || []), ...(draftPicksTo || [])].join(', ');

    if (proposerAssets) {
      await logTransaction({
        type: 'TRADE',
        identity: proposerAssets, // ADD THIS LINE (Fixes the build error)
        details: proposerAssets,  
        fromTeam: fromFull,
        toTeam: toFull,
        coach: submittedBy,
        status: status || 'PENDING'
      });
    }

    if (partnerAssets) {
      await logTransaction({
        type: 'TRADE',
        identity: partnerAssets, // ADD THIS LINE (Fixes the build error)
        details: partnerAssets,
        fromTeam: toFull,
        toTeam: fromFull,
        coach: submittedBy,
        status: status || 'PENDING'
      });
    }
    
  return Response.json({ success: true });
  } catch (error: any) {
    console.error("Trade API Error:", error);
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function updateCell(sheetName: string, column: string, rowNum: number, value: string) {
  return sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${column}${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}