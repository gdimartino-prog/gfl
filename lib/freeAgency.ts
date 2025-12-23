import { sheets, SHEET_ID } from './googleSheets';
import { parsePlayers, Player } from './players';

/**
 * Execute a free agent pickup + waive transaction
 */
export async function executeFreeAgentMove(
  team: string,
  addIdentity: string,
  dropIdentity: string
) {
  // 1. Load players
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Players',
  });

  const rows = res.data.values || [];
  const players = parsePlayers(rows);

  const addPlayer = players.find(p => p.identity === addIdentity);
  const dropPlayer = players.find(p => p.identity === dropIdentity);

  if (!addPlayer) {
    throw new Error('Free agent not found');
  }

  if (!dropPlayer) {
    throw new Error('Player to waive not found');
  }

  // 2. Validation
  if (addPlayer.team !== 'FA') {
    throw new Error('Selected player is not a free agent');
  }

  if (dropPlayer.team !== team) {
    throw new Error('Player to waive does not belong to this team');
  }

  // 3. Find row indexes in sheet
  const [, ...dataRows] = rows;

  const addRowIndex = dataRows.findIndex(
    row =>
      row[2] === addPlayer.first &&
      row[3] === addPlayer.last &&
      Number(row[5]) === addPlayer.age
  );

  const dropRowIndex = dataRows.findIndex(
    row =>
      row[2] === dropPlayer.first &&
      row[3] === dropPlayer.last &&
      Number(row[5]) === dropPlayer.age
  );

  if (addRowIndex === -1 || dropRowIndex === -1) {
    throw new Error('Player row not found in sheet');
  }

  // Sheet row numbers (account for header row)
  const addSheetRow = addRowIndex + 2;
  const dropSheetRow = dropRowIndex + 2;

  // 4. Execute updates
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId: SHEET_ID,
    requestBody: {
      valueInputOption: 'RAW',
      data: [
        {
          range: `Players!A${addSheetRow}`,
          values: [[team]],
        },
        {
          range: `Players!A${dropSheetRow}`,
          values: [['FA']],
        },
      ],
    },
  });

  return { success: true };
}
