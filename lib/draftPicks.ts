import { sheets, SHEET_ID } from './googleSheets';

const SHEET = 'DraftPicks';

// Updated to match your spreadsheet structure
export type DraftPick = {
  year: number;
  round: number;
  overall: number;     
  originalTeam: string; 
  currentOwner: string; 
  status: string;      
};

/**
 * Get all draft picks with full details
 */
export async function getAllDraftPicks(): Promise<DraftPick[]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:G`,
    });

    const rows = res.data.values;
    if (!Array.isArray(rows)) return [];

    return rows.map(r => ({
      year: Number(r[0]),
      round: Number(r[1]),
      overall: Number(r[2]),
      originalTeam: r[3] || '',
      currentOwner: r[4] || '',
      status: r[5] || 'Active',
    }));
  } catch (error) {
    console.error('getAllDraftPicks failed:', error);
    throw error;
  }
}

/**
 * Find a specific pick using Year, Round, and the Current Owner
 */
export async function findDraftPick(
  currentOwner: string,
  year: number,
  round: number,
  overall?: number // Added overall here for consistency
) {
  const rows = await getAllDraftPicks();

  return rows.find(
    r =>
      r.year === year &&
      r.round === round &&
      r.currentOwner.toLowerCase() === currentOwner.toLowerCase() &&
      (!overall || r.overall === overall) // Match pick number if provided
  );
}

/**
 * Transfer a draft pick by updating the 'Current Owner' (Column E)
 * Note: Index 4 is Column E. Index 5 is Column F. 
 * Based on your GET request in the route, currentOwner is index 4 (Col E).
 */
export async function transferDraftPick(
  fromTeam: string,
  toTeam: string,
  year: number,
  round: number,
  overall?: number // FIX: This 5th argument now exists!
) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:G`,
    });

    const rows = res.data.values || [];

    // Find the row. We prioritize 'overall' if it's available.
    const rowIndex = rows.findIndex(r => {
      const matchesYear = Number(r[0]) === year;
      const matchesRound = Number(r[1]) === round;
      const matchesOwner = r[4]?.toLowerCase() === fromTeam.toLowerCase();
      
      if (overall) {
        return matchesYear && matchesRound && Number(r[2]) === overall;
      }
      return matchesYear && matchesRound && matchesOwner;
    });

    if (rowIndex === -1) {
      throw new Error(`Pick ${year} R${round} (Pick #${overall}) not found for ${fromTeam}`);
    }

    const sheetRow = rowIndex + 2;

    // Update Column E (Index 4) which is the Current Owner
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!E${sheetRow}`, 
      valueInputOption: 'RAW',
      requestBody: {
        values: [[toTeam]],
      },
    });
  } catch (error) {
    console.error('transferDraftPick failed:', error);
    throw error;
  }
}