'use client';

import { useState } from 'react';

export default function StandingsFilter({ data, currentYear, renderTable }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All Teams');

  // FIX: Explicitly type 'teams' as string[] to resolve the 'unknown' key error
  const teams: string[] = [
    'All Teams', 
    ...Array.from(new Set(data.map((row: any) => row.team)))
  ].sort() as string[];

  // Filtering Logic
  const filteredData = data.filter((row: any) => {
    const matchesSearch = row.team.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          row.year.toString().includes(searchTerm);
    const matchesTeam = selectedTeam === 'All Teams' || row.team === selectedTeam;
    return matchesSearch && matchesTeam;
  });

  const currentSeason = filteredData.filter((row: any) => row.year === currentYear);
  const historicalData = filteredData.filter((row: any) => row.year !== currentYear);

  return (
    <div className="space-y-8">
      {/* FILTER BAR */}
      <div className="flex flex-col md:flex-row gap-4 bg-slate-100 p-4 rounded-xl border border-slate-200">
        <div className="relative flex-1">
          <input 
            type="text"
            placeholder="Search team or year..."
            className="w-full p-2 pl-4 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all shadow-sm"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="p-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none bg-white cursor-pointer shadow-sm"
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          {teams.map((team: string) => (
            <option key={team} value={team}>
              {team}
            </option>
          ))}
        </select>
      </div>

      {/* TABLES */}
      {currentSeason.length > 0 && (
        <section>
          <h2 className="text-2xl font-black uppercase italic mb-4 text-slate-900 tracking-tighter">
            Current <span className="text-blue-600">Season</span>
          </h2>
          <div className="bg-white border-2 border-blue-600/10 rounded-2xl shadow-xl overflow-hidden">
            {renderTable(currentSeason, true)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-black uppercase italic mb-4 text-slate-400 tracking-tighter">
          Historical <span className="text-slate-600">Archives</span>
        </h2>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
          {renderTable(historicalData, false)}
        </div>
      </section>
    </div>
  );
}