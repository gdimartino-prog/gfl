import { sheets, SHEET_ID } from './googleSheets';

export type Player = {
  team: string;
  first: string;
  last: string;
  age: number;
  offense: string;
  defense: string;
  special: string;
  position: string;
  isIR: boolean;
  identity: string;
};

/**
 * Builds a stable identity string for a player.
 * This MUST stay consistent across the app.
 */
export function buildPlayerIdentity(player: Player): string {
  return [
    player.first || '',
    player.last || '',
    player.age ?? '',
    player.offense || '',
    player.defense || '',
    player.special || '',
  ]
    .join('|')
    .toLowerCase();
}

/**
 * Parse players from the Google Sheet "Players" tab
 *
 * Expected columns:
 * 0 team
 * 1 original team (unused here)
 * 2 first
 * 3 last
 * 4 nickname (unused)
 * 5 age
 * 6 offense
 * 7 defense
 * 8 special
 */
export function parsePlayers(rows: string[][]): Player[] {
  const [, ...data] = rows; // skip header row

  return data.map((row, rowIndex) => {
    try {
      const team = row[0] || '';

      const offense = row[6] || '';
      const defense = row[7] || '';
      const special = row[8] || '';

      const position = [offense, defense, special].filter(Boolean).join('/');

      const player: Player = {
        team,
        first: row[2] || '',
        last: row[3] || '',
        age: Number(row[5]) || 0,
        offense,
        defense,
        special,
        position,
        isIR: team.includes('-IR'),
        identity: '', // will set next
      };

      return {
        ...player,
        identity: buildPlayerIdentity(player),
      };
    } catch (err) {
      console.error(`Error parsing row ${rowIndex + 2}:`, err);
      return null;
    }
  }).filter(Boolean) as Player[];
}

/**
 * Remove rows in the "Players" sheet where first and last names are both blank.
 */
export async function removeBlankPlayerRows() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    const rows = res.data.values || [];

    // Keep header row and rows where first or last name is present
    const filteredRows = rows.filter((row, index) => {
      if (index === 0) return true; // header
      const first = row[2]?.trim();
      const last = row[3]?.trim();
      return first || last;
    });

    if (filteredRows.length === rows.length) {
      console.log('No blank player rows to remove.');
      return;
    }

    // Clear the sheet
    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    // Write back filtered rows
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Players',
      valueInputOption: 'RAW',
      requestBody: {
        values: filteredRows,
      },
    });

    console.log(`Removed ${rows.length - filteredRows.length} blank player rows.`);
  } catch (err) {
    console.error('Error removing blank player rows:', err);
  }
}
