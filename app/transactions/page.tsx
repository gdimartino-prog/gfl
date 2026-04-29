'use client';

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from "next-auth/react";
import {
  ArrowLeftRight,
  UserPlus,
  UserMinus,
  Zap,
  ShieldCheck,
  RotateCw,
  Activity,
  Trash2,
  DollarSign,
  RefreshCcw,
} from 'lucide-react';
import FreeAgentPanel from './components/FreeAgentPanel';
import DropPlayer from './components/DropPlayer';
import IRPanel from './components/IRPanel';
import TradePanel from './components/TradePanel';
import TeamSelector from '@/components/TeamSelector';
import { useConfirm } from '@/components/ConfirmDialog';
import { useTeam } from '@/context/TeamContext';
import { Team } from '@/types';

const STATUS_STYLES: Record<string, string> = {
  'Done':    'bg-emerald-100 text-emerald-700',
  'Pending': 'bg-amber-100 text-amber-700',
  'On Team': 'bg-blue-100 text-blue-700',
};

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
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [activeTab, setActiveTab] = useState<'FA' | 'DROP' | 'IR' | 'TRADE'>('FA');
  const [savingStatus, setSavingStatus] = useState<string | null>(null);
  const [reprocessId, setReprocessId] = useState<string | null>(null);
  const [reprocessForm, setReprocessForm] = useState({ year: new Date().getFullYear(), round: 1, fromTeam: '', toTeam: '' });
  const [reprocessSaving, setReprocessSaving] = useState(false);
  const [showSpend, setShowSpend] = useState(false);
  const [spendSeason, setSpendSeason] = useState('');
  const [spendFrom, setSpendFrom] = useState('');
  const [spendTo, setSpendTo] = useState('');

  const hasSynced = useRef(false);
  const [confirm, ConfirmDialog] = useConfirm();

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

  const isCommissioner = useMemo(() => {
    if (status !== 'authenticated' || !session?.user) return false;
    const role = (session.user as { role?: string })?.role;
    if (role === 'superuser' || role === 'admin') return true;
    const sessionId = (session.user as { id?: string })?.id;
    const myTeam = teams.find(t => t.teamshort === sessionId || t.short === sessionId);
    return (myTeam as Team & { commissioner?: boolean })?.commissioner || false;
  }, [status, session, teams]);

  const handleDelete = useCallback(async (logId: string) => {
    if (!await confirm('This cannot be undone.', { title: 'Delete this transaction?', confirmLabel: 'Delete', destructive: true })) return;
    await fetch('/api/transactions', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: logId }) });
    setLogs(prev => prev.filter(l => l.id !== logId));
  }, [confirm]);

  const handleStatusChange = useCallback(async (logId: string, newStatus: string) => {
    setSavingStatus(logId);
    try {
      const res = await fetch('/api/transactions', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: parseInt(logId), status: newStatus }),
      });
      if (res.ok) {
        setLogs(prev => prev.map(l => l.id === logId ? { ...l, status: newStatus } : l));
      }
    } catch (err) { console.error(err); }
    finally { setSavingStatus(null); }
  }, []);

  const openReprocess = (log: Record<string, string>) => {
    const fromShort = teams.find(t => t.name === log.fromFull)?.teamshort || teams.find(t => t.short === log.fromFull)?.short || '';
    const toShort = teams.find(t => t.name === log.toFull)?.teamshort || teams.find(t => t.short === log.toFull)?.short || '';
    setReprocessForm({ year: new Date().getFullYear(), round: 1, fromTeam: fromShort, toTeam: toShort });
    setReprocessId(reprocessId === log.id ? null : log.id);
  };

  const handleReprocess = async () => {
    if (!reprocessForm.fromTeam || !reprocessForm.toTeam) return;
    setReprocessSaving(true);
    const res = await fetch('/api/draft-picks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fromTeam: reprocessForm.fromTeam, toTeam: reprocessForm.toTeam, year: reprocessForm.year, round: reprocessForm.round, coachName: 'commissioner' }),
    });
    setReprocessSaving(false);
    if (!res.ok) {
      const err = await res.json();
      alert(err.error || 'Pick not found — check year/round/current owner');
      return;
    }
    setReprocessId(null);
    alert('Pick transfer added to transfer table.');
  };

  const handleTransactionComplete = async () => {
    await fetchLogs();
    setRefreshKey(prev => prev + 1);
    router.refresh();
  };

  const filteredLogs = useMemo(() => {
    let safeLogs = Array.isArray(logs) ? logs : [];
    if (filterTeam) {
      safeLogs = safeLogs.filter(log =>
        String(log.fromFull || '').toLowerCase().includes(filterTeam.toLowerCase()) ||
        String(log.toFull || '').toLowerCase().includes(filterTeam.toLowerCase())
      );
    }
    if (filterType) {
      safeLogs = safeLogs.filter(log => String(log.type || '') === filterType);
    }
    if (filterStatus) {
      safeLogs = safeLogs.filter(log => String(log.status || '') === filterStatus);
    }
    return safeLogs;
  }, [logs, filterTeam, filterType, filterStatus]);

  // Available seasons for the spend report dropdown
  const availableSpendSeasons = useMemo(() => {
    const seasons = new Set<string>();
    (Array.isArray(logs) ? logs : []).forEach(l => {
      if (l.season) seasons.add(String(l.season));
    });
    return Array.from(seasons).sort((a, b) => Number(b) - Number(a));
  }, [logs]);

  // FA Spend report: team totals filtered by season and/or date range
  const spendReport = useMemo(() => {
    const fromMs = spendFrom ? new Date(spendFrom).getTime() : null;
    const toMs = spendTo ? new Date(spendTo + 'T23:59:59').getTime() : null;
    const allAdd = (Array.isArray(logs) ? logs : []).filter(l => {
      if (l.type !== 'ADD' || !(Number(l.fee) > 0)) return false;
      if (spendSeason && String(l.season) !== spendSeason) return false;
      if (spendFrom || spendTo) {
        if (!l.timestamp) return false;
        const ms = new Date(l.timestamp).getTime();
        if (fromMs && ms < fromMs) return false;
        if (toMs && ms > toMs) return false;
      }
      return true;
    });
    const byTeam: Record<string, number> = {};
    allAdd.forEach(l => {
      const team = String(l.toFull || l.fromFull || 'Unknown');
      byTeam[team] = (byTeam[team] || 0) + Number(l.fee);
    });
    return Object.entries(byTeam).sort(([, a], [, b]) => b - a);
  }, [logs, spendSeason, spendFrom, spendTo]);

  const tabs = [
    { id: 'FA', label: 'Add Player', icon: <UserPlus size={20} />, activeColor: 'bg-blue-600' },
    { id: 'DROP', label: 'Waive/Drop Player', icon: <UserMinus size={20} />, activeColor: 'bg-red-600' },
    { id: 'IR', label: 'IR Movement', icon: <Zap size={20} />, activeColor: 'bg-amber-500' },
    { id: 'TRADE', label: 'Team Trade', icon: <ArrowLeftRight size={20} />, activeColor: 'bg-purple-600' },
  ];

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8 bg-gray-50 min-h-screen text-slate-900">
      <ConfirmDialog />
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
              {activeTab === 'TRADE' && <TradePanel key={`trade-${refreshKey}`} team={selectedTeam} coach={coach} isCommissioner={isCommissioner} onComplete={handleTransactionComplete} />}
            </div>

          </div>
        </div>
      )}

      {/* TRANSACTION LOG SECTION */}
      <div className="space-y-6 pt-12">
        {/* Header row */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-200 pb-6">
          <div>
            <h2 className="text-4xl font-black text-slate-900 uppercase italic tracking-tighter leading-none flex items-center gap-3">
              <Activity className="text-blue-600" size={32} />
              Transaction <span className="text-blue-600">Log</span>
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2 ml-1">
              {filteredLogs.length} record{filteredLogs.length !== 1 ? 's' : ''}
              {(filterTeam || filterType || filterStatus) && ' · filtered'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchLogs}
              className="bg-slate-900 text-white p-3 rounded-xl hover:bg-blue-600 transition-all active:scale-95 shadow-lg"
            >
              <RotateCw size={16} className={loadingLogs ? 'animate-spin' : ''} />
            </button>
            {(filterTeam || filterType || filterStatus) && (
              <button
                onClick={() => { setFilterTeam(''); setFilterType(''); setFilterStatus(''); }}
                className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors px-3 py-2"
              >
                Clear filters
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-4 flex flex-col gap-4">
          {/* Status pills */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[9px] font-black uppercase tracking-widest text-slate-400 mr-1">Status</span>
            {[
              { value: '', label: 'All' },
              { value: 'Pending',  label: 'Pending',  cls: 'bg-amber-100 text-amber-700 border-amber-300' },
              { value: 'On Team',  label: 'On Team',  cls: 'bg-blue-100 text-blue-700 border-blue-300' },
              { value: 'Done',     label: 'Done',     cls: 'bg-emerald-100 text-emerald-700 border-emerald-300' },
            ].map(opt => (
              <button
                key={opt.value}
                onClick={() => setFilterStatus(opt.value)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest border-2 transition-all ${
                  filterStatus === opt.value
                    ? opt.cls || 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-50 text-slate-400 border-transparent hover:border-slate-200'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Type + Team selects */}
          <div className="flex gap-3 flex-wrap">
            <div className="flex-1 min-w-[160px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-slate-300 pointer-events-none">Type</span>
              <select
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[11px] font-black uppercase text-slate-700 focus:border-blue-400 transition-all outline-none appearance-none"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
              >
                <option value="">All Types</option>
                <option value="ADD">Add</option>
                <option value="WAIVE">Waive</option>
                <option value="DROP">Drop</option>
                <option value="INJURY PICKUP">Injury Pickup</option>
                <option value="IR MOVE">IR Move</option>
                <option value="TRADE">Trade</option>
              </select>
            </div>
            <div className="flex-1 min-w-[160px] relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[8px] font-black uppercase tracking-widest text-slate-300 pointer-events-none">Team</span>
              <select
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border-2 border-slate-100 rounded-xl text-[11px] font-black uppercase text-slate-700 focus:border-blue-400 transition-all outline-none appearance-none"
                value={filterTeam}
                onChange={(e) => setFilterTeam(e.target.value)}
              >
                <option value="">All Teams</option>
                {teams.map((t, i) => <option key={i} value={t.name}>{t.name}</option>)}
              </select>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] shadow-2xl border border-slate-100">
          <div className="overflow-x-auto max-h-[600px] no-scrollbar">
            <table className="w-full text-left">
              <thead className="bg-slate-900 text-white text-[9px] font-black uppercase tracking-[0.2em] sticky top-0 z-10">
                <tr>
                  <th className="px-6 py-5">Timestamp</th>
                  <th className="px-6 py-5">Operation</th>
                  <th className="px-6 py-5">Details</th>
                  <th className="px-6 py-5">From</th>
                  <th className="px-6 py-5">To</th>
                  <th className="px-6 py-5 text-center">Week</th>
                  <th className="px-6 py-5 text-center">Fee</th>
                  <th className="px-6 py-5 text-center">Status</th>
                  {isCommissioner && <th className="px-6 py-5 text-center"></th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {loadingLogs ? (
                  <tr><td colSpan={isCommissioner ? 9 : 8} className="p-24 text-center text-slate-300 font-black uppercase animate-pulse italic">Synchronizing Records...</td></tr>
                ) : filteredLogs.length === 0 ? (
                  <tr><td colSpan={isCommissioner ? 9 : 8} className="p-24 text-center text-slate-300 italic font-black uppercase">No Recent Records</td></tr>
                ) : filteredLogs.map((log, i) => (
                  <React.Fragment key={i}>
                  <tr className={`text-[11px] hover:bg-slate-50 transition-colors ${log.coach === session?.user?.name ? 'bg-blue-50/30' : ''}`}>
                    <td className="px-6 py-5 font-mono text-slate-400 tabular-nums whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-6 py-5">
                      <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${
                        log.type === 'TRADE' ? 'bg-purple-100 text-purple-700' :
                        log.type === 'WAIVE' || log.type === 'DROP' ? 'bg-red-100 text-red-700' :
                        log.type === 'INJURY PICKUP' ? 'bg-amber-100 text-amber-700' :
                        log.type === 'IR MOVE' ? 'bg-orange-100 text-orange-700' :
                        'bg-blue-100 text-blue-700'
                      }`}>
                        {log.type}
                      </span>
                    </td>
                    <td className="px-6 py-5 font-bold text-slate-800 uppercase tracking-tight leading-snug">
                      {log.details}
                      <p className="text-[9px] font-black text-slate-400 uppercase mt-1 italic tracking-tighter">Coach: {log.coach}</p>
                    </td>
                    <td className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">{log.fromFull || '—'}</td>
                    <td className="px-6 py-5 text-[10px] font-black text-slate-500 uppercase whitespace-nowrap">{log.toFull || '—'}</td>
                    <td className="px-6 py-5 text-center">
                      <span className="font-black text-blue-600 bg-blue-50 px-3 py-1.5 rounded-xl text-xs">{log.weekBack || '—'}</span>
                    </td>
                    <td className="px-6 py-5 text-center">
                      {Number(log.fee) > 0
                        ? <span className="font-black text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-xl text-xs">${log.fee}</span>
                        : <span className="text-slate-300 font-black text-[9px]">—</span>
                      }
                    </td>
                    <td className="px-6 py-5 text-center">
                      {isCommissioner ? (
                        <select
                          value={log.status || ''}
                          disabled={savingStatus === log.id}
                          onChange={(e) => handleStatusChange(log.id, e.target.value)}
                          className={`text-[9px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border-2 outline-none transition-all cursor-pointer disabled:opacity-50 ${
                            STATUS_STYLES[log.status] || 'bg-slate-100 text-slate-500 border-slate-200'
                          } border-transparent focus:border-blue-400`}
                        >
                          <option value="">— Set —</option>
                          <option value="Pending">Pending</option>
                          <option value="On Team">On Team</option>
                          <option value="Done">Done</option>
                        </select>
                      ) : (
                        log.status ? (
                          <span className={`px-3 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest whitespace-nowrap ${STATUS_STYLES[log.status] || 'bg-slate-100 text-slate-500'}`}>
                            {log.status}
                          </span>
                        ) : (
                          <span className="text-slate-300 font-black text-[9px]">—</span>
                        )
                      )}
                    </td>
                    {isCommissioner && (
                      <td className="px-4 py-5 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {log.type === 'TRADE' && (
                            <button
                              onClick={() => openReprocess(log)}
                              className={`transition-colors ${reprocessId === log.id ? 'text-blue-500' : 'text-slate-300 hover:text-blue-500'}`}
                              title="Reprocess pick transfer"
                            >
                              <RefreshCcw size={14} />
                            </button>
                          )}
                          <button
                            onClick={() => handleDelete(log.id)}
                            className="text-slate-300 hover:text-red-500 transition-colors"
                            title="Delete transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                  {isCommissioner && reprocessId === log.id && (
                    <tr className="bg-blue-50/50">
                      <td colSpan={9} className="px-6 py-4">
                        <div className="flex flex-wrap items-end gap-3">
                          <span className="text-[9px] font-black uppercase tracking-widest text-blue-500 mr-2">Push Pick to Transfer Table</span>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Year</label>
                            <input type="number" value={reprocessForm.year}
                              onChange={e => setReprocessForm(f => ({ ...f, year: Number(e.target.value) }))}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold w-20 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">Round</label>
                            <input type="number" min={1} value={reprocessForm.round}
                              onChange={e => setReprocessForm(f => ({ ...f, round: Number(e.target.value) }))}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold w-16 focus:outline-none focus:ring-2 focus:ring-blue-300" />
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">From (Current Owner)</label>
                            <select value={reprocessForm.fromTeam}
                              onChange={e => setReprocessForm(f => ({ ...f, fromTeam: e.target.value }))}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]">
                              <option value="">Select…</option>
                              {teams.map(t => <option key={t.teamshort || t.short} value={t.teamshort || t.short || ''}>{t.name}</option>)}
                            </select>
                          </div>
                          <div className="flex flex-col gap-1">
                            <label className="text-[8px] font-black uppercase text-slate-400 tracking-widest">To (New Owner)</label>
                            <select value={reprocessForm.toTeam}
                              onChange={e => setReprocessForm(f => ({ ...f, toTeam: e.target.value }))}
                              className="px-3 py-1.5 border border-slate-200 rounded-lg text-sm font-bold focus:outline-none focus:ring-2 focus:ring-blue-300 min-w-[140px]">
                              <option value="">Select…</option>
                              {teams.map(t => <option key={t.teamshort || t.short} value={t.teamshort || t.short || ''}>{t.name}</option>)}
                            </select>
                          </div>
                          <button onClick={handleReprocess} disabled={reprocessSaving || !reprocessForm.fromTeam || !reprocessForm.toTeam}
                            className="px-4 py-1.5 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors">
                            {reprocessSaving ? 'Saving…' : 'Push Transfer'}
                          </button>
                          <button onClick={() => setReprocessId(null)}
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-600 transition-colors px-2">
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* FA SPEND REPORT */}
        <div className="bg-white rounded-[2.5rem] shadow-xl border border-slate-100 overflow-hidden">
          <button
            onClick={() => setShowSpend(s => !s)}
            className="w-full flex items-center justify-between px-8 py-5 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="bg-emerald-100 p-2 rounded-xl text-emerald-600"><DollarSign size={18} /></div>
              <span className="text-sm font-black uppercase tracking-widest text-slate-700">FA Spend Report</span>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{showSpend ? 'Hide' : 'Show'}</span>
          </button>
          {showSpend && (
            <div className="px-8 pb-8 space-y-6">
              {/* Filters */}
              <div className="flex flex-wrap items-center gap-4">
                {availableSpendSeasons.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Season</span>
                    <select value={spendSeason} onChange={e => setSpendSeason(e.target.value)}
                      className="bg-white border border-slate-200 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm cursor-pointer">
                      <option value="">All Seasons</option>
                      {availableSpendSeasons.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">From</span>
                  <input type="date" value={spendFrom} onChange={e => setSpendFrom(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm" />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">To</span>
                  <input type="date" value={spendTo} onChange={e => setSpendTo(e.target.value)}
                    className="bg-white border border-slate-200 rounded-lg text-xs font-bold p-2 outline-none focus:ring-2 focus:ring-emerald-400 shadow-sm" />
                </div>
                {(spendSeason || spendFrom || spendTo) && (
                  <button onClick={() => { setSpendSeason(''); setSpendFrom(''); setSpendTo(''); }}
                    className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-red-500 transition-colors">
                    Clear
                  </button>
                )}
                {spendReport.length > 0 && (
                  <span className="ml-auto text-xs font-black text-emerald-600">
                    League Total: ${spendReport.reduce((s, [, v]) => s + v, 0)}
                  </span>
                )}
              </div>
              {spendReport.length === 0 ? (
                <p className="text-center text-slate-300 font-black uppercase italic text-sm py-8">No FA spend data for selected range</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
                  {spendReport.map(([team, amount]) => (
                    <div key={team} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center text-center">
                      <span className="text-[10px] font-black uppercase italic tracking-tighter text-slate-700 leading-tight mb-2">{team}</span>
                      <span className="text-lg font-black text-emerald-600">${amount}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
