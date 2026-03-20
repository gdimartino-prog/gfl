import { NextResponse } from 'next/server';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { teams } from '@/schema';
import { and, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!await isAdmin() && !await isCommissioner()) {
    return NextResponse.json({ error: 'Commissioner access required' }, { status: 403 });
  }
  const leagueId = await getLeagueId();
  const rows = await db.select({ id: teams.id, name: teams.name, teamshort: teams.teamshort })
    .from(teams)
    .where(and(eq(teams.leagueId, leagueId), eq(teams.status, 'active')))
    .orderBy(teams.name);
  return NextResponse.json(rows);
}
