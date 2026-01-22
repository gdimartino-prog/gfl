'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';

export default function TransactionsPage() {
  const router = useRouter();
  const { selectedTeam } = useTeam();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [coach, setCoach] = useState('');
  const [logs, setLogs] = useState<any[]>([]); 
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // 1. Load initial team data for name/coach resolution
  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(data => {
      setTeams(Array.isArray(data) ? data : []);
    });
  }, []);

  // 2. Fetch the transaction history logs from Google Sheets
  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setLogs(data);
      } else {
        console.error("API Error: Expected array but got", data);
        setLogs([]); 
      }
    } catch (err) {
      console.error("Failed to fetch logs:", err);
      setLogs([]); 
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // 3. Central Refresh Logic: Called by child components after a successful POST
  const handleTransactionComplete = async () => {
    await fetchLogs(); 
    // Incrementing this key forces all panels to re-run their internal fetch logic
    setRefreshKey(prev => prev + 1); 
    router.refresh();  
  };

  useEffect(() => {
    const teamObj = teams.find(t => t.short === selectedTeam);
    setCoach(teamObj ? teamObj.coach : '');
  }, [selectedTeam, teams]);

  // 4. History Log Filtering
  const filteredLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    if (!filterTeam) return safeLogs;
    
    return safeLogs.filter(log => 
      String(log.fromFull || '').toLowerCase().includes(filterTeam.toLowerCase()) || 
      String(log.toFull || '').toLowerCase().includes(filterTeam.toLowerCase())
    );
  }, [logs, filterTeam]);

  return (
    <div className="max-w-7xl mx-auto p-8 space-y-12 bg-white min-h-screen">
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-6 gap-4">
        <div>
          <h1 className="text-4xl font-black italic uppercase tracking-tighter text-slate-900">
            Transaction <span className="text-blue-600">Center</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Authorized Roster Movements</p>
        </div>
        
        <div className="bg-slate-50 border px-6 py-3 rounded-2xl flex flex-col justify-center min-w-[200px]">
          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Active Coach</span>
          <span className="text-sm font-bold text-slate-700">{coach || 'NO TEAM SELECTED'}</span>
        </div>
      </div>

      <TeamSelector />

      {!selectedTeam ? (
        <div className="text-center py-24 border-4 border-dashed rounded-[3rem] text-slate-300 bg-slate-50/50">
          <svg className="w-16 h-16 mx-auto mb-4 opacity-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <p className="text-xl font-black uppercase tracking-widest">Select a team to enable tools</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500">
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
      <div className="space-y-6 pt-8">
        <div className="flex flex-col md:flex-row justify-between items-end border-b pb-6 gap-4">
          <div>
            <h2 className="text-2xl font-black text-slate-800 uppercase italic">Recent History</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">League Wire Activity</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select 
              className="flex-1 md:w-64 text-sm border-2 border-slate-100 rounded-xl px-4 py-3 bg-white font-bold text-slate-700 outline-none focus:border-blue-500"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="">Show All Teams</option>
              {teams.map(t => <option key={t.short} value={t.name}>{t.name}</option>)}
            </select>
            <button onClick={fetchLogs} className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-colors">
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2rem] shadow-xl overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b">
                <tr>
                  <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-widest">Timestamp</th>
                  <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-widest">Action</th>
                  <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-widest">Details</th>
                  <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-widest">Status</th>
                  <th className="p-5 font-black text-slate-400 uppercase text-[10px] tracking-widest text-center">Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingLogs ? (
                   <tr><td colSpan={5} className="p-20 text-center text-slate-400 font-bold uppercase animate-pulse">Synchronizing Data...</td></tr>
                ) : filteredLogs.length === 0 ? (
                   <tr><td colSpan={5} className="p-20 text-center text-slate-300 italic">No records found.</td></tr>
                ) : filteredLogs.map((log, i) => (
                  <tr key={i} className={`hover:bg-slate-50/80 transition-colors ${log.coach === coach ? 'bg-blue-50/30' : ''}`}>
                    <td className="p-5 font-mono text-[10px] text-slate-400">{log.timestamp}</td>
                    <td className="p-5">
                      <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        log.type === 'INJURY PICKUP' ? 'bg-amber-100 text-amber-700' : 
                        log.type === 'TRADE' ? 'bg-purple-100 text-purple-700' : 
                        log.type === 'DROP' || log.type === 'WAIVE' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-5">
                        <p className="font-bold text-slate-800 text-sm leading-snug">{log.details}</p>
                        <p className="text-[10px] font-bold text-slate-400 uppercase mt-1 italic">
                          {log.fromFull} ➔ {log.toFull} • Submitted by {log.coach}
                        </p>
                    </td>
                    <td className="p-5">
                      <span className={`px-2 py-1 rounded text-[9px] font-black uppercase tracking-widest ${
                        log.status === 'PENDING' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 'bg-green-50 text-green-700 border border-green-100'
                      }`}>
                        {log.status || 'SUCCESS'}
                      </span>
                    </td>
                    <td className="p-5 text-center">
                      <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-xs">
                        {log.weekBack ? `W${log.weekBack}` : '—'}
                      </span>
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