'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { CalendarOff } from 'lucide-react';
import { ScheduleGame } from '../types';

interface ScheduleClientProps {
  initialGames: ScheduleGame[];
  leagueTeams?: { id: number; name: string; teamshort: string | null }[];
}

export default function ScheduleClient({ initialGames, leagueTeams }: ScheduleClientProps) {
  // 🚀 REF: For auto-scrolling the navigation rail
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const activeWeekRef = useRef<HTMLButtonElement>(null);

  // 1. Extract years and sort descending (Newest first)
  const availableYears = useMemo(() => 
    Array.from(new Set(initialGames.map(g => String(g.year || ""))))
      .sort((a, b) => Number(b) - Number(a)),
    [initialGames]
  );

  const [selectedYear, setSelectedYear] = useState(availableYears[0]);

  // 2. Filter games for the selected year
  const gamesInYear = initialGames.filter(g => String(g.year || "") === selectedYear);

  // 3. Extract and Sort Weeks (Natural sort: 1, 2 ... 14, 15-WC, 16-SEMIS)
  const weeksInYear = useMemo(() => 
    Array.from(new Set(gamesInYear.map(g => String(g.week || ""))))
      .sort((a, b) => {
        const numA = parseInt(a);
        const numB = parseInt(b);
        return numA - numB;
      }),
    [gamesInYear]
  );

  // 4. LOGIC: Find the FIRST week in the sequence that is incomplete
  const firstIncompleteWeek = useMemo(() => {
    return weeksInYear.find(weekNum => {
      const gamesInWeek = gamesInYear.filter(g => String(g.week || "") === weekNum);
      return gamesInWeek.some(g => {
        const vStr = (g.vScore ?? "").toString().trim();
        const hStr = (g.hScore ?? "").toString().trim();
        return vStr === "" || vStr === "00" || hStr === "" || hStr === "00";
      });
    });
  }, [weeksInYear, gamesInYear]);

  // Default to the first incomplete week, or the last week of the season if finished
  const activeWeek = firstIncompleteWeek || weeksInYear[weeksInYear.length - 1] || '1';
  const [selectedWeek, setSelectedWeek] = useState(activeWeek);

  // 🚀 5. AUTO-SCROLL EFFECT
  // This runs when the component mounts or when the year changes
  useEffect(() => {
    if (activeWeekRef.current) {
      // Small timeout ensures the rail has rendered before calculating position
      const timer = setTimeout(() => {
        activeWeekRef.current?.scrollIntoView({
          behavior: 'smooth',
          block: 'nearest',
          inline: 'center', // Centers the button in the horizontal rail
        });
      }, 200);
      return () => clearTimeout(timer);
    }
  }, [selectedYear, firstIncompleteWeek]);

  // Map team names to teamshort for badge display and roster linking
  const teamShortMap = useMemo(() => {
    const map = new Map<string, string>();
    (leagueTeams || []).forEach(t => {
      if (t.name && t.teamshort) {
        map.set(t.name.trim().toLowerCase(), t.teamshort);
      }
    });
    return map;
  }, [leagueTeams]);

  // Handle year change: Reset week to the active/first week of that specific year
  const handleYearChange = (year: string) => {
    setSelectedYear(year);
    const newYearGames = initialGames.filter(g => String(g.year || "") === year);
    const newWeeks = Array.from(new Set(newYearGames.map(g => String(g.week || ""))))
      .sort((a, b) => parseInt(a) - parseInt(b));
    
    const newIncomplete = newWeeks.find(w => {
      return newYearGames.filter(g => String(g.week || "") === w).some(g => {
        const v = (g.vScore ?? "").toString().trim();
        const h = (g.hScore ?? "").toString().trim();
        return v === "" || v === "00" || h === "" || h === "00";
      });
    });
    setSelectedWeek(newIncomplete || newWeeks[0] || '1');
  };

  const filteredGames = gamesInYear.filter(g => String(g.week || "") === selectedWeek);

  // Check if current selected week is a playoff round (no regular byes in playoffs)
  const isPlayoffWeek = useMemo(() => {
    const w = String(selectedWeek || "").toUpperCase();
    return w.includes('-') || ['WC', 'CONF', 'SB', 'SEMIS', 'PLAYOFF'].some(p => w.includes(p));
  }, [selectedWeek]);

  // Teams playing in the selected week
  const teamsPlayingInWeek = useMemo(() => {
    const set = new Set<string>();
    filteredGames.forEach(g => {
      if (g.home) set.add(g.home.trim().toLowerCase());
      if (g.visitor) set.add(g.visitor.trim().toLowerCase());
    });
    return set;
  }, [filteredGames]);

  // Teams with a bye this week (only active regular season weeks)
  const byeTeams = useMemo(() => {
    if (isPlayoffWeek || filteredGames.length === 0) return [];

    // Gather all distinct teams that play in this season
    const seasonTeams = new Set<string>();
    gamesInYear.forEach(g => {
      if (g.home) seasonTeams.add(g.home.trim());
      if (g.visitor) seasonTeams.add(g.visitor.trim());
    });

    return Array.from(seasonTeams)
      .filter(name => !teamsPlayingInWeek.has(name.toLowerCase()))
      .sort((a, b) => a.localeCompare(b))
      .map(name => ({
        name,
        teamshort: teamShortMap.get(name.toLowerCase()) || null,
      }));
  }, [isPlayoffWeek, filteredGames, gamesInYear, teamsPlayingInWeek, teamShortMap]);

  // Compute bye counts per week for navigation badges
  const weekByeCountMap = useMemo(() => {
    const map = new Map<string, number>();
    const seasonTeams = new Set<string>();
    gamesInYear.forEach(g => {
      if (g.home) seasonTeams.add(g.home.trim().toLowerCase());
      if (g.visitor) seasonTeams.add(g.visitor.trim().toLowerCase());
    });
    const totalSeasonTeams = seasonTeams.size;

    weeksInYear.forEach(w => {
      const isPlayoff = w.includes('-') || ['WC', 'CONF', 'SB', 'SEMIS'].some(p => w.toUpperCase().includes(p));
      if (isPlayoff) return;
      const weekGames = gamesInYear.filter(g => String(g.week || "") === w);
      const playing = new Set<string>();
      weekGames.forEach(g => {
        if (g.home) playing.add(g.home.trim().toLowerCase());
        if (g.visitor) playing.add(g.visitor.trim().toLowerCase());
      });
      const byes = totalSeasonTeams - playing.size;
      if (byes > 0) {
        map.set(w, byes);
      }
    });
    return map;
  }, [gamesInYear, weeksInYear]);

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
      <div 
        ref={scrollContainerRef}
        className="flex gap-2 overflow-x-auto pb-4 no-scrollbar sticky top-16 z-40 bg-[#f8fafc]/80 backdrop-blur-md py-4 px-2 -mx-2"
      >
        {weeksInYear.map(week => {
          const isCurrentActiveWeek = week === firstIncompleteWeek;
          const isSelected = selectedWeek === week;
          const isPlayoff = week.includes('-') || ['WC', 'CONF', 'SB', 'SEMIS'].some(p => week.toUpperCase().includes(p));
          const byeCount = weekByeCountMap.get(week);

          return (
            <button
              key={week}
              // 🚀 ATTACH REF HERE
              ref={week === activeWeek ? activeWeekRef : null}
              onClick={() => setSelectedWeek(week)}
              className={`px-5 py-3 rounded-2xl font-black uppercase text-[10px] tracking-widest transition-all shrink-0 border-2 flex items-center gap-2 ${
                isSelected 
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xl scale-105' 
                  : isPlayoff 
                    ? 'bg-amber-50 text-amber-700 border-amber-100 hover:border-amber-300'
                    : 'bg-white text-slate-400 border-slate-100 hover:border-slate-300'
              }`}
            >
              <span>{isPlayoff ? (week.includes('-') ? week.split('-')[1] : week) : `Week ${week}`}</span>
              {byeCount && byeCount > 0 ? (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full transition-colors ${
                  isSelected ? 'bg-amber-400 text-slate-900' : 'bg-amber-100 text-amber-800'
                }`}>
                  {byeCount} {byeCount === 1 ? 'Bye' : 'Byes'}
                </span>
              ) : null}
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

      {/* BYE TEAMS SECTION */}
      {byeTeams.length > 0 && (
        <div className="bg-white rounded-[2rem] border border-amber-200/70 bg-gradient-to-br from-amber-50/40 via-white to-white p-6 shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-2xl bg-amber-100 text-amber-800">
                <CalendarOff size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-black uppercase italic tracking-wider text-slate-900">
                    Teams on Bye
                  </h3>
                  <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black tracking-wider uppercase">
                    {byeTeams.length} {byeTeams.length === 1 ? 'Team' : 'Teams'}
                  </span>
                </div>
                <p className="text-[11px] font-medium text-slate-400">
                  No matchup scheduled for Week {selectedWeek}
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {byeTeams.map(team => (
              <Link
                key={team.name}
                href={`/rosters?team=${encodeURIComponent(team.teamshort || team.name)}`}
                className="group flex flex-col p-3.5 rounded-2xl border border-slate-200/80 bg-white hover:bg-amber-50/40 hover:border-amber-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[8px] font-black uppercase tracking-widest text-amber-700 bg-amber-100/70 px-1.5 py-0.5 rounded">
                    Bye
                  </span>
                  {team.teamshort && (
                    <span className="text-[10px] font-mono font-black text-slate-400 group-hover:text-blue-600 transition-colors">
                      {team.teamshort}
                    </span>
                  )}
                </div>
                <span className="text-sm font-black uppercase italic tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                  {team.name}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* GAMES GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 pb-20">
        {filteredGames.map((game, i) => {
          const vRaw = (game.vScore ?? "").toString().trim();
          const hRaw = (game.hScore ?? "").toString().trim();
          const isFinal = vRaw !== "" && vRaw !== "00" && hRaw !== "" && hRaw !== "00";
          const isPlayoff = String(game.week || "").includes('-');
          const roundName = isPlayoff ? String(game.week || "").split('-')[1] : null;

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
                    name={game.visitor || "Unknown"} 
                    score={vRaw === "" || vRaw === "00" ? null : vRaw} 
                    isWinner={isFinal && Number(vRaw) > Number(hRaw)} 
                    label="Away"
                />
                <div className="relative flex items-center justify-center py-2">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                    <span className="relative bg-white px-4 text-[10px] font-black text-slate-300 italic uppercase tracking-widest rounded-full">At</span>
                </div>
                <TeamLine 
                    name={game.home || "Unknown"} 
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

interface TeamLineProps {
  name: string;
  score: string | null;
  isWinner: boolean;
  label: string;
  isHome?: boolean;
}

function TeamLine({ name, score, isWinner, label, isHome = false }: TeamLineProps) {
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
