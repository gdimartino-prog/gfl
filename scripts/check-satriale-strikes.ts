import { db } from '../lib/db';
import { draftPicks, teams, rules } from '../schema';
import { eq, and, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

const leagueId = 1;
const draftYear = 2026;

const currentTeams = alias(teams, 'ct');
const allRows = await db.select({
  id: draftPicks.id, round: draftPicks.round, pick: draftPicks.pick,
  selectedPlayerName: draftPicks.selectedPlayerName,
  scheduledAt: draftPicks.scheduledAt, pickedAt: draftPicks.pickedAt,
  passed: draftPicks.passed, owner: currentTeams.name,
})
.from(draftPicks)
.leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
.where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
.orderBy(draftPicks.pick);

// Load clock rules directly (avoid unstable_cache)
const startRow = await db.select({ value: rules.value }).from(rules)
  .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_start_date'), isNull(rules.year))).limit(1);
const draftStartDate = startRow[0]?.value ? new Date(startRow[0].value) : null;

const clockRows = await db.select({ rule: rules.rule, value: rules.value }).from(rules)
  .where(and(eq(rules.leagueId, leagueId), sql`${rules.rule} LIKE 'draft_clock_%'`));
const clockByRound = new Map(clockRows.map(r => [r.rule, parseInt(r.value ?? '0')]));

function getClockMs(round: number): number {
  return (clockByRound.get(`draft_clock_${round}`) ?? clockByRound.get('draft_clock_default') ?? 1440) * 60 * 1000;
}

// Compute deadlines manually
const deadlineMap = new Map<number, { clockStart: Date; deadline: Date; wasLate: boolean }>();
let prevEnd: Date | null = draftStartDate;
for (const p of allRows) {
  const clockMs = getClockMs(p.round ?? 0);
  const rawStart = prevEnd ?? (p.scheduledAt ? new Date(p.scheduledAt) : new Date());
  const clockStart = draftStartDate && rawStart < draftStartDate ? draftStartDate : rawStart;
  const deadline = new Date(clockStart.getTime() + clockMs);
  const pickedAt = p.pickedAt ? new Date(p.pickedAt) : null;
  const wasLate = pickedAt ? pickedAt > deadline : false;
  deadlineMap.set(p.id, { clockStart, deadline, wasLate });
  if (pickedAt) prevEnd = new Date(Math.min(pickedAt.getTime(), deadline.getTime()));
}

const sat = allRows.filter(r => (r.owner || '').toLowerCase().includes('satriale'));
console.log('Satriale picks with strike analysis:\n');
let strikes = 0;
for (const r of sat) {
  const t = deadlineMap.get(r.id);
  const wasLate = t?.wasLate ?? false;
  const isTimeExpiry = r.selectedPlayerName === 'SKIPPED (Time Expired)';
  const isConsequence = typeof r.selectedPlayerName === 'string' && r.selectedPlayerName.startsWith('SKIPPED') && !isTimeExpiry;
  const isStrike = wasLate || isTimeExpiry;
  if (isStrike) strikes++;
  const marker = isStrike ? ` <<< STRIKE ${strikes}` : isConsequence ? ' (consequence skip - no strike)' : '';
  console.log(`R${r.round} #${r.pick} | ${(r.selectedPlayerName || '(pending)').padEnd(38)} | late=${wasLate}${marker}`);
}
console.log(`\nTotal strikes: ${strikes}`);
process.exit(0);
