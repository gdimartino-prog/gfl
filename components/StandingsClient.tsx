'use client';
import { useState } from 'react';

export default function StandingsClient({ allData, currentYear }: { allData: any[], currentYear: string }) {
  const [search, setSearch] = useState('');

  // Enhanced Filter & Sort
  const filtered = allData.filter(row => 
    row.team.toLowerCase().includes(search.toLowerCase()) || row.year.toString().includes(search)
  );

  const current = filtered.filter(r => r.year === currentYear)
    .sort((a, b) => b.pct - a.pct || b.diff - a.diff); // Tie-breaker: Diff

  const history = filtered.filter(r => r.year !== currentYear)
    .sort((a, b) => b.year - a.year || b.won - a.won);

  return (
    <div className="space-y-8">
      {/* Search Bar */}
      <div className="relative max-w-md">
        <input 
          type="text" 
          placeholder="Search team or year..."
          className="w-full p-3 pl-10 bg-white border border-slate-200 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          onChange={(e) => setSearch(e.target.value)}
        />
        <span className="absolute left-3 top-3.5 text-slate-400">🔍</span>
      </div>

      {/* Sections */}
      <div className="grid gap-12">
        <StandingsSection title={`${currentYear} Season`} data={current} isCurrent={true} />
        <StandingsSection title="Historical Archives" data={history} isCurrent={false} />
      </div>
    </div>
  );
}

function StandingsSection({ title, data, isCurrent }: any) {
  if (data.length === 0) return null;
  return (
    <section>
      <h2 className={`text-xl font-black uppercase italic mb-4 ${isCurrent ? 'text-slate-900' : 'text-slate-500'}`}>
        {title}
      </h2>
      <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[600px]">
          <thead className={isCurrent ? "bg-blue-600 text-white" : "bg-slate-800 text-white"}>
            <tr className="text-[10px] uppercase tracking-widest font-black">
              <th className="p-4">Year</th>
              <th className="p-4">Team</th>
              <th className="p-4 text-center">W-L-T</th>
              <th className="p-4 text-center">Points (PF/PA)</th>
              <th className="p-4 text-center">Diff</th>
              <th className="p-4 text-right">Finish</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {data.map((row: any, i: number) => (
              <tr key={i} className="hover:bg-slate-50 transition-colors group">
                <td className="p-4 font-bold text-slate-400">{row.year}</td>
                <td className="p-4 font-black text-slate-900 uppercase italic tracking-tighter text-lg">
                  {row.team}
                </td>
                <td className="p-4 text-center font-mono font-bold text-slate-600">
                  {row.won}-{row.lost}-{row.tie}
                </td>
                
                {/* NEW POINTS COLUMN */}
                <td className="p-4 text-center">
                  <div className="flex flex-col text-[11px] font-bold leading-tight">
                    <span className="text-emerald-600">{row.offPts} <span className="text-[8px] text-slate-300 uppercase">PF</span></span>
                    <span className="text-rose-600">{row.defPts} <span className="text-[8px] text-slate-300 uppercase">PA</span></span>
                  </div>
                </td>

                <td className={`p-4 text-center font-mono font-black ${Number(row.diff) >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {Number(row.diff) > 0 ? `+${row.diff}` : row.diff}
                </td>

                <td className="p-4 text-right">
                  <div className="flex justify-end gap-2">
                    {row.isChampion && <span className="bg-amber-400 text-amber-950 text-[9px] font-black px-2 py-0.5 rounded shadow-sm italic uppercase tracking-tighter">🏆 Champ</span>}
                    {row.isPlayoff && !row.isChampion && <span className="bg-blue-50 text-blue-600 text-[9px] font-black px-2 py-0.5 rounded tracking-tighter uppercase">Playoffs</span>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}