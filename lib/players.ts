import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache';

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
  scouting: Record<string, string>;
};

/**
 * Builds a stable identity string for a player.
 * Strictly treats empty values or '0' as blank to match the 'null' cells in your sheet.
 */
export function buildPlayerIdentity(player: Partial<Player>): string {
  const clean = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '';
    // Preserve internal spaces to keep "austin iii" as one segment
    const s = String(val).trim().toLowerCase().replace(/\s+/g, ' ');
    return (s === '0' || s === 'null' || s === '') ? '' : s;
  };

  const fields = [
    clean(player.first),    // 1. calvin
    clean(player.last),     // 2. austin iii
    clean(player.age),      // 3. 25
    clean(player.offense),  // 4. wr
    clean(player.defense),  // 5. (empty)
    clean(player.special),  // 6. pr
  ];

  return fields.join('|');
}

/**
 * Fetches all players from the Google Sheet with caching.
 */
export async function getPlayers(): Promise<Player[]> {
  // 1. Cache the RAW ROWS from Google Sheets (much smaller than objects)
  const getRawRows = unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;
      try {
        const result = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Players!A:CV', 
        });
        return result.data.values || [];
      } catch (err) {
        console.error('getRawRows Error:', err);
        return [];
      }
    },
    ['players-raw-data'],
    { revalidate: 60, tags: ['players'] }
  );

  const rows = await getRawRows();
  // 2. Parse the rows into objects AFTER retrieving from cache
  return parsePlayers(rows);
}

/**
 * Parse players from the Google Sheet "Players" tab using header mapping.
 */
export function parsePlayers(rows: string[][]): Player[] {
  if (!rows || rows.length < 2) return [];

  // 1. Map headers to lowercase keys for easy searching
  const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
  const colIndex = (name: string) => headers.indexOf(name.toLowerCase().trim());

  // Pre-calculate indices for scouting whitelist to fix the 2MB cache limit
  const whitelist = [
    'uniform', 'run block', 'pass block', 'run defense', 'pass defense', 
    'pass rush', 'total defense', 'breakaway', 'short yardage', 'audible', 
    'pressure', 'receiving', 'durability', 'salary', 'years', 'games', 
    'rush attempts', 'rush yards', 'rush long', 'rush TD', 'receptions', 
    'receiving yards', 'receiving TD', 'receiving long', 'pass attempts', 
    'completions', 'pass yards', 'pass interceptions', 'pass TD', 
    'interceptions', 'tackles', 'sacks', 'stuffs'
  ];
  const whitelistIndices = whitelist.map(h => ({ header: h, index: colIndex(h) }));

  const [, ...dataRows] = rows;

  return dataRows.map((row, rowIndex) => {
    try {
      // Helper to fetch value by header name regardless of column position
      const val = (name: string) => {
        const idx = colIndex(name);
        // We use .trim() but DO NOT split the string to preserve "Austin III"
        return (idx !== -1 && row[idx]) ? row[idx].trim() : '';
      };

      const team = val('team');
      const first = val('first');
      const last = val('last'); // Correctly grabs "Austin III"

      // Skip rows that don't have a team AND a name
      if (!team && !first) return null;

      const off = val('offense');
      const def = val('defense');
      const spec = val('special'); // Correctly grabs "pr" for Calvin Austin III

      // Standardize data for identity building
      const identityData = {
        first,
        last,
        age: Number(val('age')) || 0,
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
        // Position display logic
        position: [off, def, spec].filter(v => v && v !== '0').join('/'),
        isIR: team.toUpperCase().includes('-IR'),
        
        // Mapped ratings/stats
        run: val('run block') || '0',
        pass: val('pass block') || '0',
        rush: val('rush yards') || '0',
        int: val('interceptions') || '0',
        sack: val('sacks') || '0',
        dur: val('durability') || '0',
        overall: val('overall') || '0',
        
        // Optimized scouting dictionary (Only keep what the PlayerCard needs)
        scouting: Object.fromEntries(
          whitelistIndices.map(({ header, index }) => [
            header, 
            (index !== -1 && row[index]) ? row[index].trim() : ''
          ])
        ),
        
        // Build the stabilized 6-field identity string
        identity: buildPlayerIdentity(identityData)
      };

//if (last.toLowerCase().includes('iii') || last.toLowerCase().includes('jr')) {
//      console.log("DEBUG RAW DATA:", { first, last, row_raw: row });
//      console.log("DEBUG PLAYER:", { first, last, identity: player.identity });
//    }
    

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
    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

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