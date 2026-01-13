import { getHistory } from '@/lib/getHistory';
import Link from 'next/link';

export const revalidate = 3600;

export default async function SummaryReportPage() {
  const allData = await getHistory();

  // 1. Aggregate the data by team
  const summaryMap: Record<string, any> = {};

  allData.forEach((row) => {
    // Use 'Old Team Name' if it exists to group relocated franchises together
    const teamKey = row.oldTeamName || row.team;

    if (!summaryMap[teamKey]) {
      summaryMap[teamKey] = {
        team: teamKey,
        wins: 0,
        losses: 0,
        ties: 0,
        seasons: 0,
        championships: 0,
        playoffs: 0,
        superBowls: 0,
      };
    }

    const t = summaryMap[teamKey];
    t.seasons += 1;
    t.wins += Number(row.won || 0);
    t.losses += Number(row.lost || 0);
    t.ties += Number(row.tie || 0);
    if (row.isChampion) t.championships += 1;
    if (row.isPlayoff) t.playoffs += 1;
    if (row.isSuperBowl) t.superBowls += 1;
  });

  // 2. Convert to array and sort by Titles, then Win Pct
  const summary = Object.values(summaryMap).sort((a, b) => {
    if (b.championships !== a.championships) return b.championships - a.championships;
    const aPct = a.wins / (a.wins + a.losses) || 0;
    const bPct = b.wins / (b.wins + b.losses) || 0;
    return bPct - aPct;
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      {/* Navigation Header */}
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter">
            Franchise <span className="text-blue-600">Leaderboard</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-2">
            All-Time Cumulative League Records
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

      {/* The Table - This was likely missing or empty */}
      <div className="bg-white border-2 border-slate-900 rounded-3xl shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white uppercase text-[10px] tracking-widest font-black">
              <th className="p-5">Franchise</th>
              <th className="p-5 text-center">Yrs</th>
              <th className="p-5 text-center">Record</th>
              <th className="p-5 text-center">Win %</th>
              <th className="p-5 text-center text-amber-400">Titles</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {summary.map((team: any, idx) => {
              const winPct = (team.wins / (team.wins + team.losses)).toFixed(3);
              return (
                <tr key={idx} className="hover:bg-slate-50 font-bold">
                  <td className="p-5 text-slate-900 uppercase italic font-black">{team.team}</td>
                  <td className="p-5 text-center text-slate-400">{team.seasons}</td>
                  <td className="p-5 text-center font-mono text-slate-600">
                    {team.wins}-{team.losses}-{team.ties}
                  </td>
                  <td className="p-5 text-center text-blue-600">{winPct}</td>
                  <td className="p-5 text-center">
                    <div className="flex justify-center gap-1">
                      {team.championships > 0 ? (
                        Array(team.championships).fill(0).map((_, i) => (
                          <span key={i} title="Champion" className="text-lg">🏆</span>
                        ))
                      ) : (
                        <span className="text-slate-300 text-[10px]">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}