import { NextResponse } from 'next/server';
import { sheets, SHEET_ID } from '../../../lib/googleSheets';
import { parsePlayers } from '../../../lib/players';
import { executeFreeAgentMove } from '../../../lib/freeAgency';

export async function GET() {
  const result = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: 'Players',
  });

  const players = parsePlayers(result.data.values || []);
  const freeAgents = players.filter(p => p.team === 'FA');

  return NextResponse.json(freeAgents);
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { team, addIdentity, dropIdentity } = body;

    if (!team || !addIdentity || !dropIdentity) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    await executeFreeAgentMove(team, addIdentity, dropIdentity);

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Free agency error:', err);
    return NextResponse.json(
      { error: err.message },
      { status: 500 }
    );
  }
}