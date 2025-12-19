import { NextRequest, NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '../../../lib/googleSheets';

interface Player {
  team: string;
  originalTeam: string;
  first: string;
  last: string;
  nickname?: string;
  age?: number;
  offense?: string;
  defense?: string;
  special?: string;
  position: string;
}

export async function GET(req: NextRequest) {
  const teamShort = req.nextUrl.searchParams.get('team'); // optional filter

  try {
    const result = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: 'Players',
    });

    const rows: string[][] = result.data.values || [];
    const [headerRow, ...dataRows] = rows;

    const headerMap = headerRow.reduce<Record<string, number>>((acc, col, idx) => {
      acc[col] = idx;
      return acc;
    }, {});

    let players: Player[] = dataRows.map((row) => {
      const offense = row[headerMap['offense']]?.trim();
      const defense = row[headerMap['defense']]?.trim();
      const special = row[headerMap['special']]?.trim();
      const positionParts = [offense, defense, special].filter(Boolean);
      const position = positionParts.join('/');

      return {
        team: row[headerMap['team']],
        originalTeam: row[headerMap['original team']],
        first: row[headerMap['first']],
        last: row[headerMap['last']],
        nickname: row[headerMap['nickname']] || '',
        age: row[headerMap['age']] ? Number(row[headerMap['age']]) : undefined,
        offense: offense || undefined,
        defense: defense || undefined,
        special: special || undefined,
        position,
      };
    });

    // Apply team filter if requested
    if (teamShort) {
      players = players.filter((p) => p.team === teamShort);
    }

    return NextResponse.json(players);
  } catch (err) {
    console.error('Failed to fetch players from Google Sheets', err);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}
