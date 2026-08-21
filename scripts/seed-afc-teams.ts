/**
 * Seed AFC league teams.
 * Run: POSTGRES_URL="..." npx tsx scripts/seed-afc-teams.ts
 */

import { db } from '../lib/db';
import { leagues, teams } from '../schema';
import { eq, ilike } from 'drizzle-orm';

const afcTeams = [
  // AFC-East
  { name: 'Buffalo Bills',        teamshort: 'BUF', coach: 'Nino Montalbano',       email: 'ncrazynfl@yahoo.it',           division: 'AFC-East' },
  { name: 'Jacksonville Jaguars', teamshort: 'JAC', coach: 'Mac Whyte',              email: 'ravensmac@gmail.com',          division: 'AFC-East' },
  { name: 'Miami Dolphins',       teamshort: 'MIA', coach: 'Luke Dalfiume',          email: 'luke.dalfiume@yahoo.com',      division: 'AFC-East' },
  { name: 'New England Patriots', teamshort: 'NE',  coach: 'Don Antonelli',          email: 'dantone100@aol.com',           division: 'AFC-East' },
  { name: 'New York Jets',        teamshort: 'NYJ', coach: 'Jim Rice',               email: 'ricejim01@aol.com',            division: 'AFC-East' },

  // AFC-Central
  { name: 'Baltimore Ravens',     teamshort: 'BAL', coach: 'Jerry Banko',            email: 'jabanko@roadrunner.com',       division: 'AFC-Central' },
  { name: 'Cincinnati Bengals',   teamshort: 'CIN', coach: 'Pat Crew',               email: 'apccommish@yahoo.com',         division: 'AFC-Central' },
  { name: 'Cleveland Browns',     teamshort: 'CLE', coach: 'Bill Keller',            email: 'keller351@gmail.com',          division: 'AFC-Central' },
  { name: 'Indianapolis Colts',   teamshort: 'IND', coach: 'Valentino Montalbano',   email: 'montalbanovalentino@yahoo.it', division: 'AFC-Central' },
  { name: 'Pittsburgh Steelers',  teamshort: 'PIT', coach: 'Shawn Roach',            email: 'roachman3212@gmail.com',       division: 'AFC-Central' },

  // AFC-West
  { name: 'Denver Broncos',       teamshort: 'DEN', coach: 'Dan Roach',              email: 'go_utes@comcast.net',          division: 'AFC-West', isViceCommissioner: true },
  { name: 'Kansas City Chiefs',   teamshort: 'KC',  coach: 'Brad Fletcher',          email: 'bfletch61@mediacombb.net',     division: 'AFC-West', isViceCommissioner: true },
  { name: 'Los Angeles Chargers', teamshort: 'LAC', coach: 'Sam Alberry',            email: 'sam.alberry@yahoo.com',        division: 'AFC-West' },
  { name: 'Las Vegas Raiders',    teamshort: 'LV',  coach: 'Don Merlenbach',         email: 'minbadgers@gmail.com',         division: 'AFC-West' },

  // NFC-East
  { name: 'Atlanta Falcons',      teamshort: 'ATL', coach: 'Chuck Halling',          email: 'flagat0r@aol.com',             division: 'NFC-East' },
  { name: 'Carolina Panthers',    teamshort: 'CAR', coach: 'Dylan Mays',             email: 'dylanmys2413@yahoo.com',       division: 'NFC-East' },
  { name: 'Dallas Cowboys',       teamshort: 'DAL', coach: 'Tony McCann',            email: 'amc9187437@aol.com',           division: 'NFC-East' },
  { name: 'Philadelphia Eagles',  teamshort: 'PHI', coach: 'Roberto Tosco',          email: 'roberto.tosco@gmail.com',      division: 'NFC-East' },
  { name: 'Washington Commanders',teamshort: 'WAS', coach: 'Tom Urchek',             email: 'tomurchek@yahoo.com',          division: 'NFC-East' },

  // NFC-Central
  { name: 'Chicago Bears',        teamshort: 'CHI', coach: 'Ismael Perez',           email: 'izperez@comcast.net',          division: 'NFC-Central' },
  { name: 'Detroit Lions',        teamshort: 'DET', coach: 'Joe Richardson',         email: 'mightyjoey1@yahoo.com',        division: 'NFC-Central' },
  { name: 'Green Bay Packers',    teamshort: 'GB',  coach: 'Todd Cichon',            email: 'toddcichon@outlook.com',       division: 'NFC-Central' },
  { name: 'Minnesota Vikings',    teamshort: 'MIN', coach: 'Mike Arcand',            email: 'm19arcand@outlook.com',        division: 'NFC-Central' },
  { name: 'Tampa Bay Buccaneers', teamshort: 'TB',  coach: 'Mark Blume',             email: 'deepflyball@gmail.com',        division: 'NFC-Central', isCommissioner: true },

  // NFC-West
  { name: 'Arizona Cardinals',    teamshort: 'ARI', coach: 'Adam Neely',             email: 'adneely@yahoo.com',            division: 'NFC-West' },
  { name: 'New Orleans Saints',   teamshort: 'NO',  coach: 'John Deason',            email: 'inbudget@yahoo.com',           division: 'NFC-West' },
  { name: 'San Francisco',        teamshort: 'SF',  coach: 'Brendan McCormick',      email: 'bpmccormick85@gmail.com',      division: 'NFC-West' },
  { name: 'Seattle Seahawks',     teamshort: 'SEA', coach: 'Ian Mallet',             email: 'ipmallet@gmail.com',           division: 'NFC-West' },
];

async function main() {
  // Find AFC league
  const allLeagues = await db.select().from(leagues).orderBy(leagues.id);
  console.log('Existing leagues:', allLeagues.map(l => `[${l.id}] ${l.name}`).join(', '));

  const afcLeague = allLeagues.find(l =>
    l.name?.toLowerCase().includes('afc') || l.slug?.toLowerCase().includes('afc')
  );

  if (!afcLeague) {
    console.error('AFC league not found! Create it in the DB first.');
    process.exit(1);
  }

  const AFC_LEAGUE_ID = afcLeague.id;
  console.log(`\nUsing AFC league: id=${AFC_LEAGUE_ID}, name="${afcLeague.name}"`);

  // Delete existing AFC teams
  const deleted = await db.delete(teams).where(eq(teams.leagueId, AFC_LEAGUE_ID)).returning({ id: teams.id });
  console.log(`Deleted ${deleted.length} existing teams.`);

  // Insert all teams
  const inserted = await db.insert(teams).values(
    afcTeams.map(t => ({
      leagueId: AFC_LEAGUE_ID,
      name: t.name,
      teamshort: t.teamshort,
      coach: t.coach,
      email: t.email,
      isCommissioner: t.isCommissioner ?? false,
      status: 'active',
      touch_id: 'seed-afc',
    }))
  ).returning({ id: teams.id, name: teams.name });

  console.log(`\nInserted ${inserted.length} AFC teams:`);
  inserted.forEach(t => console.log(`  - [${t.id}] ${t.name}`));
  console.log('\nDone.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
