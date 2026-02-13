'use client';

import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import { 
  ArrowLeftRight, 
  UserPlus, 
  UserMinus, 
  Zap, 
  ShieldCheck, 
  RotateCw,
  Activity
} from 'lucide-react';
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';
import TeamSelector from '@/components/TeamSelector';
import { useTeam } from '@/context/TeamContext';
import { Team } from '@/types';

export default function TransactionsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();
  const { selectedTeam, setSelectedTeam } = useTeam();
  
  const [teams, setTeams] = useState<Team[]>([]);
  const [currentSeason, setCurrentSeason] = useState('');
  const [coach, setCoach] = useState('');
  const [logs, setLogs] = useState<Record<string, string>[]>([]); 
  const [loadingLogs, setLoadingLogs] = useState(true);
  const [filterTeam, setFilterTeam] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'FA' | 'DROP' | 'IR' | 'TRADE'>('FA');

  const hasSynced = useRef(false);

  // 1. SESSION SYNC
  useEffect(() => {
    if (status === "authenticated" && (session?.user as { id?: string })?.id && !hasSynced.current) {
      setSelectedTeam((session.user as { id?: string }).id || '');
      hasSynced.current = true;
    }
  }, [status, session, setSelectedTeam]);

  // 2. DATA LOAD
  useEffect(() => {
    fetch('/api/teams').then(res => res.json()).then(data => {
      setTeams(Array.isArray(data) ? data : []);
    });

    fetch('/api/rules', { cache: 'no-store' }).then(res => res.json()).then(data => {
      if (Array.isArray(data)) {
        const cYear = data.find(r => r.setting === 'cuts_year');
        if (cYear?.value) setCurrentSeason(cYear.value.toString());

        const limit = data.find(r => r.setting === 'limit_roster');
        if (limit?.value) console.log(`✅ Transaction Terminal: Roster Limit set to ${limit.value}`);
      }
    });
  }, []);

  const fetchLogs = useCallback(async () => {
    setLoadingLogs(true);
    try {
      const res = await fetch('/api/transactions');
      const data = await res.json();
      if (Array.isArray(data)) setLogs(data);
    } catch (err) { console.error(err); }
    finally { setLoadingLogs(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  useEffect(() => {
    const teamObj = teams.find(t => t.teamshort === selectedTeam || t.short === selectedTeam);
    setCoach(teamObj?.coach || '');
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

  const tabs = [
    { id: 'FA', label: 'Add Player', icon: <UserPlus size={20} />, activeColor: 'bg-blue-600' },
    { id: 'DROP', label: 'Waive/Drop Player', icon: <UserMinus size={20} />, activeColor: 'bg-red-600' },
    { id: 'IR', label: 'IR Movement', icon: <Zap size={20} />, activeColor: 'bg-amber-500' },
    { id: 'TRADE', label: 'Team Trade', icon: <ArrowLeftRight size={20} />, activeColor: 'bg-purple-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen text-slate-900">
      
      {/* HEADER SECTION */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 border-b border-slate-200 pb-8">
        <div className="text-left">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
            Transaction <span className="text-blue-600">Center</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
            <ShieldCheck size={14} className="text-emerald-500" />
            Authenticated Transaction Terminal • Season {currentSeason}
          </p>
        </div>
        <div className="w-full md:w-80">
          <TeamSelector />
        </div>
      </header>

      {!selectedTeam ? (
        <div className="p-20 text-center font-black text-slate-300 uppercase tracking-widest animate-pulse italic">
          Establishing Secure Roster Uplink...
        </div>
      ) : (
        <div className="space-y-8">
          
          {/* HORIZONTAL OPERATION SELECTOR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-white p-4 rounded-[2rem] shadow-xl border border-slate-100">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as 'FA' | 'DROP' | 'IR' | 'TRADE')}
                className={`flex flex-col items-center justify-center gap-3 p-6 rounded-2xl transition-all group ${
                  activeTab === tab.id 
                    ? `${tab.activeColor} text-white shadow-lg scale-[1.02]` 
                    : 'bg-slate-50 text-slate-400 hover:bg-slate-100'
                }`}
              >
                <div className={`${activeTab === tab.id ? 'text-white' : 'text-slate-300 group-hover:text-slate-500'} transition-colors`}>
                  {tab.icon}
                </div>
                <span className="text-[11px] font-black uppercase tracking-[0.15em]">{tab.label}</span>
              </button>
            ))}
          </div>

          {/* MAIN ACTION TERMINAL */}
          <div className="bg-white rounded-[3rem] shadow-2xl border border-slate-100 overflow-hidden flex flex-col min-h-[600px]">
            <div className="p-8 border-b border-slate-50 bg-slate-50/50 flex items-center justify-between">
              <h2 className="text-2xl font-black uppercase italic tracking-tighter">
                {tabs.find(t => t.id === activeTab)?.label} <span className="text-blue-600">Terminal</span>
              </h2>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Secure Sync Active</span>
              </div>
            </div>

            <div className="p-8 md:p-12 flex-1 overflow-y-auto">
              {activeTab === 'FA' && <FreeAgentPanel key={`fa-${refreshKey}`} team={selectedTeam} coach={coach} onComplete={handleTransactionComplete} />}
              {activeTab === 'DROP' && <DropPlayer key={`drop-${refreshKey}`} team={selectedTeam} coach={coach} onComplete={handleTransactionComplete} />}
              {activeTab === 'IR' && <IRPanel key={`ir-${refreshKey}`} team={selectedTeam} coach={coach} onComplete={handleTransactionComplete} />}
              {activeTab === 'TRADE' && <TradePanel key={`trade-${refreshKey}`} team={selectedTeam} coach={coach} onComplete={handleTransactionComplete} />}
            </div>

            <div className="p-6 bg-slate-900 border-t border-slate-800 text-[10px] font-mono text-slate-500 uppercase tracking-widest flex justify-between px-10">
              <p>COACH: <span className="text-white italic">{session?.user?.name || 'GUEST'}</span></p>
              <p>AUTH_ID: <span className="text-emerald-400">{(session?.user as { id?: string })?.id || 'NONE'}</span></p>
              <p className="hidden md:block">ENCRYPTION: <span className="text-blue-400">AES-256-GCM</span></p>
            </div>
          </div>
        </div>
      )}

      {/* TRANSACTION LOG SECTION */}
      <div className="space-y-6 pt-12">
        <div className="flex flex-col md:flex-row justify-between items-end border-b border-slate-200 pb-6 gap-4 text-left">
          <div className="space-y-1">
            <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
              <Activity className="text-blue-600" size={32} />
              Transaction <span className="text-blue-600">Log</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">Verified Roster History Terminal</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
            <select 
              className="flex-1 md:w-64 p-3 bg-white border-2 border-slate-100 rounded-xl text-[11px] font-black uppercase text-slate-700 focus:border-blue-500 transition-all outline-none" 
              value={filterTeam} 
              onChange={(e) => setFilterTeam(e.target.value)}
            >
              <option value="">Show All Teams</option>
              {teams.map((t, i) => <option key={i} value={t.name}>{t.name}</option>)}
            </select>
            <button onClick={fetchLogs} className="bg-slate-900 text-white p-4 rounded-xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg">
              <RotateCw size={18} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto max-h-[600px] no-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                <tr>
                  <th className="px-8 py-5">Timestamp</th>
                  <th className="px-8 py-5">Operation</th>
                  <th className="px-8 py-5">Details</th>
                  <th className="px-8 py-5 text-center pr-12">Week</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingLogs ? (
                  <tr><td colSpan={4} className="p-24 text-center text-slate-300 font-black uppercase animate-pulse italic">Synchronizing Records...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={4} className="p-24 text-center text-slate-300 italic font-black uppercase">No Recent Records</td></tr>
                ) : filteredLogs.map((log, i) => (
                  <tr key={i} className={`text-[11px] hover:bg-slate-50 transition-colors ${log.coach === session?.user?.name ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-8 py-6 font-mono text-slate-400 tabular-nums">{log.timestamp}</td>
                    <td className="px-8 py-6">
                      <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                        log.type === 'TRADE' ? 'bg-purple-100 text-purple-700' : 
                        log.type === 'DROP' ? 'bg-red-100 text-red-700' :
                        log.type === 'INJURY PICKUP' ? 'bg-amber-100 text-amber-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-8 py-6 font-bold text-slate-800 uppercase tracking-tight leading-snug">
                      {log.details}
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1.5 italic tracking-tighter">Coach: {log.coach}</p>
                    </td>
                    <td className="px-8 py-6 text-center pr-12">
                      <span className="font-black text-blue-600 bg-blue-50 px-4 py-2 rounded-xl text-xs">{log.weekBack || '—'}</span>
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