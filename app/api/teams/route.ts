import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '../../../lib/googleSheets';

export async function GET() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Config',
  });

  const [header, ...rows] = result.data.values || [];

  const index = Object.fromEntries(
    header.map((h: string, i: number) => [h.toLowerCase(), i])
  );

  const teams = rows.map(row => ({
    name: row[index.team],
    short: row[index.teamshort],
    coach: row[index.coach],
    commissioner: row[index.commissioner] === 'TRUE',
  }));

  return NextResponse.json(teams);
}
