import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { findEspnId, getEspnSeasonStats } from '@/lib/espn-stats';
import { unstable_cache } from 'next/cache';

// One rebuild (~53 ESPN fetches per roster) serves every viewer for an hour
// instead of re-running after each per-user fetch-cache expiry. Tagged
// 'players' so roster moves bust it.
const _getTeamNflStats = unstable_cache(
  async (leagueId: number, teamshortUpper: string, year: number) => {
    const roster = await db
      .select({
        id: players.id,
        first: players.first,
        last: players.last,
        name: players.name,
        position: players.position,
        offense: players.offense,
        defense: players.defense,
        special: players.special,
        isIR: players.isIR,
        espnId: players.espnId,
        nflTeam: players.nflTeam,
      })
      .from(players)
      .innerJoin(teams, and(eq(players.teamId, teams.id), eq(teams.leagueId, leagueId)))
      .where(and(eq(teams.teamshort, teamshortUpper), eq(players.leagueId, leagueId)));

    if (!roster.length) return [];

    return Promise.all(
      roster.map(async (player) => {
        // Use stored ESPN ID if available; otherwise search and persist it
        let espnId = player.espnId || null;
        if (!espnId) {
          espnId = await findEspnId(player.first || '', player.last || '');
          if (espnId) {
            // Persist so next load skips the search
            await db.update(players)
              .set({ espnId, touch_id: 'espn-sync', touch_dt: new Date() })
              .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
          }
        }
        if (!espnId) return { ...player, espnId: null, stats: null };
        const stats = await getEspnSeasonStats(espnId, year);
        return { ...player, espnId, stats };
      }),
    );
  },
  ['nfl-stats-v1'],
  { revalidate: 3600, tags: ['players', 'nfl-stats'] },
);

export async function GET(req: NextRequest) {
  const [session, leagueId] = await Promise.all([auth(), getLeagueId()]);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const teamshort = searchParams.get('team');
  const rawYear = parseInt(searchParams.get('year') ?? '');
  const currentYear = new Date().getFullYear();

  if (!teamshort) return NextResponse.json({ error: 'team required' }, { status: 400 });
  if (!Number.isFinite(rawYear) || rawYear < 2000 || rawYear > currentYear) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }
  const year = rawYear;

  const results = await _getTeamNflStats(leagueId, teamshort.toUpperCase(), year);

  return NextResponse.json(results, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
