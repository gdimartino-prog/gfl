import { db } from '../lib/db';
import { players } from '../schema';
import { eq, and, isNotNull, isNull } from 'drizzle-orm';
import { getNflTeam } from '../lib/espn-stats';

const BATCH = 10;

const roster = await db
  .select({ id: players.id, espnId: players.espnId })
  .from(players)
  .where(and(eq(players.leagueId, 1), isNotNull(players.espnId), isNull(players.nflTeam)));

console.log(`Found ${roster.length} players to sync.`);

let synced = 0;
let notFound = 0;

for (let i = 0; i < roster.length; i += BATCH) {
  const batch = roster.slice(i, i + BATCH);
  await Promise.all(
    batch.map(async (player) => {
      const espnId = player.espnId!;
      const team = await getNflTeam(espnId);
      if (!team) {
        console.log(`NOT FOUND: player id=${player.id} espnId=${espnId}`);
        notFound++;
        return;
      }
      await db
        .update(players)
        .set({ nflTeam: team, touch_id: 'sync-nfl-teams', touch_dt: new Date() })
        .where(eq(players.id, player.id));
      synced++;
    }),
  );
  console.log(`Batch ${Math.floor(i / BATCH) + 1}: ${Math.min(i + BATCH, roster.length)}/${roster.length} processed`);
}

console.log(`Done. Synced: ${synced}, Not found: ${notFound}`);
process.exit(0);
