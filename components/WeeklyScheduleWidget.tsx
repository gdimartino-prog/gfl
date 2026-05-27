import { getSchedule } from '@/lib/getSchedule';
import Link from 'next/link';
import { ScheduleGame } from '@/types';

// A score is "missing" only when null/undefined/empty-string. The literal
// number 0 is a valid result (shutout) — treating it as missing caused the
// widget to anchor the home page on an old year's shutout game.
function isScoreMissing(s: ScheduleGame['vScore']): boolean {
  if (s == null) return true;
  if (typeof s === 'string') return s.trim() === '';
  return false;
}

export default async function WeeklyScheduleWidget({ leagueId = 1 }: { leagueId?: number }) {
  const allGames: ScheduleGame[] = await getSchedule(leagueId);

  // Restrict to the latest year in the schedule so a prior-season game with
  // a real 0 score (or a stale partial row) can never mask the current week.
  const years = allGames
    .map(g => (typeof g.year === 'string' ? parseInt(g.year) : g.year))
    .filter((y): y is number => typeof y === 'number' && !isNaN(y));
  const latestYear = years.length > 0 ? Math.max(...years) : undefined;
  const yearGames = latestYear != null
    ? allGames.filter(g => Number(g.year) === latestYear)
    : allGames;

  const currentWeekGame = yearGames.find(g => isScoreMissing(g.vScore) || isScoreMissing(g.hScore));
  const displayWeek = currentWeekGame ? currentWeekGame.week : yearGames[yearGames.length - 1]?.week;
  const displayYear = currentWeekGame ? currentWeekGame.year : yearGames[yearGames.length - 1]?.year;

  const weeklyGames = yearGames.filter(g => g.week === displayWeek && g.year === displayYear);

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
        <h3 className="font-black uppercase italic text-slate-900 tracking-tighter">
          Week {displayWeek} <span className="text-blue-600">Schedule</span>
        </h3>
      </div>

      <div className="divide-y divide-slate-50">
        {weeklyGames.map((game, i) => (
          <div key={i} className="p-4 flex justify-between items-center">
            <div className="flex flex-col gap-1 flex-1">
               <div className="flex justify-between items-center pr-4">
                  <span className="text-xs font-bold text-slate-700 uppercase">{game.visitor}</span>
                  <span className="text-xs font-mono font-black text-slate-400">{game.vScore || '-'}</span>
               </div>
               <div className="flex justify-between items-center pr-4">
                  <span className="text-xs font-bold text-slate-900 uppercase">{game.home}</span>
                  <span className="text-xs font-mono font-black text-blue-600">{game.hScore || '-'}</span>
               </div>
            </div>
          </div>
        ))}
      </div>
      
      <Link href="/schedule" className="block w-full py-4 text-center text-[10px] font-black uppercase tracking-widest text-blue-600 hover:bg-blue-50 transition-all border-t border-slate-50">
        View Full Schedule
      </Link>
    </div>
  );
}