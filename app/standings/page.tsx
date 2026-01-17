import { getHistory } from '@/lib/getHistory';
import StandingsClient from '@/components/StandingsClient';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  const allData = await getHistory();

  // 1. Sort data so newest years are first
  const sortedData = [...allData].sort((a, b) => Number(b.year) - Number(a.year));

  // 2. Dynamically find the most recent year in your spreadsheet
  // If data exists, use the year from the first row; otherwise default to 2025
  const latestYear = sortedData.length > 0 ? sortedData[0].year.toString() : "2025";

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            League <span className="text-blue-600">Standings</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
            GFL Manager Official Records
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <Link 
            href="/standings" 
            className="px-6 py-2 bg-white text-blue-600 shadow-sm rounded-lg text-sm font-black uppercase tracking-tight"
          >
            Yearly View
          </Link>
          <Link 
            href="/standings/summary" 
            className="px-6 py-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-black uppercase tracking-tight"
          >
            All-Time Leaderboard
          </Link>
        </div>
      </header>
      
      {/* Pass the dynamic latestYear instead of hardcoded "2024" */}
      <StandingsClient allData={sortedData} currentYear={latestYear} />
    </div>
  );
}