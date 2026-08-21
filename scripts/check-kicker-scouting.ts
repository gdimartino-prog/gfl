import { db } from '../lib/db';
import { players } from '../schema';
import { eq, and, isNotNull } from 'drizzle-orm';

const rows = await db.select({ name: players.name, offense: players.offense, special: players.special, scouting: players.scouting })
  .from(players)
  .where(and(eq(players.leagueId, 1), isNotNull(players.scouting)))
  .limit(1000);

const kicker = rows.find(r => ['K', 'K-P'].includes(r.special ?? '') || r.offense === 'K');
if (kicker) {
  console.log('Name:', kicker.name);
  console.log('special:', kicker.special, '| offense:', kicker.offense);
  console.log('\nAll scouting keys:', Object.keys(kicker.scouting || {}).sort().join(', '));
  console.log('\nFull scouting JSON:');
  console.log(JSON.stringify(kicker.scouting, null, 2));
} else {
  console.log('No kicker found. Positions found:', [...new Set(rows.map(r => r.special || r.offense).filter(Boolean))].join(', '));
}
process.exit(0);
