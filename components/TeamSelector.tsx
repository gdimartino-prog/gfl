'use client';
import { useTeam } from '@/context/TeamContext';
import { useEffect, useState } from 'react';

// This matches your API output exactly now
interface TeamData {
  name: string;  // Column A (e.g. "Old Bridge Knights")
  short: string; // Column B (e.g. "OBG")
}

export default function TeamSelector() {
  const { selectedTeam, setSelectedTeam } = useTeam();
  const [teams, setTeams] = useState<TeamData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadTeams() {
      try {
        const res = await fetch('/api/teams');
        if (res.ok) {
          const data = await res.json();
          
          // Your API returns an array directly: [{name: "...", short: "..."}, ...]
          const sorted = data.sort((a: TeamData, b: TeamData) => 
            (a.name || '').localeCompare(b.name || '')
          );
          setTeams(sorted);
        }
      } catch (error) {
        console.error("Selector Error:", error);
      } finally {
        setLoading(false);
      }
    }
    loadTeams();
  }, []);

  return (
    <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className={`w-2 h-2 rounded-full ${loading ? 'bg-amber-400 animate-pulse' : 'bg-emerald-500'}`}></div>
        <div>
          <h3 className="text-[10px] font-black text-blue-600 uppercase tracking-widest leading-none">
            Active Team Selection
          </h3>
          <p className="text-slate-400 text-[10px] font-medium mt-1">
            Persists across Roster, Cuts, and Schedule.
          </p>
        </div>
      </div>
      
      <div className="relative w-full md:w-80">
        <select 
          value={selectedTeam}
          onChange={(e) => setSelectedTeam(e.target.value)}
          className="bg-slate-50 border border-slate-200 text-slate-900 text-sm rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5 font-bold cursor-pointer appearance-none outline-none"
        >
          <option value="">{loading ? 'Fetching Teams...' : 'Choose a team...'}</option>
          {teams.map((t) => (
            /* Using t.short as the value (OBG) 
               and t.name as the label (Old Bridge Knights) */
            <option key={t.short} value={t.short}>
              {t.name}
            </option>
          ))}
        </select>
        
        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-slate-400">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
    </div>
  );
}