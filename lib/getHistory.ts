import { db } from './db';
import { standings, teams } from '@/schema';
import { eq } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { StandingRow } from '@/types';

const _getHistory = unstable_cache(
  async (): Promise<StandingRow[]> => {
    try {
      const rows = await db.select({
        teamName: teams.name,
        year: standings.year,
        wins: standings.wins,
        losses: standings.losses,
        ties: standings.ties,
        offPts: standings.offPts,
        defPts: standings.defPts,
        division: standings.division,
        isDivWinner: standings.isDivWinner,
        isPlayoff: standings.isPlayoff,
        isSuperBowl: standings.isSuperBowl,
        isChampion: standings.isChampion,
        oldTeamName: standings.oldTeamName,
      })
      .from(standings)
      .leftJoin(teams, eq(standings.teamId, teams.id))
      .orderBy(standings.year);

      return rows.map(r => {
        const total = r.wins + r.losses + r.ties;
        return {
          team: r.oldTeamName || r.teamName || '',
          year: r.year,
          won: r.wins,
          lost: r.losses,
          tie: r.ties,
          pct: total > 0 ? r.wins / total : 0,
          offPts: r.offPts ?? 0,
          defPts: r.defPts ?? 0,
          diff: (r.offPts ?? 0) - (r.defPts ?? 0),
          isDivWinner: r.isDivWinner ?? false,
          isPlayoff: r.isPlayoff ?? false,
          isSuperBowl: r.isSuperBowl ?? false,
          isChampion: r.isChampion ?? false,
          oldTeamName: r.oldTeamName || null,
          gm: 'N/A',
          division: r.division || 'N/A',
        };
      });
    } catch (error) {
      console.error('getHistory failed:', error);
      return [];
    }
  },
  ['history-data'],
  { revalidate: 60, tags: ['history'] }
);

export async function getHistory(): Promise<StandingRow[]> {
  return _getHistory();
}

export async function getTeamSummary() {
  return unstable_cache(
    async () => {
      const allData = await getHistory();

      interface TeamSummary {
        team: string;
        seasons: number;
        wins: number;
        losses: number;
        ties: number;
        pointsFor: number;
        pointsAgainst: number;
        playoffs: number;
        superBowls: number;
        championships: number;
      }

      const summaryMap: Record<string, TeamSummary> = {};

      allData.forEach((row) => {
        const teamKey = row.team;
        if (!summaryMap[teamKey]) {
          summaryMap[teamKey] = {
            team: teamKey,
            seasons: 0, wins: 0, losses: 0, ties: 0,
            pointsFor: 0, pointsAgainst: 0,
            playoffs: 0, superBowls: 0, championships: 0,
          };
        }
        const t = summaryMap[teamKey];
        t.seasons += 1;
        t.wins += Number(row.won || 0);
        t.losses += Number(row.lost || 0);
        t.ties += Number(row.tie || 0);
        t.pointsFor += Number(row.offPts || 0);
        t.pointsAgainst += Number(row.defPts || 0);
        if (row.isPlayoff) t.playoffs += 1;
        if (row.isSuperBowl) t.superBowls += 1;
        if (row.isChampion) t.championships += 1;
      });

      return Object.values(summaryMap).sort((a, b) => {
        if (b.championships !== a.championships) return b.championships - a.championships;
        return b.wins - a.wins;
      });
    },
    ['team-summary-calculated'],
    { revalidate: 60, tags: ['history'] }
  )();
}
