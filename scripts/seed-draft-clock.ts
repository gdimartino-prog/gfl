/**
 * Seeds draft clock rules for GFL (leagueId=1):
 *   draft_clock_round_1 = 1440  (24 hours)
 *   draft_clock_round_3 = 720   (12 hours)
 *
 * Cascade logic: round 2 inherits round_1 (1440), rounds 4+ inherit round_3 (720).
 */
import { db } from '../lib/db';
import { rules } from '@/schema';
import { and, eq, isNull } from 'drizzle-orm';

const LEAGUE_ID = 1;

const clockRules = [
  { rule: 'draft_clock_round_1', value: '1440' },
  { rule: 'draft_clock_round_3', value: '720' },
];

async function run() {
  for (const r of clockRules) {
    // Upsert: delete existing then insert
    await db.delete(rules).where(
      and(eq(rules.leagueId, LEAGUE_ID), eq(rules.rule, r.rule), isNull(rules.year))
    );
    await db.insert(rules).values({
      leagueId: LEAGUE_ID,
      rule: r.rule,
      value: r.value,
      year: null,
      desc: r.rule === 'draft_clock_round_1'
        ? 'Draft clock for round 1 and any rounds before the next rule (minutes)'
        : 'Draft clock for round 3+ (minutes)',
      touch_id: 'seed-draft-clock',
    });
    console.log(`✓ ${r.rule} = ${r.value}`);
  }
  console.log('Done.');
}

run().catch(console.error);
