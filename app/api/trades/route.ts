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

    // --- 1. FETCH DATA (Expanded range to column I to catch all positions) ---
    const [playerRes, draftRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:I' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'DraftPicks!A:G' })
    ]);

    const playerRows = playerRes.data.values || [];
    const draftRows = draftRes.data.values || [];

    const formatAssetString = (players: string[], picks: any[]) => {
      const titleCase = (str: string) => 
        str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      // 1. FORMAT PLAYERS
      const formattedPlayers = (players || []).map(p => {
        if (p.includes('|')) {
          const parts = p.split('|');
          const firstName = titleCase(parts[0] || '');
          const lastName = titleCase(parts[1] || '');
          
          // POSITION HUNT: 
          // 1. Check Special Teams (parts[8]), then Defense (parts[7]), then Offense (parts[6])
          // 2. Allow up to 5 characters to catch "DE-LB"
          const position = (parts[8] || parts[7] || parts[6] || parts.slice(2).find(part => 
            part && part.length >= 1 && part.length <= 5 && isNaN(Number(part))
          ) || 'PLAYER').trim();

          return `${position.toUpperCase()} - ${firstName} ${lastName}`.trim();
        }
        return titleCase(p);
      });

      // 2. FORMAT DRAFT PICKS
      const formattedPicks = (picks || []).map(overall => {
        const pickData = draftRows.find(r => 
          String(r[2]).trim() === String(overall).trim() || 
          String(r[3]).trim() === String(overall).trim()
        );
        
        if (pickData) {
          return `Draft Pick Year ${pickData[0]} Round ${pickData[1]}`;
        }
        return `Pick #${overall}`;
      });

      // 3. COMBINE AND CLEAN
      const allAssets = [...formattedPlayers, ...formattedPicks].filter(Boolean);
      return allAssets.join(', ');
    };

    const cleanAssetsFrom = formatAssetString(playersFrom, draftPicksFrom);
    const cleanAssetsTo = formatAssetString(playersTo, draftPicksTo);

    // --- 2. EXECUTE UPDATES ---
    const updatePromises: Promise<any>[] = [];

    const findPlayerRow = (id: string) => playerRows.findIndex(r => 
      `${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[5]}|${r[6]}`.toLowerCase() === id.toLowerCase()
    );

    rawIdentitiesFrom?.forEach((id: string) => {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, toTeam));
    });

    rawIdentitiesTo?.forEach((id: string) => {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, fromTeam));
    });

    const findDraftRow = (overall: string) => draftRows.findIndex(r => String(r[3]).trim() === String(overall).trim());

    draftPicksFrom?.forEach((overall: string) => {
      const idx = findDraftRow(overall);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'F', idx + 1, toTeam));
    });

    draftPicksTo?.forEach((overall: string) => {
      const idx = findDraftRow(overall);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'F', idx + 1, fromTeam));
    });

    await Promise.all(updatePromises);

    // --- 3. LOG TRANSACTIONS ---
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