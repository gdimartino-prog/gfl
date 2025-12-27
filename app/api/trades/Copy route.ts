import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { logTransaction } from '@/lib/transactions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      fromTeam, toTeam, playersFrom, playersTo, 
      draftPicksFrom, draftPicksTo, submittedBy,
      rawIdentitiesFrom, rawIdentitiesTo 
    } = body;

    const [playerRes, draftRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:I' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'DraftPicks!A:G' })
    ]);

    const playerRows = playerRes.data.values || [];
    const draftRows = draftRes.data.values || [];

    // --- IMPROVED FORMATTER ---
    const formatAssetString = (playerIdentities: string[], pickStrings: string[]) => {
      const titleCase = (str: string) => 
        str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const formattedPlayers = (playerIdentities || []).map(p => {
        if (p.includes('|')) {
          const parts = p.split('|');
          const firstName = titleCase(parts[0] || '');
          const lastName = titleCase(parts[1] || '');
          
          // Hunt for position starting earlier (Index 2+) 
          // to catch "te" in "jake|ferguson|25|te||"
          const position = parts.slice(2).find(part => 
            part && part.length >= 1 && part.length <= 5 && isNaN(Number(part))
          ) || 'PLAYER';

          return `${position.toUpperCase()} - ${firstName} ${lastName}`;
        }
        return titleCase(p);
      });

      return [...formattedPlayers, ...(pickStrings || [])].filter(Boolean).join(', ');
    };

    // Separate the strings clearly for each side of the trade
    const cleanAssetsFrom = formatAssetString(rawIdentitiesFrom, draftPicksFrom);
    const cleanAssetsTo = formatAssetString(rawIdentitiesTo, draftPicksTo);

    // --- EXECUTE UPDATES ---
    const updatePromises: Promise<any>[] = [];

    const findPlayerRow = (id: string) => playerRows.findIndex(r => 
      `${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[5]}|${r[6]}`.toLowerCase() === id.toLowerCase()
    );

    const findDraftRow = (pickString: string) => {
      const match = pickString.match(/#(\d+)/);
      if (!match) return -1;
      return draftRows.findIndex(r => String(r[2]).trim() === String(match[1]).trim());
    };

    // Updates for Proposer -> Partner
    rawIdentitiesFrom?.forEach(id => {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, toTeam));
    });
    draftPicksFrom?.forEach(pick => {
      const idx = findDraftRow(pick);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, toTeam));
    });

    // Updates for Partner -> Proposer
    rawIdentitiesTo?.forEach(id => {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, fromTeam));
    });
    draftPicksTo?.forEach(pick => {
      const idx = findDraftRow(pick);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, fromTeam));
    });

    await Promise.all(updatePromises);

    // --- LOG TRANSACTIONS (Two separate entries for the log) ---
    if (cleanAssetsFrom) {
      await logTransaction({
        type: 'TRADE',
        identity: cleanAssetsFrom, 
        fromTeam, toTeam, coach: submittedBy,
      });
    }

    if (cleanAssetsTo) {
      await logTransaction({
        type: 'TRADE',
        identity: cleanAssetsTo,
        fromTeam: toTeam,
        toTeam: fromTeam,
        coach: submittedBy,
      });
    }

    return Response.json({ success: true });

  } catch (error: any) {
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