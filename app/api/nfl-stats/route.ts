import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { getLeagueId } from '@/lib/getLeagueId';
import { findEspnId, getEspnSeasonStats } from '@/lib/espn-stats';

const OL_POSITIONS = new Set(['OL', 'OT', 'OG', 'C', 'G', 'T']);

function isOL(p: { offense?: string | null; defense?: string | null; special?: string | null; position?: string | null }): boolean {
  const pos = (p.offense || p.defense || p.special || p.position || '').toUpperCase();
  return OL_POSITIONS.has(pos);
}

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
    })
    .from(players)
    .innerJoin(teams, and(eq(players.teamId, teams.id), eq(teams.leagueId, leagueId)))
    .where(and(eq(teams.teamshort, teamshort.toUpperCase()), eq(players.leagueId, leagueId)));

  if (!roster.length) return NextResponse.json([], { headers: { 'Cache-Control': 'private, max-age=300' } });

  const skillPlayers = roster.filter((p) => !isOL(p));
  const olPlayers = roster.filter((p) => isOL(p));

  const skillResults = await Promise.all(
    skillPlayers.map(async (player) => {
      // Use stored ESPN ID if available; otherwise search and persist it
      let espnId = player.espnId || null;
      if (!espnId) {
        espnId = await findEspnId(player.first || '', player.last || '');
        if (espnId) {
          // Persist so next load skips the search
          await db.update(players)
            .set({ espnId, touch_id: 'espn-sync', touch_dt: new Date() })
            .where(eq(players.id, player.id));
        }
      }
      if (!espnId) return { ...player, espnId: null, stats: null };
      const stats = await getEspnSeasonStats(espnId, year);
      return { ...player, espnId, stats };
    }),
  );

  const olResults = olPlayers.map((p) => ({ ...p, espnId: null, stats: null }));

  return NextResponse.json([...skillResults, ...olResults], {
    headers: { 'Cache-Control': 'private, max-age=300' },
  });
}
