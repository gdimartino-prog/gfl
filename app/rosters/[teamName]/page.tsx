import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { notFound } from 'next/navigation';

interface PageProps {
  params: Promise<{ teamName: string }>;
}

export default async function TeamDetailPage({ params }: PageProps) {
  // 1. Await params for Next.js 15
  const resolvedParams = await params;
  const teamShort = decodeURIComponent(resolvedParams.teamName).toUpperCase();

  try {
    // 2. Fetch all data using your existing sheets service
    const [playersRes, picksRes] = await Promise.all([
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'Players!A:I' 
      }),
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'DraftPicks!A:G' 
      })
    ]);

    const allPlayers = playersRes.data.values || [];
    const allPicks = picksRes.data.values || [];

    // 3. Filter and Map Data
    const teamRoster = allPlayers
      .filter(row => row[0]?.toUpperCase() === teamShort)
      .map(row => ({
        name: `${row[2]} ${row[3]}`,
        age: row[5] || '0',
        pos: (row[6] || row[7] || row[8] || '??').toUpperCase(),
      }));

    const teamPicks = allPicks
      .filter(row => row[4]?.toUpperCase() === teamShort)
      .map(row => ({
        year: row[0],
        round: row[1],
        overall: row[2],
        original: row[3]
      }));

    if (teamRoster.length === 0) return notFound();

    return (
      <div className="max-w-7xl mx-auto px-6 py-12 space-y-12">
        {/* TEAM HEADER */}
        <div className="bg-slate-900 rounded-[3rem] p-12 text-white shadow-2xl relative overflow-hidden">
          <h1 className="text-6xl font-black italic uppercase tracking-tighter">{teamShort}</h1>
          <p className="text-blue-400 font-bold tracking-widest uppercase mt-2">Franchise Personnel File</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          {/* ROSTER TABLE */}
          <div className="lg:col-span-2 bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Pos</th>
                  <th className="px-8 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Player</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {teamRoster.map((p, i) => (
                  <tr key={i} className="hover:bg-blue-50/50">
                    <td className="px-8 py-4 font-mono font-black text-blue-600">{p.pos}</td>
                    <td className="px-8 py-4 font-bold text-slate-800 uppercase">{p.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* DRAFT CAPITAL */}
          <div className="bg-slate-900 rounded-[2rem] p-8 text-white h-fit">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-500 mb-6 text-left">Draft Assets</h3>
            <div className="space-y-4">
              {teamPicks.map((pick, i) => (
                <div key={i} className="flex items-center gap-4 bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                  <div className="bg-blue-600 px-3 py-1 rounded font-black italic">R{pick.round}</div>
                  <div className="text-left">
                    <p className="text-sm font-bold">{pick.year} Pick</p>
                    <p className="text-[10px] text-slate-400 uppercase">From: {pick.original}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (e) {
    return <div>Error loading franchise data.</div>;
  }
}