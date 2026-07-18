import { db } from '../lib/db';
import { players, teams } from '../schema';
import { eq, and, isNull, isNotNull, not, sql } from 'drizzle-orm';
import { findEspnId } from '../lib/espn-stats';

const OL_POSITIONS = ['OL', 'OT', 'OG', 'C', 'G', 'T'];

// Fetch all skill players without an ESPN ID across all teams
const unmatched = await db.select({
  id: players.id,
  first: players.first,
  last: players.last,
  position: players.position,
})
.from(players)
.innerJoin(teams, and(eq(players.teamId, teams.id)))
.where(and(
  isNull(players.espnId),
  isNotNull(players.teamId),
  not(sql`upper(coalesce(${players.offense}, ${players.defense}, ${players.special}, ${players.position}, '')) = ANY(ARRAY['OL','OT','OG','C','G','T'])`),
));

console.log(`Found ${unmatched.length} unmatched skill players. Syncing...`);

let matched = 0;
let failed = 0;

// Process in batches of 10 to avoid hammering ESPN
const BATCH = 10;
for (let i = 0; i < unmatched.length; i += BATCH) {
  const batch = unmatched.slice(i, i + BATCH);
  await Promise.all(batch.map(async (p) => {
    const espnId = await findEspnId(p.first || '', p.last || '');
    if (espnId) {
      await db.update(players).set({ espnId, touch_id: 'espn-sync' }).where(eq(players.id, p.id));
      matched++;
    } else {
      failed++;
      console.log(`  NOT FOUND: ${p.first} ${p.last} (${p.position})`);
    }
  }));
  process.stdout.write(`\r  Progress: ${Math.min(i + BATCH, unmatched.length)}/${unmatched.length}`);
}

console.log(`\nDone. Matched: ${matched}, Not found: ${failed}`);
process.exit(0);
