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
      if (key === 'pct') {
        const aPct = a.wins / (a.wins + a.losses) || 0;
        const bPct = b.wins / (b.wins + b.losses) || 0;
        return direction === 'asc' ? aPct - bPct : bPct - aPct;
      }
      return direction === 'asc' ? a[key] - b[key] : b[key] - a[key];
    });

    setData(sortedData);
    setSortConfig({ key, direction });
  };

  return (
    <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden">
      <table className="w-full text-left">
        <thead className="bg-[#0f172a] text-white">
          <tr className="text-[10px] font-black uppercase tracking-[0.2em]">
            <th className="p-6 w-16">Rank</th>
            <th className="p-6 cursor-pointer hover:text-blue-400" onClick={() => handleSort('team')}>Franchise / GM</th>
            <th className="p-6 text-center cursor-pointer hover:text-blue-400" onClick={() => handleSort('seasons')}>Yrs</th>
            <th className="p-6 text-center cursor-pointer hover:text-blue-400" onClick={() => handleSort('wins')}>
              Record {sortConfig.key === 'wins' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}
            </th>
            <th className="p-6 text-center cursor-pointer hover:text-blue-400" onClick={() => handleSort('pct')}>Win %</th>
            {/* WIDER COLUMN HERE */}
            <th className="p-6 text-right w-[200px] cursor-pointer hover:text-blue-400" onClick={() => handleSort('championships')}>
              Titles {sortConfig.key === 'championships' ? (sortConfig.direction === 'desc' ? '▼' : '▲') : ''}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {data.map((team, idx) => {
            const winPct = (team.wins / (team.wins + team.losses) || 0).toFixed(3);
            return (
              <tr key={team.team} className="hover:bg-slate-50 transition-colors">
                <td className="p-6 text-slate-400 font-mono text-sm">{idx + 1}</td>
                <td className="p-6">
                  <div className="flex flex-col">
                    <span className="text-slate-900 uppercase italic font-black text-lg leading-tight">{team.team}</span>
                    <span className="text-blue-600 text-[10px] font-bold uppercase tracking-wider mt-1">GM: {team.gm}</span>
                  </div>
                </td>
                <td className="p-6 text-center text-slate-400 font-bold">{team.seasons}</td>
                <td className="p-6 text-center font-mono font-bold text-slate-600">
                  {team.wins}-{team.losses}-{team.ties}
                </td>
                <td className="p-6 text-center text-blue-500 font-bold">{winPct}</td>
                {/* PREVENT WRAP HERE */}
                <td className="p-6">
                  <div className="flex justify-end gap-1 flex-nowrap min-w-[180px]">
                    {team.championships > 0 ? (
                      Array(team.championships).fill(0).map((_, i) => (
                        <span key={i} className="text-xl drop-shadow-sm" title="GFL Champion">🏆</span>
                      ))
                    ) : (
                      <span className="text-slate-200">—</span>
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