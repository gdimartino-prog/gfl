import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { getEspnSeasonStats } from '@/lib/espn-stats';
import { posGroup, powerScore } from '@/lib/power-score';
import { unstable_cache } from 'next/cache';

const DEF_GROUPS = new Set(['DL', 'LB', 'DB']);
const OFF_GROUPS = new Set(['QB', 'RB', 'WR', 'TE', 'K', 'OL']);
const POS_ORDER = ['QB', 'RB', 'WR', 'TE', 'OL', 'DL', 'LB', 'DB', 'K', 'P'];

interface LeaguePlayerOut {
  id: number;
  name: string;
  espnId: string | null;
  nflTeam: string | null;
  age: number | null;
  teamshort: string;
  teamName: string;
  posGroup: string;
  score: number;
}

interface PlayerRow {
  id: number;
  name: string | null;
  age: number | null;
  offense: string | null;
  defense: string | null;
  special: string | null;
  position: string | null;
  espnId: string | null;
  nflTeam: string | null;
}

// ESPN calls are chunked to avoid a rate-limit burst on a cold cache.
async function withEspnStats<T extends PlayerRow>(rows: T[], year: number) {
  const CHUNK = 40;
  const out: Array<T & { stats: Record<string, number> | null }> = [];
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const results = await Promise.all(
      batch.map(async (player) => {
        if (!player.espnId) return { ...player, stats: null };
        const stats = await getEspnSeasonStats(player.espnId, year);
        return { ...player, stats };
      }),
    );
    out.push(...results);
  }
  return out;
}

async function fetchRosterStats(leagueId: number, year: number) {
  const roster = await db
    .select({
      id: players.id,
      name: players.name,
      age: players.age,
      offense: players.offense,
      defense: players.defense,
      special: players.special,
      position: players.position,
      espnId: players.espnId,
      nflTeam: players.nflTeam,
      teamshort: teams.teamshort,
      teamName: teams.name,
    })
    .from(players)
    .innerJoin(teams, and(eq(players.teamId, teams.id), eq(teams.leagueId, leagueId)))
    .where(eq(players.leagueId, leagueId));

  if (!roster.length) return { teams: [], players: [] };

  const withStats = await withEspnStats(roster, year);

  const teamMap = new Map<string, {
    teamName: string;
    offenseScore: number;
    defenseScore: number;
    playerCount: number;
    byGroup: Record<string, number>;
  }>();

  const playerList: LeaguePlayerOut[] = [];

  for (const player of withStats) {
    const group = posGroup(player.offense, player.defense, player.special, player.position);
    const score = powerScore(player.offense, player.defense, player.special, player.position, player.stats);
    const key = player.teamshort.toUpperCase();

    if (!teamMap.has(key)) {
      teamMap.set(key, { teamName: player.teamName, offenseScore: 0, defenseScore: 0, playerCount: 0, byGroup: {} });
    }
    const team = teamMap.get(key)!;
    team.playerCount++;
    team.byGroup[group] = (team.byGroup[group] ?? 0) + score;
    if (DEF_GROUPS.has(group)) team.defenseScore += score;
    else if (OFF_GROUPS.has(group)) team.offenseScore += score;

    playerList.push({
      id: player.id,
      name: player.name ?? '',
      espnId: player.espnId ?? null,
      nflTeam: player.nflTeam ?? null,
      age: player.age ?? null,
      teamshort: key,
      teamName: player.teamName,
      posGroup: group,
      score,
    });
  }

  const teamList = Array.from(teamMap.entries()).map(([teamshort, data]) => {
    const byGroup: Record<string, number> = {};
    for (const g of POS_ORDER) {
      if ((data.byGroup[g] ?? 0) > 0) byGroup[g] = Math.round(data.byGroup[g] * 10) / 10;
    }
    return {
      teamshort,
      teamName: data.teamName,
      playerCount: data.playerCount,
      offenseScore: Math.round(data.offenseScore * 10) / 10,
      defenseScore: Math.round(data.defenseScore * 10) / 10,
      totalScore: Math.round((data.offenseScore + data.defenseScore) * 10) / 10,
      byGroup,
    };
  });

  return { teams: teamList, players: playerList };
}

// Free agents are only ever stat'd when a caller explicitly asks for them
// (the "Free Agents" filter) — eagerly including the whole FA pool in the
// main roster rebuild would multiply the ESPN call volume on every 12h
// cache refresh and risk rate-limiting the app's other ESPN-backed features.
async function fetchFreeAgentStats(leagueId: number, year: number) {
  const fa = await db
    .select({
      id: players.id,
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
    .where(and(eq(players.leagueId, leagueId), isNull(players.teamId)));

  if (!fa.length) return { players: [] };

  const withStats = await withEspnStats(fa, year);

  const playerList: LeaguePlayerOut[] = withStats.map((player) => ({
    id: player.id,
    name: player.name ?? '',
    espnId: player.espnId ?? null,
    nflTeam: player.nflTeam ?? null,
    age: player.age ?? null,
    teamshort: 'FA',
    teamName: 'Free Agent',
    posGroup: posGroup(player.offense, player.defense, player.special, player.position),
    score: powerScore(player.offense, player.defense, player.special, player.position, player.stats),
  }));

  return { players: playerList };
}

const _cachedRosterStats = unstable_cache(
  fetchRosterStats,
  ['league-stats-v2'],
  // 12h — a cold rebuild loops every rostered player through ESPN calls.
  { revalidate: 43200, tags: ['league-stats'] },
);

const _cachedFreeAgentStats = unstable_cache(
  fetchFreeAgentStats,
  ['league-stats-fa-v1'],
  { revalidate: 43200, tags: ['league-stats-fa'] },
);

export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const [session, leagueId] = await Promise.all([auth(), getLeagueId()]);
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const rawYear = parseInt(searchParams.get('year') ?? '');
  const currentYear = new Date().getFullYear();

  if (!Number.isFinite(rawYear) || rawYear < currentYear - 1 || rawYear > currentYear) {
    return NextResponse.json({ error: 'Invalid year' }, { status: 400 });
  }

  if (searchParams.get('fa') === '1') {
    const { players: faPlayers } = await _cachedFreeAgentStats(leagueId, rawYear);
    return NextResponse.json({ players: faPlayers }, {
      headers: { 'Cache-Control': 'private, max-age=3600' },
    });
  }

  const result = await _cachedRosterStats(leagueId, rawYear);
  const sortedTeams = [...result.teams].sort((a, b) => b.totalScore - a.totalScore);

  return NextResponse.json({ teams: sortedTeams, players: result.players }, {
    headers: { 'Cache-Control': 'private, max-age=3600' },
  });
}
