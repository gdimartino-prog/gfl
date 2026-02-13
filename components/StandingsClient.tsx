'use client';
import { useState } from 'react';
import Link from 'next/link';
import { StandingRow } from '../types';

export default function StandingsClient({ allData, currentYear, totalGames }: { allData: StandingRow[], currentYear: string, totalGames: number }) {
  const [search, setSearch] = useState('');

  // 1. Base Filter (Search)
  const filtered = allData.filter(row => 
    row.team?.toString().toLowerCase().includes(search.toLowerCase()) || 
    row.year?.toString().toLowerCase().includes(search.toLowerCase())
  );

  // 2. Separate Current Season from History
  const currentSeasonRaw = filtered.filter(r => r.year?.toString() === currentYear?.toString());
  const history = filtered.filter(r => r.year?.toString() !== currentYear?.toString())
    .sort((a, b) => Number(b.year || 0) - Number(a.year || 0) || Number(b.won || 0) - Number(a.won || 0));

  const divisions = ["East", "Central", "West"];

  return (
    <div className="space-y-10">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <input 
          type="text" 
          placeholder="Search team or year..."
          className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium"
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
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
                <StandingsTable data={divData} isCurrent={true} showGB={true} showMagicNumber={true} totalGames={totalGames} />
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
              />
            </div>
          )}
        </div>
      </div>

      {/* HISTORICAL ARCHIVES */}
      <div className="pt-16 border-t border-slate-200">
         <h2 className="text-2xl font-black uppercase italic mb-8 text-slate-400 tracking-tight">
          Historical <span className="text-slate-300">Archives</span>
        </h2>
        <StandingsTable data={history} isCurrent={false} totalGames={totalGames} />
      </div>
    </div>
  );
}

function StandingsTable({ data, isCurrent, showGB = false, showMagicNumber = false, totalGames }: { data: StandingRow[], isCurrent: boolean, showGB?: boolean, showMagicNumber?: boolean, totalGames: number }) {
  const leader = data[0];
  const secondPlace = data[1];

  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[800px]">
        <thead className={isCurrent ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}>
          <tr className="text-[10px] uppercase tracking-[0.2em] font-black">
            <th className="p-4 pl-6">Year</th>
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
                <td className="p-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2">
                      <Link 
                      href={`/rosters?team=${row.teamshort || row.team.replace(/^[a-z*]-/i, '')}`}
                        className="font-black text-slate-900 uppercase italic tracking-tighter text-lg leading-tight hover:text-blue-600 transition-colors"
                      >
                        {row.team}
                      </Link>
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