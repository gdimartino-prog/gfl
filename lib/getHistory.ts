import { sheets, SHEET_ID } from './googleSheets';

export async function getHistory() {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Standings!A2:P1000', // Increased range for all-time data
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
    }));
  } catch (error) {
    console.error("❌ Error fetching league history:", error);
    return [];
  }
}

export async function getTeamSummary() {
  const allData = await getHistory();
  
  const summaryMap: Record<string, any> = {};

  allData.forEach((row) => {
    if (!summaryMap[row.team]) {
      summaryMap[row.team] = {
        team: row[row.oldTeamName ? 'oldTeamName' : 'team'], // Accounts for name changes
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
    t.wins += Number(row.won);
    t.losses += Number(row.lost);
    t.ties += Number(row.tie);
    t.pointsFor += Number(row.offPts);
    t.pointsAgainst += Number(row.defPts);
    if (row.isPlayoff) t.playoffs += 1;
    if (row.isSuperBowl) t.superBowls += 1;
    if (row.isChampion) t.championships += 1;
  });

  return Object.values(summaryMap).sort((a, b) => b.wins - a.wins); // Sort by total wins
}