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
  overall?: number,
  coachName?: string // 🚀 This 6th argument MUST be here
) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!A2:J`, // Extended to J to match your sheet
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => {
      const matchesYear = Number(r[0]) === year;
      const matchesRound = Number(r[1]) === round;
      if (overall) return Number(r[2]) === overall;
      return matchesYear && matchesRound && r[4]?.toLowerCase() === fromTeam.toLowerCase();
    });

    if (rowIndex === -1) throw new Error("Pick not found");

    const sheetRow = rowIndex + 2;

    // Update Owner in Column E
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!E${sheetRow}`, 
      valueInputOption: 'RAW',
      requestBody: { values: [[toTeam]] },
    });

    // Update Coach in Column J
    if (coachName) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `DraftPicks!J${sheetRow}`, 
        valueInputOption: 'RAW',
        requestBody: { values: [[coachName]] },
      });
    }
  } catch (error) {
    console.error('transferDraftPick failed:', error);
    throw error;
  }
}

/**
 * Saves a player selection to the spreadsheet
 * Updates Column G (Index 6) with Player Name and Column J (Index 9) with Coach
 */
export async function updateDraftPick(
  currentOwner: string,
  playerName: string,
  round: number,
  overall?: number,
  status?: string,
  coachName?: string // 🚀 Add this 6th argument
) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!A2:J`,
    });

    const rows = res.data.values || [];
    const rowIndex = rows.findIndex(r => {
      const matchesYear = Number(r[0]) === 2025; // Update to 2026 if needed
      const matchesRound = Number(r[1]) === round;
      if (overall) return Number(r[2]) === overall;
      return matchesYear && matchesRound && r[4]?.toLowerCase() === currentOwner.toLowerCase();
    });

    if (rowIndex === -1) throw new Error("Pick not found");

    const sheetRow = rowIndex + 2;

    // 1. Update Player Name in Column G
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `DraftPicks!G${sheetRow}`, 
      valueInputOption: 'RAW',
      requestBody: { values: [[playerName]] },
    });

    // 2. Update Coach Name in Column J
    if (coachName) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `DraftPicks!J${sheetRow}`, 
        valueInputOption: 'RAW',
        requestBody: { values: [[coachName]] },
      });
    }
  } catch (error) {
    console.error('updateDraftPick failed:', error);
    throw error;
  }
}