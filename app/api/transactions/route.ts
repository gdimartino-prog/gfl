import { db } from '@/lib/db';
import { players, teams } from '@/schema';
import { eq, and } from 'drizzle-orm';
import { logTransaction, getTransactions, updateTransactionStatus } from '@/lib/transactions';
import { getCoaches } from '@/lib/config';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { notifyTransaction } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
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
    logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_STATUS', `Transaction #${id} marked ${status}`);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
  try {
    const body = await req.json();
    const { type, identity, toTeam, details, fromTeam } = body;

    const leagueId = await getLeagueId();

    // Find player by identity
    const playerRows = await db.select({
      id: players.id,
      teamId: players.teamId,
      teamshort: teams.teamshort,
      teamName: teams.name,
    })
    .from(players)
    .leftJoin(teams, eq(players.teamId, teams.id))
    .where(and(eq(players.identity, identity), eq(players.leagueId, leagueId)))
    .limit(1);

    if (!playerRows[0]) return Response.json({ error: 'Player not found' }, { status: 404 });
    const player = playerRows[0];

    // Resolve new team ownership
    let newTeamId: number | null = player.teamId ?? null;
    const resolvedFromTeam = fromTeam || player.teamName || player.teamshort || '';

    if (type === 'ADD' || type === 'INJURY PICKUP') {
      const toTeamRow = await db.select({ id: teams.id })
        .from(teams)
        .where(and(eq(teams.leagueId, leagueId), eq(teams.name, toTeam)))
        .limit(1);
      // Also try by teamshort if name didn't match
      if (!toTeamRow[0]) {
        const byShort = await db.select({ id: teams.id })
          .from(teams)
          .where(and(eq(teams.leagueId, leagueId), eq(teams.teamshort, toTeam)))
          .limit(1);
        newTeamId = byShort[0]?.id ?? null;
      } else {
        newTeamId = toTeamRow[0].id;
      }
    } else if (type === 'DROP' || type === 'WAIVE') {
      newTeamId = null; // FA
    } else if (type === 'IR' || type === 'IR MOVE') {
      newTeamId = player.teamId ?? null; // stays on same team, isIR flag would be set
      await db.update(players).set({ isIR: true, touch_id: 'transaction' }).where(eq(players.id, player.id));
    }

    if (type !== 'IR' && type !== 'IR MOVE') {
      await db.update(players)
        .set({ teamId: newTeamId, touch_id: 'transaction' })
        .where(eq(players.id, player.id));
    }

    await logTransaction({ ...body, fromTeam: resolvedFromTeam, details, leagueId });
    logSystemEvent(body.owner || 'Unknown', toTeam || resolvedFromTeam, type, details || identity);

    // Send notification
    const directionKey = `${resolvedFromTeam} ➔ ${toTeam || 'Free Agent'}`;
    notifyTransaction({
      type,
      directions: { [directionKey]: [details || identity] },
    }).catch(e => console.error('Notify failed:', e));

    return Response.json({ success: true });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
