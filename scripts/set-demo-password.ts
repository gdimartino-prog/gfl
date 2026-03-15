/**
 * Sets up the Amalfi (AFL) team as the public demo commissioner account.
 * Password is set to "demo" (bcrypt hashed).
 * Run: POSTGRES_URL="..." npx tsx scripts/set-demo-password.ts
 */

import { db } from '../lib/db';
import { teams } from '../schema';
import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcrypt';

async function main() {
  const hashed = await bcrypt.hash('demo', 10);

  const result = await db
    .update(teams)
    .set({
      password: hashed,
      status: 'active',
      isCommissioner: true,
      touch_id: 'demo-setup',
    })
    .where(and(eq(teams.teamshort, 'VV'), eq(teams.leagueId, 2)))
    .returning({ id: teams.id, name: teams.name, teamshort: teams.teamshort });

  if (result.length === 0) {
    console.error('No team found with teamshort=AFL in leagueId=2');
    process.exit(1);
  }

  console.log(`Demo account configured: [${result[0].id}] ${result[0].name} (${result[0].teamshort})`);
  console.log('Login: username="Vico"  password="demo"');
  process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
