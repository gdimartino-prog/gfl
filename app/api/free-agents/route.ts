import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '../../../lib/googleSheets';
import { parsePlayers } from '../../../lib/players';

export async function GET() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Players',
  });

  const players = parsePlayers(result.data.values || []);
  const freeAgents = players.filter(p => p.team === 'FA');

  return NextResponse.json(freeAgents);
}
