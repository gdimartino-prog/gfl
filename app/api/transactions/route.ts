import { db } from '@/lib/db';
import { players, teams, transactions, rules, tradeBlock } from '@/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logTransaction, getTransactions, updateTransactionStatus, updateTransactionConditional } from '@/lib/transactions';
import { getLeagueId } from '@/lib/getLeagueId';
import { auth } from '@/auth';
import { isAdmin, isCommissioner } from '@/lib/auth';
import { notifyTransaction } from '@/lib/notify';
import { logSystemEvent } from '@/lib/db-helpers';
import { revalidateTag } from 'next/cache';
import { NextRequest } from 'next/server';
import { revertPickTransferByPickId } from '@/lib/draftPicks';

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
      pickIds: t.pickIds ?? null,
      conditionalDetails: t.conditionalDetails ?? null,
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

    const body = await req.json();
    const { id, status, conditionalDetails } = body;
    if (!id) return Response.json({ error: 'id required' }, { status: 400 });

    if (conditionalDetails !== undefined) {
      if (typeof conditionalDetails === 'string' && conditionalDetails.length > 2000) {
        return Response.json({ error: 'Conditional details too long (max 2000 characters)' }, { status: 400 });
      }
      await updateTransactionConditional(Number(id), conditionalDetails || null, leagueId);
      revalidateTag('transactions', 'max');
      await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_CONDITIONAL', `Transaction #${id} conditional details updated`, leagueId);
      return Response.json({ success: true });
    }

    if (!status) return Response.json({ error: 'status or conditionalDetails required' }, { status: 400 });
    const validStatuses = ['Done', 'Pending', 'On Team'];
    if (!validStatuses.includes(status)) {
      return Response.json({ error: 'Invalid status value' }, { status: 400 });
    }

    await updateTransactionStatus(Number(id), status, leagueId);
    revalidateTag('transactions', 'max');
    await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_STATUS', `Transaction #${id} marked ${status}`, leagueId);
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

    // Revert any pick transfers associated with this transaction
    const txRow = await db.select({ pickIds: transactions.pickIds })
      .from(transactions)
      .where(and(eq(transactions.id, Number(id)), eq(transactions.leagueId, leagueId)))
      .limit(1);
    const pickIds = txRow[0]?.pickIds;
    if (pickIds?.length) {
      await Promise.all(pickIds.map(pickId => revertPickTransferByPickId(leagueId, pickId)));
      revalidateTag('draft-picks', 'max');
    }

    await db.delete(transactions).where(and(eq(transactions.id, Number(id)), eq(transactions.leagueId, leagueId)));
    revalidateTag('transactions', 'max');
    await logSystemEvent(session.user.name || 'Commissioner', teamshort, 'TRANSACTION_DELETE', `Transaction #${id} deleted${pickIds?.length ? ` (reverted ${pickIds.length} pick transfer(s))` : ''}`, leagueId);
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

    // CONDITIONAL TRADE is a record-keeping entry only — no player moves, no
    // team-id update, no trade-block cleanup. The standard player-lookup path
    // 404s for this type because the request body has no `identity`. Branch
    // early so the audit/transaction row gets written.
    if (type === 'CONDITIONAL TRADE') {
      if (!details || typeof details !== 'string' || !details.trim()) {
        return Response.json({ error: 'Conditional trade details required' }, { status: 400 });
      }
      if (details.length > 2000) {
        return Response.json({ error: 'Conditional trade details too long (max 2000 characters)' }, { status: 400 });
      }
      if (!fromTeam || !toTeam) {
        return Response.json({ error: 'fromTeam and toTeam required' }, { status: 400 });
      }
      if (typeof fromTeam !== 'string' || typeof toTeam !== 'string' || fromTeam.length > 100 || toTeam.length > 100) {
        return Response.json({ error: 'fromTeam/toTeam must be strings ≤ 100 chars' }, { status: 400 });
      }
      const seasonRule = await db.select({ value: rules.value }).from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'cuts_year'), isNull(rules.year))).limit(1);
      const seasonNum = seasonRule[0] ? parseInt(seasonRule[0].value) : NaN;
      const season = Number.isFinite(seasonNum) ? seasonNum : undefined;
      const actorName = session.user.name || callerTeamshort || 'Commissioner';
      await logTransaction({ type, details, fromTeam, toTeam, coach: actorName, leagueId, season });
      revalidateTag('transactions', 'max');
      await logSystemEvent(actorName, fromTeam, 'CONDITIONAL_TRADE', `${fromTeam} → ${toTeam}: ${details.slice(0, 240)}`, leagueId);
      // Send notification so coaches see the conditional in their inbox /
      // WhatsApp the same way they'd see a regular trade. The details string
      // (capped at 2000 chars above) is the asset/condition description.
      const directionKey = `${fromTeam} ➔ ${toTeam}`;
      await notifyTransaction({
        type,
        directions: { [directionKey]: [details] },
        leagueId,
      }).catch(e => console.error('Conditional trade notify failed:', e));
      return Response.json({ success: true });
    }

    // Find player by identity (required for all non-CONDITIONAL types)
    if (!identity) {
      return Response.json({ error: 'identity required' }, { status: 400 });
    }
    const playerRows = await db.select({
      id: players.id,
      teamId: players.teamId,
      teamshort: teams.teamshort,
      teamName: teams.name,
      durability: players.durability,
      isIR: players.isIR,
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
      // Player must be a free agent — prevents stealing a rostered player
      if ((type === 'ADD' || type === 'INJURY PICKUP') && player.teamId !== null) {
        return Response.json({ error: 'Forbidden: player is already on a roster' }, { status: 403 });
      }
      if (['DROP', 'WAIVE', 'IR', 'IR MOVE'].includes(type) &&
          callerTeamshort.toLowerCase() !== (player.teamshort || '').toLowerCase()) {
        return Response.json({ error: 'Forbidden: you can only drop or IR your own players' }, { status: 403 });
      }
    }

    // IR restriction: during draft season, only players who haven't played
    // any NFL games (durability = 0) may be placed on IR.
    if (type === 'IR' || type === 'IR MOVE') {
      const nflWeekRow = await db.select({ value: rules.value })
        .from(rules)
        .where(and(eq(rules.leagueId, leagueId), eq(rules.rule, 'current_nfl_week'), isNull(rules.year)))
        .limit(1);
      const currentNflWeek = parseInt(nflWeekRow[0]?.value ?? '0') || 0;
      if (currentNflWeek === 0 && Number(player.durability ?? 0) !== 0) {
        return Response.json({
          error: 'During the draft, only players who have not played any NFL games (durability 0) can be placed on IR.',
        }, { status: 400 });
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
      if (player.isIR) {
        await db.update(players).set({ isIR: false, touch_id: 'transaction', touch_dt: new Date() })
          .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
      }
    } else if (type === 'IR' || type === 'IR MOVE') {
      newTeamId = player.teamId ?? null; // stays on same team, isIR flag would be set
      await db.update(players).set({ isIR: true, touch_id: 'transaction', touch_dt: new Date() })
        .where(and(eq(players.id, player.id), eq(players.leagueId, leagueId)));
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
    await logTransaction({ ...body, coach: actorName, fromTeam: resolvedFromTeam, details, leagueId, season });
    revalidateTag('transactions', 'max');
    revalidateTag('players', 'max');
    await logSystemEvent(actorName, resolvedFromTeam, type, details || identity, leagueId);

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
