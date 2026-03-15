
/**
 * Google Sheets player parsing utilities.
 * Used by files that still read directly from the Players sheet.
 */

export type SheetsPlayer = {
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
  run: string;
  pass: string;
  rush: string;
  int: string;
  sack: string;
  dur: string;
  overall: string;
  scouting: Record<string, string>;
};

export function buildPlayerIdentity(player: Partial<SheetsPlayer>): string {
  const clean = (val: string | number | null | undefined) => {
    if (val === null || val === undefined) return '';
    const s = String(val).trim().toLowerCase().replace(/\s+/g, ' ');
    return (s === '0' || s === 'null' || s === '') ? '' : s;
  };

  const fields = [
    clean(player.first),
    clean(player.last),
    clean(player.age),
    clean(player.offense),
    clean(player.defense),
    clean(player.special),
  ];

  return fields.join('|');
}

export function parsePlayers(rows: string[][]): SheetsPlayer[] {
  if (!rows || rows.length < 2) return [];

  const headers = rows[0].map(h => h ? h.toLowerCase().trim() : '');
  const colIndex = (name: string) => headers.indexOf(name.toLowerCase().trim());

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
      const val = (name: string) => {
        const idx = colIndex(name);
        return (idx !== -1 && row[idx]) ? row[idx].trim() : '';
      };

      const team = val('team');
      const first = val('first');
      const last = val('last');

      if (!team && !first) return null;

      const off = val('offense');
      const def = val('defense');
      const spec = val('special');

      const identityData = {
        first, last,
        age: Number(val('age')) || 0,
        offense: off, defense: def, special: spec,
      };

      const ol_positions = ['C', 'G', 'OT', 'OG', 'OC'];
      const parseNum = (name: string): number => Number(val(name)) || 0;
      const parseSalary = (name: string): number =>
        Number(String(val(name) || '0').replace(/[$,]/g, '')) || 0;

      let overallRating = 0;
      if (def) {
        overallRating = parseNum('total defense');
      } else if (off && ol_positions.includes(off.toUpperCase())) {
        overallRating = parseNum('run block') + parseNum('pass block');
      } else {
        overallRating = parseSalary('salary');
      }

      const player: SheetsPlayer = {
        team, first, last,
        age: Number(identityData.age) || 0,
        offense: off, defense: def, special: spec,
        position: [off, def, spec].filter(v => v && v !== '0').join('/'),
        isIR: team.toUpperCase().includes('-IR'),
        run: val('run block') || '0',
        pass: val('pass block') || '0',
        rush: val('rush yards') || '0',
        int: val('interceptions') || '0',
        sack: val('sacks') || '0',
        dur: val('durability') || '0',
        overall: String(overallRating),
        scouting: Object.fromEntries(
          whitelistIndices.map(({ header, index }) => [
            header,
            (index !== -1 && row[index]) ? row[index].trim() : ''
          ])
        ),
        identity: buildPlayerIdentity(identityData),
      };

      return player;
    } catch (err) {
      console.error(`Error parsing row ${rowIndex + 2}:`, err);
      return null;
    }
  }).filter((p): p is SheetsPlayer => p !== null);
}
