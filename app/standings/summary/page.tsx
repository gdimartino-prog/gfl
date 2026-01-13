import { getHistory } from '@/lib/getHistory';
import SummaryTable from '@/components/SummaryTable';
import Link from 'next/link';

export const revalidate = 3600;

export default async function SummaryReportPage() {
  const allData = await getHistory();

  // Aggregate the data (Logic remains the same)
  const summaryMap: Record<string, any> = {};
  allData.forEach((row) => {
    const teamKey = row.oldTeamName || row.team;
    if (!summaryMap[teamKey]) {
      summaryMap[teamKey] = {
        team: teamKey,
        gm: row.gm || 'N/A',
        wins: 0,
        losses: 0,
        ties: 0,
        seasons: 0,
        championships: 0,
      };
    }
    const t = summaryMap[teamKey];
    t.seasons += 1;
    t.wins += Number(row.won || 0);
    t.losses += Number(row.lost || 0);
    t.ties += Number(row.tie || 0);
    if (row.isChampion) t.championships += 1;
  });

  const summaryData = Object.values(summaryMap);

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
          <Link href="/standings" className="px-6 py-2 text-slate-500 hover:text-slate-900 text-sm font-black uppercase tracking-tight">
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