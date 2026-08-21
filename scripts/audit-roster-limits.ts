import { db } from '../lib/db';
import { players, teams, rules, transactions } from '../schema';
import { eq, and, isNotNull, inArray, sql } from 'drizzle-orm';

const leagueId = 1;

const limitRow = await db.select({ value: rules.value }).from(rules)
  .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'limit_roster'))).limit(1);
const ROSTER_LIMIT = parseInt(limitRow[0]?.value ?? '53');

// Determine IR players from transaction history (source of truth)
const irTxns = await db.select({ fromTeam: transactions.fromTeam, description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['IR', 'IR MOVE'])))
  .orderBy(transactions.date);

const removeTxns = await db.select({ description: transactions.description, date: transactions.date })
  .from(transactions)
  .where(and(eq(transactions.leagueId, leagueId), inArray(transactions.type, ['DROP', 'WAIVE', 'ADD'])))
  .orderBy(transactions.date);

function parseName(desc: string | null): string | null {
  const m = (desc || '').match(/Placed on IR:\s*(?:[A-Z\-\/]+ - )?(.+)/i);
  return m ? m[1].trim().toLowerCase() : null;
}

// Build set of (team, playerNameLower) pairs still on IR from transaction log
const irByTeam = new Map<string, Set<string>>();
for (const t of irTxns) {
  const name = parseName(t.description);
  if (!name) continue;
  const removed = removeTxns.some(r =>
    new Date(r.date!) > new Date(t.date!) &&
    (r.description || '').toLowerCase().includes(name)
  );
  if (!removed) {
    const team = (t.fromTeam ?? '').toLowerCase();
    if (!irByTeam.has(team)) irByTeam.set(team, new Set());
    irByTeam.get(team)!.add(name);
  }
}

// Count total players per team
const rows = await db
  .select({
    teamName: teams.name,
    teamshort: teams.teamshort,
    total: sql<number>`cast(count(*) as int)`,
  })
  .from(players)
  .innerJoin(teams, eq(players.teamId, teams.id))
  .where(and(eq(players.leagueId, leagueId), isNotNull(players.teamId)))
  .groupBy(teams.name, teams.teamshort)
  .orderBy(teams.name);

console.log(`Team Roster Audit (limit: ${ROSTER_LIMIT}, IR from transaction log)\n`);
console.log('Team'.padEnd(28) + 'Total'.padStart(6) + '   IR'.padStart(5) + '  Active'.padStart(8) + '  Status');
console.log('-'.repeat(62));

let violations = 0;
for (const r of rows) {
  const total = Number(r.total);
  const teamKey = (r.teamName ?? '').toLowerCase();
  const ir = irByTeam.get(teamKey)?.size ?? 0;
  const active = total - ir;
  const over = active > ROSTER_LIMIT;
  if (over) violations++;
  const status = over ? `<<< OVER by ${active - ROSTER_LIMIT}` : 'OK';
  console.log(
    (r.teamName ?? '').padEnd(28) +
    String(total).padStart(6) +
    String(ir).padStart(5) +
    String(active).padStart(8) + '  ' +
    status
  );
}

console.log('-'.repeat(62));
console.log(violations === 0 ? '\nNo violations found.' : `\n${violations} team(s) over the roster limit.`);
process.exit(0);
