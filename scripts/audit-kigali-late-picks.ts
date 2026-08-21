// Read-only audit: walk every Kigali pick in the current draft year, compute
// clock start / deadline / wasLate per the same logic the strikes & badge
// use, and print a per-pick table so the coach can verify the late call.
//
// Reimplements the clock math inline because computePickTimings uses
// unstable_cache which only works inside Next runtime.

import { db } from '../lib/db';
import { draftPicks, rules, teams } from '../schema';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const leagueId = 1; // GFL

// Resolve current draft year
const draftYearRow = await db
  .select({ value: rules.value })
  .from(rules)
  .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year'), isNull(rules.year)))
  .limit(1);
const draftYear = parseInt(draftYearRow[0]?.value || '0');
if (!draftYear) {
  console.error('No draft_year rule set');
  process.exit(1);
}

// Resolve Kigali team id (try teamshort variants)
const kigaliRows = await db
  .select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
  .from(teams)
  .where(and(eq(teams.leagueId, leagueId), sql`upper(${teams.teamshort}) = upper('Kig')`))
  .limit(1);
if (!kigaliRows[0]) {
  console.error('Kigali team not found');
  process.exit(1);
}
const kigali = kigaliRows[0];
console.log(`Kigali team: id=${kigali.id} name="${kigali.name}" short=${kigali.teamshort}`);
console.log(`Draft year: ${draftYear}\n`);

// Draft start date
const startRow = await db
  .select({ value: rules.value })
  .from(rules)
  .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_start_date')))
  .limit(1);
const draftStartRaw = startRow[0]?.value ?? null;
const draftStartDate = draftStartRaw ? new Date(draftStartRaw) : null;
console.log(`Draft start: ${draftStartDate?.toISOString() ?? '(none)'}\n`);

// Clock rules
const clockRows = await db
  .select({ rule: rules.rule, value: rules.value })
  .from(rules)
  .where(and(eq(rules.leagueId, leagueId), sql`${rules.rule} LIKE 'draft_clock_%'`));

const roundEntries = clockRows
  .map(r => {
    const m = r.rule.match(/^draft_clock_round_(\d+)$/);
    return m ? { round: parseInt(m[1]), minutes: parseInt(r.value ?? '0') } : null;
  })
  .filter((e): e is { round: number; minutes: number } => e !== null)
  .sort((a, b) => a.round - b.round);
const defaultRule = clockRows.find(r => r.rule === 'draft_clock_default');
const defaultMinutes = defaultRule?.value ? parseInt(defaultRule.value) : 1440;

function clockFor(round: number): number {
  const applicable = [...roundEntries].reverse().find(e => e.round <= round);
  return applicable?.minutes ?? defaultMinutes;
}

console.log('Clock rules:');
for (const e of roundEntries) console.log(`  R${e.round}+ → ${e.minutes} min`);
console.log(`  default → ${defaultMinutes} min\n`);

// All picks for the year
const originalTeams = alias(teams, 'originalTeams');
const currentTeams = alias(teams, 'currentTeams');
const allPicks = await db
  .select({
    id: draftPicks.id,
    round: draftPicks.round,
    pick: draftPicks.pick,
    currentTeamId: draftPicks.currentTeamId,
    pickedAt: draftPicks.pickedAt,
    scheduledAt: draftPicks.scheduledAt,
    playerId: draftPicks.playerId,
    passed: draftPicks.passed,
    selectedPlayerName: draftPicks.selectedPlayerName,
    currentOwner: currentTeams.teamshort,
    originalOwner: originalTeams.teamshort,
  })
  .from(draftPicks)
  .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
  .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
  .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear), eq(draftPicks.draftType, 'free_agent')))
  .orderBy(asc(draftPicks.pick));

// Inline computePickTimings: clockStart of pick N = min(prev pickedAt, prev deadline),
// clamped to draftStartDate if before. Deadline = clockStart + round clock.
type Timing = { clockStart: Date; deadline: Date; wasLate: boolean };
const timings = new Map<number, Timing>();
let prevEnd: Date | null = null;
for (const p of allPicks) {
  let clockStart: Date;
  const scheduled = p.scheduledAt ? new Date(p.scheduledAt) : null;
  if (prevEnd === null) {
    clockStart = scheduled ?? draftStartDate ?? new Date(0);
  } else {
    clockStart = scheduled && scheduled > prevEnd ? scheduled : prevEnd;
  }
  if (draftStartDate && clockStart < draftStartDate) clockStart = draftStartDate;

  const minutes = clockFor(p.round);
  const deadline = new Date(clockStart.getTime() + minutes * 60 * 1000);
  const pickedAt = p.pickedAt ? new Date(p.pickedAt) : null;
  const wasLate = !!pickedAt && pickedAt > deadline;
  timings.set(p.id, { clockStart, deadline, wasLate });

  prevEnd = pickedAt ? (pickedAt > deadline ? deadline : pickedAt) : deadline;
}

const kigaliPicks = allPicks.filter(p => p.currentTeamId === kigali.id);
console.log(`Kigali picks this year: ${kigaliPicks.length}\n`);

const fmt = (d: Date | null | undefined) => d ? d.toISOString().replace('T', ' ').slice(0, 19) + 'Z' : '—';
const fmtDur = (ms: number) => {
  const sec = Math.round(ms / 1000);
  const m = Math.floor(sec / 60);
  const h = Math.floor(m / 60);
  return h > 0 ? `${h}h ${m % 60}m` : `${m}m`;
};

console.log('R | Pick# | Original | Status                         | Clock Start          | Deadline             | PickedAt             | Elapsed   | Beyond Dl  | Late');
console.log('--+-------+----------+--------------------------------+----------------------+----------------------+----------------------+-----------+------------+-----');
for (const p of kigaliPicks) {
  const t = timings.get(p.id);
  const status = (() => {
    const isSkippedRow = typeof p.selectedPlayerName === 'string' && p.selectedPlayerName.startsWith('SKIPPED');
    if (isSkippedRow) return p.selectedPlayerName ?? 'SKIPPED';
    if (p.passed) return 'PASSED';
    if (p.selectedPlayerName) return `picked: ${p.selectedPlayerName}`;
    if (!p.pickedAt) return 'pending';
    return 'unknown';
  })();
  const clockStart = t?.clockStart;
  const deadline = t?.deadline;
  const wasLate = t?.wasLate ?? false;
  const pickedAt = p.pickedAt ? new Date(p.pickedAt) : null;
  const elapsed = pickedAt && clockStart ? pickedAt.getTime() - clockStart.getTime() : null;
  const beyondDl = pickedAt && deadline ? pickedAt.getTime() - deadline.getTime() : null;
  console.log(
    `${String(p.round).padStart(2)} | ${String(p.pick).padStart(5)} | ${(p.originalOwner ?? '').padEnd(8)} | ${status.slice(0, 30).padEnd(30)} | ${fmt(clockStart).padEnd(20)} | ${fmt(deadline).padEnd(20)} | ${fmt(pickedAt).padEnd(20)} | ${(elapsed != null ? fmtDur(elapsed) : '—').padStart(9)} | ${(beyondDl != null ? (beyondDl >= 0 ? '+' + fmtDur(beyondDl) : '-' + fmtDur(-beyondDl)) : '—').padStart(10)} | ${wasLate ? 'YES' : 'no'}`
  );
}

console.log('\nNotes:');
console.log('- Clock Start = min(prev pickedAt, prev deadline) — bonus time never leaks downstream.');
console.log('- Deadline = Clock Start + round clock minutes.');
console.log('- "Beyond Dl" positive = picked after deadline (counts as a strike).');
process.exit(0);
