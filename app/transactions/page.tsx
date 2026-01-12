'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';

export default function TransactionsPage() {
  const router = useRouter();
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState('');
  const [coach, setCoach] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  
  // ADDED: The key that forces children to refresh their data
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(setTeams);
  }, []);

  const fetchLogs = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // UPDATED: Centralized refresh function now increments the refreshKey
  const handleTransactionComplete = async () => {
    await fetchLogs(); // Refresh the history table
    setRefreshKey(prev => prev + 1); // This forces the child panels to re-fetch roster/FA lists
    router.refresh();  // Refresh server-side data
  };

  useEffect(() => {
    const teamObj = teams.find(t => t.short === selectedTeam);
    setCoach(teamObj ? teamObj.coach : '');
  }, [selectedTeam, teams]);

  const filteredLogs = useMemo(() => {
    if (!filterTeam) return logs;
    return logs.filter(log => 
      log.fromShort === filterTeam || log.toShort === filterTeam
    );
  }, [logs, filterTeam]);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-12">
      <h1 className="text-3xl font-bold border-b pb-4 text-left text-gray-800 tracking-tight">
        GFL <span className="text-blue-600">Transaction Center</span>
      </h1>

      {/* GLOBAL SELECTOR */}
      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row gap-6 items-end">
        <div className="flex-1 w-full text-left">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Select Active Team</label>
          <select 
            className="border p-3 w-full rounded bg-white shadow-sm focus:ring-2 focus:ring-blue-500 outline-none text-black font-medium"
            value={selectedTeam}
            onChange={(e) => setSelectedTeam(e.target.value)}
          >
            <option value="">-- Select Team --</option>
            {teams.map(t => <option key={t.short} value={t.short}>{t.name} ({t.short})</option>)}
          </select>
        </div>
        <div className="flex-1 w-full text-left">
          <label className="block text-xs font-bold text-gray-500 mb-1 uppercase tracking-widest">Coach</label>
          <input className="border p-3 w-full rounded bg-gray-100 text-gray-600 focus:outline-none" value={coach} readOnly />
        </div>
      </div>

      {!selectedTeam ? (
        <div className="text-center py-20 border-2 border-dashed rounded-xl text-gray-400 bg-gray-50">
          <p className="text-xl font-bold uppercase tracking-widest">Select a team to enable tools</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* CRITICAL CHANGE: 
            Adding 'key' to these components ensures that when refreshKey changes, 
            the component is destroyed and re-mounted, triggering their internal 
            useEffect() to fetch the latest data from the Google Sheet.
          */}
          <FreeAgentPanel 
            key={`fa-${selectedTeam}-${refreshKey}`}
            team={selectedTeam} 
            coach={coach} 
            onComplete={handleTransactionComplete} 
          />
          <DropPlayer 
            key={`drop-${selectedTeam}-${refreshKey}`}
            team={selectedTeam} 
            coach={coach} 
            onComplete={handleTransactionComplete} 
          />
          <IRPanel 
            key={`ir-${selectedTeam}-${refreshKey}`}
            team={selectedTeam} 
            coach={coach} 
            onComplete={handleTransactionComplete} 
          />
          <TradePanel 
            key={`trade-${selectedTeam}-${refreshKey}`}
            team={selectedTeam} 
            coach={coach} 
            onComplete={handleTransactionComplete} 
          />
        </div>
      )}

      {/* TRANSACTION LOG SECTION */}
      <div className="space-y-4">
        <div className="flex justify-between items-center border-b pb-4">
          <h2 className="text-xl font-bold text-gray-700">Recent History</h2>
          <div className="flex gap-3">
            <select 
              className="text-sm border rounded-lg px-3 py-2 bg-white text-black"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="">Show All Teams</option>
              {teams.map(t => <option key={t.short} value={t.short}>{t.name}</option>)}
            </select>
            <button onClick={fetchLogs} className="text-xs font-semibold bg-gray-100 px-4 py-2 rounded-lg border text-black hover:bg-gray-200 transition-colors">
              🔄 Refresh
            </button>
          </div>
        </div>

        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-100 sticky top-0 z-10 border-b">
                <tr>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Timestamp</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Type</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Details</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">From Team</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">To Team</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Owner</th>
                  <th className="p-4 font-bold text-gray-600 uppercase text-[10px]">Week Back</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingLogs ? (
                   <tr><td colSpan={7} className="p-10 text-center text-gray-400">Loading history...</td></tr>
                ) : filteredLogs.length === 0 ? (
                   <tr><td colSpan={7} className="p-10 text-center text-gray-400 italic">No transactions found.</td></tr>
                ) : filteredLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-4 font-mono text-[11px] text-gray-400">{log.timestamp}</td>
                    <td className="p-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        log.type === 'INJURY PICKUP' ? 'bg-amber-100 text-amber-700' : 
                        log.type === 'TRADE' ? 'bg-purple-100 text-purple-700' : 
                        log.type === 'DROP' ? 'bg-red-100 text-red-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-4 font-medium text-gray-800">{log.details}</td>
                    <td className="p-4 text-gray-600 text-[11px]">{log.fromFull || log.fromTeam || '-'}</td>
                    <td className="p-4 text-gray-600 text-[11px]">{log.toFull || log.toTeam || '-'}</td>
                    <td className="p-4 text-gray-500">{log.coach}</td>
                    <td className="p-4 font-bold text-blue-600">
                      {log.weekBack ? `Week ${log.weekBack}` : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}