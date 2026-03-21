import { db } from '../lib/db';
import { sql } from 'drizzle-orm';

async function main() {
  const r = await db.execute(sql`
    SELECT pt.year, pt.draft_type, pt.round,
           t1.teamshort as original, t1.name as original_name,
           t2.teamshort as current, t2.name as current_name
    FROM draft_pick_transfers pt
    JOIN teams t1 ON t1.id = pt.original_team_id
    JOIN teams t2 ON t2.id = pt.current_team_id
    WHERE pt.league_id = 1
    ORDER BY pt.year, pt.draft_type, pt.round
  `);
  console.log(`Total transfers: ${(r as any).rows.length}`);
  (r as any).rows.forEach((x: any) => console.log(`  ${x.year} ${x.draft_type} R${x.round}: ${x.original} → ${x.current}`));
}
main().catch(console.error).finally(() => process.exit(0));
