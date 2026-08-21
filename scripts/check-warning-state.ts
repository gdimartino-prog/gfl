import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../lib/db';
import { draftPicks, teams, rules } from '../schema';
import { eq, and, asc, isNull, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';

async function getDraftClockMinutes(leagueId: number, round: number): Promise<number> {
  const clockRules = await db
    .select({ rule: rules.rule, value: rules.value })
    .from(rules)
    .where(and(eq(rules.leagueId, leagueId), sql`${rules.rule} LIKE 'draft_clock_%'`));
  const roundEntries = clockRules
    .map(r => {
      const match = r.rule.match(/^draft_clock_round_(\d+)$/);
      return match ? { round: parseInt(match[1]), minutes: parseInt(r.value) } : null;
    })
    .filter((e): e is { round: number; minutes: number } => e !== null);
  const applicable = roundEntries.filter(e => e.round <= round).sort((a, b) => b.round - a.round);
  if (applicable.length > 0) return applicable[0].minutes;
  const defaultRule = clockRules.find(r => r.rule === 'draft_clock_default');
  if (defaultRule?.value) return parseInt(defaultRule.value);
  return 1440;
}
function getWarningThresholdMinutes(clockMinutes: number): number {
  return Math.max(1, Math.min(60, Math.floor(clockMinutes * 0.25)));
}
async function getDraftStartDate(leagueId: number): Promise<Date | null> {
  const row = await db
    .select({ value: rules.value })
    .from(rules)
    .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_start_date')))
    .limit(1);
  const val = row[0]?.value;
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  const draftYearRules = await db
    .select({ leagueId: rules.leagueId, value: rules.value })
    .from(rules)
    .where(and(eq(rules.rule, 'draft_year'), isNull(rules.year)));

  for (const r of draftYearRules) {
    const leagueId = r.leagueId;
    if (!leagueId) continue;
    const draftYear = parseInt(r.value || '0');
    console.log(`\n=== League ${leagueId}, draft_year=${draftYear} ===`);
    if (!draftYear) { console.log('  no draft year'); continue; }
    if (draftYear > new Date().getFullYear()) { console.log('  future draft year'); continue; }

    const originalTeams = alias(teams, 'originalTeams');
    const currentTeams = alias(teams, 'currentTeams');

    const allPicks = await db.select({
      id: draftPicks.id,
      round: draftPicks.round,
      pick: draftPicks.pick,
      playerId: draftPicks.playerId,
      passed: draftPicks.passed,
      selectedPlayerName: draftPicks.selectedPlayerName,
      scheduledAt: draftPicks.scheduledAt,
      pickedAt: draftPicks.pickedAt,
      warningSent: draftPicks.warningSent,
      currentOwner: currentTeams.name,
      originalTeam: originalTeams.name,
    })
      .from(draftPicks)
      .leftJoin(originalTeams, eq(draftPicks.originalTeamId, originalTeams.id))
      .leftJoin(currentTeams, eq(draftPicks.currentTeamId, currentTeams.id))
      .where(and(eq(draftPicks.leagueId, leagueId), eq(draftPicks.year, draftYear)))
      .orderBy(asc(draftPicks.pick));

    const activeIdx = allPicks.findIndex(p => !p.playerId && !p.pickedAt && !p.passed);
    if (activeIdx === -1) { console.log('  draft complete / not started'); continue; }

    const activePick = allPicks[activeIdx];
    const prevPick = activeIdx > 0 ? allPicks[activeIdx - 1] : null;

    const draftStartDate = await getDraftStartDate(leagueId);
    const now = new Date();
    console.log('  now (UTC):       ', now.toISOString());
    console.log('  draftStartDate:  ', draftStartDate?.toISOString() ?? 'null');

    if (draftStartDate && now < draftStartDate) { console.log('  >>> before draft start'); continue; }
    if (activePick.scheduledAt && new Date(activePick.scheduledAt) > now) {
      console.log('  >>> pick not yet scheduled, scheduledAt:', activePick.scheduledAt);
      continue;
    }

    const rawClockStart = prevPick?.pickedAt
      ? new Date(prevPick.pickedAt)
      : activePick.scheduledAt ? new Date(activePick.scheduledAt) : null;

    console.log('  active pick:');
    console.log('    id:           ', activePick.id);
    console.log('    R' + activePick.round + ' #' + activePick.pick + ' -', activePick.currentOwner);
    console.log('    scheduledAt:  ', activePick.scheduledAt);
    console.log('    warningSent:  ', activePick.warningSent);
    console.log('  prev pick:');
    console.log('    R' + (prevPick?.round ?? '-') + ' #' + (prevPick?.pick ?? '-') + ' -', prevPick?.currentOwner ?? '(none)');
    console.log('    pickedAt:     ', prevPick?.pickedAt ?? 'null');

    if (!rawClockStart) { console.log('  >>> no clock start time'); continue; }
    const clockStart = draftStartDate && rawClockStart < draftStartDate ? draftStartDate : rawClockStart;
    const clockMinutes = await getDraftClockMinutes(leagueId, activePick.round);
    const warningMinutes = getWarningThresholdMinutes(clockMinutes);
    const expiryTime = new Date(clockStart.getTime() + clockMinutes * 60 * 1000);
    const diffMs = expiryTime.getTime() - now.getTime();
    const diffMinutes = diffMs / 60000;

    console.log('  clockStart:      ', clockStart.toISOString());
    console.log('  clockMinutes:    ', clockMinutes, '(warning threshold:', warningMinutes + ' min)');
    console.log('  expiryTime:      ', expiryTime.toISOString());
    console.log('  diffMinutes:     ', diffMinutes.toFixed(2));

    if (diffMs <= 0) console.log('  >>> EXPIRED — cron would auto-skip');
    else if (diffMinutes <= warningMinutes && !activePick.warningSent) console.log('  >>> Cron WOULD fire warning on next tick');
    else if (diffMinutes <= warningMinutes && activePick.warningSent) console.log('  >>> In warning window BUT warning_sent=true (already fired or stuck)');
    else console.log('  >>> Nothing to do (not yet in warning window)');
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
