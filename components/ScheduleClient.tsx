'use client';

import { useState } from 'react';

interface Game {
  year: string;
  week: string;
  visitor: string;
  home: string;
  vScore: string | null;
  hScore: string | null;
  status: string;
}

export default function ScheduleClient({ initialGames }: { initialGames: Game[] }) {
  // 1. Extract years and sort descending (Newest first)
  const availableYears = Array.from(new Set(initialGames.map(g => g.year.toString())))
    .sort((a, b) => Number(b) - Number(a));

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);

  // 2. Filter games for the selected year
  const gamesInYear = initialGames.filter(g => g.year.toString() === selectedYear);

  // 3. Extract and Sort Weeks (Natural sort: 1, 2 ... 14, 15-WC, 16-SEMIS)
  const weeksInYear = Array.from(new Set(gamesInYear.map(g => g.week.toString())))
    .sort((a, b) => {
      const numA = parseInt(a);
      const numB = parseInt(b);
      return numA - numB;
    });

  // 4. LOGIC: Find the FIRST week in the sequence that is incomplete
  const firstIncompleteWeek = weeksInYear.find(weekNum => {
    const gamesInWeek = gamesInYear.filter(g => g.week.toString() === weekNum);
    return gamesInWeek.some(g => {
      const vStr = (g.vScore || "").toString().trim();
      const hStr = (g.hScore || "").toString().trim();
      return vStr === "" || vStr === "00" || hStr === "" || hStr === "00";
    });
  });

  // Default to the first incomplete week, or the last week of the season if finished
  const activeWeek = firstIncompleteWeek || weeksInYear[weeksInYear.length - 1] || '1';
  const [selectedWeek, setSelectedWeek] = useState(activeWeek);

  // Handle year change: Reset week to the active/first week of that specific year
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const newYearGames = initialGames.filter(g => g.year.toString() === year);
    const newWeeks = Array.from(new Set(newYearGames.map(g => g.week.toString())))
      .sort((a, b) => parseInt(a) - parseInt(b));
    
    const newIncomplete = newWeeks.find(w => {
        return newYearGames.filter(g => g.week.toString() === w).some(g => {
            const v = (g.vScore || "").toString().trim();
            return v === "" || v === "00";
        });
    });
    setSelectedWeek(newIncomplete || newWeeks[0] || '1');
  };

  const filteredGames = gamesInYear.filter(g => g.week.toString() === selectedWeek);

  return (
    <div className="space-y-8">
      {/* YEAR SELECTOR */}
      <div className="flex gap-4 border-b border-slate-200 pb-2 overflow-x-auto no-scrollbar">
        {availableYears.map(year => (
          <button
            key={year}
            onClick={() => handleYearChange(year)}
            className={`pb-2 px-1 text-sm font-black uppercase tracking-tighter transition-all border-b-2 ${
              selectedYear === year 
                ? 'border-blue-600 text-blue-600' 
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            {year} Season
          </button>
        ))}
      </div>

      {/* WEEK NAVIGATION */}
      <div className="flex gap-2 overflow-x-auto pb-4 no-scrollbar sticky top-16 z-40 bg-[#f8fafc]/80 backdrop-blur-md py-4 px-2 -mx-2">
        {weeksInYear.map(week => {
          const isCurrentActiveWeek = week === firstIncompleteWeek;
          const isSelected = selectedWeek === week;
          const isPlayoffWeek = week.includes('-');

          return (
            <button
              key={week}
              onClick={() => setSelectedWeek(week)}
              className={`px-6 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shrink-0 border-2 flex items-center gap-2 ${
                isSelected 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' 
                  : isPlayoffWeek 
                    ? 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300'
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
              }`}
            >
              {isPlayoffWeek ? week.split('-')[1] : `Week ${week}`}
              {isCurrentActiveWeek && (
                <span className="relative flex h-2 w-2 ml-1">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-blue-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-blue-600"></span>
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* GAMES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
        {filteredGames.map((game, i) => {
          const vRaw = (game.vScore || "").toString().trim();
          const hRaw = (game.hScore || "").toString().trim();
          const isFinal = vRaw !== "" && vRaw !== "00" && hRaw !== "" && hRaw !== "00";
          const isPlayoff = game.week.includes('-');
          const roundName = isPlayoff ? game.week.split('-')[1] : null;

          return (
            <div key={i} className={`relative rounded-[2rem] border transition-all duration-300 overflow-hidden group ${
              isPlayoff 
                ? 'border-amber-200 bg-gradient-to-br from-white to-amber-50 shadow-lg ring-2 ring-amber-100/50' 
                : isFinal ? 'border-slate-100 bg-white shadow-sm' : 'border-blue-100 bg-white shadow-md'
            }`}>
              {isPlayoff && (
                <div className="absolute top-0 right-0 bg-amber-500 text-white text-[8px] font-black px-4 py-1.5 uppercase tracking-widest rounded-bl-2xl shadow-sm z-10">
                  {roundName}
                </div>
              )}
              
              <div className="p-8 space-y-6">
                <TeamLine 
                    name={game.visitor} 
                    score={vRaw === "" || vRaw === "00" ? null : vRaw} 
                    isWinner={isFinal && Number(vRaw) > Number(hRaw)} 
                    label="Away"
                />
                <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <span className="relative bg-white px-4 text-[10px] font-black text-slate-300 italic uppercase tracking-widest rounded-full">At</span>
                </div>
                <TeamLine 
                    name={game.home} 
                    score={hRaw === "" || hRaw === "00" ? null : hRaw} 
                    isWinner={isFinal && Number(hRaw) > Number(vRaw)} 
                    label="Home"
                    isHome
                />
              </div>
              
              <div className={`py-3 px-8 text-center text-[9px] font-black uppercase tracking-[0.2em] ${
                isFinal ? 'bg-emerald-50 text-emerald-600' : isPlayoff ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'
              }`}>
                {isFinal ? 'Final Result' : 'Upcoming Matchup'}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function TeamLine({ name, score, isWinner, label, isHome = false }: any) {
  return (
    <div className="flex justify-between items-center">
      <div className="flex flex-col text-left">
        <span className="text-[9px] font-black uppercase text-slate-400 tracking-tighter mb-1">{label}</span>
        <span className={`text-xl font-black uppercase italic tracking-tighter leading-none ${isWinner ? 'text-blue-600' : 'text-slate-800'}`}>
          {name} {isHome && <span className="text-[10px] not-italic text-slate-300 ml-1">(H)</span>}
        </span>
      </div>
      <div className={`text-3xl font-mono font-black ${isWinner ? 'text-blue-600' : score ? 'text-slate-400' : 'text-slate-100'}`}>
        {score || '00'}
      </div>
    </div>
  );
}