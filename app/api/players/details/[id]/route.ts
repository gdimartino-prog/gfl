import { NextRequest, NextResponse } from 'next/server';
import { getPlayersWithScouting } from '@/lib/players';
import { getLeagueId } from '@/lib/getLeagueId';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const targetId = decodeURIComponent(id).toLowerCase().trim();

    const leagueId = await getLeagueId();
    // 1. Fetch from Cache (Uses the centralized utility)
    const players = await getPlayersWithScouting(leagueId);
    
    // 2. Find the player in the cached array
    const matchedPlayer = players.find(
      (p) => p.identity.toLowerCase().trim() === targetId
    );

    if (!matchedPlayer) {
      return NextResponse.json({ error: 'Player Not Found' }, { status: 404 });
    }

    // 3. Extract Stats using your existing logic
    const s = matchedPlayer.scouting;
    const getVal = (key: string, fallback: string = '0') => {
      const val = s[key.toLowerCase().trim()];
      return (val !== undefined && val !== '') ? val : fallback;
    };

    // 4. FULL ORIGINAL MAPPING (No lines missed)
    return NextResponse.json({
      core: {
        team: matchedPlayer.team,
        first: matchedPlayer.first,
        last: matchedPlayer.last,
        age: matchedPlayer.age,
        pos: { 
          off: matchedPlayer.offense, 
          def: matchedPlayer.defense, 
          spec: matchedPlayer.special 
        },
        uniform: getVal('uniform', '00'),
      },
      ratings: {
        run_block: getVal('run block'), 
        pass_block: getVal('pass block'), 
        run_def: getVal('run defense'), 
        pass_def: getVal('pass defense'),
        pass_rush: getVal('pass rush'), 
        total_def: getVal('total defense'),
        breakaway: getVal('breakaway'), 
        short_yard: getVal('short yardage'),
        audible: getVal('audible'), 
        pressure: getVal('pressure'),
        receiving: getVal('receiving'), 
        durability: getVal('durability')
      },
      contract: { 
        salary: getVal('salary', 'N/A'), 
        length: getVal('years', 'N/A') 
      },
      stats: {
        games: getVal('games'),
        rushing: { 
          att: getVal('rush attempts'), yds: getVal('rush yards'), 
          long: getVal('rush long'), td: getVal('rush TD')
        },
        receiving: {
          receptions: getVal('receptions'),
          yds: getVal('receiving yards'),
          td: getVal('receiving TD'),
          long: getVal('receiving long')
        },
        passing: { 
          att: getVal('pass attempts'), comp: getVal('completions'), 
          yds: getVal('pass yards'), int: getVal('pass interceptions'), td: getVal('pass TD') 
        },
        defense: { 
          int: getVal('interceptions'), tackles: getVal('tackles'), 
          sacks: getVal('sacks'), stuffs: getVal('stuffs') 
        }
      }
    });

  } catch (error: unknown) {
    console.error("Scouting API Error:", error instanceof Error ? error.message : String(error));
    return NextResponse.json({ error: 'Server Error' }, { status: 500 });
  }
}