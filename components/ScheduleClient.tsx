'use client';
import { useState } from 'react';

export default function ScheduleClient({ initialGames }: { initialGames: any[] }) {
  const [selectedWeek, setSelectedWeek] = useState('1');
  
  const weeks = Array.from(new Set(initialGames.map(g => g.week)))
    .sort((a, b) => Number(a) - Number(b));

  const filteredGames = initialGames.filter(g => g.week === selectedWeek);

  return (
    <div className="space-y-8">
      {/* WEEK NAVIGATION */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar sticky top-20 z-40 bg-[#f8fafc]/80 backdrop-blur-md py-2">
        {weeks.map(week => (
          <button
            key={week}
            onClick={() => setSelectedWeek(week)}
            className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shrink-0 border-2 ${
              selectedWeek === week 
                ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' 
                : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
            }`}
          >
            Week {week}
          </button>
        ))}
      </div>

      {/* GAMES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredGames.map((game, i) => {
          const isFinal = game.vScore !== null && game.vScore !== '';
          const vNum = Number(game.vScore);
          const hNum = Number(game.hScore);

          return (
            <div key={i} className="bg-white rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all duration-300 overflow-hidden group">
              <div className="p-8 space-y-6">
                <TeamLine 
                    name={game.visitor} 
                    score={game.vScore} 
                    isWinner={isFinal && vNum > hNum} 
                    label="Away"
                />
                
                <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-50"></div></div>
                    <span className="relative bg-white px-4 text-[10px] font-black text-slate-300 italic uppercase tracking-widest">At</span>
                </div>

                <TeamLine 
                    name={game.home} 
                    score={game.hScore} 
                    isWinner={isFinal && hNum > vNum} 
                    label="Home"
                />
              </div>
              
              <div className={`py-3 px-8 text-center text-[9px] font-black uppercase tracking-[0.2em] ${isFinal ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-50 text-slate-400'}`}>
                {isFinal ? 'Final Result' : 'Upcoming Matchup'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamLine({ name, score, isWinner, label }: any) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex flex-col">
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter mb-1">{label}</span>
        <span className={`text-xl font-black uppercase italic tracking-tighter leading-none ${isWinner ? 'text-blue-600' : 'text-slate-800'}`}>
          {name}
        </span>
      </div>
      <div className={`text-3xl font-mono font-black ${isWinner ? 'text-blue-600' : score ? 'text-slate-400' : 'text-slate-100'}`}>
        {score || '00'}
      </div>
    </div>
  );
}