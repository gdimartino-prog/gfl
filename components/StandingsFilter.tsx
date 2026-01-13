'use client';

import { useState } from 'react';

export default function StandingsFilter({ data, currentYear, renderTable }: any) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTeam, setSelectedTeam] = useState('All Teams');

  // Get unique team names for the dropdown
  const teams = ['All Teams', ...new Set(data.map((row: any) => row.team))].sort();

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
        <input 
          type="text"
          placeholder="Search team or year..."
          className="flex-1 p-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <select 
          className="p-2 rounded-lg border border-slate-300 text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
          onChange={(e) => setSelectedTeam(e.target.value)}
        >
          {teams.map(team => <option key={team} value={team}>{team}</option>)}
        </select>
      </div>

      {/* TABLES */}
      {currentSeason.length > 0 && (
        <section>
          <h2 className="text-2xl font-black uppercase italic mb-4 text-slate-900">Current Season</h2>
          <div className="bg-white border-2 border-blue-600/20 rounded-2xl shadow-lg overflow-hidden">
            {renderTable(currentSeason, true)}
          </div>
        </section>
      )}

      <section>
        <h2 className="text-2xl font-black uppercase italic mb-4 text-slate-500">Historical Archives</h2>
        <div className="bg-white border border-slate-200 rounded-2xl shadow-sm overflow-hidden">
          {renderTable(historicalData, false)}
        </div>
      </section>
    </div>
  );
}