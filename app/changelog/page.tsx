import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, Sparkles } from 'lucide-react';
import ChangelogViewer from '@/components/ChangelogViewer';
import { formatChangelogDate, getChangelogEntries } from '@/lib/changelog';

export const metadata: Metadata = {
  title: "What's New | League Manager",
  description: 'Plain-English log of recent app features, fixes, and improvements.',
};

export default function ChangelogPage() {
  const entries = getChangelogEntries();
  const latestDate = entries[0] ? formatChangelogDate(entries[0].date) : '—';

  return (
    <div className="max-w-5xl mx-auto p-6 md:p-12 min-h-screen bg-gray-50">
      {/* TOP NAVIGATION */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-8">
        <Link
          href="/"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-xs transition-all"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          Back to Front Office
        </Link>

        <Link
          href="/manual"
          className="inline-flex items-center gap-2 min-h-[44px] px-4 py-2 rounded-xl bg-white border border-slate-200 text-xs font-black uppercase tracking-wider text-slate-700 hover:text-blue-600 hover:border-blue-300 shadow-xs transition-all"
        >
          User Manual
          <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>

      {/* HERO HEADER */}
      <header className="bg-white p-8 md:p-12 rounded-3xl shadow-sm border border-slate-200 mb-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 text-blue-600 mb-3">
              <Sparkles size={16} aria-hidden="true" />
              <span className="text-xs font-black uppercase tracking-widest">
                Production Release Log
              </span>
            </div>
            <h1 className="text-4xl md:text-5xl font-black text-slate-900 tracking-tighter uppercase italic leading-none">
              WHAT&apos;S <span className="text-blue-600">NEW</span>
            </h1>
            <p className="text-sm font-bold text-slate-600 mt-3">
              Plain-English release notes for coaches and commissioners
            </p>
          </div>

          <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-full">
            <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
            <span className="text-xs font-black uppercase tracking-wider text-slate-700">
              {entries.length} Updates · Last updated {latestDate}
            </span>
          </div>
        </div>
      </header>

      <ChangelogViewer entries={entries} />
    </div>
  );
}
