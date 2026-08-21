import { config } from 'dotenv';
config({ path: '.env.local' });
import { db } from '../lib/db';
import { transactions, players, teams } from '../schema';
import { and, eq, gte, desc, sql } from 'drizzle-orm';

async function main() {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  console.log(`=== Trades since ${startOfToday.toISOString()} ===\n`);
  const tx = await db.select()
    .from(transactions)
    .where(and(eq(transactions.leagueId, 1), gte(transactions.date, startOfToday), sql`${transactions.type} ILIKE '%TRADE%'`))
    .orderBy(desc(transactions.date));

  if (tx.length === 0) { console.log('No trades today.'); return; }

  for (const t of tx) {
    console.log(`--- id=${t.id} ---`);
    console.log(`  type:        ${t.type}`);
    console.log(`  date:        ${t.date}`);
    console.log(`  fromTeam:    ${t.fromTeam}`);
    console.log(`  toTeam:      ${t.toTeam}`);
    console.log(`  owner:       ${t.owner}`);
    console.log(`  status:      ${t.status}`);
    console.log(`  pickIds:     ${JSON.stringify(t.pickIds)}`);
    console.log(`  description: ${t.description}`);
    console.log();
  }

  // For each trade, try to find named players and report their current team
  console.log('\n=== Player team assignment check ===\n');
  for (const t of tx) {
    if (!t.description) continue;
    // Heuristic: pull names from the description (pattern: "FirstName LastName -")
    const matches = [...t.description.matchAll(/([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})\s*-\s*[A-Z]+/g)];
    if (matches.length === 0) continue;
    console.log(`Tx ${t.id}: ${t.fromTeam} ➔ ${t.toTeam}`);
    for (const m of matches) {
      const name = m[1].trim();
      const parts = name.split(/\s+/);
      const first = parts[0];
      const last = parts.slice(1).join(' ');
      const rows = await db.select({
        playerName: players.name,
        teamName: teams.name,
        teamShort: teams.teamshort,
        playerId: players.id,
      })
        .from(players)
        .leftJoin(teams, eq(players.teamId, teams.id))
        .where(and(
          eq(players.leagueId, 1),
          sql`lower(${players.first}) = lower(${first})`,
          sql`lower(${players.last}) = lower(${last})`,
        ));
      if (rows.length === 0) {
        console.log(`  ${name}: NOT FOUND in players table`);
      } else {
        for (const r of rows) {
          console.log(`  ${name} (id=${r.playerId}) currently on ${r.teamName ?? '(free agent)'} [${r.teamShort ?? '-'}]`);
        }
      }
    }
    console.log();
  }
}

main().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
