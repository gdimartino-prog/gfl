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
        range: 'DraftPicks!A:G' // Expanded range to A:G for the 7 columns
      })
    ]);

    const allPlayers = playersRes.data.values || [];
    const allPicks = picksRes.data.values || [];

  // 1. Process Players
  const roster = allPlayers
    .filter(row => row[0]?.toUpperCase() === teamShort)
    .map(row => {
      // Column indices (0-based):
      // G = 6 (Offense), H = 7 (Defense), I = 8 (Special)
      const offPos = (row[6] || "").trim();
      const defPos = (row[7] || "").trim();
      const specPos = (row[8] || "").trim();

      return {
        // Using row[2] and row[3] for First Last name
        name: `${row[2]} ${row[3]}`,
        // row[5] is Column F (Age)
        age: row[5] || '0',
        
        // Keep these new explicit fields so the frontend can see ALL positions
        offensePos: offPos,
        defensePos: defPos,
        specialPos: specPos,

        // This is the current logic for which unit they belong to in the UI
        group: row[6] ? 'OFF' : row[7] ? 'DEF' : 'SPEC',
        
        // Sets the display position based on the primary group
        pos: (row[6] || row[7] || row[8] || '??').toUpperCase()
      };
    });
    
    // 2. Process Draft Picks
    // Column Index Mapping: 0:Year, 1:Round, 3:Overall, 4:Original Team, 5:Current Owner
    const picks = allPicks
      .filter(row => row[4]?.toUpperCase() === teamShort) // Filter by CURRENT OWNER (Index 5)
      .map(row => ({
        year: row[0],
        round: row[1],
        overall: row[2],
        originalTeam: row[3],
        currentOwner: row[4]
      }))
      // Sort by Year first, then by Overall pick number
      .sort((a, b) => 
        Number(a.year) - Number(b.year) || 
        Number(a.overall) - Number(b.overall)
      );

    return Response.json({ roster, picks });
  } catch (error: any) {
    console.error("Roster API Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}