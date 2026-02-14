'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search, Zap, Eye, EyeOff, ListOrdered } from 'lucide-react';
import { StandingRow } from '../types';

interface ScheduleGame {
  year?: string | number;
  status?: string;
  home?: string;
  visitor?: string;
  hScore?: string | number;
  vScore?: string | number;
}

const divisions = ["East", "Central", "West"];

export default function StandingsClient({ allData, allGames, currentYear, totalGames, playoffTeams }: { allData: StandingRow[], allGames: ScheduleGame[], currentYear: string, totalGames: number, playoffTeams: number }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [historySearch, setHistorySearch] = useState('');
  const [historyYear, setHistoryYear] = useState('All');
  const [showPlayoff, setShowPlayoff] = useState(true);

  // 1. Current Season Filter
  const currentSeasonRaw = allData.filter(r => 
    r.year?.toString() === currentYear?.toString() &&
    (r.team?.toLowerCase().includes(searchTerm.toLowerCase()) || 
     r.gm?.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const availableHistoryYears = useMemo(() => {
    const years = allData
      .filter(r => r.year?.toString() !== currentYear?.toString())
      .map(r => r.year?.toString());
    return Array.from(new Set(years)).sort((a, b) => Number(b) - Number(a));
  }, [allData, currentYear]);

  const history = allData.filter(r => {
    const isNotCurrent = r.year?.toString() !== currentYear?.toString();
    const matchesYear = historyYear === 'All' || r.year?.toString() === historyYear;
    const matchesSearch = 
      r.team?.toLowerCase().includes(historySearch.toLowerCase()) || 
      r.gm?.toLowerCase().includes(historySearch.toLowerCase()) ||
      r.year?.toString().includes(historySearch);
      
    return isNotCurrent && matchesYear && matchesSearch;
  }).sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(b.won || 0) - Number(a.won || 0));

  // 🚀 SEEDING LOGIC: Calculate seeds based on full current season data
  const seedMap = useMemo(() => {
    const fullCurrentSeason = allData.filter(r => r.year?.toString() === currentYear?.toString());
    const currentGames = allGames.filter(g => g.year?.toString() === currentYear?.toString() && g.status === 'Final');

    // Helper: Get H2H Win % between two teams
    const getH2H = (teamA: string, teamB: string) => {
      const h2hGames = currentGames.filter(g => 
        (g.home === teamA && g.visitor === teamB) || (g.home === teamB && g.visitor === teamA)
      );
      if (h2hGames.length === 0) return 0.5; // No games played
      let points = 0;
      h2hGames.forEach(g => {
        const isHome = g.home === teamA;
        const aScore = Number(isHome ? g.hScore : g.vScore);
        const bScore = Number(isHome ? g.vScore : g.hScore);
        if (aScore > bScore) points += 1;
        else if (aScore === bScore) points += 0.5;
      });
      return points / h2hGames.length;
    };

    // Helper: Get Division Win %
    const getDivWinPct = (team: string, division: string) => {
      const divTeams = new Set(fullCurrentSeason.filter(r => r.division === division).map(r => r.team));
      const divGames = currentGames.filter(g => 
        (g.home === team && divTeams.has(g.visitor || '')) || (g.visitor === team && divTeams.has(g.home || ''))
      );
      if (divGames.length === 0) return 0;
      let wins = 0;
      divGames.forEach(g => {
        const isHome = g.home === team;
        const myScore = Number(isHome ? g.hScore : g.vScore);
        const oppScore = Number(isHome ? g.vScore : g.hScore);
        if (myScore > oppScore) wins += 1;
        else if (myScore === oppScore) wins += 0.5;
      });
      return wins / divGames.length;
    };

    // 🚀 NFL TIEBREAKER COMPARATOR
    const compareTeams = (a: StandingRow, b: StandingRow, isSameDiv: boolean) => {
      // 1. Win Percentage
      if (Number(b.pct) !== Number(a.pct)) return Number(b.pct) - Number(a.pct);
      
      // 2. Head-to-Head
      const h2h = getH2H(a.team, b.team);
      if (h2h !== 0.5) return h2h > 0.5 ? -1 : 1;

      // 3. Division Record (Only for ties within same division)
      if (isSameDiv && a.division && b.division) {
        const divA = getDivWinPct(a.team, a.division);
        const divB = getDivWinPct(b.team, b.division);
        if (divB !== divA) return divB - divA;
      }

      // 4. Points For
      if (Number(b.offPts) !== Number(a.offPts)) return Number(b.offPts) - Number(a.offPts);

      // 5. Point Differential
      return Number(b.diff) - Number(a.diff);
    };

    // Helper: Identify the specific metric that broke a tie between two teams
    const getTiebreakerMetric = (a: StandingRow, b: StandingRow, isSameDiv: boolean) => {
      if (Number(a.pct) !== Number(b.pct)) return null;
      const h2h = getH2H(a.team, b.team);
      if (h2h !== 0.5) return "Head-to-Head";
      if (isSameDiv && a.division && b.division) {
        const divA = getDivWinPct(a.team, a.division);
        const divB = getDivWinPct(b.team, b.division);
        if (divA !== divB) return "Division Record";
      }
      if (Number(a.offPts) !== Number(b.offPts)) return "Points For";
      return "Point Differential";
    };
    
    // 1. Get leaders of each division
    const divisionLeaders: StandingRow[] = [];
    divisions.forEach(div => {
      const divTeams = fullCurrentSeason
        .filter(r => (r.division || "").toString().trim().toLowerCase() === div.toLowerCase())
        .sort((a, b) => compareTeams(a, b, true));
      if (divTeams.length > 0) divisionLeaders.push(divTeams[0]);
    });

    // 2. Sort leaders to get seeds 1, 2, 3...
    divisionLeaders.sort((a, b) => compareTeams(a, b, false));

    // 3. Get all other teams (Wildcards)
    const leaderTeams = new Set(divisionLeaders.map(l => l.team));
    const wildcards = fullCurrentSeason
      .filter(r => !leaderTeams.has(r.team))
      .sort((a, b) => compareTeams(a, b, false));

    // 4. Map Team Name -> Seed Number
    const map: Record<string, { seed: number, reason: string }> = {};
    
    divisionLeaders.forEach((team, idx) => { 
      const seed = idx + 1;
      let reason = `Seed #${seed}: Division Winner`;
      if (idx > 0 && Number(team.pct) === Number(divisionLeaders[idx-1].pct)) {
        reason += ` • Lost tiebreaker to ${divisionLeaders[idx-1].team} via ${getTiebreakerMetric(team, divisionLeaders[idx-1], false)}`;
      } else if (idx < divisionLeaders.length - 1 && Number(team.pct) === Number(divisionLeaders[idx+1].pct)) {
        reason += ` • Won tiebreaker over ${divisionLeaders[idx+1].team} via ${getTiebreakerMetric(team, divisionLeaders[idx+1], false)}`;
      }
      map[team.team] = { seed, reason }; 
    });

    wildcards.forEach((team, idx) => { 
      const seed = divisionLeaders.length + idx + 1;
      let reason = `Seed #${seed}: Wildcard`;
      if (idx > 0 && Number(team.pct) === Number(wildcards[idx-1].pct)) {
        reason += ` • Lost tiebreaker to ${wildcards[idx-1].team} via ${getTiebreakerMetric(team, wildcards[idx-1], false)}`;
      } else if (idx < wildcards.length - 1 && Number(team.pct) === Number(wildcards[idx+1].pct)) {
        reason += ` • Won tiebreaker over ${wildcards[idx+1].team} via ${getTiebreakerMetric(team, wildcards[idx+1], false)}`;
      }
      map[team.team] = { seed, reason }; 
    });

    return map;
  }, [allData, allGames, currentYear]);

  // 🚀 PLAYOFF PICTURE: Extract teams currently in a qualifying spot
  const playoffPicture = useMemo(() => {
    return allData
      .filter(r => r.year?.toString() === currentYear?.toString() && seedMap[r.team]?.seed <= playoffTeams)
      .sort((a, b) => seedMap[a.team].seed - seedMap[b.team].seed);
  }, [allData, currentYear, seedMap, playoffTeams]);

  // 🚀 BUBBLE WATCH: Extract teams just outside the qualifying spots (Seeds 9 & 10)
  const bubbleTeams = useMemo(() => {
    return allData
      .filter(r => 
        r.year?.toString() === currentYear?.toString() && 
        seedMap[r.team]?.seed > playoffTeams && 
        seedMap[r.team]?.seed <= playoffTeams + 2
      )
      .sort((a, b) => seedMap[a.team].seed - seedMap[b.team].seed);
  }, [allData, currentYear, seedMap, playoffTeams]);

  // 🚀 DRAFT ORDER: Calculate projected next season draft order
  const draftOrder = useMemo(() => {
    const fullCurrentSeason = allData.filter(r => r.year?.toString() === currentYear?.toString());
    const currentGames = allGames.filter(g => g.year?.toString() === currentYear?.toString() && g.status === 'Final');

    // 1. Calculate SOS for all teams
    const teamStats: Record<string, { w: number, g: number }> = {};
    fullCurrentSeason.forEach(r => {
      const name = r.team.replace(/^[a-z*]-/i, '');
      teamStats[name] = {
        w: Number(r.won) + (0.5 * Number(r.tie)),
        g: Number(r.won) + Number(r.lost) + Number(r.tie)
      };
    });

    const sosMap: Record<string, number> = {};
    fullCurrentSeason.forEach(r => {
      const teamName = r.team.replace(/^[a-z*]-/i, '');
      const opps = currentGames.filter(g => 
        (g.home || "").replace(/^[a-z*]-/i, '') === teamName || 
        (g.visitor || "").replace(/^[a-z*]-/i, '') === teamName
      );
      
      let totalOppW = 0;
      let totalOppG = 0;
      opps.forEach(g => {
        const h = (g.home || "").replace(/^[a-z*]-/i, '');
        const v = (g.visitor || "").replace(/^[a-z*]-/i, '');
        const opp = h === teamName ? v : h;
        if (opp && teamStats[opp]) {
          totalOppW += teamStats[opp].w;
          totalOppG += teamStats[opp].g;
        }
      });
      sosMap[r.team] = totalOppG > 0 ? totalOppW / totalOppG : 0;
    });
    
    // 2. Non-Playoff Teams (NFL Rules: Record -> SOS -> Points For)
    const nonPlayoff = fullCurrentSeason
      .filter(r => seedMap[r.team]?.seed > playoffTeams)
      .sort((a, b) => {
        if (Number(a.pct) !== Number(b.pct)) return Number(a.pct) - Number(b.pct);
        if (sosMap[a.team] !== sosMap[b.team]) return sosMap[a.team] - sosMap[b.team];
        if (Number(a.offPts) !== Number(b.offPts)) return Number(a.offPts) - Number(b.offPts);
        return Number(a.diff) - Number(b.diff);
      });

    // 3. Playoff Teams (Reverse Seeding: Lower seeds pick earlier)
    const playoff = fullCurrentSeason
      .filter(r => seedMap[r.team]?.seed <= playoffTeams)
      .sort((a, b) => seedMap[b.team].seed - seedMap[a.team].seed);

    const combined = [...nonPlayoff, ...playoff];

    return combined.map((team, idx) => {
      const pickNum = idx + 1;
      const isPlayoffTeam = seedMap[team.team].seed <= playoffTeams;
      let reason = `Pick #${pickNum}: ${isPlayoffTeam ? 'Playoff Team' : 'Non-Playoff Team'}`;

      if (isPlayoffTeam) {
        reason += ` • Reverse Seeding (Seed #${seedMap[team.team].seed})`;
      } else {
        const prev = idx > 0 ? combined[idx - 1] : null;
        const next = idx < combined.length - 1 ? combined[idx + 1] : null;
        
        const isTiedWithPrev = prev && seedMap[prev.team].seed > playoffTeams && Number(team.pct) === Number(prev.pct);
        const isTiedWithNext = next && seedMap[next.team].seed > playoffTeams && Number(team.pct) === Number(next.pct);

        if (isTiedWithPrev) {
          const metric = sosMap[team.team] !== sosMap[prev.team] ? "Strength of Schedule" : (Number(team.offPts) !== Number(prev.offPts) ? "Points For" : "Point Differential");
          reason += ` • Lost tiebreaker to ${prev.team.replace(/^[a-z*]-/i, '')} via higher ${metric}`;
        } else if (isTiedWithNext) {
          const metric = sosMap[team.team] !== sosMap[next.team] ? "Strength of Schedule" : (Number(team.offPts) !== Number(next.offPts) ? "Points For" : "Point Differential");
          reason += ` • Won tiebreaker over ${next.team.replace(/^[a-z*]-/i, '')} via lower ${metric}`;
        }
      }
      return { ...team, draftReason: reason, sos: sosMap[team.team] };
    });
  }, [allData, allGames, currentYear, seedMap, playoffTeams]);

  return (
    <div className="space-y-10">
      {/* Search Bar & Toggle */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search current season..."
            className="w-full p-3 pl-12 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <button 
          onClick={() => setShowPlayoff(!showPlayoff)}
          className={`flex items-center gap-2 px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-sm border ${
            showPlayoff ? 'bg-blue-600 text-white border-blue-500' : 'bg-white text-slate-400 border-slate-200 hover:text-slate-600'
          }`}
        >
          {showPlayoff ? <EyeOff size={14} /> : <Eye size={14} />}
          {showPlayoff ? 'Hide Projections' : 'Show Projections'}
        </button>
      </div>

      {/* CURRENT SEASON SECTION */}
      <div className="space-y-12">
        <div className="flex items-end gap-4">
          <h2 className="text-4xl font-black uppercase italic text-slate-900 tracking-tighter leading-none">
            {currentYear} <span className="text-blue-600">Season</span>
          </h2>
          <div className="h-1 flex-grow bg-slate-100 rounded-full mb-1">
            <div className="h-full bg-blue-600 w-24 rounded-full"></div>
          </div>
        </div>
        
        <div className="grid gap-12">
          {divisions.map(div => {
            const divData = currentSeasonRaw
              .filter(r => (r.division || "").toString().trim().toLowerCase() === div.toLowerCase())
              .sort((a, b) => Number(b.pct) - Number(a.pct) || Number(b.diff) - Number(a.diff));
            
            if (divData.length === 0) return null;

            return (
              <div key={div}>
                <div className="flex items-center gap-3 mb-4">
                   <h3 className="text-xl font-black uppercase italic text-blue-600 tracking-tight">
                    {div} <span className="text-slate-400 font-normal not-italic">Division</span>
                  </h3>
                  <div className="h-px bg-slate-200 flex-grow"></div>
                </div>
                <StandingsTable 
                  data={divData} 
                  isCurrent={true} 
                  showGB={true} 
                  showMagicNumber={true} 
                  totalGames={totalGames} 
                  seedMap={seedMap}
                  playoffTeams={playoffTeams}
                />
              </div>
            );
          })}

          {/* FALLBACK: If teams exist for current year but have no division assigned */}
          {currentSeasonRaw.filter(r => !divisions.map(d => d.toLowerCase()).includes((r.division || "").toString().trim().toLowerCase())).length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                 <h3 className="text-xl font-black uppercase italic text-slate-400 tracking-tight">
                  Unassigned <span className="text-slate-200 font-normal not-italic">Teams</span>
                </h3>
                <div className="h-px bg-slate-100 flex-grow"></div>
              </div>
              <StandingsTable 
                data={currentSeasonRaw.filter(r => !divisions.map(d => d.toLowerCase()).includes((r.division || "").toString().trim().toLowerCase()))} 
                isCurrent={true} 
                showGB={true}
                totalGames={totalGames}
                seedMap={seedMap}
                playoffTeams={playoffTeams}
              />
            </div>
          )}
        </div>
      </div>

      {/* PLAYOFF PICTURE SUMMARY (Moved to after standings) */}
      {showPlayoff && playoffPicture.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-blue-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700">
          <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] font-black px-6 py-2 uppercase tracking-[0.2em] rounded-bl-3xl shadow-sm">
            Live Projections
          </div>
          
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
              <Zap size={24} className="fill-blue-600" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
                Playoff <span className="text-blue-600">Picture</span>
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Top {playoffTeams} teams qualify for the post-season
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
            {playoffPicture.map((team) => {
              const seedInfo = seedMap[team.team];
              const isDivLeader = seedInfo.seed <= divisions.length;
              const clinchMatch = team.team.match(/^([a-z*])-/i);
              const clinchLetter = clinchMatch ? clinchMatch[1].toUpperCase() : null;
              
              return (
                <div key={team.team} className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group relative">
                  {clinchLetter && (
                    <div 
                      className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border border-white"
                      title={clinchLetter === 'X' ? 'Clinched Playoffs' : clinchLetter === 'Y' ? 'Clinched Division' : 'Clinched Home Field'}
                    >
                      <span className="text-[7px] font-black text-white leading-none">{clinchLetter}</span>
                    </div>
                  )}

                  <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs mb-3 shadow-sm ${isDivLeader ? 'bg-blue-600 text-white' : 'bg-white text-blue-600 border border-blue-100'}`}>
                    {seedInfo.seed}
                  </div>
                  <span className="text-[11px] font-black uppercase italic tracking-tighter text-slate-900 leading-tight group-hover:text-blue-600 transition-colors truncate w-full">
                    {team.team.replace(/^[a-z*]-/i, '')}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                    {team.won}-{team.lost}
                  </span>
                </div>
              );
            })}
          </div>

          {/* BUBBLE WATCH SECTION */}
          {bubbleTeams.length > 0 && (
            <div className="mt-10 pt-8 border-t border-slate-100">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                <h3 className="text-[10px] font-black text-amber-600 uppercase tracking-[0.2em]">
                  On the Bubble
                </h3>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
                {bubbleTeams.map((team) => {
                  const seedInfo = seedMap[team.team];
                  const clinchMatch = team.team.match(/^([a-z*])-/i);
                  const clinchLetter = clinchMatch ? clinchMatch[1].toUpperCase() : null;

                  return (
                    <div key={team.team} className="flex flex-col items-center text-center p-4 rounded-2xl bg-amber-50/30 border border-amber-100/50 hover:border-amber-200 transition-all group relative">
                      {clinchLetter && (
                        <div 
                          className="absolute top-2 right-2 w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border border-white"
                          title={clinchLetter === 'X' ? 'Clinched Playoffs' : clinchLetter === 'Y' ? 'Clinched Division' : 'Clinched Home Field'}
                        >
                          <span className="text-[7px] font-black text-white leading-none">{clinchLetter}</span>
                        </div>
                      )}

                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-[10px] mb-3 shadow-sm bg-white text-amber-600 border border-amber-100">
                        {seedInfo.seed}
                      </div>
                      <span className="text-[10px] font-black uppercase italic tracking-tighter text-slate-700 leading-tight group-hover:text-amber-600 transition-colors truncate w-full">
                        {team.team.replace(/^[a-z*]-/i, '')}
                      </span>
                      <span className="text-[8px] font-bold text-slate-400 uppercase mt-1">
                        {team.won}-{team.lost}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* PROJECTED DRAFT ORDER */}
      {showPlayoff && draftOrder.length > 0 && (
        <div className="bg-white rounded-[2.5rem] p-8 shadow-xl border border-slate-100 overflow-hidden relative animate-in fade-in slide-in-from-bottom-4 duration-700 delay-150">
          <div className="absolute top-0 right-0 bg-slate-900 text-white text-[10px] font-black px-6 py-2 uppercase tracking-[0.2em] rounded-bl-3xl shadow-sm">
            Next Season
          </div>
          
          <div className="flex items-center gap-3 mb-8">
            <div className="bg-slate-100 p-3 rounded-2xl text-slate-600">
              <ListOrdered size={24} />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase italic tracking-tighter text-slate-900">
                Projected <span className="text-orange-600">Draft Order</span>
              </h2>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                NFL Rules: SOS tiebreakers for non-playoff teams • Reverse seeding for playoff teams
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-9 gap-4">
            {draftOrder.map((team, idx) => {
              const isPlayoffTeam = seedMap[team.team].seed <= playoffTeams;
              const cleanName = team.team.replace(/^[a-z*]-/i, '');
              
              return (
                <div key={team.team} className="flex flex-col items-center text-center p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-slate-200 transition-all group relative">
                  <div 
                    title={(team as any).draftReason}
                    className={`w-8 h-8 rounded-lg flex items-center justify-center font-black text-[10px] mb-3 shadow-sm cursor-help transition-transform hover:scale-110 ${isPlayoffTeam ? 'bg-slate-200 text-slate-500' : 'bg-orange-500 text-white'}`}
                  >
                    #{idx + 1}
                  </div>
                  <span className="text-[10px] font-black uppercase italic tracking-tighter text-slate-900 leading-tight truncate w-full">
                    {cleanName}
                  </span>
                  <span className="text-[8px] font-bold text-slate-400 uppercase mt-1 flex flex-col">
                    <span>{team.won}-{team.lost}</span>
                    {!isPlayoffTeam && (
                      <span className="text-orange-500 font-black mt-0.5">SOS: {((team as any).sos || 0).toFixed(3).replace(/^0/, '')}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* HISTORICAL ARCHIVES */}
      <div className="pt-16 border-t border-slate-200 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <h2 className="text-2xl font-black uppercase italic text-slate-400 tracking-tight">
            Historical <span className="text-slate-300">Archives</span>
          </h2>
          
          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* History Search */}
            <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input 
                type="text"
                placeholder="Filter history..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500 shadow-sm"
              />
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Year:</span>
            <select 
              value={historyYear}
              onChange={(e) => setHistoryYear(e.target.value)}
              className="bg-white border border-slate-200 text-slate-900 text-xs rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 font-bold cursor-pointer outline-none shadow-sm"
            >
              <option value="All">All Seasons</option>
              {availableHistoryYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
        <StandingsTable data={history} isCurrent={false} totalGames={totalGames} seedMap={seedMap} playoffTeams={playoffTeams} />
        {history.length === 0 && (
          <div className="p-10 text-center text-slate-400 font-black uppercase italic text-sm">
            No historical records found matching your filters.
          </div>
        )}
      </div>
    </div>
  );
}

function StandingsTable({ data, isCurrent, showGB = false, showMagicNumber = false, totalGames, seedMap = {}, playoffTeams = 0 }: { data: StandingRow[], isCurrent: boolean, showGB?: boolean, showMagicNumber?: boolean, totalGames: number, seedMap?: Record<string, { seed: number, reason: string }>, playoffTeams?: number }) {
  const leader = data[0];
  const secondPlace = data[1];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead className={isCurrent ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}>
          <tr className="text-[10px] uppercase tracking-[0.2em] font-black">
            <th className="p-4 pl-6">Year</th>
            {isCurrent && <th className="p-4 text-center">Seed</th>}
            <th className="p-4">Team / Manager</th>
            <th className="p-4 text-center">W-L-T</th>
            <th className="p-4 text-center">Pct</th>
            <th className="p-4 text-center">PPG (O/D)</th>
            {showGB && <th className="p-4 text-center">GB</th>}
            {showMagicNumber && (
              <th 
                className="p-4 text-center cursor-help" 
                title={`Magic Number: (${totalGames} + 1) - (Leader Wins) - (2nd Place Losses). The number of combined leader wins and chaser losses required to clinch the division.`}
              >
                MN
              </th>
            )}
            <th className="p-4 text-center">PF</th>
            <th className="p-4 text-center">PA</th>
            <th className="p-4 pr-6 text-center">Diff</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, i) => {
            const isChamp = String(row.isChampion) === "1" || String(row.isChampion).toLowerCase() === "true";
            const isPlayoff = String(row.isPlayoff) === "1" || String(row.isPlayoff).toLowerCase() === "true";

            // Clinch Prefix Detection (x-, y-, *-)
            const rawTeamName = row.team || "";
            const clinchMatch = rawTeamName.match(/^([a-z*])-/i);
            const clinchLetter = clinchMatch ? clinchMatch[1].toUpperCase() : null;
            const displayTeamName = rawTeamName.replace(/^[a-z*]-/i, '');

            // MATH FIX: Calculate DIFF live to ensure accuracy
            const pf = Number(row.offPts) || 0;
            const pa = Number(row.defPts) || 0;
            const calculatedDiff = (pf - pa).toFixed(1);
            const diffNum = parseFloat(calculatedDiff);

            // Win Pct logic
            const wins = Number(row.won) || 0;
            const losses = Number(row.lost) || 0;
            const ties = Number(row.tie) || 0;
            const total = wins + losses + ties;
            const winPctDisplay = total > 0 ? ((wins + (0.5 * ties)) / total).toFixed(3).replace(/^0/, '') : '.000';
            const offPPG = total > 0 ? (pf / total).toFixed(1) : "0.0";
            const defPPG = total > 0 ? (pa / total).toFixed(1) : "0.0";

            // GB Calculation logic
            let gbDisplay = '—';
            if (showGB && i > 0 && leader) {
              const leaderW = Number(leader.won) || 0;
              const leaderL = Number(leader.lost) || 0;
              const teamW = Number(row.won) || 0;
              const teamL = Number(row.lost) || 0;
              const gbVal = ((leaderW - teamW) + (teamL - leaderL)) / 2;
              gbDisplay = gbVal === 0 ? '—' : gbVal.toString();
            }

            // Magic Number logic (only for the leader relative to 2nd place)
            let mnDisplay = '—';
            if (showMagicNumber && i === 0 && secondPlace) {
              const leaderW = Number(leader.won) || 0;
              const secondL = Number(secondPlace.lost) || 0;
              const mnVal = (totalGames + 1) - leaderW - secondL;
              
              mnDisplay = mnVal <= 0 ? 'CL' : mnVal.toString();
            }

            return (
              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                <td className="p-4 pl-6 font-bold text-slate-400 text-sm">{row.year}</td>
                {isCurrent && (
                  <td className="p-4 text-center">
                    {seedMap[row.team]?.seed ? (
                      <span 
                        title={seedMap[row.team].reason}
                        className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black cursor-help transition-transform hover:scale-110 ${
                          seedMap[row.team].seed <= playoffTeams ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {seedMap[row.team].seed}
                      </span>
                    ) : '—'}
                  </td>
                )}
                <td className="p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Link 
                        href={`/rosters?team=${row.teamshort || displayTeamName}`}
                        className="font-black text-slate-900 uppercase italic tracking-tighter text-lg leading-tight hover:text-blue-600 transition-colors"
                      >
                        {displayTeamName}
                      </Link>
                      {clinchLetter && (
                        <div 
                          className="w-4 h-4 bg-emerald-500 rounded-full flex items-center justify-center shadow-sm border border-white shrink-0"
                          title={clinchLetter === 'X' ? 'Clinched Playoffs' : clinchLetter === 'Y' ? 'Clinched Division' : 'Clinched Home Field'}
                        >
                          <span className="text-[7px] font-black text-white leading-none">{clinchLetter}</span>
                        </div>
                      )}
                      {isChamp && (
                        <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm italic uppercase tracking-tighter" title="Champion">
                          🏆
                        </span>
                      )}
                      {isPlayoff && !isChamp && (
                        <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" title="Playoffs" />
                      )}
                    </div>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-70">
                      {row.gm || 'Unknown Manager'}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center font-mono font-bold text-slate-700 bg-slate-50/30">
                  {row.won}-{row.lost}-{row.tie}
                </td>
                
                <td className="p-4 text-center">
                  <span className="text-sm text-blue-600 font-black italic">
                    {winPctDisplay}
                  </span>
                </td>

                <td className="p-4 text-center">
                  <div className="flex flex-col text-[11px] font-bold">
                    <span className="text-emerald-600">{offPPG} <span className="text-[8px] text-slate-300">OFF</span></span>
                    <span className="text-rose-600">{defPPG} <span className="text-[8px] text-slate-300">DEF</span></span>
                  </div>
                </td>

                {showGB && (
                  <td className="p-4 text-center font-bold text-slate-500">
                    {gbDisplay}
                  </td>
                )}

                {showMagicNumber && (
                  <td className="p-4 text-center font-bold text-blue-600">
                    {mnDisplay}
                  </td>
                )}

                {/* Separated Points Columns */}
                <td className="p-4 text-center">
                  <span className="text-emerald-600 font-black text-sm italic">
                    {pf.toFixed(1)}
                  </span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-rose-600 font-black text-sm italic">
                    {pa.toFixed(1)}
                  </span>
                </td>

                <td className={`p-4 pr-6 text-center font-mono font-black text-lg ${diffNum >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {diffNum > 0 ? `+${calculatedDiff}` : calculatedDiff}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}