import { getSchedule } from '@/lib/getSchedule';
import { getStandings } from '@/lib/getStandings'; // Using your lib as a lookup
import { getLeagueId } from '@/lib/getLeagueId';
import { NextRequest, NextResponse } from 'next/server';

interface Game {
  year: number | null;
  week: string;
  visitor: string | null;
  home: string | null;
  vScore: string | number | null;
  hScore: string | number | null;
  status: string;
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const teamCode = searchParams.get('team'); // e.g., "VV"

    const leagueId = await getLeagueId();

    // 1. Fetch both datasets in parallel
    const [allGames, allTeams] = await Promise.all([
      getSchedule(leagueId),
      getStandings(leagueId)
    ]);

    if (!teamCode) return NextResponse.json(allGames);

    // 2. Look up the City Name (Column A) using the Short Code (Column B)
    // Example: Find "Vico" where teamshort is "VV"
    const teamEntry = allTeams.find(
      (t) => t.teamshort?.toUpperCase() === teamCode.toUpperCase()
    );

    // 3. If no match found in Coaches sheet, fallback to the code itself
    const scheduleSearchName = teamEntry ? teamEntry.team : teamCode;
    const searchStr = scheduleSearchName.toUpperCase();

    // 4. Filter the schedule games
    const filtered = allGames.filter((g: Game) => {
      const home = (g.home || "").toUpperCase();
      const visitor = (g.visitor || "").toUpperCase();
      return home === searchStr || visitor === searchStr;
    });

    return NextResponse.json(filtered);
  } catch (error) {
    console.error("Dynamic Schedule API Error:", error);
    return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
  }
}