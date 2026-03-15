'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSession } from "next-auth/react";
import { Newspaper } from 'lucide-react';
import PressBoxClient from '@/components/PressBoxClient';

export default function PressBoxPage() {
  const { data: session } = useSession({ required: true });
  const [season, setSeason] = useState('');

  useEffect(() => {
    fetch('/api/rules').then(r => r.json()).then((rules: { setting: string; value: string }[]) => {
      if (!Array.isArray(rules)) return;
      const yr = rules.find(r => r.setting === 'cuts_year')?.value;
      if (yr) setSeason(yr);
    }).catch(() => {});
  }, []);

  if (!session) {
    return (
      <div className="max-w-7xl mx-auto p-8">
        <div className="animate-pulse text-center py-20">
          <p className="text-slate-400 font-black uppercase italic">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 text-center md:text-left">
        <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">Press Box</h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
          <Newspaper size={14} className="text-blue-500" /> Game Analysis Terminal • Upload & Generate Summary{season ? ` • Season ${season}` : ''}
        </p>
      </header>

      <Suspense fallback={<div className="animate-pulse text-center py-20"><p className="text-slate-400 font-black uppercase italic">Loading Press Box...</p></div>}>
        <PressBoxClient />
      </Suspense>
    </div>
  );
}
