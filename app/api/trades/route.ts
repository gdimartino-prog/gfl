import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { logTransaction } from '@/lib/transactions';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      fromTeam, 
      toTeam, 
      playersFrom, // Array: ["pos - name", ...]
      playersTo, 
      draftPicksFrom, 
      draftPicksTo, 
      submittedBy,
      rawIdentitiesFrom,
      rawIdentitiesTo 
    } = body;

    // --- 1. CLEAN STRING BUILDER (Proper Case & Formatting) ---
    const formatAssetString = (players: string[], picks: string[]) => {
      const formattedPlayers = players.map(p => {
        const [pos, name] = p.split(' - ');
        
        // Uppercase Position: "s" -> "S"
        const cleanPos = pos?.toUpperCase();
        
        // Proper Case Name: "amani hooker" -> "Amani Hooker"
        const cleanName = name
          ?.split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
          .join(' ');

        return `${cleanPos} - ${cleanName}`;
      });

      const formattedPicks = picks.map(p => {
        const [y, r] = p.split('-');
        return `Draft Pick Year ${y} Round ${r}`;
      });

      return [...formattedPlayers, ...formattedPicks].join(', ');
    };

    const cleanAssetsFrom = formatAssetString(playersFrom, draftPicksFrom);
    const cleanAssetsTo = formatAssetString(playersTo, draftPicksTo);

    // --- 2. LOG THE TWO DISTINCT ROWS ---
    await logTransaction({
      type: 'TRADE',
      identity: cleanAssetsFrom, 
      fromTeam: fromTeam,
      toTeam: toTeam,
      coach: submittedBy,
    });

    await logTransaction({
      type: 'TRADE',
      identity: cleanAssetsTo, 
      fromTeam: toTeam,
      toTeam: fromTeam,
      coach: submittedBy,
    });

    // --- 3. ROSTER UPDATES ---
    const sheetRes = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:G',
    });
    const rows = sheetRes.data.values || [];
    const updatePromises = [];

    const findRow = (id: string) => rows.findIndex(r => 
      `${r[1]}|${r[2]}|${r[3]}|${r[4]}|${r[5]}|${r[6]}`.toLowerCase() === id.toLowerCase()
    );

    rawIdentitiesFrom?.forEach((id: string) => {
      const idx = findRow(id);
      if (idx !== -1) updatePromises.push(updatePlayerCell(idx + 1, toTeam));
    });

    rawIdentitiesTo?.forEach((id: string) => {
      const idx = findRow(id);
      if (idx !== -1) updatePromises.push(updatePlayerCell(idx + 1, fromTeam));
    });

    await Promise.all(updatePromises);

    return Response.json({ 
      success: true, 
      logs: [cleanAssetsFrom, cleanAssetsTo] 
    });

  } catch (error: any) {
    return Response.json({ success: false, error: error.message }, { status: 500 });
  }
}

async function updatePlayerCell(rowNum: number, teamValue: string) {
  return sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `Players!A${rowNum}`,
    valueInputOption: 'RAW',
    requestBody: { values: [[teamValue]] },
  });
}