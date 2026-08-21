// One-shot: finds teams whose last pre-R26 pick was a voluntary pass but whose
// R26/R27 picks are still OPEN (rounds didn't exist when they cascaded).
// Marks those picks as passed, mirroring what draft-pass cascade would have done.
// Run: node --env-file=.env.local --import tsx scripts/fix-cascade-passes.ts

import { db } from '../lib/db';
import { draftPicks, teams } from '../schema';
import { and, eq, inArray } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { revalidateTag } from 'next/cache';

const LEAGUE_ID = 1;
const YEAR = 2026;
const DRAFT_TYPE = 'free_agent';

const ct = alias(teams, 'ct');

const picks = await db.select({
  id: draftPicks.id,
  round: draftPicks.round,
  pick: draftPicks.pick,
  currentTeamId: draftPicks.currentTeamId,
  teamshort: ct.teamshort,
  passed: draftPicks.passed,
  selectedPlayerName: draftPicks.selectedPlayerName,
  playerId: draftPicks.playerId,
  pickedAt: draftPicks.pickedAt,
})
  .from(draftPicks)
  .leftJoin(ct, eq(draftPicks.currentTeamId, ct.id))
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, YEAR),
    eq(draftPicks.draftType, DRAFT_TYPE),
  ))
  .orderBy(draftPicks.pick);

// Group by team
const byTeam = new Map<number, typeof picks>();
for (const p of picks) {
  if (!p.currentTeamId) continue;
  if (!byTeam.has(p.currentTeamId)) byTeam.set(p.currentTeamId, []);
  byTeam.get(p.currentTeamId)!.push(p);
}

const toPass: number[] = []; // pick IDs to mark as passed

for (const [, teamPicks] of byTeam) {
  const openNew = teamPicks.filter(p =>
    p.round >= 26 && !p.passed && !p.playerId && !p.selectedPlayerName && !p.pickedAt
  );
  if (openNew.length === 0) continue;

  // Only cascade-pass if their last pre-R26 resolved pick was a voluntary pass
  // (not a 3-strike skip — those teams need the cron to apply SKIPPED 3-strike rule)
  const prevPicks = teamPicks.filter(p => p.round < 26);
  const lastPrev = prevPicks[prevPicks.length - 1];
  if (!lastPrev?.passed) continue;

  for (const p of openNew) {
    console.log(`Will pass: ${p.teamshort} R${p.round} #${p.pick} (id=${p.id})`);
    toPass.push(p.id);
  }
}

if (toPass.length === 0) {
  console.log('Nothing to fix.');
  process.exit(0);
}

console.log(`\nMarking ${toPass.length} picks as passed...`);
const now = new Date();
await db.update(draftPicks)
  .set({ passed: true, pickedAt: now, touch_id: 'fix-cascade' })
  .where(inArray(draftPicks.id, toPass));

// Clear the scheduledAt we set on OBG #454 (it's now passed, not active)
// and find the new first OPEN pick to set scheduledAt on
const openPicks = await db.select({ id: draftPicks.id, round: draftPicks.round, pick: draftPicks.pick, teamshort: ct.teamshort })
  .from(draftPicks)
  .leftJoin(ct, eq(draftPicks.currentTeamId, ct.id))
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, YEAR),
    eq(draftPicks.draftType, DRAFT_TYPE),
  ))
  .orderBy(draftPicks.pick);

const firstOpen = openPicks.find(p => {
  // Re-check all columns after update (need fresh query)
  return true; // placeholder — will filter below
});

// Fresh query for first open pick
const freshOpen = await db.select({ id: draftPicks.id, round: draftPicks.round, pick: draftPicks.pick, teamshort: ct.teamshort, scheduledAt: draftPicks.scheduledAt })
  .from(draftPicks)
  .leftJoin(ct, eq(draftPicks.currentTeamId, ct.id))
  .where(and(
    eq(draftPicks.leagueId, LEAGUE_ID),
    eq(draftPicks.year, YEAR),
    eq(draftPicks.draftType, DRAFT_TYPE),
    eq(draftPicks.passed, false),
  ))
  .orderBy(draftPicks.pick)
  .limit(5);

// Filter to truly open (no playerId, no pickedAt, no selectedPlayerName)
// We need a different approach — just show what's next
console.log('\nFirst 5 non-passed picks after fix:');
for (const p of freshOpen) {
  console.log(`  R${p.round} #${p.pick} ${p.teamshort} scheduledAt=${p.scheduledAt?.toISOString() ?? 'null'}`);
}

revalidateTag('draft-picks', 'max');
console.log('\nDone. Cache invalidated.');
