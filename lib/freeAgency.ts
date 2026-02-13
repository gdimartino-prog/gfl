import { getSheetsClient } from './google-cloud';
import { parsePlayers } from './players';
import { findPlayerRowIndex } from './playerLookup';

/**
 * Execute a free agent pickup + waive transaction
 */
export async function executeFreeAgentMove(
  team: string,
  addIdentity: string,
  dropIdentity: string
) {
  // 1. Load players
  const sheets = getSheetsClient();
  const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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
  // Using the dynamic utility ensures we find the correct row even if columns move
  const addSheetRow = findPlayerRowIndex(rows, { identity: addIdentity });
  const dropSheetRow = findPlayerRowIndex(rows, { identity: dropIdentity });

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
