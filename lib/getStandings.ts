
import { unstable_cache } from 'next/cache';
import { db } from './db';
import { standings, teams } from '@/schema';
import { eq, desc } from 'drizzle-orm';
import { StandingRow } from '@/types';

const _getStandings = unstable_cache(
  async (leagueId: number) => {
    const standingsData = await db
      .select({
        year: standings.year,
        team: teams.name,
        teamshort: teams.teamshort,
        nickname: teams.nickname,
        coach: teams.coach,
        coachName: standings.coachName,
        won: standings.wins,
        lost: standings.losses,
        tie: standings.ties,
        division: standings.division,
        offPts: standings.offPts,
        defPts: standings.defPts,
        isDivWinner: standings.isDivWinner,
        isPlayoff: standings.isPlayoff,
        isSuperBowl: standings.isSuperBowl,
        isChampion: standings.isChampion,
        oldTeamName: standings.oldTeamName,
      })
      .from(standings)
      .leftJoin(teams, eq(standings.teamId, teams.id))
      .where(eq(standings.leagueId, leagueId))
      .orderBy(desc(standings.year), desc(standings.wins));

    return standingsData.map(data => ({
      ...data,
      gm: data.coachName ?? data.coach ?? undefined,
      pct: (data.won + data.tie / 2) / (data.won + data.lost + data.tie) || 0,
      offPts: data.offPts ?? 0,
      defPts: data.defPts ?? 0,
      diff: (data.offPts ?? 0) - (data.defPts ?? 0),
      isDivWinner: data.isDivWinner ?? false,
      isPlayoff: data.isPlayoff ?? false,
      isSuperBowl: data.isSuperBowl ?? false,
      isChampion: data.isChampion ?? false,
    })) as StandingRow[];
  },
  ['standings-data'],
  { revalidate: 60, tags: ['standings'] }
);

export async function getStandings(leagueId: number = 1): Promise<StandingRow[]> {
  try {
    return await _getStandings(leagueId);
  } catch (error) {
    console.error("getStandings Lib Error:", error);
    return [];
  }
}