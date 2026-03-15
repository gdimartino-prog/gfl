import { getSchedule } from '@/lib/getSchedule';
import Link from 'next/link';
import { ScheduleGame } from '@/types';

export default async function WeeklyScheduleWidget({ leagueId = 1 }: { leagueId?: number }) {
  const allGames: ScheduleGame[] = await getSchedule(leagueId);
  
  const currentWeekGame = allGames.find(g => !g.vScore || g.vScore === '');
  const displayWeek = currentWeekGame ? currentWeekGame.week : allGames[allGames.length - 1]?.week;

  const weeklyGames = allGames.filter(g => g.week === displayWeek);

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