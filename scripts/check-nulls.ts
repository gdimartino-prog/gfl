import { sql } from 'drizzle-orm';
import { db } from '../lib/db';

const tables = ['teams','players','transactions','draft_picks','draft_pick_transfers','cuts','rules','resources','standings','schedule','trade_block','audit_log'];

for (const t of tables) {
  const r = await db.execute(sql.raw(`SELECT COUNT(*) as n FROM ${t} WHERE league_id IS NULL`));
  const n = (r.rows[0] as { n: string }).n;
  console.log(`${t}: ${n} NULLs`);
}

process.exit(0);
