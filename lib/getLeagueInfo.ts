import { db } from './db';
import { leagues, rules } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

export type LeagueRow = { name: string; slug: string; legacyUrl: string | null };

const _getLeagueRow = unstable_cache(
  async (leagueId: number): Promise<LeagueRow | null> => {
    const rows = await db
      .select({ name: leagues.name, slug: leagues.slug, legacyUrl: leagues.legacyUrl })
      .from(leagues)
      .where(eq(leagues.id, leagueId))
      .limit(1);
    return rows[0] ?? null;
  },
  ['league-row'],
  { revalidate: 300, tags: ['leagues'] },
);

export function getLeagueRow(leagueId: number) {
  return _getLeagueRow(leagueId);
}

const _getLeagueRuleValue = unstable_cache(
  async (leagueId: number, ruleName: string): Promise<string | null> => {
    const rows = await db
      .select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.rule, ruleName), eq(rules.leagueId, leagueId)))
      .limit(1);
    return rows[0]?.value ?? null;
  },
  ['league-rule'],
  { revalidate: 60, tags: ['rules'] },
);

export function getLeagueRuleValue(leagueId: number, ruleName: string) {
  return _getLeagueRuleValue(leagueId, ruleName);
}
