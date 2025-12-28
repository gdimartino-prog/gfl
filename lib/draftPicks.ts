import { sheets, SHEET_ID } from './googleSheets';

const SHEET = 'DraftPicks';

// Updated to match your 7-column spreadsheet structure
export type DraftPick = {
  year: number;
  round: number;
  overall: number;     // Overall Pick Number (Col D)
  originalTeam: string; // Original Team (Col E)
  currentOwner: string; // Current Owner (Col F)
  status: string;      // Status (Col G)
};

/**
 * Get all draft picks with full details
 */
export async function getAllDraftPicks(): Promise<DraftPick[]> {
  try {
    // Range A to G covers all your columns
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:G`,
    });

    const rows = res.data.values;

    if (!Array.isArray(rows)) {
      return [];
    }

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
  round: number
) {
  const rows = await getAllDraftPicks();

  return rows.find(
    r =>
      r.year === year &&
      r.round === round &&
      r.currentOwner.toLowerCase() === currentOwner.toLowerCase()
  );
}

/**
 * Transfer a draft pick by updating the 'Current Owner' (Column F)
 */
export async function transferDraftPick(
  fromTeam: string,
  toTeam: string,
  year: number,
  round: number,
  overall: number
) {
  try {
    // 1. Fetch the data to find the row index
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:G`,
    });

    const rows = res.data.values || [];

    // 2. Find the row where Year, Round, and CURRENT OWNER match the trade
    const rowIndex = rows.findIndex(
      r =>
        Number(r[0]) === year &&
        Number(r[1]) === round &&
        r[5]?.toLowerCase() === fromTeam.toLowerCase() // Column F is index 5
    );

    if (rowIndex === -1) {
      throw new Error(
        `Pick ${year} R${round} not found for owner ${fromTeam}`
      );
    }

    // rowIndex is 0-based for the data range starting at A2, so add 2
    const sheetRow = rowIndex + 2;

    // 3. Update Column F (Current Owner) only
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!F${sheetRow}`, // Specifically target Column F
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