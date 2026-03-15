import { getStandings } from '@/lib/getStandings';
import { getSchedule } from '@/lib/getSchedule';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { rules, leagues } from '@/schema';
import { eq, inArray } from 'drizzle-orm';
import StandingsClient from '@/components/StandingsClient';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { StandingRow, ScheduleGame } from '@/types';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  let allData: StandingRow[] = [];
  let allGames: ScheduleGame[] = [];
  let totalGames = 14;
  let playoffTeams = 8;
  let cutsYear = "";

  let leagueName = 'League';
  try {
    const leagueId = await getLeagueId();

    const [historyData, scheduleData, ruleRows, leagueRows] = await Promise.all([
      getStandings(leagueId),
      getSchedule(leagueId),
      db.select({ rule: rules.rule, value: rules.value })
        .from(rules)
        .where(inArray(rules.rule, ['season_games', 'playoff_teams', 'cuts_year']))
        .then(rs => Object.fromEntries(rs.map(r => [r.rule, r.value]))),
      db.select({ name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId)).limit(1),
    ]);

    const rawData = Array.isArray(historyData) ? historyData : [];
    // Rows with null year are assigned to the current season
    allData = rawData.map(r => ({
      ...r,
      year: r.year ?? (ruleRows['cuts_year'] ? Number(ruleRows['cuts_year']) : r.year),
    }));
    allGames = scheduleData as ScheduleGame[];
    leagueName = leagueRows[0]?.name ?? 'League';

    if (ruleRows['season_games']) totalGames = parseInt(ruleRows['season_games']);
    if (ruleRows['playoff_teams']) playoffTeams = parseInt(ruleRows['playoff_teams']);
    if (ruleRows['cuts_year']) cutsYear = ruleRows['cuts_year'];
  } catch (err) {
    console.error("Standings Page Data Fetch Error:", err);
  }

  // 1. Sort data so newest years are first
  const sortedData = [...allData].sort((a, b) => Number(b.year || 0) - Number(a.year || 0));

  // 🚀 GM RECOVERY: Build a map of the most recent GM for each team to handle 
  // cases where clinching prefixes (x-, y-) cause missing data in the sheet.
  const gmMap: Record<string, string> = {};
  sortedData.forEach(r => {
    const cleanName = r.team.replace(/^[a-z*]-/i, '');
    if (r.gm && r.gm !== 'N/A' && r.gm.toLowerCase() !== 'manager' && !gmMap[cleanName]) {
      gmMap[cleanName] = r.gm;
    }
  });

  const enrichedData = sortedData.map(r => ({
    ...r,
    gm: (!r.gm || r.gm === 'N/A' || r.gm.toLowerCase() === 'manager') ? (gmMap[r.team.replace(/^[a-z*]-/i, '')] || 'Unknown Manager') : r.gm
  }));

  // 2. Dynamically find the most recent year in your spreadsheet
  const latestYear = cutsYear || (enrichedData.length > 0 ? (enrichedData[0].year?.toString() || "2025") : "2025");

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            League <span className="text-blue-600">Standings</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
            <BarChart3 size={14} className="text-blue-500" /> {leagueName} Official Records • Season {latestYear}
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200 self-start md:self-auto">
          <Link 
            href="/standings" 
            className="px-6 py-2 bg-white text-blue-600 shadow-sm rounded-lg text-sm font-black uppercase tracking-tight"
          >
            Yearly View
          </Link>
          <Link 
            href="/standings/summary" 
            className="px-6 py-2 text-slate-500 hover:text-slate-900 transition-colors text-sm font-black uppercase tracking-tight"
          >
            All-Time Leaderboard
          </Link>
        </div>
      </header>
      
      {/* Pass the dynamic latestYear instead of hardcoded "2024" */}
      <StandingsClient allData={enrichedData} allGames={allGames} currentYear={latestYear} totalGames={totalGames} playoffTeams={playoffTeams} />
    </div>
  );
}