import { getSchedule } from '@/lib/getSchedule';
import { ScheduleGame } from '@/types';
import Link from 'next/link';

export default async function NextMatchup() {
  const games: ScheduleGame[] = await getSchedule();
  
  // Find the first game that doesn't have a score yet
  const nextGame = games.find(g => !g.vScore || g.vScore === '');

  if (!nextGame) return null; 

  return (
    <div className="bg-white rounded-[2rem] border border-slate-100 shadow-xl overflow-hidden">
      <div className="bg-blue-600 px-6 py-3 flex justify-between items-center text-white">
        <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Featured Matchup</span>
        <span className="text-[10px] font-black uppercase tracking-[0.2em]">Week {nextGame.week}</span>
      </div>
      
      <div className="p-8 flex items-center justify-around gap-4 text-center">
        <div className="flex-1">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Visitor</p>
          <h4 className="text-xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            {nextGame.visitor}
          </h4>
        </div>

        <div className="flex flex-col items-center">
          <span className="text-2xl font-black italic text-slate-200">@</span>
        </div>

        <div className="flex-1">
          <p className="text-[9px] font-black uppercase text-slate-400 mb-1">Home</p>
          <h4 className="text-xl font-black uppercase italic tracking-tighter text-blue-600 leading-none">
            {nextGame.home}
          </h4>
        </div>
      </div>

      <div className="bg-slate-50 p-4 text-center">
        <Link href="/schedule" className="text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-blue-600 transition-colors">
          View Full Schedule →
        </Link>
      </div>
    </div>
  );
}