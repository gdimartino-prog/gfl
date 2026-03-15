import { getSchedule } from '@/lib/getSchedule';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { leagues, rules } from '@/schema';
import { and, eq } from 'drizzle-orm';
import { CalendarDays } from 'lucide-react';
import ScheduleClient from '@/components/ScheduleClient';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const leagueId = await getLeagueId();
  const [leagueRows, seasonRows] = await Promise.all([
    db.select({ name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId)).limit(1),
    db.select({ value: rules.value }).from(rules).where(and(eq(rules.rule, 'cuts_year'), eq(rules.leagueId, leagueId))).limit(1),
  ]);
  const leagueName = leagueRows[0]?.name ?? 'League';
  const season = seasonRows[0]?.value ?? '';

  // Fetch all years — ScheduleClient handles year selection client-side
  const games = await getSchedule(leagueId, null);
  const currentSeason = season ? Number(season) : null;
  // Games with null year are assigned to the current season
  const processedGames = games.map(g => ({
    ...g,
    year: g.year ?? currentSeason,
  }));
  const weekOrder = (w: string) => { const n = parseInt(w); return isNaN(n) ? 999 : n; };
  const sortedGames = processedGames.sort((a, b) => weekOrder(String(a.week)) - weekOrder(String(b.week)));

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-8 min-h-screen bg-[#f8fafc]">
      <header className="mb-10 space-y-2">
        <h1 className="text-6xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
          League <span className="text-blue-600">Schedule</span>
        </h1>
        <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
          <CalendarDays size={14} className="text-blue-500" /> {leagueName} Official Matchups & Results{season ? ` • Season ${season}` : ''}
        </p>
      </header>

      <ScheduleClient initialGames={sortedGames} />
    </div>
  );
}