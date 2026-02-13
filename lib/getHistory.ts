import { getSheetsClient } from './google-cloud';
import { unstable_cache } from 'next/cache';
import { StandingRow } from '@/types';

export async function getHistory(): Promise<StandingRow[]> {
  return unstable_cache(
    async () => {
      const sheets = getSheetsClient();
      const SHEET_ID = process.env.GOOGLE_SHEET_ID;

      try {
        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: SHEET_ID,
          range: 'Standings!A2:R1000', // FIXED: Changed Q to R
        });

        const rows = response.data.values || [];
        
        return rows.map((row) => ({
          team: row[0],
          year: row[1],
          won: row[2],
          lost: row[3],
          tie: row[4],
          pct: row[5],
          offPts: row[6],
          defPts: row[8],
          diff: row[10],
          isDivWinner: row[11] === '1',
          isPlayoff: row[12] === '1',
          isSuperBowl: row[13] === '1',
          isChampion: row[14] === '1',
          oldTeamName: row[15] || null, 
          gm: row[16] || "N/A",
          division: row[17] || "N/A" // Now index 17 (Column R) is available
        }));
      } catch (error) {
        console.error("❌ Error fetching league history:", error);
        return [];
      }
    },
    ['history-data'],
    { revalidate: 60, tags: ['history'] }
  )();
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
            seasons: 0,
            wins: 0,
            losses: 0,
            ties: 0,
            pointsFor: 0,
            pointsAgainst: 0,
            playoffs: 0,
            superBowls: 0,
            championships: 0,
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

      // Convert the object back into an array and sort by Titles, then Wins
      return Object.values(summaryMap).sort((a, b) => {
        if (b.championships !== a.championships) return b.championships - a.championships;
        return b.wins - a.wins;
      });
    },
    ['team-summary-calculated'],
    { revalidate: 60, tags: ['history'] }
  )();
}