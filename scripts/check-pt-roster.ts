import 'dotenv/config';
import { db } from '../lib/db';
import { players, teams } from '../schema';
import { eq, sql } from 'drizzle-orm';

// Check the PT team row
const ptTeam = await db.select().from(teams).where(eq(teams.teamshort, 'PT'));
console.log('PT team row:', JSON.stringify(ptTeam, null, 2));

// Check players joined to that team
if (ptTeam[0]) {
  const roster = await db.select({
    first: players.first,
    last: players.last,
    teamId: players.teamId,
    teamshort: sql<string>`(SELECT teamshort FROM teams WHERE id = ${players.teamId})`,
  }).from(players).where(eq(players.teamId, ptTeam[0].id));
  console.log(`\nPlayers with teamId=${ptTeam[0].id}:`, roster.length);
  console.log(JSON.stringify(roster.slice(0, 5), null, 2));
}

// Also check what the old TF team looks like (if still exists)
const tfTeam = await db.select().from(teams).where(eq(teams.teamshort, 'TF'));
console.log('\nTF team row (old):', JSON.stringify(tfTeam, null, 2));

process.exit(0);
