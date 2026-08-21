// One-shot: sets scheduledAt=now on the current active (undrafted, unpassed) pick
// for the current draft year's free_agent draft, anchoring the stale clock chain.
// Run: node --env-file=.env.local --import tsx scripts/fix-active-pick-clock.ts

import { db } from '../lib/db';
import { draftPicks, rules } from '../schema';
import { and, eq, isNull, asc } from 'drizzle-orm';

const LEAGUE_ID = 1;

const draftYearRow = await db.select({ value: rules.value })
  .from(rules)
  .where(and(eq(rules.rule, 'draft_year'), eq(rules.leagueId, LEAGUE_ID)))
  .limit(1);
const draftYear = parseInt(draftYearRow[0]?.value || '0');
if (!draftYear) throw new Error('Could not determine draft year');
console.log('Draft year:', draftYear);

// Find the first open pick (no playerId, no pickedAt, not passed)
const openPicks = await db.select({
  id: draftPicks.id,
  round: draftPicks.round,
  pick: draftPicks.pick,
  scheduledAt: draftPicks.scheduledAt,
})
  .from(draftPicks)
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, draftYear),
    eq(draftPicks.draftType, 'free_agent'),
    isNull(draftPicks.playerId),
    isNull(draftPicks.pickedAt),
    eq(draftPicks.passed, false),
  ))
  .orderBy(asc(draftPicks.pick))
  .limit(1);

if (!openPicks[0]) {
  console.log('No open picks found — draft may be fully resolved.');
  process.exit(0);
}

const active = openPicks[0];
console.log(`Active pick: R${active.round} #${active.pick} (id=${active.id}), current scheduledAt=${active.scheduledAt}`);

const now = new Date();
await db.update(draftPicks)
  .set({ scheduledAt: now, touch_id: 'fix-clock' })
  .where(eq(draftPicks.id, active.id));

console.log(`Set scheduledAt=${now.toISOString()} on pick id=${active.id}`);
console.log('Done. The next cron run will pick this up with a fresh clock.');
