import { db } from '@/lib/db';
import { players, teams, transactions, rules, tradeBlock } from '@/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logTransaction, getTransactions, updateTransactionStatus } from '@/lib/transactions';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { notifyTransaction } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';

export async function GET() {
  const session = await auth();
  if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

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
      fee: t.fee ?? 0,
      season: t.season ?? null,
    })));
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await isAdmin() && !await isCommissioner()) {
      return Response.json({ error: 'Commissioner access required' }, { status: 403 });
    }

    const teamshort = (session.user as { id?: string }).id || '';
    const leagueId = await getLeagueId();

    const { id, status } = await req.json();
    if (!id || !status) return Response.json({ error: 'id and status required' }, { status: 400 });

    const validStatuses = ['Done', 'Pending', 'On Team'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 });
    }

    await updateTransactionStatus(Number(id), status);
    revalidateTag('transactions', 'max');
    logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_STATUS', `Transaction #${id} marked ${status}`, leagueId);
    return Response.json({ success: true });
  } catch (error: unknown) {
    return Response.json({ error: error instanceof Error ? error.message : 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return Response.json({ error: 'Unauthorized' }, { status: 401 });
    if (!await isAdmin() && !await isCommissioner()) {
      return Response.json({ error: 'Commissioner access required' }, { status: 403 });
    }

    const teamshort = (session.user as { id?: string }).id || '';
    const leagueId = await getLeagueId();

    const { id } = await req.json();
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    await db.delete(transactions).where(and(eq(transactions.id, Number(id)), eq(transactions.leagueId, leagueId)));
    revalidateTag('transactions', 'max');
    logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_DELETE', `Transaction #${id} deleted`, leagueId);
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

    const callerTeamshort = (session.user as { id?: string }).id || '';
    const privileged = await isAdmin() || await isCommissioner();

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

    // Ownership check: coaches can only transact their own players
    if (!privileged) {
      if ((type === 'ADD' || type === 'INJURY PICKUP') &&
          callerTeamshort.toLowerCase() !== (toTeam || '').toLowerCase()) {
        return Response.json({ error: 'Forbidden: you can only add players to your own team' }, { status: 403 });
      }
      if (['DROP', 'WAIVE', 'IR', 'IR MOVE'].includes(type) &&
          callerTeamshort.toLowerCase() !== (player.teamshort || '').toLowerCase()) {
        return Response.json({ error: 'Forbidden: you can only drop or IR your own players' }, { status: 403 });
      }
    }

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

    // Remove from trade block if present
    await db.delete(tradeBlock)
      .where(and(eq(tradeBlock.playerId, String(player.id)), eq(tradeBlock.leagueId, leagueId)));

    // Resolve current season from rules
    const seasonRule = await db.select({ value: rules.value }).from(rules)
      .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'cuts_year'), isNull(rules.year))).limit(1);
    const season = seasonRule[0] ? parseInt(seasonRule[0].value) || null : null;

    const actorName = session.user.name || (session.user as { id?: string }).id || 'Commissioner';
    await logTransaction({ ...body, owner: actorName, fromTeam: resolvedFromTeam, details, leagueId, season });
    revalidateTag('transactions', 'max');
    logSystemEvent(actorName, toTeam || resolvedFromTeam, type, details || identity, leagueId);

    // Send notification
    const directionKey = `${resolvedFromTeam} ➔ ${toTeam || 'Free Agent'}`;
    await notifyTransaction({
      type,
      directions: { [directionKey]: [details || identity] },
      leagueId,
    }).catch(e => console.error('Notify failed:', e));

    return Response.json({ success: true });
  } catch (err: unknown) {
    return Response.json({ error: err instanceof Error ? err.message : 'Internal Server Error' }, { status: 500 });
  }
}
