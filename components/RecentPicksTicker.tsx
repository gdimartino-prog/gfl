'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { Zap } from 'lucide-react';

interface Pick {
  overall: string | number;
  draftedPlayer: string;
  currentOwner: string;
  status: string;
}

interface Team {
  name: string;
  short: string;
}

interface TickerProps {
  picks: Pick[];
  teams: Team[];
}

export default function RecentPicksTicker({ picks, teams }: TickerProps) {

  if (typeof window !== 'undefined') {
    console.log("✅ TICKER VERSION: Jan 28 - V1.2 (Separate Ticker State)");
  }

  const [mounted, setMounted] = useState(false);

  // 🚀 Step 1: Prevent Hydration Mismatch
  // This ensures the component only renders once the browser is ready.
  useEffect(() => {
    const handle = requestAnimationFrame(() => {
      setMounted(true);
    });
    return () => cancelAnimationFrame(handle);
  }, []);

  const getFullTeamName = (shortCode: string) => {
    if (!shortCode) return "Unknown";
    const cleanCode = shortCode.match(/\(([^)]+)\)/)?.[1] || shortCode.trim().toUpperCase();
    const team = teams.find(t => t.short.includes(cleanCode) || cleanCode.includes(t.short));
    return team ? team.name : shortCode;
  };

  const completedPicks = useMemo(() => {
    if (!picks || !Array.isArray(picks)) return [];
    return [...picks]
      .filter(p => p.status === 'Completed' || (p.draftedPlayer && p.draftedPlayer.trim() !== ''))
      .sort((a, b) => Number(b.overall) - Number(a.overall))
      .slice(0, 10); 
  }, [picks]);

  // If not mounted yet, return null (prevents invisible flash in production)
  if (!mounted) return null;

  // 🚀 Step 2: Show a placeholder if no data is found
  // If you see this in production, the CSS is working, but the API data is empty.
  if (completedPicks.length === 0) {
    return (
      <div className="w-full bg-slate-900 border-y border-white/10 py-4 overflow-hidden relative">
        <div className="flex items-center justify-center gap-4 text-slate-500 font-black uppercase text-[10px] tracking-[0.3em]">
          <Zap size={14} className="opacity-20" />
          <span>Season {new Date().getFullYear()} Draft — No Picks Yet</span>
          <Zap size={14} className="opacity-20" />
        </div>
      </div>
    );
  }

  const renderPicks = () => (
    <>
      {completedPicks.map((p, i) => (
        <div key={`${p.overall}-${i}`} className="flex items-center gap-6 shrink-0">
          <div className="flex flex-col items-center justify-center border-r border-slate-700 pr-6">
             <span className="text-[10px] font-black text-blue-500 leading-none">PICK</span>
             <span className="text-xl font-black text-white italic leading-none">#{p.overall}</span>
          </div>
          <div className="flex flex-col pr-10">
            <span className="text-white font-black uppercase italic text-base tracking-tight leading-none">
              {p.draftedPlayer}
            </span>
            <span className="text-yellow-400 font-bold uppercase text-[10px] tracking-widest mt-1">
              {getFullTeamName(p.currentOwner)}
            </span>
          </div>
        </div>
      ))}
    </>
  );

  return (
    <div className="w-full bg-slate-900 border-y border-white/10 py-4 overflow-hidden shadow-2xl relative">
      <div className="absolute left-0 top-0 bottom-0 px-6 bg-slate-900 z-20 flex items-center shadow-[15px_0_20px_rgba(15,23,42,0.9)] border-r border-white/5">
        <div className="flex items-center gap-2 text-yellow-400 font-black uppercase italic text-xs tracking-widest">
          <Zap size={16} fill="currentColor" className="animate-pulse" />
          <span>Live Updates</span>
        </div>
      </div>

      <div className="flex whitespace-nowrap overflow-hidden">
        {/* The classes below match the Tailwind v4 @theme configuration */}
        <div className="flex animate-marquee items-center gap-12 shrink-0">
          {renderPicks()}
        </div>
        <div className="flex animate-marquee items-center gap-12 shrink-0">
          {renderPicks()}
        </div>
      </div>
    </div>
  );
}