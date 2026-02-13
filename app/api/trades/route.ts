import { getSheetsClient } from '@/lib/google-cloud';
import { logTransaction } from '@/lib/transactions';
import { auth } from "@/auth";

export async function POST(req: Request) {
  // 1. Correctly fetch session for Next.js App Router
  const session = await auth();

  // 2. Authorization Check (Only George or an Admin can finalize trades)
  const isAdmin = session?.user?.name === "George Di Martino" || (session?.user as { role?: string })?.role === "admin";

  if (!isAdmin) {
    return Response.json({ message: "Unauthorized: Admin access required to process trades." }, { status: 401 });
  }

  try {
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const body = await req.json();
    const { 
      fromTeam, toTeam, fromFull, toFull, submittedBy,
      playersFrom, playersTo, rawIdentitiesFrom, rawIdentitiesTo,
      draftPicksFrom, draftPicksTo, rawPicksFrom, rawPicksTo, status 
    } = body;

    // Fetch master lists for ID matching
    const [playerRes, draftRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:A' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'DraftPicks!C:C' }) // Matching by Overall Pick
    ]);

    const playerRows = playerRes.data.values || [];
    const draftRows = draftRes.data.values || [];
    const updatePromises: Promise<unknown>[] = [];

    // --- EXECUTE ASSET MOVEMENT (Ownership Updates) ---

    // Move Proposer Assets -> Partner
    rawIdentitiesFrom?.forEach((id: string) => {
      const idx = playerRows.findIndex(r => r[0] === id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, toTeam));
    });

    rawPicksFrom?.forEach((overall: string) => {
      const idx = draftRows.findIndex(r => String(r[0]).trim() === String(overall).trim());
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, toTeam));
    });

    // Move Partner Assets -> Proposer
    rawIdentitiesTo?.forEach((id: string) => {
      const idx = playerRows.findIndex(r => r[0] === id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, fromTeam));
    });

    rawPicksTo?.forEach((overall: string) => {
      const idx = draftRows.findIndex(r => String(r[0]).trim() === String(overall).trim());
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, fromTeam));
    });

    // Execute all Google Sheet cell updates
    await Promise.all(updatePromises);

    // --- LOG TRANSACTIONS ---
    const proposerAssets = [...(playersFrom || []), ...(draftPicksFrom || [])].join(', ');
    const partnerAssets = [...(playersTo || []), ...(draftPicksTo || [])].join(', ');

    if (proposerAssets) {
      await logTransaction({
        type: 'TRADE',
        identity: proposerAssets,
        details: `Traded to ${toFull}: ${proposerAssets}`,
        fromTeam: fromFull,
        toTeam: toFull,
        coach: submittedBy,
        status: status || 'COMPLETED'
      });
    }

    if (partnerAssets) {
      await logTransaction({
        type: 'TRADE',
        identity: partnerAssets,
        details: `Traded to ${fromFull}: ${partnerAssets}`,
        fromTeam: toFull,
        toTeam: fromFull,
        coach: submittedBy,
        status: status || 'COMPLETED'
      });
    }

    return Response.json({ success: true });
  } catch (error: unknown) {
    console.error("Trade API Error:", error);
    return Response.json({ success: false, error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

async function updateCell(sheetName: string, column: string, rowNum: number, value: string) {
  const sheets = getSheetsClient();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

  return sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${sheetName}!${column}${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[value]] },
  });
}