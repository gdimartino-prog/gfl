import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and, sql } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { findEspnId, getEspnSeasonStats } from '@/lib/espn-stats';
import { mapWithConcurrency } from '@/lib/concurrency';
import { getDepthChartDataBounded, normalizePlayerName, type DepthChartEntry } from '@/lib/ourlads';
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
      .where(and(sql`upper(${teams.teamshort}) = ${teamshortUpper}`, eq(players.leagueId, leagueId)));

    if (!roster.length) return [];

    // Cap in-flight ESPN requests so a full roster (~53 players) doesn't fan
    // out all at once and trip ESPN rate limits / exhaust sockets.
    return mapWithConcurrency(roster, 8, async (player) => {
      try {
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
      } catch (err) {
        // One player's ESPN/DB hiccup must not reject the whole roster.
        console.error('[nfl-stats] player', player.id, err);
        return { ...player, espnId: player.espnId ?? null, stats: null };
      }
    });
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

  // OurLads depth charts give each player's role (Starter / backup) plus the LS
  // designation we use to keep long snappers out of the offensive-line view.
  // Computed outside the roster cache so a corrected OurLads chart isn't stuck
  // behind the 1h nfl-stats entry.
  let longSnappers = new Set<string>();
  let depth = new Map<string, DepthChartEntry>();
  try {
    const data = await getDepthChartDataBounded();
    longSnappers = data.longSnappers;
    depth = data.index;
  } catch (err) {
    // OurLads slow/unavailable — degrade to no depth / long-snapper data.
    console.warn('[nfl-stats] OurLads depth data unavailable:', err);
  }

  const playersWithFlags = results.map((p) => {
    const key = normalizePlayerName(p.name || `${p.first ?? ''} ${p.last ?? ''}`);
    const entry = depth.get(key);
    const isLongSnapper = longSnappers.has(key);
    return {
      ...p,
      longSnapper: isLongSnapper,
      depthPosition: isLongSnapper ? null : entry?.position ?? null,
      depthRank: isLongSnapper ? null : entry?.depthRank ?? null,
    };
  });

  return NextResponse.json(playersWithFlags, {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
