import { getHistory } from '@/lib/getHistory';
import { sheets, SHEET_ID } from '@/lib/googleSheets';
import StandingsClient from '@/components/StandingsClient';
import Link from 'next/link';
import { StandingRow } from '@/types';

export const dynamic = 'force-dynamic';

export default async function StandingsPage() {
  let allData: StandingRow[] = [];
  let totalGames = 14;

  try {
    allData = await getHistory();
    if (!Array.isArray(allData)) allData = [];

    // 🚀 DIRECT DATA ACCESS: Instead of fetching from our own API (which fails in SSR),
    // we query Google Sheets directly using our server-side utility.
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Rules!A:B',
    });

    const rows = response.data.values || [];
    // Find the 'season_games' setting in Column A and get value from Column B
    const seasonGamesRule = rows.find(row => row[0] === 'season_games');
    if (seasonGamesRule?.[1]) totalGames = parseInt(seasonGamesRule[1]);
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
  const latestYear = enrichedData.length > 0 ? (enrichedData[0].year?.toString() || "2025") : "2025";

  return (
    <div className="max-w-7xl mx-auto p-8">
      <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <h1 className="text-5xl font-black uppercase italic tracking-tighter text-slate-900 leading-none">
            League <span className="text-blue-600">Standings</span>
          </h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.3em] mt-3">
            GFL Manager Official Records
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
      <StandingsClient allData={enrichedData} currentYear={latestYear} totalGames={totalGames} />
    </div>
  );
}