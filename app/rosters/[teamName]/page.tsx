import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Player, Team, DraftPick } from '../../../types';

interface PageProps {
  params: Promise<{ teamName: string }>;
}

export default async function TeamDetailPage({ params }: PageProps) {
  // 1. Resolve team identifier from URL
  const resolvedParams = await params;
  const teamShort = decodeURIComponent(resolvedParams.teamName).toUpperCase();

  try {
    // 2. Fetch fresh data from Google Sheets
    const [playersRes, picksRes, teamsRes] = await Promise.all([
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'Players!A:CV' // Fetch full range to ensure headers map correctly
      }),
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'DraftPicks!A:G' 
      }),
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'Teams!A:C' 
      })
    ]);

    const rawPlayerRows = playersRes.data.values || [];
    const rawPickRows = picksRes.data.values || [];
    const rawTeamRows = teamsRes.data.values || [];

    // 3. Use your standardized parser to generate identities
    const allPlayers = parsePlayers(rawPlayerRows);
    
    // 4. Filter for the specific team
    const teamRoster = allPlayers.filter(p => 
      p.team?.toUpperCase() === teamShort || 
      p.team?.toUpperCase() === `${teamShort}-IR`
    );

    const teamPicks = rawPickRows
      .filter(row => row[4]?.toUpperCase() === teamShort)
      .map(row => ({
        year: row[0],
        round: row[1],
        overall: row[2],
        original: row[3]
      }));
      
    const teamInfo = rawTeamRows.find(row => row[1]?.toUpperCase() === teamShort);
    const coachName = teamInfo ? teamInfo[2] : 'Unknown Coach';

    if (teamRoster.length === 0 && teamPicks.length === 0) return notFound();

    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12 text-black">
        {/* TEAM HEADER */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter">{teamShort}</h1>
          <p className="text-blue-400 font-bold tracking-widest uppercase mt-2">Franchise Personnel File • Coach: {coachName}</p>
          <div className="absolute top-0 right-0 p-8 opacity-10">
             <span className="text-9xl font-black italic">{teamShort}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* ROSTER TABLE */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden h-fit">
            <div className="px-8 py-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                <h2 className="font-black uppercase tracking-tighter text-xl">Active Roster</h2>
                <span className="text-[10px] font-bold px-2 py-1 bg-blue-100 text-blue-700 rounded-md">
                    {teamRoster.length} Players
                </span>
            </div>
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100">
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Pos</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                  <th className="px-8 py-4 text-right"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {teamRoster.map((p: Player, i) => (
                  <tr key={i} className="hover:bg-blue-50/50 transition-colors group">
                    <td className="px-8 py-5 font-mono font-black text-blue-600">
                      {p.pos || p.position}
                    </td>
                    <td className="px-8 py-5">
                      <p className="font-bold text-slate-800 uppercase leading-none">{p.first} {p.last}</p>
                      <p className="text-[10px] text-slate-400 font-bold mt-1 uppercase tracking-tighter">Age: {p.core?.age || p.age}</p>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {/* CRITICAL: encodeURIComponent handles spaces in names like "Austin III" */}
                      <Link 
                        href={`/roster/${encodeURIComponent(p.identity)}`}
                        className="opacity-0 group-hover:opacity-100 bg-slate-900 text-white text-[10px] font-black px-4 py-2 rounded-full uppercase tracking-widest transition-all hover:scale-105 inline-block"
                      >
                        Scout Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DRAFT CAPITAL */}
          <div className="bg-slate-900 rounded-[2rem] p-8 text-white h-fit shadow-xl border border-slate-800">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 text-left">Future Assets</h3>
            <div className="space-y-4">
              {teamPicks.length > 0 ? teamPicks.map((pick, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700 hover:border-blue-500 transition-colors">
                  <div className="bg-blue-600 px-3 py-1 rounded font-black italic min-w-[3rem] text-center">R{pick.round}</div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{pick.year} Draft Pick</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-tighter">
                        Original: {pick.original || 'Own'}
                    </p>
                  </div>
                </div>
              )) : (
                <p className="text-slate-500 italic text-sm text-center py-4">No draft picks found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (e) {
    console.error("Roster Page Error:", e);
    return (
      <div className="min-h-screen flex items-center justify-center p-6 text-center">
        <div className="space-y-4">
            <h1 className="text-4xl font-black uppercase italic text-slate-900">Communication Error</h1>
            <p className="text-slate-500 font-medium">Unable to connect to the league database. Please check your network.</p>
        </div>
      </div>
    );
  }
}