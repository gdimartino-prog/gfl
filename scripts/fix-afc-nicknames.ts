/**
 * Split AFC team names: last word → nickname, remainder → name
 * Run: POSTGRES_URL="..." npx tsx scripts/fix-afc-nicknames.ts
 */

import { db } from '../lib/db';
import { teams } from '../schema';
import { eq } from 'drizzle-orm';

const AFC_LEAGUE_ID = 3;

async function main() {
  const rows = await db.select({ id: teams.id, name: teams.name })
    .from(teams)
    .where(eq(teams.leagueId, AFC_LEAGUE_ID));

  console.log(`Updating ${rows.length} teams...`);

  for (const row of rows) {
    const parts = (row.name ?? '').trim().split(' ');
    const nickname = parts.pop()!;
    const name = parts.join(' ');
    await db.update(teams)
      .set({ name, nickname })
      .where(eq(teams.id, row.id));
    console.log(`  [${row.id}] "${row.name}" → name: "${name}", nickname: "${nickname}"`);
  }

  console.log('Done.');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
