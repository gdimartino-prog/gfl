import { sheets, SHEET_ID } from './googleSheets';

const SHEET = 'DraftPicks';

export type DraftPick = {
  year: number;
  round: number;
  team: string;
};

/**
 * Get all draft picks
 */
export async function getAllDraftPicks(): Promise<DraftPick[]> {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:C`,
    });

    const rows = res.data.values;

    if (!Array.isArray(rows)) {
      return [];
    }

    return rows.map(r => ({
      year: Number(r[0]),
      round: Number(r[1]),
      team: r[2],
    }));
  } catch (error) {
    console.error('getAllDraftPicks failed:', error);
    throw error;
  }
}

/**
 * Find a single draft pick
 */
export async function findDraftPick(
  team: string,
  year: number,
  round: number
) {
  const rows = await getAllDraftPicks();

  return rows.find(
    r =>
      r.year === year &&
      r.round === round &&
      r.team === team
  );
}

/**
 * Transfer a draft pick
 */
export async function transferDraftPick(
  fromTeam: string,
  toTeam: string,
  year: number,
  round: number
) {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!A2:C`,
    });

    const rows = res.data.values || [];

    const rowIndex = rows.findIndex(
      r =>
        Number(r[0]) === year &&
        Number(r[1]) === round &&
        r[2] === fromTeam
    );

    if (rowIndex === -1) {
      throw new Error(
        `Draft pick ${year} R${round} not owned by ${fromTeam}`
      );
    }

    const sheetRow = rowIndex + 2;

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${SHEET}!C${sheetRow}`,
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
