import { getSchedule } from '@/lib/getSchedule';
import ScheduleClient from '@/components/ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const games = await getSchedule();
  
  // Sort primarily by week
  const sortedGames = games.sort((a, b) => Number(a.week) - Number(b.week));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#f8fafc]">
      <header className="mb-10 space-y-2">
        <h1 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
          League <span className="text-blue-600">Schedule</span>
        </h1>
        <div className="flex items-center gap-3">
            <span className="h-px w-12 bg-blue-600"></span>
            <p className="text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">
                GFL Official Matchups & Results
            </p>
        </div>
      </header>

      <ScheduleClient initialGames={sortedGames} />
    </div>
  );
}