import { db } from './db';
import { rules } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

const _getDraftClockMinutes = unstable_cache(
  async (leagueId: number, round: number): Promise<number> => {
    const clockRules = await db
      .select({ rule: rules.rule, value: rules.value })
      .from(rules)
      .where(
        and(
          eq(rules.leagueId, leagueId),
          sql`${rules.rule} LIKE 'draft_clock_%'`
        )
      );

    const roundEntries = clockRules
      .map(r => {
        const match = r.rule.match(/^draft_clock_round_(\d+)$/);
        return match ? { round: parseInt(match[1]), minutes: parseInt(r.value) } : null;
      })
      .filter((e): e is { round: number; minutes: number } => e !== null);

    const applicable = roundEntries
      .filter(e => e.round <= round)
      .sort((a, b) => b.round - a.round);

    if (applicable.length > 0) return applicable[0].minutes;

    const defaultRule = clockRules.find(r => r.rule === 'draft_clock_default');
    if (defaultRule?.value) return parseInt(defaultRule.value);

    return 1440;
  },
  ['draft-clock-minutes'],
  { revalidate: 60, tags: ['rules'] },
);

/**
 * Get the clock duration in minutes for a given league and round.
 *
 * Looks up draft_clock_round_* rules and applies cascading defaults:
 * - Find the highest configured round number <= current round
 * - Fall back to draft_clock_default if no round rules exist
 * - Fall back to 1440 minutes (24 hours) if nothing configured
 */
export function getDraftClockMinutes(leagueId: number, round: number): Promise<number> {
  return _getDraftClockMinutes(leagueId, round);
}

/**
 * Warning threshold in minutes: 25% of clock, capped at 60 min, minimum 1 min.
 */
export function getWarningThresholdMinutes(clockMinutes: number): number {
  return Math.max(1, Math.min(60, Math.floor(clockMinutes * 0.25)));
}

const _getDraftYear = unstable_cache(
  async (leagueId: number): Promise<number> => {
    const row = await db
      .select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year')))
      .limit(1);
    const val = parseInt(row[0]?.value ?? '');
    return isNaN(val) ? new Date().getFullYear() : val;
  },
  ['draft-year'],
  { revalidate: 60, tags: ['rules'] },
);

/**
 * Get the current draft year for a league from the draft_year rule.
 * Falls back to the current calendar year if not configured.
 */
export function getDraftYear(leagueId: number): Promise<number> {
  return _getDraftYear(leagueId);
}

const _getDraftStartDateRaw = unstable_cache(
  async (leagueId: number): Promise<string | null> => {
    const row = await db
      .select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_start_date')))
      .limit(1);
    return row[0]?.value ?? null;
  },
  ['draft-start-date'],
  { revalidate: 60, tags: ['rules'] },
);

/**
 * Get the official draft start date for a league.
 * Returns null if not configured or if the date is invalid.
 * The clock does not run until this date/time has passed.
 */
export async function getDraftStartDate(leagueId: number): Promise<Date | null> {
  const val = await _getDraftStartDateRaw(leagueId);
  if (!val) return null;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}
