import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { players, teams, rules } from '@/schema';
import { eq, and, isNotNull, isNull, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { getActiveInjuryPickups } from '@/lib/transactions';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const leagueId = await getLeagueId();

  const [limitRow, rows, activeInjuryPickups] = await Promise.all([
    db.select({ value: rules.value })
      .from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'limit_roster'), isNull(rules.year)))
      .limit(1),
    db.select({
      teamshort: teams.teamshort,
      teamName: teams.name,
      total: sql<number>`cast(count(*) as int)`,
      ir: sql<number>`cast(sum(case when ${players.isIR} = true then 1 else 0 end) as int)`,
    })
    .from(players)
    .innerJoin(teams, eq(players.teamId, teams.id))
    .where(and(eq(players.leagueId, leagueId), isNotNull(players.teamId)))
    .groupBy(teams.teamshort, teams.name),
    getActiveInjuryPickups(leagueId),
  ]);

  const limit = parseInt(limitRow[0]?.value ?? '53');
  const counts: Record<string, { active: number; limit: number }> = {};
  for (const r of rows) {
    if (!r.teamshort) continue;
    const shortUpper = r.teamshort.toUpperCase();
    const nameUpper = (r.teamName || '').trim().toUpperCase();
    const injuryPickups = activeInjuryPickups.filter(tx => {
      const to = (tx.toTeam || '').trim().toUpperCase();
      return to === shortUpper || (nameUpper !== '' && to === nameUpper);
    }).length;
    const active = Math.max(0, Number(r.total) - Number(r.ir) - injuryPickups);
    counts[shortUpper] = { active, limit };
  }

  return NextResponse.json(counts, {
    headers: { 'Cache-Control': 'private, max-age=30' },
  });
}
