import { sheets, SHEET_ID } from '@/lib/googleSheets';

type RouteContext = {
  params: Promise<{ team: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const teamShort = resolvedParams.team.toUpperCase();

    // Fetch data from both sheets
    const [playersRes, picksRes] = await Promise.all([
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'Players!A:I' 
      }),
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'DraftPicks!A:C' // Corrected tab name
      })
    ]);

    const allPlayers = playersRes.data.values || [];
    const allPicks = picksRes.data.values || [];

    // Filter Players
    const roster = allPlayers
      .filter(row => row[0]?.toUpperCase() === teamShort)
      .map(row => ({
        name: `${row[1]} ${row[2]}`,
        // Col G (6), H (7), I (8)
        pos: (row[6] || row[7] || row[8] || '??').toUpperCase(),
        group: row[6] ? 'OFF' : row[7] ? 'DEF' : 'SPEC'
      }));

    // Filter Draft Picks
    const picks = allPicks
      .filter(row => row[2]?.toUpperCase() === teamShort)
      .map(row => ({
        year: row[0],
        round: row[1]
      }))
      .sort((a, b) => Number(a.year) - Number(b.year) || Number(a.round) - Number(b.round));

    return Response.json({ roster, picks });
  } catch (error: any) {
    console.error("Roster API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}