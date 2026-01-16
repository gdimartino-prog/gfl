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
  // Stats/Ratings
  run: string;
  pass: string;
  rush: string;
  int: string;
  sack: string;
  dur: string;
  overall: string;
  allStats: Record<string, string>;
};

/**
 * Builds a stable identity string for a player.
 * Strictly treats empty values or '0' as blank to match the 'null' cells in your sheet.
 */
export function buildPlayerIdentity(player: any): string {
  const clean = (val: any) => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim().toLowerCase();
    // Action PC data often uses '0' or blank for empty positions
    return (s === '0' || s === 'null' || s === '') ? '' : s;
  };

  return [
    clean(player.first),
    clean(player.last),
    clean(player.age),
    clean(player.offense),
    clean(player.defense),
    clean(player.special),
  ]
    .join('|')
    .toLowerCase();
}

/**
 * Parse players from the Google Sheet "Players" tab using header mapping.
 */
export function parsePlayers(rows: string[][]): Player[] {
  if (!rows || rows.length < 2) return [];

  // 1. Map headers to lowercase keys for easy searching
  const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
  const colIndex = (name: string) => headers.indexOf(name.toLowerCase().trim());

  const [, ...dataRows] = rows;

  return dataRows.map((row, rowIndex) => {
    try {
      // Helper to fetch value by header name regardless of column position
      const val = (name: string) => {
        const idx = colIndex(name);
        return (idx !== -1 && row[idx]) ? row[idx].trim() : '';
      };

      const team = val('team');
      const first = val('first');
      const last = val('last');

      // Skip rows that don't have a team AND a name
      if (!team && !first) return null;

      const off = val('offense');
      const def = val('defense');
      const spec = val('special');

      // Standardize data for identity building
      const identityData = {
        first,
        last,
        age: val('age'),
        offense: off,
        defense: def,
        special: spec,
      };

      const player: Player = {
        team,
        first,
        last,
        age: Number(identityData.age) || 0,
        offense: off,
        defense: def,
        special: spec,
        // Position display skips '0' or empty values
        position: [off, def, spec].filter(v => v && v !== '0').join('/'),
        isIR: team.toUpperCase().includes('-IR'),
        
        // Mapped ratings/stats
        run: val('run block'),
        pass: val('pass block'),
        rush: val('rush yards'),
        int: val('interceptions'),
        sack: val('sacks'),
        dur: val('durability'),
        overall: val('overall'),
        
        // Dictionary of every single column for deep scouting
        allStats: Object.fromEntries(headers.map((h, i) => [h, row[i] || ''])),
        
        // Build the stabilized identity string
        identity: buildPlayerIdentity(identityData)
      };

      return player;
    } catch (err) {
      console.error(`Error parsing row ${rowIndex + 2}:`, err);
      return null;
    }
  }).filter((p): p is Player => p !== null);
}

/**
 * Remove rows in the "Players" sheet where first and last names are both blank.
 */
export async function removeBlankPlayerRows() {
  try {
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV',
    });

    const rows = res.data.values || [];
    if (rows.length === 0) return;

    const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
    const firstIdx = headers.indexOf('first');
    const lastIdx = headers.indexOf('last');

    const filteredRows = rows.filter((row, index) => {
      if (index === 0) return true; // Keep header
      const first = row[firstIdx]?.trim();
      const last = row[lastIdx]?.trim();
      return !!(first || last);
    });

    if (filteredRows.length === rows.length) return;

    await sheets.spreadsheets.values.clear({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV',
    });

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: 'Players!A:CV',
      valueInputOption: 'RAW',
      requestBody: { values: filteredRows },
    });

    console.log(`Cleaned up ${rows.length - filteredRows.length} blank rows.`);
  } catch (err) {
    console.error('Error removing blank player rows:', err);
  }
}