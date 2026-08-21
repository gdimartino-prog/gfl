import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players } from '@/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { findEspnId, getEspnSeasonStats, getNflTeam } from '@/lib/espn-stats';
import { posGroup, powerScore } from '@/lib/power-score';
import { isPrivileged } from '@/lib/auth';
import { unstable_cache } from 'next/cache';

async function fetchFaPower(leagueId: number, year: number) {
  const roster = await db
    .select({
      id: players.id,
      first: players.first,
      last: players.last,
      name: players.name,
      age: players.age,
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
    ));

  if (!roster.length) return [];

  const CHUNK = 40;
  const results: Array<{
    id: number;
    name: string;
    espnId: string | null;
    nflTeam: string | null;
    posGroup: string;
    score: number;
  }> = [];

  for (let i = 0; i < roster.length; i += CHUNK) {
    const batch = roster.slice(i, i + CHUNK);
    const batchResults = await Promise.all(
      batch.map(async (player) => {
        let espnId = player.espnId ?? null;

        // Auto-search and persist missing espnIds (same pattern as nfl-stats route)
        if (!espnId) {
          espnId = await findEspnId(player.first ?? '', player.last ?? '');
          if (espnId) {
            await db.update(players)
              .set({ espnId, touch_id: 'fa-power-sync', touch_dt: new Date() })
              .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
          }
        }

        if (!espnId) return null;

        // Fetch stats and NFL team in parallel; persist nflTeam if newly found
        const [stats, fetchedTeam] = await Promise.all([
          getEspnSeasonStats(espnId, year),
          player.nflTeam ? Promise.resolve(null) : getNflTeam(espnId),
        ]);

        let nflTeam = player.nflTeam ?? null;
        if (!nflTeam && fetchedTeam) {
          nflTeam = fetchedTeam;
          await db.update(players)
            .set({ nflTeam, touch_id: 'fa-power-sync', touch_dt: new Date() })
            .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
        }

        const group = posGroup(player.offense, player.defense, player.special, player.position);
        const score = powerScore(player.offense, player.defense, player.special, player.position, stats);
        return {
          id: player.id,
          name: player.name ?? '',
          espnId,
          nflTeam,
          age: player.age ?? null,
          posGroup: group,
          score,
        };
      }),
    );
    results.push(...batchResults.filter((r): r is NonNullable<typeof r> => r !== null));
  }

  return results
    .filter(p => p.score > 0)
    .sort((a, b) => b.score - a.score);
}

const _cachedFaPower = unstable_cache(
  fetchFaPower,
  ['fa-power-v3'],
  // 12h — a cold rebuild fans out hundreds of ESPN calls; season stats
  // don't move fast enough to justify hourly rebuilds.
  { revalidate: 43200, tags: ['fa-power'] },
);

// Cold rebuild loops every FA through ESPN lookups — needs more than the
// default function budget or a timeout wastes the whole run.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const [session, leagueId] = await Promise.all([auth(), getLeagueId()]);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  if (!(await isPrivileged())) {
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
