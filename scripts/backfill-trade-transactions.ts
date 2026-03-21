/**
 * Backfill pick trades into transactions table.
 * Uses today's date since exact trade dates are unknown.
 */
import { db } from '../lib/db';
import { transactions, pickTransfers, teams } from '../schema';
import { and, eq, sql } from 'drizzle-orm';

const LEAGUE_ID = 1;
const TRADE_DATE = new Date('2026-03-20');

async function main() {
  // Get all transfers with team names
  const rows = await db.execute(sql`
    SELECT pt.year, pt.draft_type, pt.round,
           t1.name as from_name, t2.name as to_name
    FROM draft_pick_transfers pt
    JOIN teams t1 ON t1.id = pt.original_team_id
    JOIN teams t2 ON t2.id = pt.current_team_id
    WHERE pt.league_id = ${LEAGUE_ID}
    ORDER BY pt.year, pt.draft_type, pt.round
  `);

  const draftLabel = (type: string) => type === 'rookie' ? 'Rookie' : 'FA';

  let inserted = 0;
  for (const r of (rows as any).rows) {
    const desc = `Traded to ${r.to_name}: ${r.year} ${draftLabel(r.draft_type)} Draft Pick Rd ${r.round}`;
    await db.insert(transactions).values({
      leagueId: LEAGUE_ID,
      date: TRADE_DATE,
      type: 'TRADE',
      description: desc,
      fromTeam: r.from_name,
      toTeam: r.to_name,
      status: 'Done',
      touch_id: 'trade-migration',
    });
    console.log(`  ✓ ${r.year} R${r.round}: ${r.from_name} → ${r.to_name}`);
    inserted++;
  }

  console.log(`\nDone: ${inserted} transactions inserted.`);
}
main().catch(console.error).finally(() => process.exit(0));
