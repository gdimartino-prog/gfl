import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '@/lib/googleSheets';

export async function GET(
  req: NextRequest, 
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const targetId = decodeURIComponent(id).toLowerCase().trim();

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players', 
    });

    const rows: string[][] = response.data.values || [];
    const [headerRow, ...dataRows] = rows;

    // 1. Safe Header Mapping
    const headerMap = headerRow.reduce<Record<string, number>>((acc, col, idx) => {
      if (col) {
        // Convert to string first to prevent non-string header crashes
        acc[col.toString().toLowerCase().trim()] = idx;
      }
      return acc;
    }, {});

    // 2. Find the player
    const playerRow = dataRows.find((row) => {
      const first = (row[headerMap['first']] || '').trim();
      const last = (row[headerMap['last']] || '').trim();
      const age = (row[headerMap['age']] || '').trim();
      const offense = (row[headerMap['offense']] || '').trim();
      const defense = (row[headerMap['defense']] || '').trim();
      const special = (row[headerMap['special']] || '').trim();

      const identity = `${first}|${last}|${age}|${offense}|${defense}|${special}`.toLowerCase();
      return identity === targetId;
    });

    if (!playerRow) {
      console.log(`❌ Mismatch: Could not find ${targetId}`);
      return NextResponse.json({ error: 'Player Not Found' }, { status: 404 });
    }

    // 3. Safe Value Helper (Now handles strings only)
    const getVal = (colName: string, fallback: string = '0') => {
      const normalizedKey = colName.toString().toLowerCase().trim();
      const idx = headerMap[normalizedKey];
      
      if (idx !== undefined && playerRow[idx] !== undefined && playerRow[idx] !== '') {
        return playerRow[idx];
      }
      return fallback;
    };

    // 4. Build JSON using HEADER NAMES, not numbers
// 6. Build the JSON response with corrected Header Names
    return NextResponse.json({
      core: {
        team: getVal('team', 'FA'),
        first: getVal('first', 'Unknown'),
        last: getVal('last', 'Player'),
        age: getVal('age', '??'),
        pos: { 
          off: getVal('offense', ''), 
          def: getVal('defense', ''), 
          spec: getVal('special', '') 
        },
        uniform: getVal('uniform', '00'), // Or 'number'
      },
      ratings: {
        run_block: getVal('run block'), 
        pass_block: getVal('pass block'), 
        run_def: getVal('run defense'), 
        pass_def: getVal('pass defense'),
        pass_rush: getVal('pass rush'), 
        total_def: getVal('total defense'), // Matched your header!
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
          yds: getVal('receiving yards'), // Match your header (e.g., 'rec yards' or 'receiving yards')
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

  } catch (error: any) {
    console.error("API ERROR:", error);
    return NextResponse.json({ 
      error: 'Server Error', 
      details: error.message 
    }, { status: 500 });
  }
}