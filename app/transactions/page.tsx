'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';

export default function TransactionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { selectedTeam, setSelectedTeam } = useTeam();
  
  const [teams, setTeams] = useState<any[]>([]);
  const [coach, setCoach] = useState('');
  const [logs, setLogs] = useState<any[]>([]); 
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);

  // Sync tracking to ensure the home team is set exactly once upon login
  const hasSynced = useRef(false);

  // 1. SESSION SYNC
  useEffect(() => {
    if (status === "authenticated" && (session?.user as any)?.id && !hasSynced.current) {
      setSelectedTeam((session.user as any).id);
      hasSynced.current = true;
    }
    if (status === "unauthenticated") {
      hasSynced.current = false;
    }
  }, [status, session, setSelectedTeam]);

  // 2. DATA LOAD
  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(data => {
      setTeams(Array.isArray(data) ? data : []);
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) {
      console.error("Log Fetch Error:", err);
    } finally {
      setLoadingLogs(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Update internal coach name based on the selectedTeam (required for transaction POSTs)
  useEffect(() => {
    const teamObj = teams.find(t => t.teamshort === selectedTeam || t.short === selectedTeam);
    setCoach(teamObj ? teamObj.coach : '');
  }, [selectedTeam, teams]);

  const handleTransactionComplete = async () => {
    await fetchLogs(); 
    setRefreshKey(prev => prev + 1); 
    router.refresh();  
  };

  const filteredLogs = useMemo(() => {
    const safeLogs = Array.isArray(logs) ? logs : [];
    if (!filterTeam) return safeLogs;
    return safeLogs.filter(log => 
      String(log.fromFull || '').toLowerCase().includes(filterTeam.toLowerCase()) || 
      String(log.toFull || '').toLowerCase().includes(filterTeam.toLowerCase())
    );
  }, [logs, filterTeam]);

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-12 bg-white min-h-screen text-slate-900">
      
      {/* STANDARDIZED HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-200 pb-8 text-left">
        <div className="space-y-1">
          <h1 className="text-5xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Transaction <span className="text-blue-600">Center</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
            Authorized Roster Movements • Season 2026
          </p>
        </div>
        
        <div className="w-full md:w-96">
            <TeamSelector />
        </div>
      </div>

      {!selectedTeam ? (
        <div className="text-center py-24 border-4 border-dashed rounded-[3rem] text-slate-200 bg-slate-50/50">
          <p className="text-xl font-black uppercase tracking-widest italic animate-pulse text-center">Establishing Secure Uplink...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 animate-in fade-in duration-500 pb-20">
          {/* Main Transaction Panels */}
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

      {/* TRANSACTION HISTORY SECTION */}
      <div className="space-y-6">
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-100 pb-6 gap-4">
          <div className="text-left">
            <h2 className="text-2xl font-black text-slate-800 uppercase italic leading-none">Recent History</h2>
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">League Wire Activity</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select 
              className="flex-1 md:w-64 text-sm border-2 border-slate-100 rounded-xl px-4 py-3 bg-white font-bold text-slate-700 outline-none focus:border-blue-500 transition-all shadow-sm"
              value={filterTeam}
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="">Show All Teams</option>
              {teams.map((t, i) => (
                <option key={i} value={t.name}>{t.name}</option>
              ))}
            </select>
            <button 
              onClick={fetchLogs} 
              className="bg-slate-900 text-white px-6 py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-md active:scale-95"
            >
              Refresh
            </button>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-[2.5rem] shadow-2xl overflow-hidden mb-20">
          <div className="overflow-x-auto max-h-[600px] overflow-y-auto text-left text-sm">
            <table className="w-full text-left">
              <thead className="bg-slate-50 sticky top-0 z-10 border-b border-slate-100">
                <tr>
                  <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Timestamp</th>
                  <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Action</th>
                  <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em]">Details</th>
                  <th className="p-6 font-black text-slate-400 uppercase text-[10px] tracking-[0.2em] text-center">Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingLogs ? (
                   <tr><td colSpan={4} className="p-24 text-center text-slate-300 font-black uppercase animate-pulse italic">Synchronizing Records...</td></tr>
                ) : filteredLogs.length === 0 ? (
                   <tr><td colSpan={4} className="p-24 text-center text-slate-300 italic font-black uppercase">No Recent Transactions Found</td></tr>
                ) : filteredLogs.map((log, i) => (
                  <tr key={i} className={`hover:bg-slate-50/80 transition-colors ${log.coach === session?.user?.name ? 'bg-blue-50/20' : ''}`}>
                    <td className="p-6 font-mono text-[10px] text-slate-400">{log.timestamp}</td>
                    <td className="p-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-tighter ${
                        log.type === 'INJURY PICKUP' ? 'bg-amber-100 text-amber-700' : 
                        log.type === 'TRADE' ? 'bg-purple-100 text-purple-700' : 
                        log.type === 'DROP' || log.type === 'WAIVE' ? 'bg-red-100 text-red-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="p-6">
                        <p className="font-bold text-slate-800 uppercase tracking-tight leading-snug">{log.details}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-2 italic">Executed by {log.coach}</p>
                    </td>
                    <td className="p-6 text-center">
                      <span className="font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-lg text-xs">{log.weekBack || '—'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* FOOTER INFO (For Debugging) */}
      <div className="mt-20 p-8 bg-slate-900 rounded-t-[3rem] border-t border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-widest flex flex-wrap gap-10 justify-center">
          <p>LOGGED_COACH: <span className="text-white">{session?.user?.name || 'GUEST'}</span></p>
          <p>AUTH_ID: <span className="text-emerald-400">{(session?.user as any)?.id || 'NONE'}</span></p>
          <p>SYNC_LOCK: <span className="text-blue-400">{hasSynced.current ? "ENGAGED" : "OPEN"}</span></p>
      </div>
    </div>
  );
}