import { getHistory } from '@/lib/getHistory';
import SummaryTable from '@/components/SummaryTable';
import Link from 'next/link';

export const revalidate = 3600;

export default async function SummaryReportPage() {
  const allData = await getHistory();

  // Sort data by year ascending to ensure the most recent GM name is captured last during aggregation
  const sortedData = [...allData].sort((a, b) => Number(a.year) - Number(b.year));

  interface TeamSummary {
    [key: string]: string | number;
    team: string;
    gm: string;
    wins: number;
    losses: number;
    ties: number;
    winPct: number;
    seasons: number;
    offPts: number;
    defPts: number;
    divWins: number;
    postSeason: number;
    superBowls: number;
    championships: number;
  }

  // Aggregate raw rows into Franchise summaries
  const summaryMap: Record<string, TeamSummary> = {};

  sortedData.forEach((row) => {
    // Group by Team name (Column A)
    const teamKey = row.team;

    if (!summaryMap[teamKey]) {
      summaryMap[teamKey] = {
        team: teamKey,
        gm: row.gm || 'N/A',
        wins: 0,
        losses: 0,
        ties: 0,
        winPct: 0,
        seasons: 0,
        offPts: 0,
        defPts: 0,
        divWins: 0,
        postSeason: 0,
        superBowls: 0,
        championships: 0,
      };
    }

    const t = summaryMap[teamKey];
    t.seasons += 1;
    t.wins += Number(row.won || 0);
    t.losses += Number(row.lost || 0);
    t.ties += Number(row.tie || 0);
    t.offPts += Number(row.offPts || 0);
    t.defPts += Number(row.defPts || 0);
    
    // Increment counts for specific achievements
    if (row.isDivWinner) t.divWins += 1;
    if (row.isPlayoff) t.postSeason += 1;
    if (row.isSuperBowl) t.superBowls += 1;
    if (row.isChampion) t.championships += 1;

    // Ensure we have the most recent GM name
    if (row.gm && row.gm !== 'N/A') {
      t.gm = row.gm;
    }
  });

  const summaryData = Object.values(summaryMap).map(t => {
    const totalGames = t.wins + t.losses + t.ties;
    t.winPct = totalGames > 0 ? Number(((t.wins + (0.5 * t.ties)) / totalGames).toFixed(3)) : 0;
    return t;
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            FRANCHISE <span className="text-blue-600">LEADERBOARD</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
            ALL-TIME CUMULATIVE LEAGUE RECORDS
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Link href="/standings" className="px-6 py-2 text-slate-500 hover:text-slate-900 text-sm font-black uppercase tracking-tight transition-colors">
            Yearly View
          </Link>
          <Link href="/standings/summary" className="px-6 py-2 bg-white text-blue-600 shadow-sm rounded-lg text-sm font-black uppercase tracking-tight">
            All-Time Leaderboard
          </Link>
        </div>
      </header>

      <SummaryTable initialData={summaryData} />
    </div>
  );
}