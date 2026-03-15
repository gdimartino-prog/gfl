import { getSheetsClient } from '@/lib/google-cloud';
import { parsePlayers } from '@/lib/sheetsPlayers';
import { findPlayerRowIndex } from '@/lib/playerLookup';
import { logTransaction, getTransactions, updateTransactionStatus } from '@/lib/transactions';
import { getCoaches } from '@/lib/config';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const leagueId = await getLeagueId();
    const data = await getTransactions(leagueId);
    return Response.json(data.map(t => ({
      id: t.id,
      timestamp: t.date
        ? new Date(t.date).toLocaleString('en-US', { timeZone: 'America/New_York' })
        : '',
      type: t.type || '',
      details: t.description || '',
      fromFull: t.fromTeam || '',
      toFull: t.toTeam || '',
      coach: t.owner || '',
      status: t.status || '',
      weekBack: t.weekBack?.toString() || '',
    })));
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const teamshort = (session.user as { id?: string }).id || '';
    const leagueId = await getLeagueId();
    const coaches = await getCoaches(leagueId);
    const coach = coaches.find(c => c.teamshort === teamshort);
    if (!coach?.isCommissioner) {
      return Response.json({ error: 'Commissioner access required' }, { status: 403 });
    }

    const { id, status } = await req.json();
    if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 });

    const validStatuses = ['Done', 'Pending', 'On Team'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 });
    }

    await updateTransactionStatus(Number(id), status);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { type, identity, toTeam, details, fromTeam } = body;

    const sheets = getSheetsClient();
    const SHEET_ID = process.env.GOOGLE_SHEET_ID;

    const [res, coaches] = await Promise.all([
      sheets.spreadsheets.values.get({ spreadsheetId: SHEET_ID, range: 'Players!A:CV' }),
      getCoaches()
    ]);

    const rows = res.data.values || [];
    const teamMap = new Map(coaches.map(c => [c.team.toLowerCase(), c.teamshort]));

    const player = parsePlayers(rows).find(p => p.identity.trim().toLowerCase() === identity.trim().toLowerCase());
    if (!player) return Response.json({ error: 'Player not found' }, { status: 404 });

    const rowIndex = findPlayerRowIndex(rows, player);
    let newTeamValue = player.team;

    if (type === 'ADD' || type === 'INJURY PICKUP') {
      const lookup = toTeam.trim().toLowerCase();
      newTeamValue = teamMap.get(lookup) || toTeam;
    } else if (type === 'DROP' || type === 'WAIVE') {
      newTeamValue = 'FA';
    } else if (type === 'IR' || type === 'IR MOVE') {
      newTeamValue = `${player.team}-IR`;
    }

    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `Players!A${rowIndex}`,
      valueInputOption: 'RAW',
      requestBody: { values: [[newTeamValue]] },
    });

    await logTransaction({ ...body, fromTeam: fromTeam || player.team, details });

    return Response.json({ success: true });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
