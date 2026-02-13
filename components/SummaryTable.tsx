'use client';
import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';

export default function SummaryTable({ initialData }: { initialData: Record<string, string | number>[] }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortConfig, setSortConfig] = useState({ key: 'championships', direction: 'desc' });

  const displayData = useMemo(() => {
    let result = initialData.filter(team => {
      const s = searchTerm.toLowerCase();
      return (
        String(team.team || '').toLowerCase().includes(s) ||
        String(team.gm || '').toLowerCase().includes(s)
      );
    });

    result.sort((a, b) => {
      const key = sortConfig.key;
      if (key === 'team' || key === 'gm') {
        const valA = String(a[key] || '').toLowerCase();
        const valB = String(b[key] || '').toLowerCase();
        return sortConfig.direction === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      const aVal = Number(a[key]) || 0;
      const bVal = Number(b[key]) || 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    return result;
  }, [initialData, searchTerm, sortConfig]);

  const handleSort = (key: string) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }
    setSortConfig({ key, direction });
  };

  return (
    <div className="space-y-6">
      {/* SEARCH BAR */}
      <div className="relative">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
        <input 
          type="text" 
          placeholder="Filter by franchise or manager..." 
          value={searchTerm} 
          onChange={(e) => setSearchTerm(e.target.value)} 
          className="w-full bg-white border border-slate-200 rounded-[1.5rem] py-5 pl-16 pr-8 text-slate-800 font-bold focus:ring-2 focus:ring-blue-500 outline-none transition-all text-lg shadow-sm" 
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden overflow-x-auto">
        <table className="w-full text-left border-collapse min-w-[1000px]">
          <thead className="bg-[#0f172a] text-white">
          <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            <th className="p-4 w-16">Rank</th>
            <th className="p-4 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('team')}>Franchise / GM</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('seasons')}>Yrs</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('wins')}>Record</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('winPct')}>
              Pct {sortConfig.key === 'winPct' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
            </th>
            <th className="p-4 text-center">PPG (O/D)</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('divWins')}>Div</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('postSeason')}>Post</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('superBowls')}>Super Bowl Appearances</th>
            <th className="p-4 text-right min-w-[200px] cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('championships')}>
              Titles {sortConfig.key === 'championships' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {displayData.map((team, idx) => {
            const totalGames = Number(team.wins) + Number(team.losses) + Number(team.ties);
            const offPPG = totalGames > 0 ? (Number(team.offPts) / totalGames).toFixed(1) : "0.0";
            const defPPG = totalGames > 0 ? (Number(team.defPts) / totalGames).toFixed(1) : "0.0";

            return (
              <tr key={team.team} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4 text-slate-300 font-mono text-lg font-bold">{idx + 1}</td>
                <td className="p-4">
                  <div className="flex flex-col">
                    <span className="text-slate-900 uppercase italic font-black text-lg leading-tight group-hover:text-blue-600 transition-colors">{team.team}</span>
                    <span className="text-blue-600 text-[10px] font-black uppercase tracking-widest">GM: {team.gm}</span>
                  </div>
                </td>
                <td className="p-4 text-center text-slate-400 font-bold">{team.seasons}</td>
                <td className="p-4 text-center">
                  <span className="font-mono font-bold text-slate-700">{team.wins}-{team.losses}-{team.ties}</span>
                </td>
                <td className="p-4 text-center">
                  <span className="text-sm text-blue-600 font-black italic">{Number(team.winPct || 0).toFixed(3).replace(/^0/, '')}</span>
                </td>
                <td className="p-4 text-center">
                  <div className="flex flex-col text-[11px] font-bold">
                    <span className="text-emerald-600">{offPPG} <span className="text-[8px] text-slate-300">OFF</span></span>
                    <span className="text-rose-600">{defPPG} <span className="text-[8px] text-slate-300">DEF</span></span>
                  </div>
                </td>
                <td className="p-4 text-center font-bold text-slate-500">{team.divWins}</td>
                <td className="p-4 text-center font-bold text-slate-500">{team.postSeason}</td>
                <td className="p-4 text-center font-bold text-slate-500">{team.superBowls}</td>
                <td className="p-4 text-right">
                  <div className="flex justify-end gap-1 whitespace-nowrap">
                    {Number(team.championships) > 0 ? (
                      Array(Number(team.championships)).fill(0).map((_, i) => (
                        <span key={i} className="text-2xl drop-shadow-sm">🏆</span>
                      ))
                    ) : (
                      <span className="text-slate-200 text-[10px] uppercase font-black">No Titles</span>
                    )}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {displayData.length === 0 && (
        <div className="p-20 text-center text-slate-400 font-black uppercase italic">
          No franchises found matching your search.
        </div>
      )}
      </div>
    </div>
  );
}