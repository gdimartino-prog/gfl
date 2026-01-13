import { getHistory } from '@/lib/getHistory';
import StandingsClient from '@/components/StandingsClient';
import Link from 'next/link';

export const revalidate = 3600;

export default async function StandingsPage() {
  const allData = await getHistory();

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter">
            League <span className="text-blue-600">Standings</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-xs tracking-widest mt-2">
            GFL Manager Official Records
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
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
      
      <StandingsClient allData={allData} currentYear="2024" />
    </div>
  );
}