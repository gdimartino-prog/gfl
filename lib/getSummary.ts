import { getHistory } from './getHistory';

export async function getTeamSummary() {
  const allData = await getHistory();
  
  const summaryMap: Record<string, any> = {};

  allData.forEach((row) => {
    // If we haven't seen this team yet, initialize their stats
    if (!summaryMap[row.team]) {
      summaryMap[row.team] = {
        team: row.team,
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

    const t = summaryMap[row.team];
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
}