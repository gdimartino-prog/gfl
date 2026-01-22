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
  identity: string; // Add this field
}

export async function GET(req: NextRequest) {
  const teamShort = req.nextUrl.searchParams.get('team');

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
      const first = row[headerMap['first']]?.trim() || '';
      const last = row[headerMap['last']]?.trim() || '';
      const age = row[headerMap['age']]?.trim() || '';
      const offense = row[headerMap['offense']]?.trim() || '';
      const defense = row[headerMap['defense']]?.trim() || '';
      const special = row[headerMap['special']]?.trim() || '';

      const positionParts = [offense, defense, special].filter(Boolean);
      const position = positionParts.join('/');

      // Construct the identity string to match the Free Agents format
      // Format: first|last|age|offense|defense|special (lowercase)
      const identity = `${first}|${last}|${age}|${offense}|${defense}|${special}`.toLowerCase();

      return {
        team: row[headerMap['team']],
        originalTeam: row[headerMap['original team']],
        first,
        last,
        nickname: row[headerMap['nickname']] || '',
        age: age ? Number(age) : undefined,
        offense: offense || undefined,
        defense: defense || undefined,
        special: special || undefined,
        position,
        identity, // Return the identity to the frontend
      };
    });

    if (teamShort) {
      players = players.filter((p) => p.team === teamShort);
    }

    return NextResponse.json(players);
  } catch (err) {
    console.error('Failed to fetch players from Google Sheets', err);
    return NextResponse.json({ error: 'Failed to fetch players' }, { status: 500 });
  }
}