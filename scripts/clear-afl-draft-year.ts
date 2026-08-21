import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../lib/db';
import { rules } from '../schema';
import { and, eq, isNull } from 'drizzle-orm';

async function main() {
  const leagueId = 2;
  const existing = await db.select({ id: rules.id, value: rules.value, touch_id: rules.touch_id })
    .from(rules)
    .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'draft_year'), isNull(rules.year)))
    .limit(1);

  if (!existing[0]) {
    console.log('No draft_year rule found for League 2 (AFL). Nothing to do.');
    return;
  }

  console.log('Found rule to delete:');
  console.log(`  id:       ${existing[0].id}`);
  console.log(`  rule:     draft_year`);
  console.log(`  value:    ${existing[0].value}`);
  console.log(`  touch_id: ${existing[0].touch_id}`);

  const deleted = await db.delete(rules).where(eq(rules.id, existing[0].id));
  console.log(`\nDeleted. Rowcount: ${deleted.rowCount ?? '(unknown)'}`);
  console.log('Cron /api/cron/draft will now skip League 2 entirely on its next tick.');
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
