import { sheets, SHEET_ID } from '@/lib/googleSheets';
import { parsePlayers } from '@/lib/players'; // Use your master parser

type RouteContext = {
  params: Promise<{ team: string }>;
};

export async function GET(req: Request, { params }: RouteContext) {
  try {
    const resolvedParams = await params;
    const teamShort = resolvedParams.team.toUpperCase();

    // 1. Fetch data with sufficient range for header mapping
    const [playersRes, picksRes] = await Promise.all([
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'Players!A:CV' // Ensure range includes all identity columns
      }),
      sheets.spreadsheets.values.get({ 
        spreadsheetId: SHEET_ID, 
        range: 'DraftPicks!A:G' 
      })
    ]);

    const rawPlayers = playersRes.data.values || [];
    const allPicks = picksRes.data.values || [];

    // 2. Use parsePlayers to get stable identities & full names
    const parsedPlayers = parsePlayers(rawPlayers);

    // 3. Filter and Format for your specific Roster UI
    const roster = parsedPlayers
      .filter(p => p.team?.toUpperCase() === teamShort)
      .map(p => ({
        identity: p.identity, // CRITICAL: Fixes the 404 error
        name: `${p.first} ${p.last}`, // Preserves "Austin III"
        age: p.age.toString(),
        offensePos: p.offense,
        defensePos: p.defense,
        specialPos: p.special,
        // UI Logic for grouping
        group: p.offense ? 'OFF' : p.defense ? 'DEF' : 'SPEC',
        pos: (p.offense || p.defense || p.special || '??').toUpperCase()
      }));
    
    // 4. Process Draft Picks
    const picks = allPicks
      .filter(row => row[4]?.toUpperCase() === teamShort)
      .map(row => ({
        year: row[0],
        round: row[1],
        overall: row[2],
        originalTeam: row[3],
        currentOwner: row[4]
      }))
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