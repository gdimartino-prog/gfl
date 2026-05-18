import { db } from './db';
import { rules } from '@/schema';
import { and, eq, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

const _getClockRulesRaw = unstable_cache(
  async (leagueId: number) => {
    const rows = await db
      .select({ rule: rules.rule, value: rules.value })
      .from(rules)
      .where(
        and(
          eq(rules.leagueId, leagueId),
          sql`${rules.rule} LIKE 'draft_clock_%'`,
        ),
      );
    return rows.map(r => ({ rule: r.rule, value: r.value ?? '' }));
  },
  ['draft-clock-rules'],
  { revalidate: 60, tags: ['rules'] },
);

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

export type PickTimingInput = {
  id: number;
  round: number;
  pick: number;
  scheduledAt: Date | null;
  pickedAt: Date | null;
};

export type PickTiming = {
  clockStart: Date;
  deadline: Date;
  wasLate: boolean;
};

/**
 * Compute per-pick clock-start and deadline for a sorted sequence of picks.
 *
 * The next pick's clock starts at min(prevPick.pickedAt, prevPick.deadline) —
 * never later than the previous deadline. This prevents a late submission
 * from leaking bonus time downstream.
 */
export async function computePickTimings(
  picks: PickTimingInput[],
  leagueId: number,
  draftStartDate: Date | null,
): Promise<Map<number, PickTiming>> {
  const sorted = [...picks].sort((a, b) => a.pick - b.pick);

  // Fetch ALL draft_clock_* rules in one query, then resolve per-round
  // locally. Previously this called getDraftClockMinutes per distinct round
  // (~25 calls), each going through unstable_cache with a separate key and
  // a separate DB roundtrip — a major CPU/latency cost on every cron tick.
  const clockRules = await _getClockRulesRaw(leagueId);
  const roundEntries = clockRules
    .map(r => {
      const m = r.rule.match(/^draft_clock_round_(\d+)$/);
      return m ? { round: parseInt(m[1]), minutes: parseInt(r.value) } : null;
    })
    .filter((e): e is { round: number; minutes: number } => e !== null)
    .sort((a, b) => a.round - b.round);
  const defaultEntry = clockRules.find(r => r.rule === 'draft_clock_default');
  const defaultMinutes = defaultEntry?.value ? parseInt(defaultEntry.value) : 1440;
  const distinctRounds = Array.from(new Set(sorted.map(p => p.round)));
  const clockByRound = new Map<number, number>();
  for (const round of distinctRounds) {
    const applicable = [...roundEntries].reverse().find(e => e.round <= round);
    clockByRound.set(round, applicable?.minutes ?? defaultMinutes);
  }

  const result = new Map<number, PickTiming>();
  let prevEnd: Date | null = null;

  for (const p of sorted) {
    let clockStart: Date;
    if (prevEnd === null) {
      clockStart = p.scheduledAt ?? draftStartDate ?? new Date(0);
    } else {
      clockStart = p.scheduledAt && p.scheduledAt > prevEnd ? p.scheduledAt : prevEnd;
    }
    if (draftStartDate && clockStart < draftStartDate) clockStart = draftStartDate;

    const clockMinutes = clockByRound.get(p.round) ?? 1440;
    const deadline = new Date(clockStart.getTime() + clockMinutes * 60 * 1000);
    const wasLate = !!p.pickedAt && p.pickedAt > deadline;
    result.set(p.id, { clockStart, deadline, wasLate });

    if (p.pickedAt) {
      const effEnd = p.pickedAt > deadline ? deadline : p.pickedAt;
      prevEnd = effEnd;
    } else {
      prevEnd = deadline;
    }
  }

  return result;
}
