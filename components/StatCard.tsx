'use client';

import React from 'react';

interface GroupStats {
  avgAge: string | number;
  posMap: Record<string, number>;
  count: number;
}

export default function StatCard({ title, stats, color, border, icon }: { title: string, stats: GroupStats, color: string, border: string, icon: React.ReactNode }) {
  const count = stats?.count ?? 0;
  const avgAge = stats?.avgAge ?? '0';
  const posMap = stats?.posMap ?? {};

  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border-t-[12px] ${border} shadow-lg space-y-6 text-left`}>
      <div className="flex justify-between items-start">
        <div className="space-y-1">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{title}</p>
          <div className={`${color} opacity-20`}>{icon}</div>
        </div>
        <div className="text-right">
          <p className={`text-6xl font-black italic tracking-tighter leading-none ${color}`}>{count}</p>
          <p className="text-[9px] font-black text-slate-400 uppercase mt-2 tracking-widest italic">Avg Age: {avgAge}</p>
        </div>
      </div>
      <div className="pt-4 border-t border-slate-50 flex flex-wrap gap-2">
        {Object.entries(posMap).sort(([posA], [posB]) => posA.localeCompare(posB)).map(([pos, val]) => (
          <span key={pos} className="bg-slate-50 text-slate-500 px-3 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-tighter border border-slate-100">{pos} {val}</span>
        ))}
      </div>
    </div>
  );
}
