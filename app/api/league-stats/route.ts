import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { getEspnSeasonStats } from '@/lib/espn-stats';
import { posGroup, powerScore } from '@/lib/power-score';
import { unstable_cache } from 'next/cache';

const DEF_GROUPS = new Set(['DL', 'LB', 'DB']);
const OFF_GROUPS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'OL']);

async function fetchLeagueStats(leagueId: number, year: number) {
  const roster = await db
    .select({
      offense: players.offense,
      defense: players.defense,
      special: players.special,
      position: players.position,
      espnId: players.espnId,
      teamshort: teams.teamshort,
      teamName: teams.name,
    })
    .from(players)
    .innerJoin(teams, eq(players.teamId, teams.id))
    .where(and(eq(players.leagueId, leagueId), eq(teams.leagueId, leagueId)));

  if (!roster.length) return [];

  // Fetch ESPN stats in chunks of 40 to avoid rate-limit burst on cold cache
  const CHUNK = 40;
  const withStats: Array<typeof roster[number] & { stats: Record<string, number> | null }> = [];
  for (let i = 0; i < roster.length; i += CHUNK) {
    const batch = roster.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map(async (player) => {
        if (!player.espnId) return { ...player, stats: null };
        const stats = await getEspnSeasonStats(player.espnId, year);
        return { ...player, stats };
      }),
    );
    withStats.push(...results);
  }

  const teamMap = new Map<string, {
    teamName: string;
    offenseScore: number;
    defenseScore: number;
    playerCount: number;
  }>();

  for (const player of withStats) {
    const group = posGroup(player.offense, player.defense, player.special, player.position);
    const score = powerScore(player.offense, player.defense, player.special, player.position, player.stats);
    const key = player.teamshort.toUpperCase();

    if (!teamMap.has(key)) {
      teamMap.set(key, { teamName: player.teamName, offenseScore: 0, defenseScore: 0, playerCount: 0 });
    }
    const team = teamMap.get(key)!;
    team.playerCount++;
    if (DEF_GROUPS.has(group)) team.defenseScore += score;
    else if (OFF_GROUPS.has(group)) team.offenseScore += score;
  }

  return Array.from(teamMap.entries()).map(([teamshort, data]) => ({
    teamshort,
    teamName: data.teamName,
    playerCount: data.playerCount,
    offenseScore: Math.round(data.offenseScore * 10) / 10,
    defenseScore: Math.round(data.defenseScore * 10) / 10,
    totalScore: Math.round((data.offenseScore + data.defenseScore) * 10) / 10,
  }));
}

const _cachedLeagueStats = unstable_cache(
  fetchLeagueStats,
  ['league-stats'],
  { revalidate: 3600, tags: ['league-stats'] },
);

export async function GET(req: NextRequest) {
  const [session, leagueId] = await Promise.all([auth(), getLeagueId()]);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawYear = parseInt(searchParams.get('year') ?? '');
  const currentYear = new Date().getFullYear();

  if (!Number.isFinite(rawYear) || rawYear < currentYear - 1 || rawYear > currentYear) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const result = await _cachedLeagueStats(leagueId, rawYear);
  result.sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
