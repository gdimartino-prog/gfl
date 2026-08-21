import { drizzle } from 'drizzle-orm/vercel-postgres';
import { sql as vercelSql } from '@vercel/postgres';
import { standings, teams } from '../schema';
import { eq } from 'drizzle-orm';

const db = drizzle(vercelSql);

// Master data: [team, year, W, L, T, WinPct, PF, PPG_PF, PA, PPG_PA, Diff, isDivWinner, isPlayoff, isSuperBowl, isChampion, oldTeamName, coach, division]
// Blank = false/0 for flag fields
const MASTER: Array<{
  team: string;
  year: number;
  wins: number;
  losses: number;
  ties: number;
  offPts: number;
  defPts: number;
  isDivWinner: boolean;
  isPlayoff: boolean;
  isSuperBowl: boolean;
  isChampion: boolean;
}> = [
  // 2025
  { team: 'Amalfi',       year: 2025, wins: 14, losses: 3,  ties: 0, offPts: 573, defPts: 369, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: false },
  { team: 'DC',           year: 2025, wins: 13, losses: 4,  ties: 0, offPts: 491, defPts: 339, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Tampa',        year: 2025, wins: 12, losses: 5,  ties: 0, offPts: 467, defPts: 371, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Carolina',     year: 2025, wins: 9,  losses: 8,  ties: 0, offPts: 455, defPts: 423, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Newark Bay',   year: 2025, wins: 7,  losses: 10, ties: 0, offPts: 428, defPts: 422, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Satriale',     year: 2025, wins: 2,  losses: 15, ties: 0, offPts: 253, defPts: 453, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tetbury',      year: 2025, wins: 11, losses: 6,  ties: 0, offPts: 513, defPts: 412, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Urban',        year: 2025, wins: 10, losses: 7,  ties: 0, offPts: 499, defPts: 409, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Las Vegas',    year: 2025, wins: 7,  losses: 10, ties: 0, offPts: 299, defPts: 364, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'London',       year: 2025, wins: 5,  losses: 12, ties: 0, offPts: 405, defPts: 586, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Old Bridge',   year: 2025, wins: 4,  losses: 13, ties: 0, offPts: 292, defPts: 541, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'LE',           year: 2025, wins: 2,  losses: 15, ties: 0, offPts: 309, defPts: 529, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Fur Peace',    year: 2025, wins: 14, losses: 3,  ties: 0, offPts: 549, defPts: 393, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: false },
  { team: 'LBI',          year: 2025, wins: 14, losses: 3,  ties: 0, offPts: 535, defPts: 352, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Tinton Falls', year: 2025, wins: 13, losses: 4,  ties: 0, offPts: 552, defPts: 375, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Kigali',       year: 2025, wins: 7,  losses: 10, ties: 0, offPts: 418, defPts: 487, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Crimson',      year: 2025, wins: 5,  losses: 12, ties: 0, offPts: 327, defPts: 472, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Vico',         year: 2025, wins: 4,  losses: 13, ties: 0, offPts: 397, defPts: 465, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  // 2024
  { team: 'Vico',         year: 2024, wins: 16, losses: 1,  ties: 0, offPts: 546, defPts: 327, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: true  },
  { team: 'Old Bridge',   year: 2024, wins: 13, losses: 3,  ties: 1, offPts: 575, defPts: 382, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Urban',        year: 2024, wins: 11, losses: 6,  ties: 0, offPts: 432, defPts: 306, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Tetbury',      year: 2024, wins: 5,  losses: 12, ties: 0, offPts: 332, defPts: 507, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Crimson',      year: 2024, wins: 2,  losses: 15, ties: 0, offPts: 261, defPts: 501, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Carolina',     year: 2024, wins: 1,  losses: 16, ties: 0, offPts: 270, defPts: 512, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'DC',           year: 2024, wins: 13, losses: 4,  ties: 0, offPts: 408, defPts: 348, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'London',       year: 2024, wins: 10, losses: 6,  ties: 1, offPts: 500, defPts: 329, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Tinton Falls', year: 2024, wins: 10, losses: 7,  ties: 0, offPts: 485, defPts: 362, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Newark Bay',   year: 2024, wins: 9,  losses: 8,  ties: 0, offPts: 407, defPts: 347, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Las Vegas',    year: 2024, wins: 7,  losses: 9,  ties: 1, offPts: 353, defPts: 359, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Kigali',       year: 2024, wins: 4,  losses: 13, ties: 0, offPts: 303, defPts: 493, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'LE',           year: 2024, wins: 15, losses: 2,  ties: 0, offPts: 514, defPts: 282, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: false },
  { team: 'Amalfi',       year: 2024, wins: 13, losses: 4,  ties: 0, offPts: 408, defPts: 328, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'LBI',          year: 2024, wins: 9,  losses: 7,  ties: 1, offPts: 491, defPts: 398, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Satriale',     year: 2024, wins: 7,  losses: 10, ties: 0, offPts: 371, defPts: 461, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tampa',        year: 2024, wins: 4,  losses: 13, ties: 0, offPts: 389, defPts: 511, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Fur Peace',    year: 2024, wins: 2,  losses: 15, ties: 0, offPts: 224, defPts: 516, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  // 2023
  { team: 'Crimson',      year: 2023, wins: 13, losses: 3,  ties: 0, offPts: 491, defPts: 263, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'DC',           year: 2023, wins: 13, losses: 3,  ties: 0, offPts: 394, defPts: 283, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: true  },
  { team: 'Carolina',     year: 2023, wins: 12, losses: 4,  ties: 0, offPts: 531, defPts: 249, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Urban',        year: 2023, wins: 11, losses: 5,  ties: 0, offPts: 431, defPts: 332, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Joe C',        year: 2023, wins: 10, losses: 6,  ties: 0, offPts: 521, defPts: 352, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Fur Peace',    year: 2023, wins: 10, losses: 6,  ties: 0, offPts: 447, defPts: 319, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Amalfi',       year: 2023, wins: 10, losses: 6,  ties: 0, offPts: 490, defPts: 387, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Old Bridge',   year: 2023, wins: 10, losses: 6,  ties: 0, offPts: 383, defPts: 342, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'London',       year: 2023, wins: 9,  losses: 7,  ties: 0, offPts: 502, defPts: 395, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Vico',         year: 2023, wins: 9,  losses: 7,  ties: 0, offPts: 446, defPts: 394, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Satriale',     year: 2023, wins: 9,  losses: 7,  ties: 0, offPts: 383, defPts: 351, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'LBI',          year: 2023, wins: 8,  losses: 8,  ties: 0, offPts: 342, defPts: 392, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Newark Bay',   year: 2023, wins: 7,  losses: 9,  ties: 0, offPts: 371, defPts: 365, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tampa',        year: 2023, wins: 7,  losses: 9,  ties: 0, offPts: 348, defPts: 463, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tetbury',      year: 2023, wins: 6,  losses: 10, ties: 0, offPts: 420, defPts: 463, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Kigali',       year: 2023, wins: 5,  losses: 11, ties: 0, offPts: 306, defPts: 505, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tinton Falls', year: 2023, wins: 2,  losses: 14, ties: 0, offPts: 266, defPts: 459, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Las Vegas',    year: 2023, wins: 1,  losses: 15, ties: 0, offPts: 275, defPts: 505, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Gotham City',  year: 2023, wins: 0,  losses: 16, ties: 0, offPts: 76,  defPts: 604, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  // 2022
  { team: 'DC',           year: 2022, wins: 15, losses: 2,  ties: 0, offPts: 471, defPts: 295, isDivWinner: true,  isPlayoff: true,  isSuperBowl: true,  isChampion: true  },
  { team: 'Amalfi',       year: 2022, wins: 14, losses: 3,  ties: 0, offPts: 518, defPts: 370, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Vico',         year: 2022, wins: 13, losses: 4,  ties: 0, offPts: 461, defPts: 328, isDivWinner: true,  isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Fur Peace',    year: 2022, wins: 13, losses: 4,  ties: 0, offPts: 521, defPts: 415, isDivWinner: false, isPlayoff: true,  isSuperBowl: true,  isChampion: false },
  { team: 'Crimson',      year: 2022, wins: 12, losses: 5,  ties: 0, offPts: 422, defPts: 265, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Kigali',       year: 2022, wins: 11, losses: 6,  ties: 0, offPts: 499, defPts: 340, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'London',       year: 2022, wins: 11, losses: 6,  ties: 0, offPts: 419, defPts: 360, isDivWinner: false, isPlayoff: true,  isSuperBowl: false, isChampion: false },
  { team: 'Carolina',     year: 2022, wins: 10, losses: 7,  ties: 0, offPts: 445, defPts: 332, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tampa',        year: 2022, wins: 9,  losses: 8,  ties: 0, offPts: 478, defPts: 392, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Honolulu',     year: 2022, wins: 8,  losses: 9,  ties: 0, offPts: 458, defPts: 369, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tetbury',      year: 2022, wins: 8,  losses: 9,  ties: 0, offPts: 397, defPts: 415, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Satriale',     year: 2022, wins: 7,  losses: 10, ties: 0, offPts: 374, defPts: 398, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Newark Bay',   year: 2022, wins: 6,  losses: 11, ties: 0, offPts: 367, defPts: 451, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Tinton Falls', year: 2022, wins: 5,  losses: 12, ties: 0, offPts: 324, defPts: 449, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Urban',        year: 2022, wins: 5,  losses: 12, ties: 0, offPts: 329, defPts: 483, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Old Bridge',   year: 2022, wins: 3,  losses: 14, ties: 0, offPts: 240, defPts: 486, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'Las Vegas',    year: 2022, wins: 3,  losses: 14, ties: 0, offPts: 216, defPts: 467, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
  { team: 'LBI',          year: 2022, wins: 0,  losses: 17, ties: 0, offPts: 206, defPts: 530, isDivWinner: false, isPlayoff: false, isSuperBowl: false, isChampion: false },
];

async function main() {
  console.log('Fetching DB standings for leagueId=1...');

  const dbRows = await db
    .select({
      year: standings.year,
      teamName: teams.name,
      teamshort: teams.teamshort,
      nickname: teams.nickname,
      oldTeamName: standings.oldTeamName,
      wins: standings.wins,
      losses: standings.losses,
      ties: standings.ties,
      offPts: standings.offPts,
      defPts: standings.defPts,
      isDivWinner: standings.isDivWinner,
      isPlayoff: standings.isPlayoff,
      isSuperBowl: standings.isSuperBowl,
      isChampion: standings.isChampion,
    })
    .from(standings)
    .leftJoin(teams, eq(standings.teamId, teams.id))
    .where(eq(standings.leagueId, 1));

  console.log(`Fetched ${dbRows.length} DB rows.\n`);

  // Build a lookup: key = `${year}|${normalizedTeamLabel}` → db row
  // We'll normalize team matching: try name, teamshort, nickname, oldTeamName (case-insensitive)
  type DbRow = typeof dbRows[0];
  const dbMap = new Map<string, DbRow>();

  for (const row of dbRows) {
    const candidates = [
      row.teamName,
      row.teamshort,
      row.nickname,
      row.oldTeamName,
    ].filter(Boolean).map(s => s!.toLowerCase().trim());

    for (const c of candidates) {
      const key = `${row.year}|${c}`;
      if (!dbMap.has(key)) {
        dbMap.set(key, row);
      }
    }
  }

  type DiscrepancyField = 'wins' | 'losses' | 'ties' | 'offPts' | 'defPts' | 'isDivWinner' | 'isPlayoff' | 'isSuperBowl' | 'isChampion';
  const FIELDS: DiscrepancyField[] = ['wins', 'losses', 'ties', 'offPts', 'defPts', 'isDivWinner', 'isPlayoff', 'isSuperBowl', 'isChampion'];

  let discrepancyCount = 0;
  const notFound: string[] = [];

  for (const master of MASTER) {
    const lookupKey = `${master.year}|${master.team.toLowerCase().trim()}`;
    const dbRow = dbMap.get(lookupKey);

    if (!dbRow) {
      notFound.push(`${master.year} | ${master.team} — NOT FOUND in DB (no matching name/teamshort/nickname/oldTeamName)`);
      continue;
    }

    for (const field of FIELDS) {
      const masterVal = master[field];
      let dbVal: boolean | number | null | undefined = dbRow[field];

      // Normalize booleans: DB stores null as false equivalent
      if (field === 'isDivWinner' || field === 'isPlayoff' || field === 'isSuperBowl' || field === 'isChampion') {
        dbVal = dbVal ?? false;
        if (masterVal !== dbVal) {
          console.log(`DISCREPANCY | ${master.year} | ${master.team.padEnd(14)} | ${field.padEnd(12)} | DB: ${String(dbVal).padEnd(6)} | Master: ${masterVal}`);
          discrepancyCount++;
        }
      } else {
        // numeric fields: DB null treated as 0
        dbVal = dbVal ?? 0;
        if (masterVal !== dbVal) {
          console.log(`DISCREPANCY | ${master.year} | ${master.team.padEnd(14)} | ${field.padEnd(12)} | DB: ${String(dbVal).padEnd(6)} | Master: ${masterVal}`);
          discrepancyCount++;
        }
      }
    }
  }

  if (notFound.length > 0) {
    console.log('\n--- Teams not found in DB ---');
    for (const msg of notFound) {
      console.log(msg);
    }
  }

  console.log(`\n=== Total discrepancies: ${discrepancyCount} (across ${MASTER.length} master rows, ${notFound.length} not found in DB) ===`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
