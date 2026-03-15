/**
 * Seed AFL (league 2) teams by copying GFL team structure with fake coach data.
 * Run: POSTGRES_URL="..." npx tsx scripts/seed-afl-teams.ts
 */

import { db } from '../lib/db';
import { teams } from '../schema';
import { eq } from 'drizzle-orm';

const AFL_LEAGUE_ID = 2;

// Fake coaches for AFL demo league — same team names/shorts as GFL
const aflTeams = [
  { name: 'Old Bridge',    teamshort: 'OBG', nickname: 'Generals',   coach: 'James Mitchell',   email: 'jmitchell@demo.com',   cell: '555-100-0001' },
  { name: 'Las Vegas',     teamshort: 'LV',  nickname: 'Aces',       coach: 'Carlos Rivera',    email: 'crivera@demo.com',     cell: '555-100-0002' },
  { name: 'Urban',         teamshort: 'UF',  nickname: 'Foxes',      coach: 'Derek Johnson',    email: 'djohnson@demo.com',    cell: '555-100-0003' },
  { name: 'Tetbury',       teamshort: 'TT',  nickname: 'Titans',     coach: 'Marcus Williams',  email: 'mwilliams@demo.com',   cell: '555-100-0004' },
  { name: 'London',        teamshort: 'LM',  nickname: 'Monarchs',   coach: 'Oliver Hayes',     email: 'ohayes@demo.com',      cell: '555-100-0005' },
  { name: 'LE',            teamshort: 'LES', nickname: 'Eagles',     coach: 'Nathan Brooks',    email: 'nbrooks@demo.com',     cell: '555-100-0006' },
  { name: 'Amalfi',        teamshort: 'AFL', nickname: 'Coast',      coach: 'Giovanni Rossi',   email: 'grossi@demo.com',      cell: '555-100-0007' },
  { name: 'DC',            teamshort: 'DC',  nickname: 'Capital',    coach: 'Anthony Carter',   email: 'acarter@demo.com',     cell: '555-100-0008' },
  { name: 'Tampa',         teamshort: 'TC',  nickname: 'Charge',     coach: 'Brandon Lee',      email: 'blee@demo.com',        cell: '555-100-0009' },
  { name: 'Carolina',      teamshort: 'CT',  nickname: 'Thunder',    coach: 'Kevin Davis',      email: 'kdavis@demo.com',      cell: '555-100-0010' },
  { name: 'Newark Bay',    teamshort: 'NBT', nickname: 'Tides',      coach: 'Steven Park',      email: 'spark@demo.com',       cell: '555-100-0011' },
  { name: 'Satriale',      teamshort: 'SG',  nickname: 'Grills',     coach: 'Tony Moretti',     email: 'tmoretti@demo.com',    cell: '555-100-0012' },
  { name: 'LBI',           teamshort: 'LBI', nickname: 'Claws',      coach: 'Ryan Walsh',       email: 'rwalsh@demo.com',      cell: '555-100-0013' },
  { name: 'Fur Peace',     teamshort: 'FPR', nickname: 'Ranch',      coach: 'Chad Cooper',      email: 'ccooper@demo.com',     cell: '555-100-0014' },
  { name: 'Tinton Falls',  teamshort: 'TFT', nickname: 'Thunder',    coach: 'Eddie Grant',      email: 'egrant@demo.com',      cell: '555-100-0015' },
  { name: 'Kigali',        teamshort: 'Kig', nickname: 'Kings',      coach: 'Samuel Osei',      email: 'sosei@demo.com',       cell: '555-100-0016' },
  { name: 'Crimson',       teamshort: 'CK',  nickname: 'Kings',      coach: 'Robert Gaines',    email: 'rgaines@demo.com',     cell: '555-100-0017' },
  { name: 'Vico',          teamshort: 'VV',  nickname: 'Vipers',     coach: 'Frank Vitale',     email: 'fvitale@demo.com',     cell: '555-100-0018' },
];

async function main() {
  console.log(`Seeding ${aflTeams.length} teams for AFL (leagueId=${AFL_LEAGUE_ID})...`);

  // Remove existing AFL teams first
  const deleted = await db.delete(teams).where(eq(teams.leagueId, AFL_LEAGUE_ID)).returning({ id: teams.id });
  console.log(`Deleted ${deleted.length} existing AFL teams.`);

  const inserted = await db.insert(teams).values(
    aflTeams.map(t => ({
      leagueId: AFL_LEAGUE_ID,
      name: t.name,
      teamshort: t.teamshort,
      nickname: t.nickname,
      coach: t.coach,
      email: t.email,
      cell: t.cell,
      status: 'active',
      touch_id: 'seed-afl',
    }))
  ).returning({ id: teams.id, name: teams.name });

  console.log(`Inserted ${inserted.length} AFL teams:`);
  inserted.forEach(t => console.log(`  - [${t.id}] ${t.name}`));
  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
