import { db } from '../lib/db';
import { sql } from 'drizzle-orm';
async function main() {
  const r = await db.execute(sql`SELECT DISTINCT type, count(*) FROM transactions WHERE league_id=1 GROUP BY type ORDER BY count DESC`);
  (r as any).rows.forEach((x: any) => console.log(`  ${x.type}: ${x.count}`));
}
main().catch(console.error).finally(() => process.exit(0));
