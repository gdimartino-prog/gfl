'use client';
import { useState, useMemo } from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';
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
      if (isSameDiv && a.division) {
        const divA = getDivWinPct(a.team, a.division);
        const divB = getDivWinPct(b.team, b.division);
        if (divB !== divA) return divB - divA;
      }

      // 4. Points For
      if (Number(b.offPts) !== Number(a.offPts)) return Number(b.offPts) - Number(a.offPts);

      // 5. Point Differential
      return Number(b.diff) - Number(a.diff);
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
    const map: Record<string, number> = {};
    divisionLeaders.forEach((team, idx) => { map[team.team] = idx + 1; });
    wildcards.forEach((team, idx) => { map[team.team] = divisionLeaders.length + idx + 1; });

    return map;
  }, [allData, allGames, currentYear]);

  return (
    <div className="space-y-10">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
        <input 
          type="text" 
          placeholder="Search current season..."
          className="w-full p-3 pl-12 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
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

function StandingsTable({ data, isCurrent, showGB = false, showMagicNumber = false, totalGames, seedMap = {}, playoffTeams = 0 }: { data: StandingRow[], isCurrent: boolean, showGB?: boolean, showMagicNumber?: boolean, totalGames: number, seedMap?: Record<string, number>, playoffTeams?: number }) {
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
                    {seedMap[row.team] ? (
                      <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-black ${seedMap[row.team] <= playoffTeams ? 'bg-blue-600 text-white shadow-sm' : 'bg-slate-100 text-slate-400'}`}>
                        {seedMap[row.team]}
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
                        <span 
                          className="bg-blue-50 text-blue-600 text-[8px] font-black px-1.5 py-0.5 rounded border border-blue-100 uppercase tracking-widest"
                          title={clinchLetter === 'X' ? 'Clinched Playoffs' : clinchLetter === 'Y' ? 'Clinched Division' : 'Clinched Home Field'}
                        >
                          {clinchLetter}
                        </span>
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