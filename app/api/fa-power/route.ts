import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players } from '@/schema';
import { eq, and, isNull, isNotNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { getEspnSeasonStats } from '@/lib/espn-stats';
import { posGroup, powerScore } from '@/lib/power-score';
import { unstable_cache } from 'next/cache';

async function fetchFaPower(leagueId: number, year: number) {
  const roster = await db
    .select({
      id: players.id,
      name: players.name,
      offense: players.offense,
      defense: players.defense,
      special: players.special,
      position: players.position,
      espnId: players.espnId,
      nflTeam: players.nflTeam,
    })
    .from(players)
    .where(and(
      eq(players.leagueId, leagueId),
      isNull(players.teamId),
      isNotNull(players.espnId),
    ));

  if (!roster.length) return [];

  const CHUNK = 40;
  const results: Array<{
    id: number;
    name: string;
    espnId: string;
    nflTeam: string | null;
    posGroup: string;
    score: number;
  }> = [];

  for (let i = 0; i < roster.length; i += CHUNK) {
    const batch = roster.slice(i, i + CHUNK);
    const batchResults = await Promise.all(
      batch.map(async (player) => {
        const stats = await getEspnSeasonStats(player.espnId!, year);
        const group = posGroup(player.offense, player.defense, player.special, player.position);
        const score = powerScore(player.offense, player.defense, player.special, player.position, stats);
        return {
          id: player.id,
          name: player.name ?? '',
          espnId: player.espnId!,
          nflTeam: player.nflTeam ?? null,
          posGroup: group,
          score,
        };
      }),
    );
    results.push(...batchResults);
  }

  return results
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);
}

const _cachedFaPower = unstable_cache(
  fetchFaPower,
  ['fa-power'],
  { revalidate: 3600, tags: ['fa-power'] },
);

export async function GET(req: NextRequest) {
  const [session, leagueId] = await Promise.all([auth(), getLeagueId()]);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== 'admin' && role !== 'superuser') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const rawYear = parseInt(searchParams.get('year') ?? '');
  const currentYear = new Date().getFullYear();

  if (!Number.isFinite(rawYear) || rawYear < currentYear - 1 || rawYear > currentYear) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  const result = await _cachedFaPower(leagueId, rawYear);

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
