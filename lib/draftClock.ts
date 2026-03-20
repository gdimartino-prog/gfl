import { db } from './db';
import { rules } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';

/**
 * Get the clock duration in minutes for a given league and round.
 *
 * Looks up draft_clock_round_* rules and applies cascading defaults:
 * - Find the highest configured round number <= current round
 * - Fall back to draft_clock_default if no round rules exist
 * - Fall back to 1440 minutes (24 hours) if nothing configured
 *
 * Example config: round_1=1440, round_3=720
 *   Round 1 → 1440, Round 2 → 1440, Round 3 → 720, Round 4+ → 720
 */
export async function getDraftClockMinutes(leagueId: number, round: number): Promise<number> {
  const clockRules = await db
    .select({ rule: rules.rule, value: rules.value })
    .from(rules)
    .where(
      and(
        eq(rules.leagueId, leagueId),
        sql`${rules.rule} LIKE 'draft_clock_%'`
      )
    );

  // Parse round-specific entries
  const roundEntries = clockRules
    .map(r => {
      const match = r.rule.match(/^draft_clock_round_(\d+)$/);
      return match ? { round: parseInt(match[1]), minutes: parseInt(r.value) } : null;
    })
    .filter((e): e is { round: number; minutes: number } => e !== null);

  // Highest configured round <= current round (cascading default)
  const applicable = roundEntries
    .filter(e => e.round <= round)
    .sort((a, b) => b.round - a.round);

  if (applicable.length > 0) return applicable[0].minutes;

  // Fall back to draft_clock_default
  const defaultRule = clockRules.find(r => r.rule === 'draft_clock_default');
  if (defaultRule?.value) return parseInt(defaultRule.value);

  // Ultimate fallback: 24 hours
  return 1440;
}

/**
 * Warning threshold in minutes: 25% of clock, capped at 60 min, minimum 1 min.
 */
export function getWarningThresholdMinutes(clockMinutes: number): number {
  return Math.max(1, Math.min(60, Math.floor(clockMinutes * 0.25)));
}
