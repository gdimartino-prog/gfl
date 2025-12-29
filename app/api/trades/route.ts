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

    // 1. FETCH DATA
    const [playerRes, draftRes] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:I' }),
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'DraftPicks!A:G' })
    ]);

    const playerRows = playerRes.data.values || [];
    const draftRows = draftRes.data.values || [];

    // --- ASSET FORMATTER FOR LOGS ---
    const formatAssetString = (playerIdentities: string[], pickStrings: string[]) => {
      const titleCase = (str: string) => 
        str.toLowerCase().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

      const formattedPlayers = (playerIdentities || []).map(p => {
        if (p.includes('|')) {
          const parts = p.split('|');
          const firstName = titleCase(parts[0] || '');
          const lastName = titleCase(parts[1] || '');
          // Identify position by looking for short text strings in the identity parts
          const position = parts.slice(2).find(part => 
            part && part.length >= 1 && part.length <= 5 && isNaN(Number(part))
          ) || 'PLAYER';
          return `${position.toUpperCase()} - ${firstName} ${lastName}`;
        }
        return titleCase(p);
      });

      return [...formattedPlayers, ...(pickStrings || [])].filter(Boolean).join(', ');
    };

    const cleanAssetsFrom = formatAssetString(rawIdentitiesFrom, draftPicksFrom);
    const cleanAssetsTo = formatAssetString(rawIdentitiesTo, draftPicksTo);

    // --- EXECUTE UPDATES ---
    const updatePromises: Promise<any>[] = [];

    /**
     * UNIQUE PLAYER FINDER
     * p[0]=First (Col C) | p[1]=Last (Col D) | p[2]=Age (Col F)
     * p[3]=Pos1 (Col G)  | p[4]=Pos2 (Col H) | p[5]=Pos3 (Col I)
     */
    const findPlayerRow = (id: string) => {
      if (!id || !id.includes('|')) return -1;
      const p = id.toLowerCase().split('|');

      return playerRows.findIndex(r => {
        const match = (sheetVal: any, identityVal: any) => {
          // If the identity part is empty or missing, skip the check for that column
          if (identityVal === undefined || identityVal === '') return true;
          return String(sheetVal || '').toLowerCase().trim() === String(identityVal).toLowerCase().trim();
        };

        return (
          match(r[2], p[0]) && // First Name (C)
          match(r[3], p[1]) && // Last Name (D)
          match(r[5], p[2]) && // Age (F)
          match(r[6], p[3]) && // Position 1 (G)
          match(r[7], p[4]) && // Position 2 (H)
          match(r[8], p[5])    // Position 3 (I)
        );
      });
    };

    const findDraftRow = (pickString: string) => {
      const match = pickString.match(/#(\d+)/);
      if (!match) return -1;
      return draftRows.findIndex(r => String(r[2]).trim() === String(match[1]).trim());
    };

    // 1. Update Proposer Assets -> Move to Partner Team
    rawIdentitiesFrom?.forEach((id: string)=> {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, toTeam));
      else console.warn(`Player not found for update: ${id}`);
    });
    
    draftPicksFrom?.forEach(pick => {
      const idx = findDraftRow(pick);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, toTeam));
    });

    // 2. Update Partner Assets -> Move to Proposer Team
    rawIdentitiesTo?.forEach((id: string) => {
      const idx = findPlayerRow(id);
      if (idx !== -1) updatePromises.push(updateCell('Players', 'A', idx + 1, fromTeam));
      else console.warn(`Player not found for update: ${id}`);
    });

    draftPicksTo?.forEach(pick => {
      const idx = findDraftRow(pick);
      if (idx !== -1) updatePromises.push(updateCell('DraftPicks', 'E', idx + 1, fromTeam));
    });

    await Promise.all(updatePromises);

    // --- LOG TRANSACTIONS ---
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