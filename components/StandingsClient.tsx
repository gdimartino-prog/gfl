'use client';
import { useState } from 'react';



export default function StandingsClient({ allData, currentYear }: { allData: any[], currentYear: string }) {
  const [search, setSearch] = useState('');

  // 1. Base Filter (Search)
  const filtered = allData.filter(row => 
    row.team?.toLowerCase().includes(search.toLowerCase()) || 
    row.year?.toString().includes(search)
  );

  // 2. Separate Current Season from History
  const currentSeasonRaw = filtered.filter(r => r.year.toString() === currentYear.toString());
  const history = filtered.filter(r => r.year.toString() !== currentYear.toString())
    .sort((a, b) => Number(b.year) - Number(a.year) || Number(b.won) - Number(a.won));

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
              .filter(r => r.division?.toString().trim().toLowerCase() === div.toLowerCase())
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
                <StandingsTable data={divData} isCurrent={true} />
              </div>
            );
          })}

          {/* FALLBACK: If teams exist for current year but have no division assigned */}
          {currentSeasonRaw.filter(r => !divisions.map(d => d.toLowerCase()).includes(r.division?.toString().trim().toLowerCase())).length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                 <h3 className="text-xl font-black uppercase italic text-slate-400 tracking-tight">
                  Unassigned <span className="text-slate-200 font-normal not-italic">Teams</span>
                </h3>
                <div className="h-px bg-slate-100 flex-grow"></div>
              </div>
              <StandingsTable 
                data={currentSeasonRaw.filter(r => !divisions.map(d => d.toLowerCase()).includes(r.division?.toString().trim().toLowerCase()))} 
                isCurrent={true} 
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
        <StandingsTable data={history} isCurrent={false} />
      </div>
    </div>
  );
}

function StandingsTable({ data, isCurrent }: { data: any[], isCurrent: boolean }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[700px]">
        <thead className={isCurrent ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-500"}>
          <tr className="text-[10px] uppercase tracking-[0.2em] font-black">
            <th className="p-4 pl-6">Year</th>
            <th className="p-4">Team / Manager</th>
            <th className="p-4 text-center">W-L-T</th>
            <th className="p-4 text-center">Points (PF/PA)</th>
            <th className="p-4 text-center">Diff</th>
            <th className="p-4 pr-6 text-right">Status</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row: any, i: number) => {
            // Robust check for truthy values (handles "1", 1, true, or "TRUE")
            const isChamp = String(row.isChampion) === "1" || String(row.isChampion).toLowerCase() === "true";
            const isPlayoff = String(row.isPlayoff) === "1" || String(row.isPlayoff).toLowerCase() === "true";

            return (
              <tr key={i} className="hover:bg-slate-50/80 transition-colors group">
                <td className="p-4 pl-6 font-bold text-slate-400 text-sm">{row.year}</td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="font-black text-slate-900 uppercase italic tracking-tighter text-lg leading-tight">
                      {row.team}
                    </span>
                    <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest opacity-70">
                      {row.gm || 'Unknown Manager'}
                    </span>
                  </div>
                </td>
                <td className="p-4 text-center font-mono font-bold text-slate-700 bg-slate-50/30">
                  {row.won}-{row.lost}-{row.tie}
                </td>
                
                <td className="p-4 text-center">
                  <div className="flex flex-col text-[11px] font-bold leading-tight items-center">
                    <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full mb-1 w-16 text-center">
                      {row.offPts} <span className="text-[8px] opacity-60">PF</span>
                    </span>
                    <span className="text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full w-16 text-center">
                      {row.defPts} <span className="text-[8px] opacity-60">PA</span>
                    </span>
                  </div>
                </td>

                <td className={`p-4 text-center font-mono font-black text-lg ${Number(row.diff) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(row.diff) > 0 ? `+${row.diff}` : row.diff}
                </td>

                <td className="p-4 pr-6 text-right">
                  <div className="flex justify-end gap-2">
                    {isChamp && (
                      <span className="bg-amber-400 text-amber-950 text-[10px] font-black px-2 py-1 rounded shadow-sm italic uppercase tracking-tighter flex items-center gap-1">
                        🏆 Champ
                      </span>
                    )}
                    {isPlayoff && !isChamp && (
                      <span className="bg-blue-600 text-white text-[10px] font-black px-2 py-1 rounded tracking-tighter uppercase italic">
                        Playoffs
                      </span>
                    )}
                    {!isPlayoff && !isChamp && isCurrent && (
                      <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
                        Active
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}