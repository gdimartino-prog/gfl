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
  
  // New state for logs
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);

  // 1. Fetch Teams
  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
  }, []);

  // 2. Fetch Logs (Run once on mount)
  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      setLogs(data);
    } catch (err) {
      console.error("Failed to fetch logs:", err);
    } finally {
      setLoadingLogs(false);
    }
  };

  useEffect(() => {
    const teamObj = teams.find(t => t.short === selectedTeam);
    setCoach(teamObj ? teamObj.coach : '');
  }, [selectedTeam, teams]);

  return (
    <div className="max-w-6xl mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-bold border-b pb-4">GFL Transaction Center</h1>

      {/* GLOBAL SELECTOR SECTION */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase text-left">Select Active Team</label>
          <select 
            className="border p-3 w-full rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">-- Select Team --</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name} ({t.short})</option>)}
          </select>
        </div>
        <div className="flex-1 w-full text-left">
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
        /* THE 2x2 GRID */
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <FreeAgentPanel team={selectedTeam} coach={coach} />
          <DropPlayer team={selectedTeam} coach={coach} />
          <IRPanel team={selectedTeam} coach={coach} />
          <TradePanel team={selectedTeam} coach={coach} />
        </div>
      )}

      {/* --- TRANSACTION LOG SECTION --- */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-2">
          <h2 className="text-xl font-bold text-gray-700">Recent Transaction History</h2>
          <button 
            onClick={fetchLogs}
            className="text-xs bg-gray-200 hover:bg-gray-300 px-3 py-1 rounded transition"
          >
            Refresh Log
          </button>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Date</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Type</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Details</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Coach</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {loadingLogs ? (
                  <tr><td colSpan={4} className="p-10 text-center text-gray-400 italic">Updating history...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="p-10 text-center text-gray-400">No transactions recorded yet.</td></tr>
                ) : (
                  logs.map((log, i) => (
                    <tr key={i} className="hover:bg-blue-50/30 transition">
                      <td className="p-4 text-gray-500 whitespace-nowrap">
                        {new Date(log.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-4">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          log.type === 'TRADE' ? 'bg-blue-100 text-blue-700' :
                          log.type === 'ADD' ? 'bg-green-100 text-green-700' :
                          log.type === 'DROP' ? 'bg-red-100 text-red-700' : 'bg-gray-100'
                        }`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="p-4">
                        <div className="flex flex-col">
                          <span className="font-semibold text-gray-800">{log.details}</span>
                          <span className="text-[10px] text-gray-400 italic lowercase">
                            {log.from} &rarr; {log.to}
                          </span>
                        </div>
                      </td>
                      <td className="p-4 text-gray-600 font-medium">{log.coach}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}