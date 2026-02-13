'use client';

import React, { useState } from 'react';
import { Player } from '../types';

interface PlayerCardProps {
  data: Player;
  onClose: () => void;
}

const PlayerCard: React.FC<PlayerCardProps> = ({ data, onClose }) => {
  const [showDebug] = useState(false);
  if (!data) return null;

  // 1. POSITION & ROLE DETECTION
  const posOff = data.core?.pos?.off?.toUpperCase() || "";
  const posDef = data.core?.pos?.def?.toUpperCase() || "";
  const posSpec = data.core?.pos?.spec?.toUpperCase() || "";

  const isQB = posOff === 'QB';
  const isOL = ['C', 'G', 'T', 'OL'].includes(posOff);
  const isSkill = ['WR', 'TE', 'RB', 'HB', 'FB'].includes(posOff);
  const isDef = posDef !== "";

  // 2. THE STAT MAPPING ENGINE
  const getStatValue = (label: string): string => {
    const key = label.toLowerCase().trim();
    let val: string | number | null | undefined = null;

    // --- RATINGS & SHARED ---
    if (key === 'salary') val = data.contract?.salary;
    else if (key === 'games') val = data.stats?.games;
    else if (key === 'durability') val = data.ratings?.durability;
    else if (key === 'run block') val = data.ratings?.run_block;
    else if (key === 'pass block') val = data.ratings?.pass_block;
    else if (key === 'total defense') val = data.ratings?.total_def;
    else if (key === 'run defense') val = data.ratings?.run_def;
    else if (key === 'pass defense') val = data.ratings?.pass_def;
    else if (key === 'pass rush') val = data.ratings?.pass_rush;

    // --- QB STATS (Passing) ---
    else if (isQB) {
      const p = data.stats?.passing || {};
      if (key === 'pass attempts') val = p.att;
      else if (key === 'completions') val = p.comp;
      else if (key === 'pass yards') val = p.yds;
      else if (key === 'pass interceptions') val = p.int;
      else if (key === 'pass td') val = p.td;
      else if (key === 'pass times sacked') val = data.stats?.defense?.sacks;
    }

    // --- SKILL STATS (Rushing & Receiving) ---
    else if (isSkill) {
      const rush = data.stats?.rushing || {};
      const rec = data.stats?.receiving || {};
      
      if (key === 'rush attempts') val = rush.att;
      else if (key === 'rush yards') val = rush.yds;
      else if (key === 'rush long') val = rush.long;
      else if (key === 'rush td') val = rush.td;
      else if (key === 'receptions') val = rec.receptions;
      else if (key === 'receiving yards') val = rec.yds;
      else if (key === 'receiving long') val = rec.long;
      else if (key === 'receiving td') val = rec.td;
    }

    // --- FORMATTING ---
    if (val === null || val === undefined || val === "") val = '0';
    if (key === 'salary' && !String(val).startsWith('$') && val !== 'N/A') return `$${val}`;
    return String(val);
  };

  // 3. DISPLAY ORDER
  let displayKeys: string[] = [];
  if (isOL) {
    displayKeys = ['run block', 'pass block', 'games', 'durability', 'salary'];
  } else if (isDef) {
    displayKeys = ['total defense', 'run defense', 'pass defense', 'pass rush', 'games', 'durability', 'salary'];
  } else if (isQB) {
    displayKeys = ['pass attempts', 'completions', 'pass yards', 'pass td', 'pass interceptions', 'run block', 'pass block', 'games', 'durability', 'salary'];
  } else if (isSkill) {
    displayKeys = ['receptions', 'receiving yards', 'receiving td', 'rush attempts', 'rush yards', 'rush td', 'run block', 'pass block', 'games', 'durability', 'salary'];
  } else {
    displayKeys = ['games', 'durability', 'salary'];
  }

  return (
    /* 🚀 FIX: Increased z-index to 200 and backdrop blur to xl */
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-950/95 backdrop-blur-xl">
      <div className="bg-[#020617] w-full max-w-6xl rounded-[2.5rem] border-2 border-slate-700 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        
        {/* Header Section */}
        <div className="p-8 bg-slate-900 border-b border-slate-700 flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center gap-2 mb-2">
              {posOff && <PositionBadge label={posOff} type="off" />}
              {posDef && <PositionBadge label={posDef} type="def" />}
              {posSpec && <PositionBadge label={posSpec} type="spec" />}
              <span className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em] ml-2">
                {data.core?.team || 'FA'} • AGE {data.core?.age || '??'}
              </span>
            </div>
            <h2 className="text-5xl font-black italic uppercase text-white tracking-tighter leading-none">
              {data.core?.first} <span className="text-blue-400">{data.core?.last}</span>
            </h2>
          </div>
          <div className="flex gap-3">
            <button onClick={onClose} className="p-4 bg-slate-800 hover:bg-red-500 rounded-full text-white transition-all border border-slate-600 text-2xl leading-none">
              &times;
            </button>
          </div>
        </div>

        {/* Stats Content Area */}
        <div className="flex-1 overflow-y-auto p-8 bg-slate-950 custom-scrollbar">
          {showDebug ? (
            <pre className="text-blue-400 text-xs font-mono bg-black p-6 rounded-3xl border border-blue-500/30 overflow-x-auto">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
              {displayKeys.map((key) => (
                <div key={key} className="bg-slate-900 border border-slate-800 p-5 rounded-3xl flex flex-col border-b-4 border-b-emerald-500/20 hover:border-b-emerald-500/50 transition-all">
                  <span className="text-slate-500 text-[9px] font-black uppercase mb-2 tracking-wider">{key}</span>
                  <span className="text-emerald-400 text-3xl font-black italic tabular-nums leading-none">
                    {getStatValue(key)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer Action */}
        <div className="p-8 bg-slate-900 border-t border-slate-700 shrink-0">
           <button onClick={onClose} className="w-full py-5 bg-blue-600 hover:bg-blue-500 text-white font-black uppercase text-xs tracking-[0.4em] rounded-2xl shadow-xl active:scale-95 transition-transform">
             Finish Evaluation
           </button>
        </div>
      </div>
    </div>
  );
};

function PositionBadge({ label, type }: { label: string, type: 'off' | 'def' | 'spec' }) {
  const colors = { off: 'bg-blue-600', def: 'bg-red-600', spec: 'bg-amber-500 text-slate-900' };
  return (
    <span className={`${colors[type]} text-white text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-widest`}>
      {label}
    </span>
  );
}

export default PlayerCard;