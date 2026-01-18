import { getStandings } from '@/lib/getStandings';
import { getSchedule } from '@/lib/getSchedule';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // 1. Fetch the static coach data and the raw schedule in parallel
    const [teams, schedule] = await Promise.all([
      getStandings(),
      getSchedule()
    ]);

    // 2. Map through each team and calculate their 2025 performance
    const standings = teams.map((team: any) => {
      let wins = 0;
      let losses = 0;
      let pf = 0;
      let pa = 0;

      // Filter for 2025 games where this team played and the game is 'Final'
      schedule.filter((g: any) => 
        g.year === "2025" && 
        g.status === "Final" && 
        (g.home === team.team || g.visitor === team.team || g.home === team.teamshort || g.visitor === team.teamshort)
      ).forEach((game: any) => {
        const hS = parseInt(game.hScore) || 0;
        const vS = parseInt(game.vScore) || 0;
        
        // Determine if they were Home or Visitor for this game
        const isHome = game.home === team.team || game.home === team.teamshort;
        
        if (isHome) {
          pf += hS; pa += vS;
          if (hS > vS) wins++; else if (vS > hS) losses++;
        } else {
          pf += vS; pa += hS;
          if (vS > hS) wins++; else if (hS > vS) losses++;
        }
      });

      return {
        ...team,
        wins,
        losses,
        pf,
        pa,
        diff: pf - pa
      };
    });

    // 3. Sort by wins (descending) then point differential
    standings.sort((a, b) => b.wins - a.wins || b.diff - a.diff);

    return NextResponse.json(standings);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to calculate standings' }, { status: 500 });
  }
}