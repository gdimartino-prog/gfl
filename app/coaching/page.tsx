import CoachingTerminal from '@/components/CoachingTerminal';
import { auth } from "@/auth";
import { ShieldCheck, Lock, ArrowRight, Info } from 'lucide-react';
import Link from 'next/link';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { rules } from '@/schema';
import { and, eq } from 'drizzle-orm';

export default async function CoachingPage() {
  const session = await auth();
  const teamName = (session?.user as { team?: string })?.team || session?.user?.name;
  const isAuthenticated = !!session;

  const leagueId = await getLeagueId();
  const seasonRows = await db.select({ value: rules.value }).from(rules)
    .where(and(eq(rules.rule, 'cuts_year'), eq(rules.leagueId, leagueId))).limit(1);
  const season = seasonRows[0]?.value ?? '';

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-10 bg-gray-50 min-h-screen text-left">
      <header className="border-b border-slate-200 pb-8">
        <h1 className="text-6xl font-black italic uppercase tracking-tighter text-slate-900 leading-none">
          Coaching <span className="text-blue-600">Hub</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
          <ShieldCheck size={14} className="text-blue-500" /> Secure Terminal • Action! PC Football Logistics{season ? ` • Season ${season}` : ''}
        </p>
      </header>

      <div className="bg-blue-50 border border-blue-100 p-6 rounded-[2rem] flex items-start gap-4 shadow-sm">
        <div className="bg-blue-600 p-2 rounded-lg shrink-0">
          <Info className="text-white" size={18} />
        </div>
        <div>
          <h4 className="text-sm font-black text-blue-900 uppercase italic">Gameday Sync Instructions</h4>
          <p className="text-xs text-blue-700 font-bold mt-1 leading-relaxed">
            Upload your <code className="bg-blue-100 px-1 rounded font-black">.COA</code> coach file. 
            The file will be saved as <span className="font-black italic underline">{teamName?.replace(/\s+/g, '_')}.COA</span> to match Action! PC requirements.
          </p>
        </div>
      </div>

      {!isAuthenticated ? (
        <div className="bg-white rounded-[2.5rem] p-12 shadow-xl border border-slate-200 text-center max-w-2xl mx-auto my-20">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Lock className="text-slate-400" size={32} />
          </div>
          <h2 className="text-3xl font-black uppercase italic tracking-tighter text-slate-900">Restricted Access</h2>
          <p className="text-slate-500 font-bold text-sm mt-4 mb-8 leading-relaxed">
            You must be an authenticated GFL Coach to upload gameday rosters.
          </p>
          <Link 
            href="/login" 
            className="inline-flex items-center gap-3 bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase text-[11px] tracking-widest hover:bg-slate-900 transition-all shadow-xl shadow-blue-500/20"
          >
            Coach Login <ArrowRight size={16} />
          </Link>
        </div>
      ) : (
        /* LOGGED IN - The teamName passed here will define the filename */
        <CoachingTerminal teamName={teamName || "Unknown_Team"} />
      )}
    </div>
  );
}