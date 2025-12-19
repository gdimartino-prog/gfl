import { sheets, SHEET_ID } from './googleSheets';

const SHEET = 'DraftPicks';

export async function findDraftPick(
  team: string,
  year: number,
  round: number
) {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET}!A2:C`,
  });

  const rows = res.data.values || [];

  return rows.find(
    r =>
      Number(r[0]) === year &&
      Number(r[1]) === round &&
      r[2] === team
  );
}

export async function transferDraftPick(
  fromTeam: string,
  toTeam: string,
  year: number,
  round: number
) {
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
}
