import { getHistory } from '@/lib/getHistory';
import SummaryTable from '@/components/SummaryTable';
import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { getLeagueId } from '@/lib/getLeagueId';
import { db } from '@/lib/db';
import { rules, leagues } from '@/schema';
import { and, eq } from 'drizzle-orm';

export const revalidate = 3600;

export default async function SummaryReportPage() {
  const leagueId = await getLeagueId();
  const [allData, leagueRows, seasonRows] = await Promise.all([
    getHistory(leagueId),
    db.select({ name: leagues.name }).from(leagues).where(eq(leagues.id, leagueId)).limit(1),
    db.select({ value: rules.value }).from(rules).where(and(eq(rules.rule, 'cuts_year'), eq(rules.leagueId, leagueId))).limit(1),
  ]);
  const leagueName = leagueRows[0]?.name ?? 'League';
  const season = seasonRows[0]?.value ?? '';

  // Sort data by year ascending so the most recent team name is captured last
  const sortedData = [...allData].sort((a, b) => Number(a.year) - Number(b.year));

  interface TeamSummary {
    [key: string]: string | number;
    gm: string;
    team: string;
    allTeams: string;
    wins: number;
    losses: number;
    ties: number;
    winPct: number;
    seasons: number;
    offPts: number;
    defPts: number;
    divWins: number;
    postSeason: number;
    superBowls: number;
    championships: number;
  }

  // Aggregate raw rows into coach/GM summaries
  const summaryMap: Record<string, TeamSummary> = {};
  const teamNamesTracker: Record<string, Set<string>> = {};

  sortedData.forEach((row) => {
    const gmKey = (row.gm && row.gm !== 'N/A' && row.gm.toLowerCase() !== 'manager') ? row.gm : null;
    if (!gmKey) return;

    if (!summaryMap[gmKey]) {
      summaryMap[gmKey] = {
        gm: gmKey,
        team: '',
        allTeams: '',
        wins: 0,
        losses: 0,
        ties: 0,
        winPct: 0,
        seasons: 0,
        offPts: 0,
        defPts: 0,
        divWins: 0,
        postSeason: 0,
        superBowls: 0,
        championships: 0,
      };
      teamNamesTracker[gmKey] = new Set<string>();
    }

    const t = summaryMap[gmKey];
    const cleanTeam = row.team.replace(/^[a-z*]-/i, '');
    teamNamesTracker[gmKey].add(cleanTeam);
    t.team = cleanTeam; // last write (year asc) = most recent team name

    t.seasons += 1;
    t.wins += Number(row.won || 0);
    t.losses += Number(row.lost || 0);
    t.ties += Number(row.tie || 0);
    t.offPts += Number(row.offPts || 0);
    t.defPts += Number(row.defPts || 0);

    if (row.isDivWinner) t.divWins += 1;
    if (row.isPlayoff) t.postSeason += 1;
    if (row.isSuperBowl) t.superBowls += 1;
    if (row.isChampion) t.championships += 1;
  });

  // Build allTeams string for each coach
  Object.keys(summaryMap).forEach(gmKey => {
    summaryMap[gmKey].allTeams = Array.from(teamNamesTracker[gmKey]).join(' / ');
  });

  const summaryData = Object.values(summaryMap).map(t => {
    const totalGames = t.wins + t.losses + t.ties;
    t.winPct = totalGames > 0 ? Number(((t.wins + (0.5 * t.ties)) / totalGames).toFixed(3)) : 0;
    return t;
  });

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            FRANCHISE <span className="text-blue-600">LEADERBOARD</span>
          </h1>
          <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic mt-3 flex items-center gap-2">
            <Trophy size={14} className="text-blue-500" /> {leagueName} All-Time Records{season ? ` • Through Season ${season}` : ''}
          </p>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl border border-slate-200">
          <Link href="/standings" className="px-6 py-2 text-slate-500 hover:text-slate-900 text-sm font-black uppercase tracking-tight transition-colors">
            Yearly View
          </Link>
          <Link href="/standings/summary" className="px-6 py-2 bg-white text-blue-600 shadow-sm rounded-lg text-sm font-black uppercase tracking-tight">
            All-Time Leaderboard
          </Link>
        </div>
      </header>

      <SummaryTable initialData={summaryData} />
    </div>
  );
}