'use client';

import { useState, useEffect } from 'react';
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';

export default function TransactionsPage() {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [coach, setCoach] = useState('');

  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
  }, []);

  useEffect(() => {
    const teamObj = teams.find(t => t.short === selectedTeam);
    setCoach(teamObj ? teamObj.coach : '');
  }, [selectedTeam, teams]);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-8">
      <h1 className="text-3xl font-bold border-b pb-4">GFL Transaction Center</h1>

      {/* GLOBAL SELECTOR SECTION */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Select Active Team</label>
          <select 
            className="border p-3 w-full rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">-- Select Team --</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name} ({t.short})</option>)}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase">Coach (Auto-filled)</label>
          <input 
            className="border p-3 w-full rounded bg-gray-100 text-gray-600" 
            value={coach} 
            readOnly 
            placeholder="Coach name will appear here..."
          />
        </div>
      </div>

      {!selectedTeam ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-gray-400 bg-gray-50">
          <p className="text-xl">Select a team at the top to enable transaction tools.</p>
        </div>
      ) : (
        /* THE 2x2 GRID: One instance of each component */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FreeAgentPanel team={selectedTeam} coach={coach} />
          <DropPlayer team={selectedTeam} coach={coach} />
          <IRPanel team={selectedTeam} coach={coach} />
          <TradePanel team={selectedTeam} coach={coach} />
        </div>
      )}
    </div>
  );
}