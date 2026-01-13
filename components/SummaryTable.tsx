'use client';
import { useState } from 'react';

export default function SummaryTable({ initialData }: { initialData: any[] }) {
  const [data, setData] = useState(initialData);
  const [sortConfig, setSortConfig] = useState({ key: 'championships', direction: 'desc' });

  const handleSort = (key: string) => {
    let direction = 'desc';
    if (sortConfig.key === key && sortConfig.direction === 'desc') {
      direction = 'asc';
    }

    const sortedData = [...data].sort((a, b) => {
      let aVal = a[key];
      let bVal = b[key];

      // Special calculation for sorting by Win Percentage
      if (key === 'pct') {
        aVal = a.wins / (a.wins + a.losses || 1);
        bVal = b.wins / (b.wins + b.losses || 1);
      }

      return direction === 'asc' ? aVal - bVal : bVal - aVal;
    });

    setData(sortedData);
    setSortConfig({ key, direction });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden overflow-x-auto">
      <table className="w-full text-left border-collapse min-w-[1000px]">
        <thead className="bg-[#0f172a] text-white">
          <tr className="text-[10px] font-black uppercase tracking-widest whitespace-nowrap">
            <th className="p-4 w-16">Rank</th>
            <th className="p-4 cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('team')}>Franchise / GM</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('seasons')}>Yrs</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('wins')}>Record</th>
            <th className="p-4 text-center">PPG (O/D)</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('divWins')}>Div</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('postSeason')}>Post</th>
            <th className="p-4 text-center cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('superBowls')}>Bowl</th>
            <th className="p-4 text-right min-w-[200px] cursor-pointer hover:text-blue-400 transition-colors" onClick={() => handleSort('championships')}>
              Titles {sortConfig.key === 'championships' && (sortConfig.direction === 'desc' ? '▼' : '▲')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((team, idx) => {
            const totalGames = team.wins + team.losses + team.ties;
            const offPPG = totalGames > 0 ? (team.offPts / totalGames).toFixed(1) : "0.0";
            const defPPG = totalGames > 0 ? (team.defPts / totalGames).toFixed(1) : "0.0";
            const winPct = totalGames > 0 ? (team.wins / (team.wins + team.losses)).toFixed(3) : ".000";

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
                  <div className="flex flex-col">
                    <span className="font-mono font-bold text-slate-700">{team.wins}-{team.losses}-{team.ties}</span>
                    <span className="text-[10px] text-blue-500 font-bold">{winPct}</span>
                  </div>
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
                    {team.championships > 0 ? (
                      Array(team.championships).fill(0).map((_, i) => (
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
    </div>
  );
}