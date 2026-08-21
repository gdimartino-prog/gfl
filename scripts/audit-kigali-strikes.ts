// Replicate computePickTimings logic (without unstable_cache) to verify Kigali's strike count
import { db } from '../lib/db';
import { draftPicks, teams, rules } from '../schema';
import { eq, and, asc, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const leagueId = 1;
const draftYear = 2026;
const draftStartDate = new Date('2026-05-02T04:00:00.000Z');

// Clock rules (same logic as computePickTimings)
const clockRulesRaw = await db.select({ rule: rules.rule, value: rules.value })
  .from(rules)
  .where(and(eq(rules.leagueId, leagueId), sql`${rules.rule} LIKE 'draft_clock_%'`));

const roundEntries = clockRulesRaw
  .map(r => { const m = r.rule?.match(/^draft_clock_round_(\d+)$/); return m ? { round: parseInt(m[1]), minutes: parseInt(r.value ?? '1440') } : null; })
  .filter((e): e is { round: number; minutes: number } => e !== null)
  .sort((a, b) => a.round - b.round);
const defaultMinutes = 1440;

function clockForRound(round: number): number {
  const applicable = [...roundEntries].reverse().find(e => e.round <= round);
  return applicable?.minutes ?? defaultMinutes;
}

// Load all picks
const originalTeams = alias(teams, 'ot');
const currentTeams = alias(teams, 'ct');
const picks = await db.select({
  id: draftPicks.id, pick: draftPicks.pick, round: draftPicks.round,
  pickedAt: draftPicks.pickedAt, scheduledAt: draftPicks.scheduledAt,
  selectedPlayerName: draftPicks.selectedPlayerName,
  currentTeamId: draftPicks.currentTeamId, currentOwner: currentTeams.name,
}).from(draftPicks)
.leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
.where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
.orderBy(asc(draftPicks.pick));

// Find Kigali team ID
const kigTeam = await db.select({ id: teams.id }).from(teams)
  .where(and(eq(teams.leagueId, leagueId), sql`lower(name) = 'kigali'`)).limit(1);
const kigId = kigTeam[0]?.id;
console.log('Kigali team ID:', kigId);

// Replicate computePickTimings
const timings = new Map<number, { clockStart: Date; deadline: Date; wasLate: boolean }>();
let prevEnd: Date | null = null;

for (const p of picks) {
  let clockStart: Date;
  if (prevEnd === null) {
    clockStart = p.scheduledAt ? new Date(p.scheduledAt) : draftStartDate;
  } else {
    clockStart = p.scheduledAt && new Date(p.scheduledAt) > prevEnd ? new Date(p.scheduledAt) : prevEnd;
  }
  if (clockStart < draftStartDate) clockStart = draftStartDate;

  const clockMinutes = clockForRound(p.round);
  const deadline = new Date(clockStart.getTime() + clockMinutes * 60 * 1000);
  const pickedAt = p.pickedAt ? new Date(p.pickedAt) : null;
  const wasLate = !!pickedAt && pickedAt > deadline;
  timings.set(p.id, { clockStart, deadline, wasLate });

  if (pickedAt) {
    prevEnd = pickedAt > deadline ? deadline : pickedAt;
  } else {
    prevEnd = deadline;
  }
}

// Count strikes per team (same as cron)
const strikesByTeamId = new Map<number, number>();
for (const p of picks) {
  if (p.currentTeamId == null) continue;
  const isSkipped = typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED');
  const wasLate = timings.get(p.id)?.wasLate ?? false;
  if (isSkipped || wasLate) {
    strikesByTeamId.set(p.currentTeamId, (strikesByTeamId.get(p.currentTeamId) ?? 0) + 1);
  }
}

console.log('\nKigali picks with timing:');
const kigPicks = picks.filter(p => p.currentTeamId === kigId);
let strikeCount = 0;
for (const p of kigPicks) {
  const t = timings.get(p.id);
  if (!t) continue;
  const pickedAt = p.pickedAt ? new Date(p.pickedAt) : null;
  const isSkipped = p.selectedPlayerName?.startsWith('SKIPPED');
  const strike = isSkipped || t.wasLate;
  if (strike) strikeCount++;
  const lateBy = pickedAt && t.wasLate ? ((pickedAt.getTime() - t.deadline.getTime()) / 60000).toFixed(0) + 'min late' : '';
  console.log(`  P${p.pick} R${p.round} | deadline=${t.deadline.toISOString()} | pickedAt=${pickedAt?.toISOString() || 'pending'} | late=${t.wasLate} ${isSkipped ? '(SKIPPED)' : ''} ${lateBy}`);
}

console.log('\nKigali strikes from timings:', strikeCount);
console.log('strikesByTeamId for Kigali:', strikesByTeamId.get(kigId ?? 0) ?? 0);

// Top strike teams
console.log('\nAll teams with strikes:');
for (const [teamId, count] of [...strikesByTeamId.entries()].sort((a, b) => b[1] - a[1])) {
  const team = picks.find(p => p.currentTeamId === teamId)?.currentOwner;
  if (count > 0) console.log(`  ${(team || teamId).toString().padEnd(20)} ${count} strike(s)`);
}
process.exit(0);
